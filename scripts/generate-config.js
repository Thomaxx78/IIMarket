// Script de build Vercel — génère js/config.js à partir des variables d'environnement
const fs = require('fs');
const path = require('path');

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VAPID_PUBLIC_KEY'];
const missing  = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`❌ Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

const content = `// ⚙️ Généré automatiquement par scripts/generate-config.js — ne pas éditer
const SUPABASE_URL      = '${process.env.SUPABASE_URL}';
const SUPABASE_ANON_KEY = '${process.env.SUPABASE_ANON_KEY}';
const INITIAL_COINS     = 1000;
const MAX_PRICE_MOVE    = 0.30;
const VAPID_PUBLIC_KEY  = '${process.env.VAPID_PUBLIC_KEY}';
`;

fs.mkdirSync(path.join(__dirname, '../js'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../js/config.js'), content);
console.log('✅ js/config.js généré');
