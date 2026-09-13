#!/usr/bin/env node
/**
 * Nöbet listesini Drive'ın metin çıktısından okur.
 *
 *   node tools/import-duties.js <nobet.md> [--dry]
 *
 * <nobet.md>: Drive bağlayıcısının "Asistan Nöbet Tarihleri" için döndürdüğü
 * markdown tablo metni (her sayfa ayrı bir tablo).
 *
 * Renk yok, hepsi metin — bu yüzden xlsx açmaya gerek kalmıyor.
 * Beklenen başlık: | | Asistan | Altunizade | Maslak | Ataşehir | Atakent | Nöbet Ertesi İzin |
 */
const fs = require('node:fs');
const path = require('node:path');

const HOSPITALS = {
  altunizade: ['altunizade'],
  maslak: ['maslak'],
  atasehir: ['ataşehir', 'atasehir'],
  atakent: ['atakent']
};
// Kaynakta isim yazımı tutarsız (Metehan/Metahan), soyadsız da geçebiliyor
const RESIDENTS = {
  tky: ['tahir', 'koray', 'yozgatlı', 'yozgatli'],
  mk:  ['müge', 'muge', 'kıraç', 'kirac'],
  ma:  ['metehan', 'metahan', 'akdağ', 'akdag'],
  moc: ['oğuz', 'oguz', 'çolak', 'colak'],
  ty:  ['tarık', 'tarik', 'yılmaz', 'yilmaz'],
  ce:  ['can eser', 'eser']
};

const norm = (s) => s.toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

function matchResident(cell) {
  const n = norm(cell.replace(/\\?\[merged\\?\]/g, ''));
  if (!n) return null;
  let best = null, bestScore = 0;
  for (const [id, keys] of Object.entries(RESIDENTS)) {
    const score = keys.filter((k) => n.includes(k)).length;
    if (score > bestScore) { best = id; bestScore = score; }
  }
  return bestScore ? best : null;
}

function matchHospital(cell) {
  const n = norm(cell);
  for (const [id, keys] of Object.entries(HOSPITALS)) {
    if (keys.some((k) => n.includes(k))) return id;
  }
  return null;
}

const warnings = [];

/** "18/08/2026", "1/8/2026", "11.08.26", "5/082/2026" -> "2026-08-18" */
function parseDate(raw, hint) {
  const s = String(raw).trim();
  if (!s || s === ',') return null;
  const m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{1,3})\s*[./-]\s*(\d{2,4})$/);
  if (!m) { warnings.push(`okunamayan tarih: "${s}"`); return null; }
  let [, d, mo, y] = m;
  if (mo.length === 3) {                       // "082" gibi yazım hatası
    warnings.push(`ay alanı düzeltildi: "${s}" -> ${mo} => ${mo.slice(0, 2)}`);
    mo = mo.slice(0, 2);
  }
  d = Number(d); mo = Number(mo); y = Number(y);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) { warnings.push(`geçersiz tarih: "${s}"`); return null; }
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (hint && iso.slice(0, 7) !== hint) {
    warnings.push(`"${s}" ${hint} sayfasında ama ${iso.slice(0, 7)} ayına düşüyor`);
  }
  return iso;
}

/** Bir sayfanın baskın ayından 1 aydan fazla sapan tarih yazım hatasıdır.
 *  (Ay sınırındakiler meşru: 30.09 nöbetinin ertesi 01.10 olabilir.) */
function fixOutliers(entries) {
  const votes = {};
  entries.forEach((e) => { votes[e.d.slice(0, 7)] = (votes[e.d.slice(0, 7)] || 0) + 1; });
  const dom = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  if (!dom) return entries;
  const [domMonth] = dom;
  const idx = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return entries.map((e) => {
    const gap = Math.abs(idx(e.d.slice(0, 7)) - idx(domMonth));
    if (gap <= 1) return e;
    const fixed = `${domMonth}-${e.d.slice(8)}`;
    warnings.push(`${e.d} sayfanın ayından (${domMonth}) sapıyor, ${fixed} olarak alındı`);
    return { ...e, d: fixed };
  });
}

