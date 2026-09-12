const zlib = require('zlib'), fs = require('fs');
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
const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const t = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
  return t.map(v => (v + m) * 255);
};
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Konum işareti: eş merkezli halkalar + merkezde kehribar nokta.
function draw(S) {
  const buf = Buffer.alloc(S * S * 4);
  const cx = S / 2, cy = S / 2;
  const platinum = [236, 239, 246];
  const amber = hsl(32, 94, 60);

  // halkalar: [yarıçap, kalınlık, opaklık]
  const rings = [
    [S * 0.335, S * 0.026, 0.26],
    [S * 0.225, S * 0.032, 0.58],
  ];
  const dotR = S * 0.088;

  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let col = [5, 6, 10];

    // zemin ışıması — uygulamanın ambiyansıyla aynı dil
    const g1 = clamp01(1 - Math.hypot((x - S * 0.22) / (S * 0.78), (y - S * 0.12) / (S * 0.78)));
    col = mix(col, hsl(266, 86, 54), Math.pow(g1, 2.0) * 0.58);
    const g2 = clamp01(1 - Math.hypot((x - S * 0.88) / (S * 0.62), (y - S * 0.94) / (S * 0.62)));
    col = mix(col, hsl(28, 92, 54), Math.pow(g2, 2.2) * 0.38);

    const d = Math.hypot(x - cx + 0.5, y - cy + 0.5);

    // halkalar
    for (const [r, w, op] of rings) {
      const cover = clamp01(w / 2 + 0.5 - Math.abs(d - r));
      if (cover > 0) col = mix(col, platinum, cover * op);
    }

    // merkez noktanın halesi
    const halo = clamp01(1 - d / (dotR * 3.1));
    if (halo > 0) col = mix(col, amber, Math.pow(halo, 2.6) * 0.5);

    // merkez nokta
    const dot = clamp01(dotR + 0.5 - d);
    if (dot > 0) col = mix(col, amber, dot);

    const o = (y * S + x) * 4;
    buf[o] = Math.round(col[0]); buf[o+1] = Math.round(col[1]); buf[o+2] = Math.round(col[2]); buf[o+3] = 255;
  }
  return png(S, S, buf);
}

for (const s of [180, 192, 512]) {
  fs.writeFileSync(`/Users/yigit/Desktop/cod/asistan-panel/assets/icon-${s}.png`, draw(s));
}
console.log('ikonlar yenilendi');
