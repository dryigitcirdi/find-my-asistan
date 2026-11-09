#!/usr/bin/env node
/**
 * Nöbet listesini içe aktarır.
 *
 *   node tools/import-duties.js <veri.json> [--dry]
 *
 * <veri.json>: { "11.2026": [[satır],[satır],...], "10.2026": [...] }
 * Her satır B..G sütunları: [Asistan, Altunizade, Maslak, Ataşehir, Atakent, Nöbet Ertesi İzin]
 * İlk satır başlık olmalı. Veri Google Sheets bağlayıcısının get_values çıktısıdır.
 *
 * NEDEN JSON: Drive'ın metin çıktısı 2026 sonbaharında değişti ve artık tablonun
 * tamamını değil yalnızca ilk ~13 satırını ("Table Sample Data") veriyor. Metni
 * ayrıştırmak sessizce eksik veri üretiyordu — Ekim 2026 bu yüzden yarım geldi.
 *
 * Yalnızca dosyada geçen aylar değiştirilir; diğer aylar olduğu gibi kalır.
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
  tky: ['tahir', 'koray', 'yozgatl'],
  mk:  ['müge', 'muge', 'kıraç', 'kirac'],
  ma:  ['metehan', 'metahan', 'akdağ', 'akdag'],
  moc: ['oğuz', 'oguz', 'çolak', 'colak'],
  ty:  ['tarık', 'tarik', 'yılmaz', 'yilmaz'],
  ce:  ['can eser', 'eser']
};

const norm = (s) => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();
const warnings = [];

function matchResident(hucre) {
  const n = norm(String(hucre).replace(/\[merged\]/g, ''));
  if (!n) return null;
  let best = null, score = 0;
  for (const [id, keys] of Object.entries(RESIDENTS)) {
    const k = keys.filter((x) => n.includes(x)).length;
    if (k > score) { best = id; score = k; }
  }
  return score ? best : null;
}

function matchHospital(hucre) {
  const n = norm(hucre);
  for (const [id, keys] of Object.entries(HOSPITALS)) if (keys.some((k) => n.includes(k))) return id;
  return null;
}

/** "18/08/2026" · "1.8.2026" · "07-11-2026" · "5.11.26" -> "2026-11-05" */
function parseDate(ham, sayfa) {
  const s = String(ham == null ? '' : ham).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*[./-]\s*(\d{1,3})\s*[./-]\s*(\d{2,4})$/);
  if (!m) {
    if (/^[\d./-]+$/.test(s)) warnings.push(`${sayfa}: okunamayan tarih "${s}"`);
    return null;
  }
  let [, d, mo, y] = m;
  if (mo.length === 3) { warnings.push(`${sayfa}: ay alanı düzeltildi "${s}"`); mo = mo.slice(0, 2); }
  d = Number(d); mo = Number(mo); y = Number(y);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) { warnings.push(`${sayfa}: geçersiz tarih "${s}"`); return null; }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Sayfanın baskın ayından 1 aydan fazla sapan tarih yazım hatasıdır.
 *  Ay sınırı meşru: 30.09 nöbetinin ertesi 01.10 olabilir. */
function fixOutliers(kayitlar, beklenenAy, sayfa) {
  const ix = (m) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  return kayitlar.map((e) => {
    const fark = Math.abs(ix(e.d.slice(0, 7)) - ix(beklenenAy));
    if (fark <= 1) return e;
    const duzeltilmis = `${beklenenAy}-${e.d.slice(8)}`;
    warnings.push(`${sayfa}: ${e.d} sayfanın ayından sapıyor, ${duzeltilmis} olarak alındı`);
    return { ...e, d: duzeltilmis };
  });
}

