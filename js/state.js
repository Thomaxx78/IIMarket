// ============================================================
// STATE — cache local, source de vérité = Supabase
// ============================================================
let state = { users: {}, markets: [], transactions: [] };
let currentUser = null;
let tradeState = { side: 'yes' };
