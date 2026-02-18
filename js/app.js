// ============================================================
// APP INIT + BOOT
// ============================================================

function initApp() {
  updateHeader();
  initPush();
  initMentionEditor();
  const dateInput = document.getElementById('new-date');
  const future = new Date(Date.now() + 7 * 86400000);
  dateInput.min   = new Date().toISOString().split('T')[0];
  dateInput.value = future.toISOString().split('T')[0];
  renderMarkets();
}

// Close modal on Escape / backdrop click
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('market-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('market-modal')) closeModal();
  });
});

async function boot() {
  const loginCard = document.querySelector('.login-card');
  loginCard.innerHTML = `
    <div class="login-logo">⚡ FriendMarket</div>
    <div class="login-sub" style="margin-bottom:24px">Connexion à la base de données…</div>
    <div style="color:var(--muted);font-size:0.85rem">⏳ Chargement en cours</div>
  `;

  try {
    initSupabase();
    await dbLoadAll();

    // Auto-login si session sauvegardée
    const savedUser = localStorage.getItem(LS_USER_KEY);
    if (savedUser && state.users[savedUser]) {
      currentUser = savedUser;
      enterApp();
      return;
    }

    loginCard.innerHTML = `
      <div class="login-logo">⚡ FriendMarket</div>
      <div class="login-sub">Marchés prédictifs virtuels entre amis</div>
      <select class="login-select" id="login-select">
        <option value="">— Choisir un profil existant —</option>
      </select>
      <div style="color:var(--muted);font-size:0.75rem;margin-bottom:10px;">ou créer un nouveau compte</div>
      <input type="text" class="login-input" id="login-name" placeholder="Entre ton prénom" maxlength="20">
      <button class="btn-primary" onclick="loginUser()">Entrer dans l'arène ↗</button>
    `;
    initLogin();
  } catch(e) {
    console.error(e);
    loginCard.innerHTML = `
      <div class="login-logo">⚡ FriendMarket</div>
      <div style="color:var(--no);margin-top:16px;font-size:0.9rem">
        ❌ Impossible de se connecter à Supabase.<br><br>
        Vérifie tes clés <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code> dans <code>js/config.js</code>.
      </div>
    `;
  }
}

boot();
