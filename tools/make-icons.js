// Find My Asistan — PWA ikon üreticisi. Bağımlılık yok, saf Node.
//   node tools/make-icons.js            -> varsayılan sürümü assets/ içine yazar
//   node tools/make-icons.js --variant=tools --out=/tmp/x   -> karşılaştırma için
const zlib = require('node:zlib'), fs = require('node:fs'), path = require('node:path');

/* ---------- minimal PNG yazıcı ---------- */
const T = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc = (b) => { let c = -1; for (const x of b) c = T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- renk + geometri ---------- */
const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const t = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return t.map(v => (v + m) * 255);
};
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** A-B parçasına uzaklık */
const segD = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy)));
  return Math.hypot(wx - t * vx, wy - t * vy);
};
const rotP = (px, py, a) => {
  const c = Math.cos(a), s = Math.sin(a);
  return [px * c + py * s, -px * s + py * c];
};

const INK = [7, 8, 13];
const AMBER = hsl(32, 94, 60);
const IVORY_TOP = [255, 251, 243];
const IVORY_BOT = [240, 219, 191];
const STEEL_TOP = [226, 231, 242];
const STEEL_BOT = [166, 175, 194];
const GRIP_TOP  = [214, 176, 132];
const GRIP_BOT  = [166, 132, 95];

/**
 * Kemik: gövde (kapsül) + dört topuz.
 * Okunurluk için üç oran korunmalı — ayrıntı CLAUDE.md'de.
 */
function boneSD(lx, ly, b) {
  let sd = segD(lx, ly, -b.lobeDx, 0, b.lobeDx, 0) - b.shaftH;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const dl = Math.hypot(lx - sx * b.lobeDx, ly - sy * b.lobeDy) - b.lobeR;
    if (dl < sd) sd = dl;
  }
  return sd;
}

