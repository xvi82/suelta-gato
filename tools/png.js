// Mini PNG decoder/encoder (RGBA 8-bit, sin dependencias)
const zlib = require('zlib');
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function decode(buf) {
  let p = 8, w, h, ctype, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = ctype === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
  const out = Buffer.alloc(w * h * 4), prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = k < bpp ? cur[x * bpp + k] : 255;
    cur.copy(prev);
  }
  return { w, h, data: out };
}
function encode(w, h, data) {
  // filtro adaptativo por fila (mejor compresión)
  const st = w * 4, raw = Buffer.alloc((st + 1) * h), cand = [0, 1, 2, 4].map(() => Buffer.alloc(st));
  for (let y = 0; y < h; y++) {
    const cur = data.subarray(y * st, (y + 1) * st), prev = y ? data.subarray((y - 1) * st, y * st) : Buffer.alloc(st);
    let best = 0, bestSum = Infinity;
    [0, 1, 2, 4].forEach((f, k) => {
      const o = cand[k]; let sum = 0;
      for (let i = 0; i < st; i++) {
        const a = i >= 4 ? cur[i - 4] : 0, b = prev[i], c = i >= 4 ? prev[i - 4] : 0;
        let p = 0; if (f === 1) p = a; else if (f === 2) p = b; else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        const v = (cur[i] - p) & 255; o[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = k; }
    });
    raw[y * (st + 1)] = [0, 1, 2, 4][best]; cand[best].copy(raw, y * (st + 1) + 1);
  }
  const chunk = (type, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(type, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// PNG indexado (paleta de hasta 256 colores): pixels = índice por píxel
function encodeIndexed(w, h, pixels, palette) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 1; for (let x = 0; x < w; x++) { const i = y * w + x; raw[y * (w + 1) + 1 + x] = (pixels[i] - (x ? pixels[i - 1] : 0)) & 255; } }
  const chunk = (type, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(type, 4, 'ascii'); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(palette.length * 3); palette.forEach((c, i) => { plte[i * 3] = c[0]; plte[i * 3 + 1] = c[1]; plte[i * 3 + 2] = c[2]; });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Cuantización "median cut" a n colores
function quantize(rgba, n = 256) {
  const hist = new Map();
  for (let i = 0; i < rgba.length; i += 4) { const k = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3); hist.set(k, (hist.get(k) || 0) + 1); }
  const cols = [...hist.entries()].map(([k, c]) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4, c]);
  let boxes = [cols];
  while (boxes.length < n) {
    let bi = -1, best = -1, ch = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; for (let c = 0; c < 3; c++) { let lo = 255, hi = 0; for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; } const score = (hi - lo) * Math.log(1 + b.reduce((a, p) => a + p[3], 0)); if (score > best) { best = score; bi = i; ch = c; } } });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[ch] - q[ch]); const total = b.reduce((a, p) => a + p[3], 0); let acc = 0, cutAt = 1;
    for (let i = 0; i < b.length; i++) { acc += b[i][3]; if (acc >= total / 2) { cutAt = Math.max(1, Math.min(b.length - 1, i + 1)); break; } }
    boxes.splice(bi, 1, b.slice(0, cutAt), b.slice(cutAt));
  }
  const palette = boxes.map(b => { let r = 0, g = 0, bl = 0, t = 0; for (const p of b) { r += p[0] * p[3]; g += p[1] * p[3]; bl += p[2] * p[3]; t += p[3]; } return [Math.round(r / t), Math.round(g / t), Math.round(bl / t)]; });
  const cache = new Map(), idx = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const k = ((rgba[i] >> 2) << 12) | ((rgba[i + 1] >> 2) << 6) | (rgba[i + 2] >> 2);
    let v = cache.get(k);
    if (v === undefined) { let bd = 1e9; palette.forEach((c, pi) => { const d = (c[0] - rgba[i]) ** 2 * 2 + (c[1] - rgba[i + 1]) ** 2 * 3 + (c[2] - rgba[i + 2]) ** 2; if (d < bd) { bd = d; v = pi; } }); cache.set(k, v); }
    idx[j] = v;
  }
  return { palette, idx };
}
module.exports = { decode, encode, encodeIndexed, quantize };
