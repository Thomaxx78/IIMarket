// ============================================================
// DB HELPERS + REALTIME (Supabase)
// ============================================================

// sb is created in app.js after config is loaded
let sb;

function initSupabase() {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function dbLoadAll() {
  const [usersRes, marketsRes, txRes] = await Promise.all([
    sb.from('users').select('*'),
    sb.from('markets').select('*').order('created_at', { ascending: false }),
    sb.from('transactions').select('*').order('timestamp', { ascending: true }),
  ]);
  if (usersRes.error) throw usersRes.error;
  if (marketsRes.error) throw marketsRes.error;
  if (txRes.error) throw txRes.error;

  state.users = {};
  usersRes.data.forEach(u => {
    state.users[u.name] = { coins: u.coins, joinedAt: new Date(u.joined_at).getTime() };
  });
  state.markets = marketsRes.data.map(dbToMarket);
  state.transactions = txRes.data.map(dbToTx);
}

function dbToMarket(r) {
  return {
    id: r.id,
    question: r.question,
    category: r.category,
    resolveDate: r.resolve_date,
    b: r.b,
    maxBet: r.max_bet,
    creator: r.creator,
    hiddenFrom: r.hidden_from || [],
    qYes: r.q_yes,
    qNo: r.q_no,
    resolved: r.resolved,
    resolution: r.resolution,
    createdAt: new Date(r.created_at).getTime(),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
    resolutionRequest: r.resolution_request || null,
  };
}

function dbToTx(r) {
  return {
    id: r.id,
    marketId: r.market_id,
    user: r.user_name,
    side: r.side,
    coins: r.coins,
    shares: r.shares,
    probBefore: r.prob_before,
    probAfter: r.prob_after,
    timestamp: new Date(r.timestamp).getTime(),
  };
}

async function dbUpsertUser(name, coins) {
  const { error } = await sb.from('users').upsert(
    { name, coins, joined_at: new Date().toISOString() },
    { onConflict: 'name', ignoreDuplicates: false }
  );
  if (error) throw error;
}

async function dbUpdateCoins(name, coins) {
  const { error } = await sb.from('users').update({ coins }).eq('name', name);
  if (error) throw error;
}

async function dbInsertMarket(m) {
  const { error } = await sb.from('markets').insert({
    id: m.id,
    question: m.question,
    category: m.category,
    resolve_date: m.resolveDate,
    b: m.b,
    max_bet: m.maxBet,
    creator: m.creator,
    hidden_from: m.hiddenFrom,
    q_yes: m.qYes,
    q_no: m.qNo,
    resolved: false,
    resolution: null,
    created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function dbUpdateMarket(id, fields) {
  const mapped = {};
  if (fields.qYes !== undefined)       mapped.q_yes       = fields.qYes;
  if (fields.qNo !== undefined)        mapped.q_no        = fields.qNo;
  if (fields.resolved !== undefined)   mapped.resolved    = fields.resolved;
  if (fields.resolution !== undefined) mapped.resolution  = fields.resolution;
  if (fields.resolvedAt !== undefined) mapped.resolved_at = new Date(fields.resolvedAt).toISOString();
  if (fields.hiddenFrom !== undefined)        mapped.hidden_from        = fields.hiddenFrom;
  if ('resolutionRequest' in fields)           mapped.resolution_request = fields.resolutionRequest;
  const { error } = await sb.from('markets').update(mapped).eq('id', id);
  if (error) throw error;
}

async function dbInsertTx(t) {
  const { error } = await sb.from('transactions').insert({
    id: t.id,
    market_id: t.marketId,
    user_name: t.user,
    side: t.side,
    coins: t.coins,
    shares: t.shares,
    prob_before: t.probBefore,
    prob_after: t.probAfter,
    timestamp: new Date(t.timestamp).toISOString(),
  });
  if (error) throw error;
}

function subscribeRealtime() {
  sb.channel('public:markets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'markets' }, () => {
      dbLoadAll().then(() => { renderMarkets(); });
    })
    .subscribe();

  sb.channel('public:transactions')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, () => {
      dbLoadAll().then(() => { renderMarkets(); updateHeader(); });
    })
    .subscribe();

  sb.channel('public:users')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
      dbLoadAll().then(() => updateHeader());
    })
    .subscribe();
}
