// ============================================================
// Supabase Edge Function — send-notification
// Envoie des Web Push Notifications avec VAPID
//
// Secrets requis (supabase secrets set):
//   VAPID_PUBLIC_KEY   = clé publique VAPID (base64url, point non-compressé 65 octets)
//   VAPID_PRIVATE_KEY  = clé privée VAPID (base64url, scalaire 32 octets)
//   VAPID_SUBJECT      = mailto:votre@email.com
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT        = Deno.env.get('VAPID_SUBJECT')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── Base64url helpers ─────────────────────────────────────────

function base64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64  = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

// ── VAPID signing — JWK format (fiable, sans PKCS8 manuel) ───

let _signingKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (_signingKey) return _signingKey;

  // VAPID_PUBLIC_KEY = point non-compressé P-256 : 04 || x(32) || y(32)
  const pub = base64urlDecode(VAPID_PUBLIC_KEY);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(`VAPID_PUBLIC_KEY invalide : attendu 65 octets non-compressés, reçu ${pub.length} octets`);
  }

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    d: VAPID_PRIVATE_KEY,                        // scalaire privé base64url
    x: base64urlEncode(pub.slice(1, 33)),         // coordonnée x
    y: base64urlEncode(pub.slice(33, 65)),         // coordonnée y
    key_ops: ['sign'],
    ext: true,
  };

  _signingKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  );

  return _signingKey;
}

async function makeVapidHeader(endpoint: string): Promise<string> {
  const url    = new URL(endpoint);
  const origin = `${url.protocol}//${url.host}`;
  const exp    = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header  = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({ aud: origin, exp, sub: VAPID_SUBJECT })));

  const signingKey = await getSigningKey();
  const toSign     = new TextEncoder().encode(`${header}.${payload}`);
  const signature  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, toSign);

  const jwt = `${header}.${payload}.${base64urlEncode(signature)}`;
  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
}

// ── RFC 8291 payload encryption ───────────────────────────────

async function encryptPayload(p256dh: string, auth: string, plaintext: string): Promise<Uint8Array> {
  const encoder    = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);

  const clientPublicKey = await crypto.subtle.importKey(
    'raw', base64urlDecode(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' },
    true, []
  );

  const authSecret = base64urlDecode(auth);

  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits']
  );

  const ephemeralPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
  );

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );

  const salt      = crypto.getRandomValues(new Uint8Array(16));
  const ecdhBytes = new Uint8Array(sharedBits);

  // IKM : HKDF-SHA256(salt=authSecret, IKM=ecdhSecret, info="WebPush: info\0"+recvPub+asPub)
  const hkdfKey = await crypto.subtle.importKey('raw', ecdhBytes, 'HKDF', false, ['deriveBits']);
  const infoIkm = concat(
    encoder.encode('WebPush: info\x00'),
    new Uint8Array(await crypto.subtle.exportKey('raw', clientPublicKey)),
    ephemeralPublicKeyRaw,
  );
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: infoIkm },
    hkdfKey,
    256
  );

  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  // CEK et Nonce : HKDF-SHA256(salt=salt, IKM=ikm, info=...)
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: aes128gcm\x00') },
    ikmKey,
    128
  );
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: nonce\x00') },
    ikmKey,
    96
  );

  // Chiffrement AES-128-GCM
  const cekKey = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const record  = concat(plainBytes, new Uint8Array([0x02])); // delimiter RFC 8291
  const encryptedContent = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cekKey, record)
  );

  // En-tête RFC 8291 : salt(16) + rs(4) + keyid_len(1) + keyid(65)
  const rs     = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096 big-endian
  const header = concat(salt, rs, new Uint8Array([ephemeralPublicKeyRaw.length]), ephemeralPublicKeyRaw);

  return concat(header, encryptedContent);
}

// ── Envoi d'une notification ──────────────────────────────────

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<number> {
  const encrypted     = await encryptPayload(p256dh, auth, payload);
  const authorization = await makeVapidHeader(endpoint);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type':     'application/octet-stream',
      'TTL':              '86400',
    },
    body: encrypted,
  });
  return res.status;
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: { title: string; body: string; url?: string; recipients: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { title, body: msgBody, url = '/', recipients } = body;
  if (!title || !msgBody || !recipients?.length) {
    return new Response('Missing fields', { status: 400 });
  }

  // Vérification secrets
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error('[Push] Secrets VAPID manquants !');
    return new Response('VAPID secrets not configured', { status: 500, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_name')
    .in('user_name', recipients);

  if (error) {
    console.error('[Push] DB error:', error);
    return new Response('DB error', { status: 500, headers: corsHeaders });
  }

  if (!subs || subs.length === 0) {
    console.log(`[Push] Aucune subscription pour: ${recipients.join(', ')}`);
    return new Response(
      JSON.stringify({ sent: 0, note: 'no subscriptions found' }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  console.log(`[Push] Envoi à ${subs.length} subscription(s) pour: ${recipients.join(', ')}`);

  const payload          = JSON.stringify({ title, body: msgBody, url });
  const expiredEndpoints: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        const status = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload);
        if (status === 201 || status === 200) {
          sent++;
          console.log(`[Push] OK → ${sub.user_name} (${status})`);
        } else if (status === 404 || status === 410) {
          expiredEndpoints.push(sub.endpoint);
          console.log(`[Push] Subscription expirée → ${sub.user_name} (${status})`);
        } else {
          console.warn(`[Push] Échec → ${sub.user_name} (${status})`);
        }
      } catch (err) {
        console.error(`[Push] Erreur pour ${sub.user_name}:`, err);
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
    console.log(`[Push] ${expiredEndpoints.length} subscription(s) expirée(s) supprimée(s)`);
  }

  return new Response(
    JSON.stringify({ sent, expired: expiredEndpoints.length, total: subs.length }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
});