function draw(S, variant) {
  const buf = Buffer.alloc(S * S * 4);
  const cx = S / 2, cy = S / 2;
  const withTools = variant === 'tools';
  const withScrew = variant === 'screw' || variant === 'screwring';
  const keepRings = variant === 'rings' || variant === 'screwring';
  const anyTool = withTools || withScrew;
  const k = variant === 'screwring' ? 0.72 : 1;   // halkalı sürümde aletler küçülür

  // Kemik oranları
  const b = variant === 'screwring'
    ? { halfSpan: S * 0.128, lobeR: S * 0.054, shaftH: S * 0.034, lobeDy: S * 0.038, tilt: -20 * Math.PI / 180 }
    : anyTool
    ? { halfSpan: S * 0.168, lobeR: S * 0.071, shaftH: S * 0.045, lobeDy: S * 0.050, tilt: -20 * Math.PI / 180 }
    : { halfSpan: S * 0.152, lobeR: S * 0.066, shaftH: S * 0.042, lobeDy: S * 0.046, tilt: -22 * Math.PI / 180 };
  b.lobeDx = b.halfSpan - b.lobeR;
  const cosT = Math.cos(b.tilt), sinT = Math.sin(b.tilt);

  const rings = variant === 'screwring' ? [[S * 0.405, S * 0.022, 0.32]]
    : keepRings ? [[S * 0.335, S * 0.026, 0.26], [S * 0.225, S * 0.032, 0.58]]
    : [];
  const outline = S * 0.015 * (k < 1 ? 0.82 : 1);
  const sdAngle = -42 * Math.PI / 180;   // tornavida ucu sağ üste
  const drAngle =  42 * Math.PI / 180;   // matkap ucu sol üste

  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let col = [5, 6, 10];
    const px = x - cx + 0.5, py = y - cy + 0.5;
    const d = Math.hypot(px, py);

    // zemin ışıması
    const g1 = clamp01(1 - Math.hypot((x - S * 0.22) / (S * 0.78), (y - S * 0.12) / (S * 0.78)));
    col = mix(col, hsl(266, 86, 54), Math.pow(g1, 2.0) * 0.58);
    const g2 = clamp01(1 - Math.hypot((x - S * 0.88) / (S * 0.62), (y - S * 0.94) / (S * 0.62)));
    col = mix(col, hsl(28, 92, 54), Math.pow(g2, 2.2) * 0.38);

    for (const [r, w, op] of rings) {
      const cover = clamp01(w / 2 + 0.5 - Math.abs(d - r));
      if (cover > 0) col = mix(col, [236, 239, 246], cover * op);
    }

    // merkezdeki kehribar hale
    const halo = clamp01(1 - d / (S * (anyTool ? 0.34 : 0.30)));
    if (halo > 0) col = mix(col, AMBER, Math.pow(halo, 1.9) * (anyTool ? 0.5 : 0.66));

    if (anyTool) {
      // --- tornavida ---
      {
        const [tx, ty] = rotP(px, py, sdAngle);
        const grip  = segD(tx, ty, -S * 0.290 * k, 0, -S * 0.170 * k, 0) - S * 0.062 * k;
        const neck  = segD(tx, ty, -S * 0.172 * k, 0, -S * 0.140 * k, 0) - S * 0.028 * k;
        const shaft = segD(tx, ty, -S * 0.145 * k, 0,  S * 0.235 * k, 0) - S * 0.023 * k;
        const tip   = segD(tx, ty,  S * 0.235 * k, 0,  S * 0.285 * k, 0) - S * 0.034 * k;
        const sd = Math.min(grip, neck, shaft, tip);
        const isGrip = grip <= Math.min(neck, shaft, tip);
        const edge = clamp01(0.5 - (sd - outline));
        if (edge > 0) col = mix(col, INK, edge);
        const fill = clamp01(0.5 - sd);
        if (fill > 0) {
          const kk = clamp01(0.5 - ty / (S * 0.20));
          col = mix(col, isGrip ? mix(GRIP_BOT, GRIP_TOP, kk) : mix(STEEL_BOT, STEEL_TOP, kk), fill);
        }
      }
      // --- matkap (yalnızca çift aletli sürümde) ---
      if (withTools) {
        const [tx, ty] = rotP(px, py, drAngle);
        const body  = segD(tx, ty, -S * 0.215, 0, S * 0.030, 0) - S * 0.072;
        const chuck = segD(tx, ty,  S * 0.030, 0, S * 0.110, 0) - S * 0.042;
        const bit   = segD(tx, ty,  S * 0.110, 0, S * 0.275, 0) - S * 0.017;
        const hand  = segD(tx, ty, -S * 0.120, S * 0.050, -S * 0.170, S * 0.230) - S * 0.058;
        const sd = Math.min(body, chuck, bit, hand);
        const isGrip = hand <= Math.min(body, chuck, bit);
        const edge = clamp01(0.5 - (sd - outline));
        if (edge > 0) col = mix(col, INK, edge);
        const fill = clamp01(0.5 - sd);
        if (fill > 0) {
          const kk = clamp01(0.5 - ty / (S * 0.26));
          col = mix(col, isGrip ? mix(GRIP_BOT, GRIP_TOP, kk) : mix(STEEL_BOT, STEEL_TOP, kk), fill);
        }
      }
    }

    // --- kemik (en önde) ---
    const lx = px * cosT + py * sinT;
    const ly = -px * sinT + py * cosT;
    const sd = boneSD(lx, ly, b);
    const edge = clamp01(0.5 - (sd - outline));
    if (edge > 0) col = mix(col, INK, edge);
    const cover = clamp01(0.5 - sd);
    if (cover > 0) {
      const shade = clamp01(0.5 - ly / (2 * (b.lobeDy + b.lobeR)));
      col = mix(col, mix(IVORY_BOT, IVORY_TOP, Math.pow(shade, 0.85)), cover);
    }

    const o = (y * S + x) * 4;
    buf[o] = Math.round(col[0]); buf[o+1] = Math.round(col[1]); buf[o+2] = Math.round(col[2]); buf[o+3] = 255;
  }
  return png(S, S, buf);
}

const args = process.argv.slice(2);
const arg = (k, dv) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${dv}`).split('=')[1];
const variant = arg('variant', 'rings');
const out = arg('out', path.join(__dirname, '..', 'assets'));
fs.mkdirSync(out, { recursive: true });
for (const s of [180, 192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), draw(s, variant));
console.log(`ikonlar yazıldı → ${out}  (sürüm: ${variant})`);
