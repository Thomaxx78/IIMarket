// ============================================================
// MARKET MODAL + TRADING + RESOLVE
// ============================================================

function openMarket(id) {
  const m = state.markets.find(x => x.id === id);
  if (!m) return;
  tradeState = { side: 'yes' };
  renderModal(m);
  document.getElementById('market-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('market-modal').classList.remove('open');
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

  // Resolve (creator only)
  let resolveSection = '';
  if (!m.resolved && m.creator === currentUser) {
    resolveSection = `<div class="divider"></div>
    <div style="font-size:0.8rem;font-weight:700;color:var(--muted);margin-bottom:10px;">RÉSOUDRE CE MARCHÉ (créateur uniquement)</div>
    <div style="display:flex;gap:8px;">
      <button class="btn-sm" style="flex:1;background:rgba(16,185,129,0.12);border-color:var(--yes);color:var(--yes);" onclick="resolveMarket('${m.id}','yes')">✅ Résoudre OUI</button>
      <button class="btn-sm" style="flex:1;background:rgba(239,68,68,0.12);border-color:var(--no);color:var(--no);" onclick="resolveMarket('${m.id}','no')">❌ Résoudre NON</button>
    </div>`;
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

async function resolveMarket(marketId, result) {
  const m = state.markets.find(x => x.id === marketId);
  if (!m || m.resolved) return;
  if (!confirm(`Résoudre "${m.question.substring(0, 60)}…" → ${result === 'yes' ? 'OUI ✅' : 'NON ❌'} ?`)) return;

  const byUser = {};
  state.transactions.filter(t => t.marketId === marketId).forEach(t => {
    if (!byUser[t.user]) byUser[t.user] = { yes: 0, no: 0 };
    byUser[t.user][t.side] += t.shares;
  });

  try {
    await dbUpdateMarket(marketId, {
      resolved: true,
      resolution: result,
      resolvedAt: Date.now(),
      hiddenFrom: [],
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

    // Notifier tous les participants
    const participants = [...new Set(
      state.transactions.filter(t => t.marketId === marketId).map(t => t.user)
    )];
    const shortQ   = m.question.length > 60 ? m.question.slice(0, 57) + '…' : m.question;
    const resultFr = result === 'yes' ? 'OUI ✅' : 'NON ❌';
    sendPushNotification(
      `🏁 Marché résolu — ${resultFr}`,
      shortQ,
      participants
    );

    const fresh = state.markets.find(x => x.id === marketId);
    renderModal(fresh);
    renderMarkets();
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la résolution.', 'error');
  }
}