/** Tek bir ay sayfasını okur */
function parseSheet(sayfaAdi, rows) {
  // "11.2026" -> "2026-11"
  const m = sayfaAdi.match(/(\d{1,2})[.\-/](\d{4})/);
  const beklenenAy = m ? `${m[2]}-${String(Number(m[1])).padStart(2, '0')}` : null;

  let cols = null, nameCol = -1, sonAsistan = null;
  const duties = [], postCall = [];

  for (const satir of rows) {
    const cells = (satir || []).map((c) => String(c == null ? '' : c).replace(/\[merged\]/g, '').trim());
    if (!cells.some(Boolean)) continue;

    const asistanIdx = cells.findIndex((c) => norm(c) === 'asistan');
    if (asistanIdx >= 0) {
      cols = {}; nameCol = asistanIdx; sonAsistan = null;
      cells.forEach((c, i) => {
        const h = matchHospital(c);
        if (h) cols[h] = i;
        if (norm(c).includes('ertesi')) cols.post = i;
      });
      continue;
    }
    if (!cols) continue;

    // Ad yalnızca bloğun ilk satırında yazıyor; adsız satır bir öncekine ait
    const bulunan = matchResident(cells[nameCol] || '');
    if (bulunan) sonAsistan = bulunan;
    const id = bulunan || sonAsistan;
    if (!id) continue;

    for (const [key, idx] of Object.entries(cols)) {
      const iso = parseDate(cells[idx], sayfaAdi);
      if (!iso) continue;
      if (key === 'post') postCall.push({ d: iso, r: id });
      else duties.push({ d: iso, r: id, h: key });
    }
  }

  if (beklenenAy) {
    return { duties: fixOutliers(duties, beklenenAy, sayfaAdi),
             postCall: fixOutliers(postCall, beklenenAy, sayfaAdi), ay: beklenenAy };
  }
  return { duties, postCall, ay: null };
}

/* ---- çalıştır ---- */
const src = process.argv[2];
if (!src) { console.error('Kullanım: node tools/import-duties.js <veri.json> [--dry]'); process.exit(1); }

const girdi = JSON.parse(fs.readFileSync(src, 'utf8'));
const yeniDuties = [], yeniPost = [];
const dokunulanAylar = new Set();

for (const [sayfaAdi, rows] of Object.entries(girdi)) {
  const r = parseSheet(sayfaAdi, rows);
  if (r.ay) dokunulanAylar.add(r.ay);
  r.duties.forEach((x) => yeniDuties.push(x));
  r.postCall.forEach((x) => yeniPost.push(x));
  console.log(`${sayfaAdi}: ${r.duties.length} nöbet · ${r.postCall.length} ertesi izin`);
}

const tekil = (arr, k) => [...new Map(arr.map((x) => [k(x), x])).values()];
const D = tekil(yeniDuties, (x) => `${x.d}|${x.r}|${x.h}`);
const P = tekil(yeniPost, (x) => `${x.d}|${x.r}`);

console.log(`\ntoplam: ${D.length} nöbet · ${P.length} ertesi izin`);
console.log(`değiştirilen aylar: ${[...dokunulanAylar].sort().join(', ')}`);
if (warnings.length) { console.log('\nuyarılar:'); [...new Set(warnings)].forEach((w) => console.log('  · ' + w)); }

if (process.argv.includes('--dry')) process.exit(0);

const hedef = path.join(__dirname, '..', 'data', 'schedule.json');
const db = JSON.parse(fs.readFileSync(hedef, 'utf8'));
const disinda = (x) => !dokunulanAylar.has(x.d.slice(0, 7));   // dokunulmayan aylar korunur

db.duties = [...db.duties.filter(disinda), ...D].sort((a, b) => a.d.localeCompare(b.d) || a.r.localeCompare(b.r));
db.postCall = [...db.postCall.filter(disinda), ...P].sort((a, b) => a.d.localeCompare(b.d) || a.r.localeCompare(b.r));
db.meta.coverage = [...new Set(db.duties.map((x) => x.d.slice(0, 7)))].sort();
fs.writeFileSync(hedef, JSON.stringify(db, null, 2));
console.log(`\ndata/schedule.json güncellendi · kapsam: ${db.meta.coverage.join(', ')}`);
