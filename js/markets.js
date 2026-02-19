// ============================================================
// RENDER MARKETS
// ============================================================

function visibleMarkets() {
  return state.markets.filter(m => {
    if (m.resolved) return true;
    return !(m.hiddenFrom && m.hiddenFrom.includes(currentUser));
  });
}

function renderMarkets() {
  const all = visibleMarkets();
  const open = all.filter(m => !m.resolved);
  const resolved = all.filter(m => m.resolved);
  const totalVol = state.transactions.reduce((a, t) => a + t.coins, 0);

  // Votes en attente pour l'utilisateur courant
  const pendingVotes = state.markets.filter(m =>
    !m.resolved && m.resolutionRequest && m.resolutionRequest.validator === currentUser
  );
  const pendingEl = document.getElementById('pending-validations');
  if (pendingEl) {
    if (pendingVotes.length > 0) {
      pendingEl.innerHTML = pendingVotes.map(m => {
        const resFr = m.resolutionRequest.result === 'yes' ? 'OUI ✅' : 'NON ❌';
        return `<div class="pending-vote-item" onclick="openMarket('${m.id}')">
          <span class="pending-vote-icon">🗳️</span>
          <div class="pending-vote-text">
            <b>${m.resolutionRequest.requestedBy}</b> demande de résoudre → <b>${resFr}</b>
            <div class="pending-vote-q">${m.question.length > 55 ? m.question.slice(0, 52) + '…' : m.question}</div>
          </div>
          <span class="pending-vote-cta">Voter →</span>
        </div>`;
      }).join('');
      pendingEl.style.display = 'block';
    } else {
      pendingEl.style.display = 'none';
    }
  }

  document.getElementById('global-stats').innerHTML = `
    <div class="stat-card"><div class="val">${open.length}</div><div class="lbl">Marchés actifs</div></div>
    <div class="stat-card"><div class="val">${Object.keys(state.users).length}</div><div class="lbl">Joueurs</div></div>
    <div class="stat-card"><div class="val">${Math.round(totalVol)}</div><div class="lbl">Volume total 🪙</div></div>
    <div class="stat-card"><div class="val">${resolved.length}</div><div class="lbl">Résolus</div></div>
  `;

  document.getElementById('markets-grid').innerHTML = open.length
    ? open.map(renderMarketCard).join('')
    : '<div class="empty-state"><div class="emoji">🌱</div><div>Aucun marché actif.<br>Crée le premier !</div></div>';

  document.getElementById('resolved-grid').innerHTML = resolved.map(renderMarketCard).join('');
}

function renderMarketCard(m) {
  const prob = lmsrProb(m.qYes, m.qNo, m.b);
  const pct  = Math.round(prob * 100);
  const vol  = state.transactions.filter(t => t.marketId === m.id).reduce((a, t) => a + t.coins, 0);

  let tagHtml = m.resolved
    ? (m.resolution === 'yes'
        ? '<span class="tag tag-resolved-yes">✓ OUI</span>'
        : '<span class="tag tag-resolved-no">✗ NON</span>')
    : '<span class="tag tag-open">OUVERT</span>';

  const daysLeft = m.resolveDate
    ? Math.ceil((new Date(m.resolveDate) - Date.now()) / 86400000)
    : null;

  const dateStr = daysLeft !== null
    ? (m.resolved
        ? new Date(m.resolveDate).toLocaleDateString('fr')
        : daysLeft > 0 ? `dans ${daysLeft}j` : 'aujourd\'hui')
    : '—';

  const myTx = state.transactions.filter(t => t.marketId === m.id && t.user === currentUser);
  const posIndicator = myTx.length > 0 ? ' <span style="color:var(--accent)">●</span>' : '';

  return `<div class="market-card ${m.resolved ? 'resolved' : ''}" onclick="openMarket('${m.id}')">
    <div class="market-tags">
      ${tagHtml}
      <span class="tag" style="background:rgba(107,107,138,0.12);color:var(--muted)">${m.category}</span>
    </div>
    <div class="market-question">${renderQuestion(m.question)}${posIndicator}</div>
    <div class="prob-bar"><div class="prob-fill" style="width:${pct}%"></div></div>
    <div class="prob-labels">
      <span class="yes-label">OUI ${pct}%</span>
      <span class="no-label">NON ${100-pct}%</span>
    </div>
    <div class="market-footer">
      <span>⏰ ${dateStr}</span>
      <span>par <b>${m.creator}</b></span>
      <span class="volume-badge">${Math.round(vol)} 🪙</span>
    </div>
  </div>`;
}
