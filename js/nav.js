// ============================================================
// NAVIGATION
// ============================================================

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Désactiver tous les boutons nav (bottom + top)
  document.querySelectorAll('.bnav-btn, .nav-btn').forEach(b => b.classList.remove('active'));

  const map = {
    markets:     'page-markets',
    leaderboard: 'page-leaderboard',
    profile:     'page-profile',
    create:      'page-create',
  };

  document.getElementById(map[page])?.classList.add('active');

  // Activer dans la bottom nav
  document.getElementById(`nav-${page}`)?.classList.add('active');
  // Activer dans la top nav desktop
  document.getElementById(`nav-${page}-top`)?.classList.add('active');

  if (page === 'leaderboard') renderLeaderboard();
  if (page === 'profile')     renderProfile();
  if (page === 'markets')     renderMarkets();
  if (page === 'create')      initMentionEditor();
  window.scrollTo(0, 0);
}
