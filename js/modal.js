// ============================================================
// MARKET MODAL + TRADING + RESOLVE
// ============================================================

// ── Scroll lock ───────────────────────────────────────────────
let _scrollY = 0;
function lockScroll() {
  _scrollY = window.scrollY;
  document.body.style.overflow  = 'hidden';
  document.body.style.position  = 'fixed';
  document.body.style.top       = `-${_scrollY}px`;
  document.body.style.width     = '100%';
}
function unlockScroll() {
  document.body.style.overflow  = '';
  document.body.style.position  = '';
  document.body.style.top       = '';
  document.body.style.width     = '';
  window.scrollTo(0, _scrollY);
}

// ── Swipe to close ────────────────────────────────────────────
function initModalSwipe() {
  const modal = document.getElementById('modal-content');
  let startY = 0, dragging = false;

  modal.addEventListener('touchstart', e => {
    startY   = e.touches[0].clientY;
    dragging = false;
    modal.style.transition = 'none';
  }, { passive: true });

  modal.addEventListener('touchmove', e => {
    const delta = e.touches[0].clientY - startY;
    if (delta > 0 && modal.scrollTop <= 0) {
      dragging = true;
      modal.style.transform = `translateY(${delta}px)`;
      modal.style.opacity   = `${Math.max(0, 1 - delta / 350)}`;
    }
  }, { passive: true });

  modal.addEventListener('touchend', e => {
    modal.style.transition = 'transform 0.28s cubic-bezier(0.32,0.72,0,1), opacity 0.28s ease';
    const delta = e.changedTouches[0].clientY - startY;
    if (dragging && delta > 110) {
      modal.style.transform = 'translateY(100%)';
      modal.style.opacity   = '0';
      setTimeout(() => {
        closeModal();
        modal.style.transform = '';
        modal.style.opacity   = '';
        modal.style.transition = '';
      }, 280);
    } else {
      modal.style.transform = '';
      modal.style.opacity   = '';
      dragging = false;
    }
  }, { passive: true });
}

// Init swipe une seule fois au chargement
document.addEventListener('DOMContentLoaded', initModalSwipe);

function openMarket(id) {
  const m = state.markets.find(x => x.id === id);
  if (!m) return;
  tradeState = { side: 'yes' };
  renderModal(m);
  document.getElementById('market-modal').classList.add('open');
  lockScroll();
}

function closeModal() {
  document.getElementById('market-modal').classList.remove('open');
  unlockScroll();
}