function parse(text) {
  const duties = [], postCall = [];
  const rows = text.split('\n').filter((l) => l.trim().startsWith('|'));

  let cols = null;      // { hospitalId|'post' : sütun indeksi }
  let nameCol = -1;
  let monthHint = null;
  let tableD = [], tableP = [];
  const monthVotes = {};
  const flushTable = () => {
    fixOutliers(tableD).forEach((e) => duties.push(e));
    fixOutliers(tableP).forEach((e) => postCall.push(e));
    tableD = []; tableP = [];
  };

  for (const line of rows) {
    const cells = line.split('|').slice(1, -1).map((c) => c.replace(/\\?\[merged\\?\]/g, '').trim());
    if (cells.every((c) => !c) || /^:?-+:?$/.test(cells[0] || '')) continue;

    // Başlık satırı mı?
    const asistanIdx = cells.findIndex((c) => norm(c) === 'asistan');
    if (asistanIdx >= 0) {
      flushTable();
      cols = {}; nameCol = asistanIdx;
      cells.forEach((c, i) => {
        const h = matchHospital(c);
        if (h) cols[h] = i;
        if (norm(c).includes('ertesi')) cols.post = i;
      });
      // Yeni tablo = yeni sayfa; ay ipucunu sıfırla
      monthHint = null;
      continue;
    }
    if (!cols) continue;

    const id = matchResident(cells[nameCol] || '');
    if (!id) continue;

    for (const [key, idx] of Object.entries(cols)) {
      const iso = parseDate(cells[idx] || '', monthHint);
      if (!iso) continue;
      if (key === 'post') tableP.push({ d: iso, r: id });
      else tableD.push({ d: iso, r: id, h: key });
    }
  }

  flushTable();
  // Aylar, yazım hatası düzeltmelerinden SONRA sayılmalı
  [...duties, ...postCall].forEach((e) => {
    monthVotes[e.d.slice(0, 7)] = (monthVotes[e.d.slice(0, 7)] || 0) + 1;
  });

  const dedupe = (arr, k) => [...new Map(arr.map((x) => [k(x), x])).values()];
  return {
    duties: dedupe(duties, (x) => `${x.d}|${x.r}|${x.h}`).sort((a, b) => a.d.localeCompare(b.d)),
    postCall: dedupe(postCall, (x) => `${x.d}|${x.r}`).sort((a, b) => a.d.localeCompare(b.d)),
    months: Object.keys(monthVotes).sort(),
    warnings
  };
}

/* ---- çalıştır ---- */
const src = process.argv[2];
if (!src) { console.error('Kullanım: node tools/import-duties.js <nobet.md> [--dry]'); process.exit(1); }
const out = parse(fs.readFileSync(src, 'utf8'));

console.log(`nöbet: ${out.duties.length} · nöbet ertesi izin: ${out.postCall.length}`);
console.log(`kapsanan aylar: ${out.months.join(', ')}`);
const byHosp = out.duties.reduce((a, d) => (a[d.h] = (a[d.h] || 0) + 1, a), {});
console.log('hastane dağılımı:', JSON.stringify(byHosp));
const byRes = out.duties.reduce((a, d) => (a[d.r] = (a[d.r] || 0) + 1, a), {});
console.log('asistan dağılımı:', JSON.stringify(byRes));
if (out.warnings.length) {
  console.log('\nuyarılar:');
  [...new Set(out.warnings)].forEach((w) => console.log('  · ' + w));
}

if (process.argv.includes('--dry')) process.exit(0);
const target = path.join(__dirname, '..', 'data', 'schedule.json');
const db = JSON.parse(fs.readFileSync(target, 'utf8'));
db.duties = out.duties;
db.postCall = out.postCall;
db.meta.coverage = out.months;
fs.writeFileSync(target, JSON.stringify(db, null, 2));
console.log(`\ndata/schedule.json güncellendi`);
