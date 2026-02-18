// ============================================================
// Supabase Edge Function — send-notification
// Envoie des Web Push Notifications avec VAPID
//
// Secrets requis (supabase secrets set):
//   VAPID_PUBLIC_KEY   = votre clé publique VAPID (base64url)
//   VAPID_PRIVATE_KEY  = votre clé privée VAPID (base64url)
//   VAPID_SUBJECT      = mailto:votre@email.com
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ── VAPID signing helpers ─────────────────────────────────────

function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64  = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function importVapidPrivateKey(base64urlKey: string): Promise<CryptoKey> {
  const raw = base64urlDecode(base64urlKey);
  return crypto.subtle.importKey(
    'raw', raw,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
}

async function importVapidSigningKey(base64urlKey: string): Promise<CryptoKey> {
  // For VAPID JWT signing we need ECDSA P-256 key
  // The VAPID private key is a raw 32-byte P-256 scalar
  const raw = base64urlDecode(base64urlKey);

  // Import as ECDSA signing key via PKCS8 wrapper
  // Build a minimal PKCS8 DER for P-256 raw private key
  const pkcs8 = buildPkcs8(raw);
  return crypto.subtle.importKey(
    'pkcs8', pkcs8,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
}

function buildPkcs8(rawPrivate: Uint8Array): ArrayBuffer {
  // PKCS#8 wrapper for P-256 raw private key (RFC 5915 / RFC 5480)
  const ecPrivateKey = concat([
    new Uint8Array([0x30, 0x77]),   // SEQUENCE
    new Uint8Array([0x02, 0x01, 0x01]),  // version = 1
    new Uint8Array([0x04, 0x20]), rawPrivate,  // privateKey OCTET STRING
    new Uint8Array([0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]), // oid P-256
  ]);

  const algorithmIdentifier = new Uint8Array([
    0x30, 0x13,  // SEQUENCE
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,  // OID ecPublicKey
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
  ]);

  // Simpler: use the SEC1 DER format embedded in PKCS8
  // Actually, let's build the correct PKCS8 manually
  const privateKeyInfo = buildDerPkcs8(rawPrivate);
  return privateKeyInfo;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

function buildDerPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // Minimal PKCS8 DER for P-256
  // From RFC 5958 / SEC 1
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  const algorithmOid = new Uint8Array([
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
  ]);

  // ECPrivateKey (SEC1)
  const ecPrivKeyInner = concat(
    new Uint8Array([0x02, 0x01, 0x01]),  // version
    new Uint8Array([0x04, 0x20]), rawKey, // privateKey
  );
  const ecPrivKey = tlv(0x30, ecPrivKeyInner);

  const privateKeyOctet = tlv(0x04, ecPrivKey);

  const seq = tlv(0x30, concat(version, algorithmOid, privateKeyOctet));
  return seq.buffer;
}

function tlv(tag: number, value: Uint8Array): Uint8Array {
  const len = value.length;
  let lenBytes: Uint8Array;
  if (len < 0x80) {
    lenBytes = new Uint8Array([len]);
  } else if (len < 0x100) {
    lenBytes = new Uint8Array([0x81, len]);
  } else {
    lenBytes = new Uint8Array([0x82, len >> 8, len & 0xff]);
  }
  return concat(new Uint8Array([tag]), lenBytes, value);
}

async function makeVapidHeader(endpoint: string): Promise<string> {
  const url    = new URL(endpoint);
  const origin = `${url.protocol}//${url.host}`;
  const exp    = Math.floor(Date.now() / 1000) + 12 * 3600; // 12h

  const header  = base64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64urlEncode(new TextEncoder().encode(JSON.stringify({ aud: origin, exp, sub: VAPID_SUBJECT })));

  const signingKey = await importVapidSigningKey(VAPID_PRIVATE_KEY);
  const toSign     = new TextEncoder().encode(`${header}.${payload}`);
  const signature  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, toSign);

  const jwt = `${header}.${payload}.${base64urlEncode(signature)}`;
  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
}

// ── Send one push notification ────────────────────────────────

async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
): Promise<number> {
  // Encrypt the payload using Web Push ECDH + AES-128-GCM (RFC 8291)
  const encrypted = await encryptPayload(p256dh, auth, payload);
  const authorization = await makeVapidHeader(endpoint);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: encrypted,
  });
  return res.status;
}

// ── RFC 8291 payload encryption ───────────────────────────────

async function encryptPayload(p256dh: string, auth: string, plaintext: string): Promise<Uint8Array> {
  const encoder    = new TextEncoder();
  const plainBytes = encoder.encode(plaintext);

  // Client public key (receiver)
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', base64urlDecode(p256dh),
    { name: 'ECDH', namedCurve: 'P-256' },
    true, []
  );

  // Auth secret
  const authSecret = base64urlDecode(auth);

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits']
  );

  // Export ephemeral public key
  const ephemeralPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey)
  );

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // HKDF to derive Content Encryption Key and Nonce (RFC 8291)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK from HKDF-Extract(auth_secret, ECDH_secret)
  const ecdhSecret = new Uint8Array(sharedBits);

  const hkdfKey = await crypto.subtle.importKey('raw', ecdhSecret, 'HKDF', false, ['deriveBits']);

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" + clientKey + ephemeralKey, 32)
  const infoIkm = concat(
    encoder.encode('WebPush: info\x00'),
    new Uint8Array(await crypto.subtle.exportKey('raw', clientPublicKey)),
    ephemeralPublicKeyRaw,
  );

  const authSecretKey = await crypto.subtle.importKey('raw', authSecret, 'HKDF', false, ['deriveBits']);
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: infoIkm },
    hkdfKey,
    256
  );

  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\x00');
  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    ikmKey,
    128
  );

  // Nonce = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonceInfo = encoder.encode('Content-Encoding: nonce\x00');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    ikmKey,
    96
  );

  // Encrypt
  const cekKey = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt']);
  const record = concat(plainBytes, new Uint8Array([0x02])); // padding delimiter
  const encryptedContent = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cekKey, record)
  );

  // Build RFC 8291 header: salt(16) + rs(4=big-endian 4096) + keyid_len(1) + keyid(65)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096
  const header = concat(salt, rs, new Uint8Array([ephemeralPublicKeyRaw.length]), ephemeralPublicKeyRaw);

  return concat(header, encryptedContent);
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch subscriptions for target users
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_name', recipients);

  if (error) {
    console.error('DB error:', error);
    return new Response('DB error', { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const payload = JSON.stringify({ title, body: msgBody, url });
  const expiredEndpoints: string[] = [];
  let sent = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      const status = await sendPush(sub.endpoint, sub.p256dh, sub.auth, payload);
      if (status === 201 || status === 200) {
        sent++;
      } else if (status === 404 || status === 410) {
        expiredEndpoints.push(sub.endpoint);
      } else {
        console.warn(`Push failed for endpoint with status ${status}`);
      }
    })
  );

  // Cleanup expired subscriptions
  if (expiredEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', expiredEndpoints);
  }

  return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
});
