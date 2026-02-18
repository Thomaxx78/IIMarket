// ============================================================
// ⚙️  SUPABASE CONFIG — remplace par tes vraies valeurs
// ============================================================
const SUPABASE_URL = 'https://dolywuluyxyiazqenlzz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbHl3dWx1eXh5aWF6cWVubHp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MDU4NjksImV4cCI6MjA4Njk4MTg2OX0.16iT0YRJ22hDKdNDpThq6zFiqJmJU1BT75ME5BY1nSk';

const INITIAL_COINS = 1000;
const MAX_PRICE_MOVE = 0.30;

// ── Web Push VAPID ──────────────────────────────────────────
// Génère tes clés : npx web-push generate-vapid-keys
// Puis colle la clé PUBLIQUE ici, et les deux autres dans les secrets Supabase
const VAPID_PUBLIC_KEY = 'BCF55J3c1jB6ajkZBtYS4Pw71CuRZNi5CEUJw5IHykBFYFHozOPnz-zvkECQXhCWwLRg-t_i5YA-NrBiDiRBQQE';
