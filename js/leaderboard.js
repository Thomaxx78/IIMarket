// ============================================================
// LEADERBOARD
// ============================================================

function renderLeaderboard() {
  const resolved = state.markets.filter(m => m.resolved);

  const data = Object.entries(state.users).map(([name, u]) => {
    const txs = state.transactions.filter(t => t.user === name);
    const participated = new Set(txs.map(t => t.marketId)).size;

    let pnl = 0, marketsWon = 0, marketsLost = 0;
    resolved.forEach(m => {
      const myTx = txs.filter(t => t.marketId === m.id);
      if (!myTx.length) return;
      const spent = myTx.reduce((a, t) => a + t.coins, 0);
      const wonShares = myTx.filter(t => t.side === m.resolution).reduce((a, t) => a + t.shares, 0);
      pnl += wonShares - spent;
      if (wonShares > 0) marketsWon++; else marketsLost++;
    });

    return { name, coins: u.coins, pnl, participated, marketsWon, marketsLost };
  }).sort((a, b) => b.coins - a.coins);

  const icons = ['🥇', '🥈', '🥉'];
  const rankClass = (i) => i === 0 ? 'gold-r' : i === 1 ? 'silver-r' : i === 2 ? 'bronze-r' : '';

  document.getElementById('leaderboard-list').innerHTML = data.map((u, i) => {
    const pnlColor = u.pnl >= 0 ? 'var(--yes)' : 'var(--no)';
    const winRate = (u.marketsWon + u.marketsLost) > 0
      ? Math.round(u.marketsWon / (u.marketsWon + u.marketsLost) * 100) + '%'
      : '—';
    return `<div class="lb-row ${u.name === currentUser ? 'me' : ''}">
      <div class="lb-rank ${rankClass(i)}">${icons[i] || i+1}</div>
      <div class="lb-name">${u.name}${u.name === currentUser ? ' 👈' : ''}</div>
      <div class="lb-stats">
        <div class="lb-stat">
          <div class="val">${Math.round(u.coins)} 🪙</div>
          <div class="lbl">Solde</div>
        </div>
        <div class="lb-stat">
          <div class="val" style="color:${pnlColor}">${u.pnl >= 0 ? '+' : ''}${u.pnl.toFixed(0)}</div>
          <div class="lbl">P&L</div>
        </div>
        <div class="lb-stat">
          <div class="val">${u.participated}</div>
          <div class="lbl">Marchés</div>
        </div>
        <div class="lb-stat">
          <div class="val">${winRate}</div>
          <div class="lbl">Win rate</div>
        </div>
      </div>
    </div>`;
  }).join('');
}
