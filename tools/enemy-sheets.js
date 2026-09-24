// Detecta automáticamente los dibujos de una hoja de enemigo (filas y columnas irregulares).
// Devuelve filas de "grupos": cada grupo = cuerpo principal + efectos cercanos (estrellas, zarpazos...)
const fs = require('fs'), path = require('path'), { decode } = require('./png.js');

function analyzeSheet(file, opt = {}) {
  const im = decode(fs.readFileSync(file)), { w, h, data } = im;
  const solid = k => data[k * 4 + 3] >= 150;
  const lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let i = 0; i < w * h; i++) {
    if (lab[i] >= 0 || !solid(i)) continue;
    const id = comps.length, st = [i]; lab[i] = id;
    let n = 0, sx = 0, sy = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0;
      n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx; if (lab[k] < 0 && solid(k)) { lab[k] = id; st.push(k); }
      }
    }
    comps.push({ id, n, cx: sx / n, cy: sy / n, x0, y0, x1, y1 });
  }
  let cs = comps.filter(c => c.n >= 25 && !(opt.minX && c.x1 < opt.minX));
  const maxN = Math.max(...cs.map(c => c.n));
  const bodies = cs.filter(c => c.n >= maxN * (opt.bodyFrac || 0.12)).map(c => ({ ...c, parts: [c] }));
  // efectos pequeños -> al cuerpo más cercano (si están cerca); números/etiquetas debajo -> fuera
  for (const c of cs) {
    if (bodies.some(b => b.id === c.id)) continue;
    let best = null, bd = 1e9;
    for (const b of bodies) {
      const dx = Math.max(0, b.x0 - c.x1, c.x0 - b.x1), dy = Math.max(0, b.y0 - c.y1, c.y0 - b.y1), d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best || bd > (opt.attach || 70)) continue;
    if (c.y0 > best.y1 + 4 && c.n < 3000) continue; // debajo del dibujo: etiqueta/número
    best.parts.push(c);
  }
  // filas por altura
  bodies.sort((a, b) => a.cy - b.cy);
  const medH = bodies.map(b => b.y1 - b.y0).sort((a, b) => a - b)[bodies.length >> 1];
  const rows = [];
  for (const b of bodies) {
    const r = rows[rows.length - 1];
    if (r && Math.abs(b.cy - r.cy) < medH * 0.5) { r.items.push(b); r.cy = r.items.reduce((s, x) => s + x.cy, 0) / r.items.length; }
    else rows.push({ cy: b.cy, items: [b] });
  }
  rows.forEach(r => r.items.sort((a, b) => a.cx - b.cx));
  for (const r of rows) for (const b of r.items) {
    b.gx0 = Math.min(...b.parts.map(p => p.x0)); b.gy0 = Math.min(...b.parts.map(p => p.y0));
    b.gx1 = Math.max(...b.parts.map(p => p.x1)); b.gy1 = Math.max(...b.parts.map(p => p.y1));
    b.ids = new Set(b.parts.map(p => p.id));
  }
  return { im, lab, rows };
}
module.exports = { analyzeSheet };

if (require.main === module) {
  const dir = path.join(__dirname, '..', 'enemigos');
  for (const f of fs.readdirSync(dir)) {
    const { rows } = analyzeSheet(path.join(dir, f), f === 'rata.png' ? { minX: 200 } : f === 'murcielago.png' ? { minX: 180 } : f === 'lagarto.png' ? { minX: 250 } : {});
    console.log(f.padEnd(14), rows.map(r => r.items.length + '[' + r.items.map(b => (b.y1 - b.y0)).join(',') + ']').join('  '));
  }
}