function renderModal(m) {
  const prob  = lmsrProb(m.qYes, m.qNo, m.b);
  const pct   = Math.round(prob * 100);
  const myTx  = state.transactions.filter(t => t.marketId === m.id && t.user === currentUser);
  const myYes = myTx.filter(t => t.side === 'yes').reduce((a, t) => a + t.shares, 0);
  const myNo  = myTx.filter(t => t.side === 'no').reduce((a, t) => a + t.shares, 0);
  const mySpent = myTx.reduce((a, t) => a + t.coins, 0);
  const remaining = Math.max(0, m.maxBet - mySpent);
  const allTx = [...state.transactions.filter(t => t.marketId === m.id)]
    .sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);

  // Resolved banner
  let resolvedBanner = '';
  if (m.resolved) {
    const won = m.resolution === 'yes' ? myYes : myNo;
    resolvedBanner = `<div class="resolved-banner ${m.resolution}">
      Résolu : ${m.resolution === 'yes' ? '✅ OUI' : '❌ NON'}
      ${won > 0 ? `— Tu as gagné <b>${won.toFixed(2)} 🪙</b>` : mySpent > 0 ? `— Tu as perdu <b>${mySpent.toFixed(0)} 🪙</b>` : ''}
    </div>`;
  }

  // Trade section
  const alreadyBet = myTx.length > 0;
  const maxAllowed = Math.min(remaining, state.users[currentUser]?.coins ?? 0);
  let tradeSection = '';
  if (!m.resolved) {
    if (alreadyBet) {
      tradeSection = `<div class="info-box">🔒 Tu as déjà parié sur ce marché. Une seule mise par joueur et par marché.</div>`;
    } else if (maxAllowed < 1) {
      tradeSection = `<div class="info-box">⚠️ Tu n'as pas assez de coins.</div>`;
    } else {
      tradeSection = `
      <div class="trade-tabs">
        <button class="trade-tab yes active" id="tab-yes" onclick="setTradeSide('yes','${m.id}')">🟢 OUI</button>
        <button class="trade-tab no" id="tab-no" onclick="setTradeSide('no','${m.id}')">🔴 NON</button>
      </div>
      <label>Mise en coins (max ${Math.floor(maxAllowed)} 🪙)</label>
      <input type="number" id="trade-amount" value="10" min="1" max="${Math.floor(maxAllowed)}" step="1" oninput="updateCostPreview('${m.id}')">
      <div class="cost-preview" id="cost-preview">
        <div class="cost-row"><span>Parts reçues</span><span class="val" id="prev-shares">—</span></div>
        <div class="cost-row"><span>Prix moyen/part</span><span class="val" id="prev-avg">—</span></div>
        <div class="cost-row"><span>Gain si gagnant</span><span class="val" id="prev-gain">—</span></div>
        <div class="cost-row"><span>Coût total</span><span class="val" id="prev-cost">—</span></div>
      </div>
      <button class="btn-primary" onclick="executeTrade('${m.id}')">Confirmer la mise ↗</button>
      `;
    }
  }

  // Positions
  let posSection = '';
  if (myYes > 0 || myNo > 0) {
    posSection = `<div class="divider"></div>
    <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:10px;">MES POSITIONS</div>
    ${myYes > 0 ? `<div class="position-row"><span class="yes-text">OUI</span><span class="mono">${myYes.toFixed(3)} parts</span><span class="mono" style="color:var(--yes)">${myYes.toFixed(2)} 🪙 si OUI</span></div>` : ''}
    ${myNo  > 0 ? `<div class="position-row"><span class="no-text">NON</span><span class="mono">${myNo.toFixed(3)} parts</span><span class="mono" style="color:var(--no)">${myNo.toFixed(2)} 🪙 si NON</span></div>` : ''}
    <div class="position-row"><span style="color:var(--muted)">Total investi</span><span class="mono gold">${mySpent.toFixed(1)} 🪙</span></div>`;
  }

  // History
  let histSection = '';
  if (allTx.length) {
    histSection = `<div class="divider"></div>
    <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:10px;">DERNIÈRES TRANSACTIONS</div>
    ${allTx.map(t => `<div class="tx-row">
      <span><b>${t.user}</b></span>
      <span class="${t.side === 'yes' ? 'yes-text' : 'no-text'}">${t.side.toUpperCase()}</span>
      <span class="mono">${t.coins.toFixed(0)} 🪙 → ${t.shares.toFixed(2)} parts</span>
      <span>${new Date(t.timestamp).toLocaleDateString('fr')}</span>
    </div>`).join('')}`;
  }

  // Validation section (for the randomly picked validator)
  let validationSection = '';
  if (!m.resolved && m.resolutionRequest && m.resolutionRequest.validator === currentUser) {
    const resFr = m.resolutionRequest.result === 'yes' ? 'OUI ✅' : 'NON ❌';
    validationSection = `<div class="divider"></div>
    <div style="font-size:0.8rem;font-weight:700;color:var(--accent);margin-bottom:10px;">🗳️ VOTE REQUIS — TOI SEUL DÉCIDES</div>
    <div class="info-box"><b>${m.resolutionRequest.requestedBy}</b> demande de clore ce marché → <b>${resFr}</b><br>Es-tu d'accord avec ce résultat ?</div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn-sm" style="flex:1;background:rgba(16,185,129,0.12);border-color:var(--yes);color:var(--yes);" onclick="approveResolution('${m.id}')">✅ Confirmer</button>
      <button class="btn-sm" style="flex:1;background:rgba(239,68,68,0.12);border-color:var(--no);color:var(--no);" onclick="rejectResolution('${m.id}')">❌ Rejeter</button>
    </div>`;
  }

  // Resolve section (creator only)
  let resolveSection = '';
  if (!m.resolved && m.creator === currentUser) {
    if (m.resolutionRequest) {
      const resFr = m.resolutionRequest.result === 'yes' ? 'OUI ✅' : 'NON ❌';
      resolveSection = `<div class="divider"></div>
      <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:10px;">RÉSOLUTION EN ATTENTE</div>
      <div class="info-box">⏳ Demande envoyée à <b>${m.resolutionRequest.validator}</b> pour valider → ${resFr}</div>
      <button class="btn-sm" style="width:100%;margin-top:8px;background:rgba(239,68,68,0.08);border-color:var(--no);color:var(--no);" onclick="cancelResolutionRequest('${m.id}')">Annuler la demande</button>`;
    } else {
      resolveSection = `<div class="divider"></div>
      <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:10px;">RÉSOUDRE CE MARCHÉ (créateur uniquement)</div>
      <div style="display:flex;gap:8px;">
        <button class="btn-sm" style="flex:1;background:rgba(16,185,129,0.12);border-color:var(--yes);color:var(--yes);" onclick="requestResolution('${m.id}','yes')">✅ Proposer OUI</button>
        <button class="btn-sm" style="flex:1;background:rgba(239,68,68,0.12);border-color:var(--no);color:var(--no);" onclick="requestResolution('${m.id}','no')">❌ Proposer NON</button>
      </div>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:6px;text-align:center;">Un joueur aléatoire devra confirmer.</div>`;
    }
  }

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${renderQuestion(m.question)}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      ${resolvedBanner}
      <div class="prob-display">
        <div class="prob-bar" style="margin-bottom:10px;"><div class="prob-fill" style="width:${pct}%"></div></div>
        <div class="prob-big ${prob < 0.5 ? 'low' : ''}">${pct}%</div>
        <div style="color:var(--muted);font-size:0.8rem;margin-top:4px;">probabilité OUI — b=${m.b} — max ${m.maxBet} 🪙/joueur</div>
      </div>
      <div class="info-box">📅 Résolution : ${new Date(m.resolveDate).toLocaleDateString('fr', {day:'numeric',month:'long',year:'numeric'})} · Créé par <b>${m.creator}</b></div>
      ${tradeSection}
      ${posSection}
      ${histSection}
      ${validationSection}
      ${resolveSection}
    </div>`;

  setTimeout(() => updateCostPreview(m.id), 30);
}

function setTradeSide(side, marketId) {
  tradeState.side = side;
  document.getElementById('tab-yes').className = `trade-tab yes${side === 'yes' ? ' active' : ''}`;
  document.getElementById('tab-no').className  = `trade-tab no${side === 'no'  ? ' active' : ''}`;
  updateCostPreview(marketId);
}

function updateCostPreview(marketId) {
  const m     = state.markets.find(x => x.id === marketId);
  const amtEl = document.getElementById('trade-amount');
  if (!m || !amtEl) return;
  const coins  = parseFloat(amtEl.value) || 0;
  const shares = sharesToReceive(m, tradeState.side, coins);
  const avgPrice = shares > 0 ? coins / shares : 0;
  const gain     = shares - coins;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('prev-shares', `${shares.toFixed(3)} parts`);
  set('prev-avg',    `${(avgPrice * 100).toFixed(1)}¢`);
  set('prev-gain',   `${gain >= 0 ? '+' : ''}${gain.toFixed(2)} 🪙`);
  set('prev-cost',   `${coins.toFixed(1)} 🪙`);
}

async function executeTrade(marketId) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || m.resolved) return showToast('Marché fermé.', 'error');

  const coins = parseFloat(document.getElementById('trade-amount')?.value) || 0;
  if (coins < 1) return showToast('Mise minimum : 1 coin.', 'error');

  const user = state.users[currentUser];
  if (coins > user.coins) return showToast('Pas assez de coins !', 'error');

  const myTxCheck = state.transactions.filter(t => t.marketId === marketId && t.user === currentUser);
  if (myTxCheck.length > 0) {
    return showToast('Tu as déjà parié sur ce marché.', 'error');
  }
  if (coins > m.maxBet) {
    return showToast(`Mise maximum : ${m.maxBet} 🪙.`, 'error');
  }

  const probBefore = lmsrProb(m.qYes, m.qNo, m.b);
  const shares     = sharesToReceive(m, tradeState.side, coins);
  const newQY      = m.qYes + (tradeState.side === 'yes' ? shares : 0);
  const newQN      = m.qNo  + (tradeState.side === 'no'  ? shares : 0);
  const probAfter  = lmsrProb(newQY, newQN, m.b);

  const newCoins = user.coins - coins;
  const tx = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,5),
    marketId, user: currentUser,
    side: tradeState.side,
    coins, shares,
    probBefore, probAfter,
    timestamp: Date.now(),
  };

  try {
    await Promise.all([
      dbUpdateMarket(marketId, { qYes: newQY, qNo: newQN }),
      dbUpdateCoins(currentUser, newCoins),
      dbInsertTx(tx),
    ]);
    await dbLoadAll();
    updateHeader();
    showToast(`✅ ${shares.toFixed(2)} parts ${tradeState.side === 'yes' ? 'OUI' : 'NON'} achetées !`, 'success');
    const fresh = state.markets.find(x => x.id === marketId);
    renderModal(fresh);
    renderMarkets();
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la transaction.', 'error');
  }
}

// ── Résolution effective (interne) ────────────────────────────
async function resolveMarket(marketId, result) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || m.resolved) return;

  const byUser = {};
  state.transactions.filter(t => t.marketId === marketId).forEach(t => {
    if (!byUser[t.user]) byUser[t.user] = { yes: 0, no: 0 };
    byUser[t.user][t.side] += t.shares;
  });

  await dbUpdateMarket(marketId, {
    resolved: true,
    resolution: result,
    resolvedAt: Date.now(),
    hiddenFrom: [],
    resolutionRequest: null,
  });

  const payouts = Object.entries(byUser).map(([uname, pos]) => {
    const winShares = result === 'yes' ? pos.yes : pos.no;
    if (winShares > 0 && state.users[uname]) {
      const newCoins = (state.users[uname].coins || 0) + winShares;
      return dbUpdateCoins(uname, newCoins);
    }
    return Promise.resolve();
  });
  await Promise.all(payouts);

  await dbLoadAll();
  updateHeader();
  showToast('Marché résolu ! Gains distribués. 🎉', 'success');

  // Notif personnalisée par participant (win ou lose)
  const shortQ   = m.question.length > 55 ? m.question.slice(0, 52) + '…' : m.question;
  const resultFr = result === 'yes' ? 'OUI ✅' : 'NON ❌';
  const marketTx = state.transactions.filter(t => t.marketId === marketId);

  Object.entries(byUser).forEach(([uname, pos]) => {
    const winShares  = result === 'yes' ? pos.yes : pos.no;
    const coinsSpent = marketTx.filter(t => t.user === uname).reduce((a, t) => a + t.coins, 0);
    if (winShares > 0) {
      const net = winShares - coinsSpent;
      const sign = net >= 0 ? '+' : '';
      sendPushNotification(
        `🎉 Tu as gagné ! ${sign}${net.toFixed(1)} 🪙`,
        `Marché résolu ${resultFr} — ${shortQ}`,
        [uname]
      );
    } else {
      sendPushNotification(
        `😔 Tu as perdu ${coinsSpent.toFixed(0)} 🪙`,
        `Marché résolu ${resultFr} — ${shortQ}`,
        [uname]
      );
    }
  });

  const fresh = state.markets.find(x => x.id === marketId);
  renderModal(fresh);
  renderMarkets();
}

// ── Demande de résolution (créateur) ──────────────────────────
async function requestResolution(marketId, result) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || m.resolved) return;

  const candidates = Object.keys(state.users).filter(n => n !== currentUser);
  if (candidates.length === 0) return showToast('Aucun autre joueur pour valider.', 'error');

  const validator = candidates[Math.floor(Math.random() * candidates.length)];
  const req = { result, requestedBy: currentUser, requestedAt: Date.now(), validator };

  try {
    await dbUpdateMarket(marketId, { resolutionRequest: req });
    await dbLoadAll();
    showToast(`Demande envoyée à ${validator} pour validation. ⏳`, 'success');
    sendPushNotification(
      `🗳️ Vote requis — FriendMarket`,
      `${currentUser} demande de résoudre "${m.question.slice(0, 55)}" → ${result === 'yes' ? 'OUI' : 'NON'}`,
      [validator]
    );
    renderModal(state.markets.find(x => x.id === marketId));
    renderMarkets();
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la demande.', 'error');
  }
}

// ── Validation (joueur aléatoire) ─────────────────────────────
async function approveResolution(marketId) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || m.resolved || !m.resolutionRequest) return;
  try {
    await resolveMarket(marketId, m.resolutionRequest.result);
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la résolution.', 'error');
  }
}

async function rejectResolution(marketId) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || !m.resolutionRequest) return;
  const creator = m.creator;
  try {
    await dbUpdateMarket(marketId, { resolutionRequest: null });
    await dbLoadAll();
    showToast('Demande rejetée.', 'info');
    sendPushNotification(
      `❌ Demande rejetée`,
      `${currentUser} a rejeté ta demande de résolution pour "${m.question.slice(0, 55)}"`,
      [creator]
    );
    renderModal(state.markets.find(x => x.id === marketId));
    renderMarkets();
  } catch(e) {
    console.error(e);
    showToast('Erreur.', 'error');
  }
}

async function cancelResolutionRequest(marketId) {
  try {
    await dbUpdateMarket(marketId, { resolutionRequest: null });
    await dbLoadAll();
    showToast('Demande annulée.', 'info');
    renderModal(state.markets.find(x => x.id === marketId));
    renderMarkets();
  } catch(e) {
    showToast('Erreur.', 'error');
  }
}
