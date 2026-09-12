// İsimleri baş harflere indirir / geri alır.
//   node tools/anonymize.js            -> Tahir Koray Yozgatlı  ->  T.K.Y.
//   node tools/anonymize.js --restore  -> tam isimlere geri döner
// Tam isimli sürüm data/.schedule.full.json içinde saklanır (git'e girmez).
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data', 'schedule.json');
const FULL = path.join(__dirname, '..', 'data', '.schedule.full.json');
const restore = process.argv.includes('--restore');

if (restore) {
  if (!fs.existsSync(FULL)) {
    console.error('Yedek yok: data/.schedule.full.json bulunamadı.');
    process.exit(1);
  }
  fs.copyFileSync(FULL, DATA);
  console.log('Tam isimler geri yüklendi.');
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DATA, 'utf8'));
if (!fs.existsSync(FULL)) fs.copyFileSync(DATA, FULL);

const initials = (name) => name.trim().split(/\s+/).map((w) => w[0].toLocaleUpperCase('tr')).join('.') + '.';

db.residents = db.residents.map((r) => ({ ...r, name: initials(r.name), short: initials(r.name) }));
db.meta.anonymized = true;

fs.writeFileSync(DATA, JSON.stringify(db, null, 2));
console.log('İsimler kısaltıldı:', db.residents.map((r) => r.name).join(', '));
console.log('Tam sürüm: data/.schedule.full.json (git\'e girmez)');
