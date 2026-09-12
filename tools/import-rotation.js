#!/usr/bin/env node
/**
 * Rotasyon takvimindeki RENK KODLARINDAN gündüz kadrosunu okur ve
 * data/schedule.json içindeki `assignments` + `rotations` alanlarını yeniler.
 *
 *   node tools/import-rotation.js <rotasyon.xlsx>
 *   node tools/import-rotation.js <rotasyon.xlsx> --dry    (yazmadan göster)
 *
 * xlsx nasıl alınır: Drive'da "Asistan Rotasyon Takvimi" → Dosya → İndir → .xlsx
 *
 * Neden renk: sayfada kadro yazıyla değil, hücre dolgusuyla tutuluyor.
 * Renk anahtarı sayfanın kendi içinde (20-23. satırlar) tanımlı.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const HOSP = { '00FF00': 'altunizade', '00FFFF': 'atakent', 'FFFF00': 'atasehir', 'FF00FF': 'maslak' };
const ROT_COLOR = 'FF0000';   // dış rotasyon  (ROT başlığının rengi)
const TEZ_COLOR = 'FF9900';   // tez dönemi    (TEZ başlığının rengi)
const PEOPLE = { 12: 'tky', 13: 'mk', 14: 'ma', 15: 'moc', 16: 'ty', 17: 'ce' };
const FIRST_COL = 2, LAST_COL = 121;
const BASE_COL = 62;          // BJ = 2026-01 (kullanıcı tarafından doğrulandı)

const colNum = (ref) => {
  const L = ref.match(/^[A-Z]+/)[0];
  let n = 0; for (const c of L) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
};
const colToMonth = (n) => {
  const k = n - BASE_COL;
  const y = 2026 + Math.floor(k / 12);
  const m = ((k % 12) + 12) % 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
};

function readSheet(xlsxPath) {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'rot-'));
  execFileSync('unzip', ['-o', '-q', xlsxPath, '-d', dir]);
  const rd = (f) => fs.readFileSync(path.join(dir, f), 'utf8');

  const ss = [];
  try {
    for (const m of rd('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)) {
      ss.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    }
  } catch { /* paylaşılan metin yoksa sorun değil */ }

  const styles = rd('xl/styles.xml');
  const fills = [];
  for (const m of styles.match(/<fills[^>]*>([\s\S]*?)<\/fills>/)[1].matchAll(/<fill>([\s\S]*?)<\/fill>/g)) {
    const fg = m[1].match(/<fgColor[^>]*rgb="([0-9A-Fa-f]{6,8})"/);
    fills.push(/patternType="none"/.test(m[1]) ? null : (fg ? fg[1].slice(-6).toUpperCase() : null));
  }
  const xfs = [];
  for (const m of styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].matchAll(/<xf\b[^>]*>/g)) {
    const f = m[0].match(/fillId="(\d+)"/);
    xfs.push(f ? Number(f[1]) : 0);
  }
  const colorOf = (s) => (s == null ? null : fills[xfs[Number(s)] ?? 0] ?? null);

  const sheet = rd('xl/worksheets/sheet1.xml');
  const rows = new Map();
  for (const rm of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = new Map();
    // Kendi kendini kapatan <c .../> ayrı ele alınmalı: tek kalıpla okunursa
    // boş-ama-renkli hücre kendinden sonrakini yutar. (Kadro hücreleri tam da bunlar.)
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g)) {
      const attrs = cm[1] !== undefined ? cm[1] : cm[2];
      const inner = cm[3] || '';
      const r = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1];
      if (!r) continue;
      const t = (attrs.match(/\bt="(\w+)"/) || [])[1];
      let v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
      if (t === 's' && v !== '') v = ss[Number(v)] ?? '';
      cells.set(colNum(r), { v: String(v).trim(), color: colorOf((attrs.match(/\bs="(\d+)"/) || [])[1]) });
    }
    rows.set(Number(rm[1]), cells);
  }

  // Birleştirilmiş hücrelerde değer/renk yalnızca sol üstte durur (TEZ blokları böyle)
  const mc = sheet.match(/<mergeCells[^>]*>([\s\S]*?)<\/mergeCells>/);
  if (mc) {
    for (const m of mc[1].matchAll(/ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)) {
      if (m[2] !== m[4]) continue;
      const row = rows.get(Number(m[2]));
      if (!row) continue;
      const a = colNum(m[1] + m[2]), b = colNum(m[3] + m[4]);
      const src = row.get(a);
      if (!src) continue;
      for (let n = a + 1; n <= b; n++) {
        const cur = row.get(n) || { v: '', color: null };
        row.set(n, { v: cur.v || src.v, color: cur.color || src.color });
      }
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return rows;
}

function extract(rows) {
  const assignments = {}, rotations = [];
  for (const [rn, id] of Object.entries(PEOPLE)) {
    const cells = rows.get(Number(rn));
    if (!cells) { console.warn(`uyarı: satır ${rn} (${id}) bulunamadı`); continue; }
    let runColor = null, runName = null;
    for (let n = FIRST_COL; n <= LAST_COL; n++) {
      const c = cells.get(n) || {};
      if (!c.color) { runColor = null; runName = null; continue; }
      const month = colToMonth(n);
      const text = (c.v || '').trim();
      const isName = text && isNaN(Number(text.replace(',', '.')));
      if (c.color !== runColor) { runColor = c.color; runName = null; }
      if (isName) runName = text;

      if (HOSP[c.color]) (assignments[month] ||= {})[id] = HOSP[c.color];
      else if (c.color === ROT_COLOR) rotations.push({ r: id, month, name: runName || 'Dış rotasyon' });
      else if (c.color === TEZ_COLOR) rotations.push({ r: id, month, name: runName || 'TEZ' });
    }
  }
  return { assignments, rotations };
}

/** Sayfanın kendi özet sütunlarıyla (ATZ/ATK/ATA/MAS/ROT/TEZ) karşılaştır */
function verify(rows) {
  const ORDER = ['00FF00', '00FFFF', 'FFFF00', 'FF00FF', ROT_COLOR, TEZ_COLOR];
  const LABEL = ['ATZ', 'ATK', 'ATA', 'MAS', 'ROT', 'TEZ'];
  let ok = true;
  for (const [rn, id] of Object.entries(PEOPLE)) {
    const cells = rows.get(Number(rn));
    if (!cells) continue;
    const mine = ORDER.map(() => 0);
    for (let n = FIRST_COL; n <= LAST_COL; n++) {
      const i = ORDER.indexOf((cells.get(n) || {}).color);
      if (i >= 0) mine[i]++;
    }
    const diffs = LABEL.map((lab, i) => {
      const cell = cells.get(122 + i);
      const want = cell && cell.v !== '' ? Math.round(Number(cell.v)) : null;
      return want != null && want !== mine[i] ? `${lab} ${mine[i]}≠${want}` : null;
    }).filter(Boolean);
    if (diffs.length) { ok = false; console.warn(`  ${id}: ${diffs.join(', ')}`); }
  }
  return ok;
}

const xlsx = process.argv[2];
if (!xlsx) { console.error('Kullanım: node tools/import-rotation.js <rotasyon.xlsx> [--dry]'); process.exit(1); }

const rows = readSheet(xlsx);
const { assignments, rotations } = extract(rows);
const months = Object.keys(assignments).sort();
console.log(`kadro: ${months.length} ay (${months[0]} → ${months[months.length - 1]}) · rotasyon: ${rotations.length} kayıt`);
console.log('özet sütunlarıyla karşılaştırma:');
if (verify(rows)) console.log('  tüm sayılar tutuyor');

if (process.argv.includes('--dry')) {
  const now = new Date().toISOString().slice(0, 7);
  console.log(`\n${now} kadrosu:`, JSON.stringify(assignments[now] || {}, null, 0));
  process.exit(0);
}
const target = path.join(__dirname, '..', 'data', 'schedule.json');
const db = JSON.parse(fs.readFileSync(target, 'utf8'));
db.assignments = assignments;
db.rotations = rotations;
fs.writeFileSync(target, JSON.stringify(db, null, 2));
console.log(`\ndata/schedule.json güncellendi`);
