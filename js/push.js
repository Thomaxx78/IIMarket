// ============================================================
// PUSH NOTIFICATIONS — Web Push (iOS 16.4+ & Android)
// ============================================================

// Affiché une seule fois pour guider les users iOS
function showIosBanner() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInStandalone = window.navigator.standalone;
  if (!isIos || isInStandalone) return;

  const banner = document.createElement('div');
  banner.id = 'ios-install-banner';
  banner.style.cssText = `
    position:fixed; bottom:0; left:0; right:0; z-index:9999;
    background:var(--surface2); border-top:1px solid var(--accent);
    padding:16px 20px; display:flex; align-items:center; gap:12px;
    font-size:0.85rem; animation:slideUp 0.3s ease;
  `;
  banner.innerHTML = `
    <span style="font-size:1.5rem">📲</span>
    <div>
      <div style="font-weight:700;color:var(--text)">Active les notifications</div>
      <div style="color:var(--muted)">Appuie sur <b>Partager</b> puis <b>Sur l'écran d'accueil</b></div>
    </div>
    <button onclick="this.parentElement.remove()" style="
      margin-left:auto; background:none; border:none;
      color:var(--muted); font-size:1.2rem; cursor:pointer; padding:4px 8px;
    ">✕</button>
  `;
  document.body.appendChild(banner);
}

// Convertit la clé VAPID base64url → Uint8Array (requis par pushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Enregistre (ou récupère) la push subscription et la sauvegarde en DB
async function subscribeToPush() {
  if (!('PushManager' in window)) return null;

  const reg = await navigator.serviceWorker.ready;
  let sub   = await reg.pushManager.getSubscription();

  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.warn('[Push] Subscription failed:', err);
      return null;
    }
  }

  await savePushSubscription(sub);
  return sub;
}

async function savePushSubscription(sub) {
  const json = sub.toJSON();
  const { error } = await sb.from('push_subscriptions').upsert(
    {
      user_name: currentUser,
      endpoint:  json.endpoint,
      p256dh:    json.keys.p256dh,
      auth:      json.keys.auth,
    },
    { onConflict: 'endpoint' }
  );
  if (error) console.error('[Push] Save subscription error:', error);
}

// Point d'entrée appelé après login
async function initPush() {
  if (!('serviceWorker' in navigator)) return;

  // Enregistre le service worker
  try {
    await navigator.serviceWorker.register('/service-worker.js');
  } catch (err) {
    console.warn('[Push] SW registration failed:', err);
    return;
  }

  // iOS : montrer le banner si pas encore en standalone
  showIosBanner();

  // Demander la permission si pas encore décidé
  if (Notification.permission === 'default') {
    // Délai de 2s pour ne pas spammer l'utilisateur dès l'ouverture
    setTimeout(async () => {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') await subscribeToPush();
    }, 2000);
  } else if (Notification.permission === 'granted') {
    await subscribeToPush();
  }
}

// ── Envoi d'une notification via Edge Function ───────────────

/**
 * @param {string} title
 * @param {string} body
 * @param {string[]} recipients  — noms des users à notifier
 * @param {string} [url]         — url à ouvrir au clic
 */
async function sendPushNotification(title, body, recipients, url = '/') {
  if (!recipients || recipients.length === 0) return;

  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ title, body, url, recipients }),
    });
  } catch (err) {
    console.warn('[Push] sendPushNotification error:', err);
  }
}
