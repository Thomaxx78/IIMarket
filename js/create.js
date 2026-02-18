// ============================================================
// CREATE MARKET
// ============================================================

async function createMarket() {
  const question    = getEditorText();
  const category    = document.getElementById('new-category').value;
  const resolveDate = document.getElementById('new-date').value;
  const b           = parseFloat(document.getElementById('new-b').value);
  const maxBet      = parseFloat(document.getElementById('new-max-bet').value);
  const hiddenFrom  = getHiddenFrom();

  if (!question)   return showToast('Entre une question !', 'error');
  if (!resolveDate) return showToast('Choisis une date de résolution.', 'error');
  if (isNaN(b) || b < 20 || b > 200) return showToast('b doit être entre 20 et 200.', 'error');
  if (isNaN(maxBet) || maxBet < 10)  return showToast('Mise max invalide.', 'error');

  const market = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
    question, category, resolveDate, b, maxBet,
    creator: currentUser,
    hiddenFrom,
    qYes: 0, qNo: 0,
    resolved: false, resolution: null,
    createdAt: Date.now(),
  };

  try {
    await dbInsertMarket(market);
    await dbLoadAll();
    document.getElementById('question-editor').innerHTML = '';
    mentionHideMap = {};
    updateHideBanner();
    showToast('Marché créé ! 🎉', 'success');

    // Notifier tous les joueurs (sauf ceux dans hiddenFrom et le créateur)
    const recipients = Object.keys(state.users).filter(
      n => n !== currentUser && !hiddenFrom.includes(n)
    );
    const shortQ = question.length > 80 ? question.slice(0, 77) + '…' : question;
    sendPushNotification(
      `⚡ Nouveau marché — ${market.category}`,
      shortQ,
      recipients
    );

    navigate('markets');
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la création du marché.', 'error');
  }
}
