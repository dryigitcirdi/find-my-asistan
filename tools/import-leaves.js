#!/usr/bin/env node
/**
 * Yıllık izinleri Drive metninden okur (Rotasyon Takvimi > "Yıllık izin" sayfası).
 *   node tools/import-leaves.js <izin.md> [--dry]
 * Beklenen satır: | Müge Kıraç | 7-11.09.2026 |
 */
const fs = require('node:fs');
const path = require('node:path');

const RESIDENTS = {
  tky: ['tahir', 'koray', 'yozgatl'], mk: ['müge', 'muge', 'kıraç', 'kirac'],
  ma: ['metehan', 'metahan', 'akdağ', 'akdag'], moc: ['oğuz', 'oguz', 'çolak', 'colak'],
  ty: ['tarık', 'tarik', 'yılmaz', 'yilmaz'], ce: ['can eser', 'eser']
};
const norm = (s) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const warnings = [];

function matchResident(cell) {
  const n = norm(cell.replace(/\\?\[merged\\?\]/g, ''));
  let best = null, score = 0;
  for (const [id, keys] of Object.entries(RESIDENTS)) {
    const k = keys.filter((x) => n.includes(x)).length;
    if (k > score) { best = id; score = k; }
  }
  return score ? best : null;
}

const iso = (d, m, y) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** "7-11.09.2026" · "12-16.10.2026" · "1.10.2026-5.10.2026" · "3.11.2026" */
function parseRange(raw) {
  const s = String(raw).trim();
  if (!s) return null;

  // gün-gün.ay.yıl
  let m = s.match(/^(\d{1,2})\s*-\s*(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(\d{2,4})$/);
  if (m) {
    let [, d1, d2, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
    return { from: iso(d1, mo, y), to: iso(d2, mo, y) };
  }
  // tam tarih - tam tarih
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})\s*-\s*(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let [, d1, m1, y1, d2, m2, y2] = m.map(Number);
    if (y1 < 100) y1 += 2000; if (y2 < 100) y2 += 2000;
    return { from: iso(d1, m1, y1), to: iso(d2, m2, y2) };
  }
  // tek gün
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m.map(Number);
    if (y < 100) y += 2000;
    return { from: iso(d, mo, y), to: iso(d, mo, y) };
  }
  warnings.push(`okunamayan izin aralığı: "${s}"`);
  return null;
}

const leaves = [];
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  if (!line.trim().startsWith('|')) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.replace(/\\?\[merged\\?\]/g, '').trim());
  const id = matchResident(cells[0] || '');
  if (!id) continue;
  for (const cell of cells.slice(1)) {
    for (const part of cell.split(/[,;]/)) {
      const r = parseRange(part);
      if (r) leaves.push({ r: id, from: r.from, to: r.to, type: 'yillik' });
    }
  }
}

const uniq = [...new Map(leaves.map((l) => [`${l.r}|${l.from}|${l.to}`, l])).values()]
  .sort((a, b) => a.from.localeCompare(b.from));
console.log(`yıllık izin: ${uniq.length} kayıt`);
uniq.forEach((l) => console.log(`  ${l.r}  ${l.from} → ${l.to}`));
if (warnings.length) { console.log('\nuyarılar:'); [...new Set(warnings)].forEach((w) => console.log('  · ' + w)); }

if (process.argv.includes('--dry')) process.exit(0);
const target = path.join(__dirname, '..', 'data', 'schedule.json');
const db = JSON.parse(fs.readFileSync(target, 'utf8'));
db.leaves = uniq;
fs.writeFileSync(target, JSON.stringify(db, null, 2));
console.log('\ndata/schedule.json güncellendi');
