#!/usr/bin/env node
/**
 * data/schedule.json sağlık kontrolü. Otomatik senkron yayına çıkmadan önce çalışır.
 * Hata varsa çıkış kodu 1 — sync betiği o zaman commit etmemeli.
 */
const fs = require('node:fs');
const path = require('node:path');

const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'schedule.json'), 'utf8'));
const errors = [], notes = [];
const ids = new Set(db.residents.map((r) => r.id));
const hosp = new Set(db.hospitals.map((h) => h.id));
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

const need = (cond, msg) => { if (!cond) errors.push(msg); };

need(db.residents.length > 0, 'asistan listesi boş');
need(db.hospitals.length > 0, 'hastane listesi boş');
need(db.duties.length > 0, 'nöbet kaydı yok');

db.duties.forEach((d, i) => {
  if (!isDate(d.d)) errors.push(`duties[${i}] geçersiz tarih: ${d.d}`);
  if (!ids.has(d.r)) errors.push(`duties[${i}] bilinmeyen asistan: ${d.r}`);
  if (!hosp.has(d.h)) errors.push(`duties[${i}] bilinmeyen hastane: ${d.h}`);
});
db.postCall.forEach((p, i) => {
  if (!isDate(p.d)) errors.push(`postCall[${i}] geçersiz tarih: ${p.d}`);
  if (!ids.has(p.r)) errors.push(`postCall[${i}] bilinmeyen asistan: ${p.r}`);
});
db.leaves.forEach((l, i) => {
  if (!isDate(l.from) || !isDate(l.to)) errors.push(`leaves[${i}] geçersiz tarih`);
  else if (l.from > l.to) errors.push(`leaves[${i}] bitiş başlangıçtan önce: ${l.from} > ${l.to}`);
});
Object.entries(db.assignments).forEach(([m, map]) => {
  if (!/^\d{4}-\d{2}$/.test(m)) errors.push(`assignments anahtarı geçersiz: ${m}`);
  Object.entries(map).forEach(([r, h]) => {
    if (!ids.has(r)) errors.push(`assignments[${m}] bilinmeyen asistan: ${r}`);
    if (!hosp.has(h)) errors.push(`assignments[${m}] bilinmeyen hastane: ${h}`);
  });
});

// Makul tarih aralığı — yazım hatası yılları yakalar
const years = [...new Set(db.duties.map((d) => Number(d.d.slice(0, 4))))].sort();
const now = new Date().getFullYear();
years.forEach((y) => {
  if (y < now - 2 || y > now + 2) errors.push(`nöbet listesinde beklenmedik yıl: ${y}`);
});

// Aynı gün aynı asistana iki nöbet
const seen = new Map();
db.duties.forEach((d) => {
  const k = `${d.d}|${d.r}`;
  if (seen.has(k)) notes.push(`${d.r} ${d.d} tarihinde iki nöbet (${seen.get(k)} + ${d.h})`);
  else seen.set(k, d.h);
});

// Aynı gün hem nöbet hem nöbet ertesi izin
db.postCall.forEach((p) => {
  if (db.duties.some((d) => d.d === p.d && d.r === p.r)) {
    notes.push(`${p.r} ${p.d} hem nöbet hem nöbet ertesi izin`);
  }
});

// Durum motoru hatasız çalışıyor mu?
(async () => {
  try {
    const S = await import(path.join(__dirname, '..', 'app', 'schedule.js'));
    const bugun = S.iso(new Date());
    db.hospitals.forEach((h) => S.hospitalDay(db, h.id, bugun, {}));
    db.residents.forEach((r) => S.weekOutlook(db, r.id, bugun, {}));
  } catch (e) {
    errors.push(`durum motoru hata verdi: ${e.message}`);
  }

  const ay = [...new Set(db.duties.map((d) => d.d.slice(0, 7)))].sort();
  console.log(`nöbet ${db.duties.length} · ertesi izin ${db.postCall.length} · izin ${db.leaves.length}`);
  console.log(`kapsanan aylar: ${ay.join(', ')}`);
  console.log(`kadro tanımlı ay: ${Object.keys(db.assignments).length}`);
  if (notes.length) { console.log('\nnotlar (engel değil):'); [...new Set(notes)].forEach((n) => console.log('  · ' + n)); }
  if (errors.length) {
    console.error('\nHATA:'); errors.forEach((e) => console.error('  ✗ ' + e));
    process.exit(1);
  }
  console.log('\n✓ doğrulama geçti');
})();
