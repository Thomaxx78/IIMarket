// ============================================================
// UI HELPERS — Toast, render utils
// ============================================================

let toastTimer;

function showToast(msg, type = 'success') {
  document.querySelectorAll('.toast').forEach(e => e.remove());
  clearTimeout(toastTimer);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  toastTimer = setTimeout(() => el.remove(), 4000);
}

function renderQuestion(q) {
  return q.replace(/@(\w+)/g, (_, name) =>
    `<span style="background:rgba(124,58,237,0.2);color:var(--accent);border-radius:5px;padding:1px 5px;font-weight:700;">@${name}</span>`
  );
}

function updateHeader() {
  const coins = state.users[currentUser]?.coins ?? 0;
  document.getElementById('wallet-display').textContent = `${Math.round(coins)} 🪙`;
  document.getElementById('user-display').textContent = currentUser;
}
