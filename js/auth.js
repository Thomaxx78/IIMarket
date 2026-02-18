// ============================================================
// AUTH — Login persistant via localStorage
// ============================================================

const LS_USER_KEY = 'fm_user';

function initLogin() {
  const sel = document.getElementById('login-select');
  sel.innerHTML = '<option value="">— Choisir un profil existant —</option>';
  Object.entries(state.users)
    .sort((a, b) => b[1].coins - a[1].coins)
    .forEach(([name, u]) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${name} — ${Math.round(u.coins)} 🪙`;
      sel.appendChild(opt);
    });
}

async function loginUser() {
  const sel  = document.getElementById('login-select').value;
  const raw  = document.getElementById('login-name').value.trim();
  const name = sel || raw;
  if (!name) return showToast('Choisis ou entre un prénom !', 'error');

  try {
    if (!state.users[name]) {
      await dbUpsertUser(name, INITIAL_COINS);
      await dbLoadAll();
      showToast(`Bienvenue ${name} ! Tu débutes avec 1000 🪙`, 'success');
    }

    currentUser = name;
    localStorage.setItem(LS_USER_KEY, name);
    enterApp();
  } catch(e) {
    console.error(e);
    showToast('Erreur de connexion à la base de données.', 'error');
  }
}

function logoutUser() {
  localStorage.removeItem(LS_USER_KEY);
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-markets').classList.add('active');
  boot();
}

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  initApp();
  subscribeRealtime();
}
