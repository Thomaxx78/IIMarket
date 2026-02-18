// ============================================================
// NAVIGATION
// ============================================================

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const map    = { markets: 'page-markets', leaderboard: 'page-leaderboard', profile: 'page-profile', create: 'page-create' };
  const navMap = { markets: 'nav-markets',  leaderboard: 'nav-leaderboard',  profile: 'nav-profile',  create: 'nav-create' };

  document.getElementById(map[page])?.classList.add('active');
  if (navMap[page]) document.getElementById(navMap[page])?.classList.add('active');

  if (page === 'leaderboard') renderLeaderboard();
  if (page === 'profile')     renderProfile();
  if (page === 'markets')     renderMarkets();
  if (page === 'create')      initMentionEditor();
  window.scrollTo(0, 0);
}
