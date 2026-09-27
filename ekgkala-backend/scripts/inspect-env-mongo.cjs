const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const lines = env.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
const map = {};
for (const l of lines) {
  const i = l.indexOf('=');
  if (i < 0) continue;
  map[l.slice(0, i).trim()] = l.slice(i + 1).trim();
}
const v = map.MONGODB_URI || '';
const masked = v.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
console.log('MONGODB_URI=' + masked);
console.log('keys with MONGO/DB:', Object.keys(map).filter((k) => /mongo|db|uri/i.test(k)).join(', '));
