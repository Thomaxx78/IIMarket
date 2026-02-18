// ============================================================
// PROFILE
// ============================================================

function renderProfile() {
  const user = state.users[currentUser];
  if (!user) return;

  const txs = state.transactions.filter(t => t.user === currentUser);
  const resolved = state.markets.filter(m => m.resolved);
  let totalWonCoins = 0, totalSpentResolved = 0, mWon = 0, mLost = 0;

  resolved.forEach(m => {
    const myTx = txs.filter(t => t.marketId === m.id);
    if (!myTx.length) return;
    const spent = myTx.reduce((a, t) => a + t.coins, 0);
    const won   = myTx.filter(t => t.side === m.resolution).reduce((a, t) => a + t.shares, 0);
    totalSpentResolved += spent;
    totalWonCoins += won;
    if (won > 0) mWon++; else mLost++;
  });

  const pnl = totalWonCoins - totalSpentResolved;
  const roi = totalSpentResolved > 0 ? (pnl / totalSpentResolved * 100).toFixed(0) + '%' : '—';
  const participated = new Set(txs.map(t => t.marketId)).size;

  document.getElementById('profile-avatar').textContent = currentUser[0].toUpperCase();
  document.getElementById('profile-name').textContent = currentUser;
  document.getElementById('profile-stats').innerHTML = `
    <div class="pstat"><div class="val">${Math.round(user.coins)} 🪙</div><div class="lbl">Solde</div></div>
    <div class="pstat"><div class="val">${participated}</div><div class="lbl">Marchés joués</div></div>
    <div class="pstat"><div class="val">${mWon}</div><div class="lbl">Gagnés</div></div>
    <div class="pstat"><div class="val" style="color:${pnl >= 0 ? 'var(--yes)' : 'var(--no)'}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}</div><div class="lbl">P&L</div></div>
    <div class="pstat"><div class="val">${roi}</div><div class="lbl">ROI</div></div>
  `;

  // Active positions
  const activeMkts = state.markets.filter(m => !m.resolved && txs.some(t => t.marketId === m.id));
  document.getElementById('my-positions').innerHTML = activeMkts.length
    ? activeMkts.map(m => {
        const mt   = txs.filter(t => t.marketId === m.id);
        const yS   = mt.filter(t => t.side === 'yes').reduce((a, t) => a + t.shares, 0);
        const nS   = mt.filter(t => t.side === 'no').reduce((a, t) => a + t.shares, 0);
        const spent = mt.reduce((a, t) => a + t.coins, 0);
        const prob  = lmsrProb(m.qYes, m.qNo, m.b);
        return `<div class="market-card" onclick="openMarket('${m.id}')">
          <div class="market-question">${renderQuestion(m.question)}</div>
          <div class="prob-bar" style="margin-bottom:6px"><div class="prob-fill" style="width:${Math.round(prob*100)}%"></div></div>
          <div class="prob-labels"><span class="yes-label">OUI ${Math.round(prob*100)}%</span><span class="no-label">NON ${Math.round((1-prob)*100)}%</span></div>
          <div class="position-row">
            ${yS > 0 ? `<span class="yes-text">${yS.toFixed(2)} pts OUI</span>` : ''}
            ${nS > 0 ? `<span class="no-text">${nS.toFixed(2)} pts NON</span>` : ''}
            <span class="mono gold">${spent.toFixed(0)} 🪙 investis</span>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty-state"><div class="emoji">📭</div><div>Aucune position active.</div></div>';

  // Transaction history
  const recentTx = [...txs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 25);
  document.getElementById('my-history').innerHTML = recentTx.length
    ? recentTx.map(t => {
        const m = state.markets.find(x => x.id === t.marketId);
        const q = m ? m.question.substring(0, 45) + '…' : '—';
        return `<div class="tx-row">
          <span style="flex:1;min-width:160px">${q}</span>
          <span class="${t.side === 'yes' ? 'yes-text' : 'no-text'}">${t.side.toUpperCase()}</span>
          <span class="mono">${t.coins.toFixed(0)} 🪙 → ${t.shares.toFixed(2)} parts</span>
          <span style="color:var(--muted)">${new Date(t.timestamp).toLocaleDateString('fr')}</span>
        </div>`;
      }).join('')
    : '<div style="color:var(--muted);padding:20px;text-align:center">Aucune transaction.</div>';
}
