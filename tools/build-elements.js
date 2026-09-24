// Recorta, limpia y empaqueta los sprites generados de elementos/.
// Genera js/elements.js; las imágenes originales nunca se modifican.
const fs = require('fs'), path = require('path');
const { decode, encode } = require('./png.js');

const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'elementos');
const load = name => decode(fs.readFileSync(path.join(DIR, name)));
const lote1 = load('lote 1.png'), lote2 = load('lote 2.png'), lote4 = load('lote 4.png');

function crop(im, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y));
  w = Math.min(im.w - x, Math.round(w)); h = Math.min(im.h - y, Math.round(h));
  const data = Buffer.alloc(w * h * 4);
  for (let yy = 0; yy < h; yy++) im.data.copy(data, yy * w * 4, ((y + yy) * im.w + x) * 4, ((y + yy) * im.w + x + w) * 4);
  return { w, h, data };
}

// Elimina el fondo neutro conectado a los bordes. Las zonas blancas encerradas
// dentro de un objeto se conservan, pero desaparecen cuadrículas y sombras grises.
function clearNeutralBackground(im, minLight = 155, maxSpread = 28) {
  const { w, h, data } = im, gone = new Uint8Array(w * h), queue = new Int32Array(w * h); let q0 = 0, q1 = 0;
  const neutral = i => {
    const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2];
    return Math.max(r, g, b) - Math.min(r, g, b) <= maxSpread && (r + g + b) / 3 >= minLight;
  };
  const push = i => { if (!gone[i] && neutral(i)) { gone[i] = 1; queue[q1++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (q0 < q1) {
    const i = queue[q0++], x = i % w, y = (i / w) | 0;
    if (x) push(i - 1); if (x + 1 < w) push(i + 1); if (y) push(i - w); if (y + 1 < h) push(i + w);
  }
  for (let i = 0; i < gone.length; i++) if (gone[i]) data[i * 4 + 3] = 0;
  return im;
}

function cleanAlpha(im) {
  for (let i = 3; i < im.data.length; i += 4) {
    const a = im.data[i];
    im.data[i] = a < 24 ? 0 : Math.min(255, Math.round((a - 24) * 255 / 231));
  }
  return im;
}

// Quita restos del sprite vecino: tiras finas pegadas al borde del recorte.
// strong: cualquier mancha que toque el borde y sea mucho menor que el dibujo principal (recortes manuales del lote 4).
function dropEdgeScraps(im, strong = false) {
  const { w, h, data } = im, seen = new Uint8Array(w * h), comps = [];
  const ink = i => data[i * 4 + 3] > 40;
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || !ink(i)) continue;
    const q = [i]; seen[i] = 1;
    let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, edge = false;
    const pix = [];
    while (q.length) {
      const p = q.pop(); pix.push(p); n++;
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      if (x && !seen[p - 1] && ink(p - 1)) { seen[p - 1] = 1; q.push(p - 1); }
      if (x + 1 < w && !seen[p + 1] && ink(p + 1)) { seen[p + 1] = 1; q.push(p + 1); }
      if (y && !seen[p - w] && ink(p - w)) { seen[p - w] = 1; q.push(p - w); }
      if (y + 1 < h && !seen[p + w] && ink(p + w)) { seen[p + w] = 1; q.push(p + w); }
    }
    comps.push({ n, w: x1 - x0 + 1, h: y1 - y0 + 1, edge, pix });
  }
  const main = comps.reduce((m, c) => Math.max(m, c.n), 0);
  for (const c of comps) {
    if (c.edge && (strong ? c.n < main * 0.6 : Math.min(c.w, c.h) <= 7 && c.n < main * 0.2)) for (const p of c.pix) data[p * 4 + 3] = 0;
  }
  return im;
}

function trim(im, pad = 2) {
  let x0 = im.w, y0 = im.h, x1 = -1, y1 = -1;
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (im.data[(y * im.w + x) * 4 + 3] > 20) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < 0) return { w: 1, h: 1, data: Buffer.alloc(4) };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(im.w - 1, x1 + pad); y1 = Math.min(im.h - 1, y1 + pad);
  return crop(im, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}

// Reducción por caja con alfa premultiplicado: evita halos claros alrededor del arte.
function resize(im, targetH) { return resizeTo(im, Math.max(1, Math.round(im.w * targetH / im.h)), Math.max(1, targetH)); }
function resizeTo(im, w, h) {
  const kx = w / im.w, ky = h / im.h, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ax = x / kx, bx = (x + 1) / kx, ay = y / ky, by = (y + 1) / ky;
    let rr = 0, gg = 0, bb = 0, aa = 0, n = 0;
    for (let sy = Math.floor(ay); sy < Math.ceil(by); sy++) for (let sx = Math.floor(ax); sx < Math.ceil(bx); sx++) {
      if (sx < 0 || sy < 0 || sx >= im.w || sy >= im.h) continue;
      const o = (sy * im.w + sx) * 4, a = im.data[o + 3] / 255;
      rr += im.data[o] * a; gg += im.data[o + 1] * a; bb += im.data[o + 2] * a; aa += a; n++;
    }
    const o = (y * w + x) * 4;
    if (aa > 0) { out[o] = rr / aa; out[o + 1] = gg / aa; out[o + 2] = bb / aa; out[o + 3] = Math.round(255 * aa / Math.max(1, n)); }
  }
  return { w, h, data: out };
}

const frames = {}, pieces = [];
function prep(im, box, bg = true) {
  let p = crop(im, ...box);
  p = bg ? clearNeutralBackground(p, bg.minLight || 155, bg.maxSpread || 28) : cleanAlpha(p);
  // erase: rectángulos [x, y, w, h] (relativos al recorte) con restos de un sprite vecino.
  for (const [ex, ey, ew, eh] of (bg && bg.erase) || []) for (let y = ey; y < Math.min(p.h, ey + eh); y++) for (let x = ex; x < Math.min(p.w, ex + ew); x++) p.data[(y * p.w + x) * 4 + 3] = 0;
  return trim(dropEdgeScraps(p, bg && bg.strong));
}
function add(name, im, box, targetH, bg = true) {
  const p = resize(prep(im, box, bg), targetH);
  (frames[name] ||= []).push(p); pieces.push(p);
}

// Lote 1 no es una cuadrícula uniforme: las filas de abajo se desplazan y un
// corte fijo parte el bloque ? y el ladrillo, dejando un hueco en el centro.
function contentRows(im, minSize = 24) {
  const bg = (x, y) => {
    const o = (y * im.w + x) * 4, r = im.data[o], g = im.data[o + 1], b = im.data[o + 2];
    return im.data[o + 3] < 20 || (Math.max(r, g, b) - Math.min(r, g, b) <= 22 && (r + g + b) / 3 >= 200);
  };
  const rowInk = new Uint16Array(im.h);
  for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x += 2) if (!bg(x, y)) rowInk[y]++;
  const bands = [];
  for (let y = 0; y < im.h;) {
    while (y < im.h && rowInk[y] < 20) y++;
    const y0 = y;
    while (y < im.h && rowInk[y] >= 20) y++;
    if (y - y0 > minSize) bands.push([y0, y - 1]);
  }
  return bands.map(([y0, y1]) => {
    const col = new Uint16Array(im.w);
    for (let y = y0; y <= y1; y++) for (let x = 0; x < im.w; x++) if (!bg(x, y)) col[x]++;
    const boxes = [];
    for (let x = 0; x < im.w;) {
      while (x < im.w && col[x] < 6) x++;
      const x0 = x;
      while (x < im.w && col[x] >= 6) x++;
      if (x - x0 < minSize) continue;
      let top = y1, bot = y0;
      for (let y = y0; y <= y1; y++) for (let xx = x0; xx < x; xx += 2) if (!bg(xx, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
      const w = x - x0, h = bot - top + 1;
      if (h < minSize) continue;
      const bx = Math.max(0, x0 - 3), by = Math.max(0, top - 3);
      boxes.push([bx, by, Math.min(im.w - bx, w + 6), Math.min(im.h - by, h + 6)]);
    }
    return boxes;
  });
}
const itemRows = [
  ['peseta', 6, 30], ['bocadillo', 3, 30], ['mojo', 3, 33], ['turron', 3, 25], ['tortilla', 3, 29],
  ['churro', 3, 25], ['chancla', 3, 25], ['corazon', 3, 29], ['qblock', 4, 36], ['brick', 4, 36],
];
const found = contentRows(lote1);
if (found.length !== itemRows.length) throw new Error('Lote 1: se esperaban ' + itemRows.length + ' filas y hay ' + found.length);
itemRows.forEach(([name, n, th], row) => {
  if (found[row].length !== n) throw new Error(name + ': se esperaban ' + n + ' sprites y hay ' + found[row].length);
  found[row].forEach(box => add(name, lote1, box, th, { minLight: 145, maxSpread: 34 }));
});

// Comidas nuevas (opcionales): elementos/comidas/<nombre>.png, una tira de 3 poses sobre fondo blanco,
// como las filas del lote 1. Si falta alguna, el juego usa su dibujo provisional de pixel-art.
const FOOD = [['gazpacho', 30], ['paella', 26], ['cocido', 29], ['cafe', 30]];
for (const [name, th] of FOOD) {
  const file = path.join(DIR, 'comidas', name + '.png');
  if (!fs.existsSync(file)) { console.log('(sin comidas/' + name + '.png: se usa el dibujo provisional)'); continue; }
  const im = decode(fs.readFileSync(file)), boxes = contentRows(im).flat();
  if (boxes.length !== 3) throw new Error('comidas/' + name + '.png: se esperaban 3 poses y hay ' + boxes.length);
  // misma escala para las 3 poses (la de la pose quieta): los destellos y el vapor
  // hacen más altas las otras y, escaladas por separado, la comida encogería al animarse
  const raw = boxes.map(box => prep(im, box, { minLight: 145, maxSpread: 34 })), k = th / raw[0].h;
  raw.forEach(p => { const r = resizeTo(p, Math.max(1, Math.round(p.w * k)), Math.max(1, Math.round(p.h * k))); (frames[name] ||= []).push(r); pieces.push(r); });
}

// Lote 2: 16 filas de efectos. Los dibujos no siguen la rejilla de 128 px (cada fila se desplaza un poco),
// así que se separan por manchas: filas por huecos horizontales y fotogramas por los huecos más anchos entre manchas.
// uniform = misma escala en toda la fila (los efectos crecen y se deshacen como en la hoja); si no, cada fotograma a la altura th.
const fxRows = [
  ['fuego', 4, 23], ['chancla_throw', 6, 23], ['tinta', 4, 20], ['golf', 4, 16], ['caca', 3, 19],
  ['pelo', 4, 22], ['ovillo', 4, 27], ['onda', 5, 36, 1], ['zarpazo', 5, 58, 1], ['impacto', 4, 52, 1],
  ['polvo', 6, 32, 1], ['hielo', 5, 32, 1], ['agua', 6, 45, 1], ['burbujas', 4, 38, 1], ['lava', 6, 50, 1], ['ko', 6, 52, 1],
];
function lote2Frames(im, rowsSpec) {
  const { w, h, data } = im, ink = i => data[i * 4 + 3] > 8;
  const prof = new Uint16Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ink(y * w + x)) prof[y]++;
  let bands = [];
  for (let y = 0; y < h;) { while (y < h && !prof[y]) y++; const y0 = y; while (y < h && prof[y]) y++; if (y > y0) bands.push([y0, y - 1]); }
  // dos filas que se tocan (p. ej. zarpazo e impacto): se parten por la línea con menos tinta del centro de la banda
  while (bands.length < rowsSpec.length) {
    const hs = bands.map(b => b[1] - b[0]), med = [...hs].sort((a, b) => a - b)[hs.length >> 1], i = hs.indexOf(Math.max(...hs));
    if (hs[i] < med * 1.6) break;
    const [y0, y1] = bands[i]; let cut = y0 + (hs[i] >> 1);
    for (let y = y0 + Math.round(hs[i] * 0.3); y < y0 + hs[i] * 0.7; y++) if (prof[y] < prof[cut]) cut = y;
    bands.splice(i, 1, [y0, cut], [cut + 1, y1]);
  }
  if (bands.length !== rowsSpec.length) throw new Error('Lote 2: se esperaban ' + rowsSpec.length + ' filas y hay ' + bands.length);
  const lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let i = 0; i < w * h; i++) {
    if (lab[i] >= 0 || !ink(i)) continue;
    const c = { id: comps.length, n: 0, x0: w, y0: h, x1: -1, y1: -1, sy: 0 }, st = [i]; lab[i] = c.id;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0; c.n++; c.sy += y;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const k = ny * w + nx; if (lab[k] < 0 && ink(k)) { lab[k] = c.id; st.push(k); }
      }
    }
    comps.push(c);
  }
  rowsSpec.forEach(([name, n, th, uniform], r) => {
    const [by0, by1] = bands[r], cs = comps.filter(c => c.n >= 3 && c.sy / c.n >= by0 && c.sy / c.n <= by1).sort((a, b) => a.x0 - b.x0);
    // n-1 huecos más anchos entre manchas consecutivas = separaciones entre fotogramas
    const gaps = []; let reach = -1;
    cs.forEach((c, i) => { if (i) gaps.push({ i, g: c.x0 - reach }); reach = Math.max(reach, c.x1); });
    const cuts = gaps.sort((a, b) => b.g - a.g).slice(0, n - 1).map(g => g.i).sort((a, b) => a - b);
    if (cuts.length !== n - 1) throw new Error(name + ': no se pudieron separar ' + n + ' fotogramas');
    const groups = [0, ...cuts].map((s, k) => cs.slice(s, k < cuts.length ? cuts[k] : cs.length));
    const pics = groups.map(g => {
      const ids = new Set(g.map(c => c.id)), x0 = Math.min(...g.map(c => c.x0)), y0 = Math.min(...g.map(c => c.y0));
      const pw = Math.max(...g.map(c => c.x1)) - x0 + 1, ph = Math.max(...g.map(c => c.y1)) - y0 + 1, pic = { w: pw, h: ph, data: Buffer.alloc(pw * ph * 4) };
      for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const k = (y0 + y) * w + x0 + x; if (ids.has(lab[k])) data.copy(pic.data, (y * pw + x) * 4, k * 4, k * 4 + 4); }
      return trim(cleanAlpha(pic));
    });
    const k = th / Math.max(...pics.map(q => q.h));
    for (const q of pics) {
      const out = uniform ? resizeTo(q, Math.max(1, Math.round(q.w * k)), Math.max(1, Math.round(q.h * k))) : resize(q, th);
      (frames[name] ||= []).push(out); pieces.push(out);
    }
  });
}
lote2Frames(lote2, fxRows);

// Lote 4: recortes manuales (ajustados a las manchas reales para no llevarse trozos del vecino); el trim posterior ajusta cada silueta.
const L4 = erase => ({ minLight: 150, maxSpread: 27, erase, strong: true });
const P = (name, box, h, erase) => add(name, lote4, box, h, L4(erase));
// Decorado animado: todas las poses con la misma escala (el más alto mide h) para que no cambie de tamaño al animarse.
const PG = (name, boxes, h) => {
  const ps = boxes.map(b => prep(lote4, b, L4())), k = h / Math.max(...ps.map(q => q.h));
  for (const q of ps) { const r = resizeTo(q, Math.max(1, Math.round(q.w * k)), Math.max(1, Math.round(q.h * k))); (frames[name] ||= []).push(r); pieces.push(r); }
};
// Las Palmas
// Solo la sombrilla abierta: las otras dos poses cambian de tamaño y llevan flechas de movimiento.
P('lp_sombrilla', [0, 45, 150, 215], 82, [[112, 88, 38, 127]]);
P('lp_toalla', [342, 195, 240, 65], 24); P('lp_parada', [562, 40, 70, 212], 78); P('lp_guaguero', [640, 50, 115, 210], 74);
// Cádiz
P('ca_farola', [762, 52, 122, 210], 94); PG('ca_chirigotero', [[886, 76, 121, 184], [1012, 80, 130, 180], [1139, 76, 114, 184]], 80); P('ca_bombo', [1250, 115, 198, 145], 52);
// Sotogrande
PG('so_bandera', [[18, 338, 86, 186], [112, 340, 80, 184], [190, 340, 62, 186]], 80);
PG('so_carrito', [[268, 336, 182, 188], [458, 336, 170, 188]], 70); P('so_seto', [636, 360, 160, 162], 62);
// Madrid
P('ma_oso', [800, 320, 172, 192], 88); P('ma_metro', [965, 315, 275, 195], 82); P('ma_banco', [1225, 360, 223, 150], 57);
// Parque Warner
P('wa_cola', [0, 565, 205, 205], 83); PG('wa_vagoneta', [[178, 630, 119, 125], [296, 630, 120, 125], [416, 630, 127, 125]], 55); P('wa_barrera', [565, 595, 190, 175], 62);
// Siam Park
PG('si_flotador', [[758, 685, 85, 70], [844, 665, 72, 90], [906, 625, 90, 128]], 56);
P('si_tobogan', [990, 560, 250, 210], 92); PG('si_agua', [[1235, 595, 70, 175], [1295, 575, 78, 195], [1360, 565, 88, 205]], 78);
// Teide
PG('te_tajinaste', [[8, 825, 118, 232], [125, 825, 106, 232], [230, 840, 112, 217]], 90);
P('te_roca', [340, 930, 182, 122], 57); P('te_senal', [516, 855, 98, 197], 76);
// Andorra. El telesilla se recorta aparte: las tres poses comparten el enganche
// del cable, así el balanceo no cambia de tamaño ni se lleva nieve o la silla vecina.
function largestComponent(im) {
  const { w, h, data } = im, seen = new Uint8Array(w * h);
  const ink = i => data[i * 4 + 3] > 40;
  let best = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || !ink(i)) continue;
    const q = [i]; seen[i] = 1; const pix = [];
    while (q.length) {
      const p = q.pop(); pix.push(p);
      const x = p % w, y = (p / w) | 0;
      for (const j of [p - 1, p + 1, p - w, p + w]) {
        if (j < 0 || j >= w * h || seen[j] || !ink(j)) continue;
        if (Math.abs((j % w) - x) > 1) continue;
        seen[j] = 1; q.push(j);
      }
    }
    if (pix.length > best.length) best = pix;
  }
  const keep = new Uint8Array(w * h);
  for (const p of best) keep[p] = 1;
  for (let i = 0; i < w * h; i++) if (!keep[i]) data[i * 4 + 3] = 0;
  return im;
}
function dropPaleStrokes(im) {
  const { w, h, data } = im;
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, r = data[o], g = data[o + 1], b = data[o + 2], a = data[o + 3];
    if (a < 30) continue;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (b > r + 12 && b > 145 && g > 110 && r > 80 && spread < 90) data[o + 3] = 0;
  }
  return im;
}
function hangerPole(im) {
  const y0 = Math.round(im.h * 0.12), y1 = Math.round(im.h * 0.42);
  const ink = (x, y) => im.data[(y * im.w + x) * 4 + 3] > 80;
  let x0 = -1, x1 = -1, top = y1;
  for (let x = 0; x < im.w; x++) {
    let run = 0, best = 0, bestTop = y1, curTop = 0;
    for (let y = y0; y < y1; y++) {
      if (ink(x, y)) { if (!run) curTop = y; run++; if (run > best) { best = run; bestTop = curTop; } }
      else run = 0;
    }
    if (best > (y1 - y0) * 0.45) {
      if (x0 < 0 || x > x1 + 6) { x0 = x; x1 = x; top = bestTop; }
      else { x1 = x; top = Math.min(top, bestTop); }
    }
  }
  return x0 < 0 ? { x: im.w / 2, y: 8 } : { x: (x0 + x1) / 2, y: top };
}
function addTelesilla() {
  const windows = [[628, 845, 130, 175], [755, 825, 120, 200], [875, 810, 150, 215]];
  const chairs = windows.map(box => trim(dropPaleStrokes(largestComponent(clearNeutralBackground(crop(lote4, ...box), 150, 27))), 1));
  const poles = chairs.map(hangerPole);
  chairs.forEach((c, i) => {
    const p = poles[i];
    for (let y = 0; y < Math.round(p.y) + 2 && y < c.h; y++) for (let x = 0; x < c.w; x++) {
      if (Math.abs(x - p.x) > 34) c.data[(y * c.w + x) * 4 + 3] = 0;
    }
  });
  const ax = Math.max(...poles.map(p => p.x)) + 6, ay = Math.max(...poles.map(p => p.y)) + 2;
  const right = Math.max(...chairs.map((c, i) => c.w - poles[i].x)) + 6;
  const below = Math.max(...chairs.map((c, i) => c.h - poles[i].y)) + 2;
  const W = Math.ceil(ax + right), H = Math.ceil(ay + below);
  const placed = chairs.map((c, i) => {
    const data = Buffer.alloc(W * H * 4);
    const ox = Math.round(ax - poles[i].x), oy = Math.round(ay - poles[i].y);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const s = (y * c.w + x) * 4;
      if (c.data[s + 3] < 16) continue;
      const dx = ox + x, dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      data.set(c.data.subarray(s, s + 4), (dy * W + dx) * 4);
    }
    return resize({ w: W, h: H, data }, 90);
  });
  frames.an_telesilla = placed;
  placed.forEach(p => pieces.push(p));
  frames.an_telesilla.push(placed[1]);
}
addTelesilla();
PG('an_nieve', [[1018, 795, 113, 140], [1131, 795, 110, 140], [1240, 788, 76, 147]], 61);
PG('an_monticulo', [[970, 930, 132, 122], [1103, 930, 104, 122], [1208, 930, 125, 122]], 43); P('an_senal', [1320, 825, 128, 255], 82);

// Ocho hojas de punto de control, en el orden de los niveles.
const flagFiles = fs.readdirSync(DIR).filter(f => /Imagen de Codex.*-[1-8]\.png$/i.test(f)).sort((a, b) => +(a.match(/-(\d+)\.png$/) || [0, 0])[1] - +(b.match(/-(\d+)\.png$/) || [0, 0])[1]);
if (flagFiles.length !== 8) throw new Error('Se esperaban 8 hojas de banderas y se encontraron ' + flagFiles.length);
flagFiles.forEach((file, i) => {
  const im = load(file), cw = im.w / 3;
  for (let f = 0; f < 3; f++) add('checkpoint_' + i, im, [f * cw + 8, 8, cw - 16, im.h - 16], 108, { minLight: 145, maxSpread: 32 });
});

// Funde cada borde con el opuesto para que la pieza se repita sin costura (horizontal y/o vertical).
function seamless(im, fx, fy, band = 0.12) {
  const { w, h } = im;
  const pass = (src, n, len, idx) => {
    const out = Buffer.from(src), bw = Math.max(1, Math.round(len * band));
    for (let k = 0; k < n; k++) for (let i = 0; i < bw; i++) {
      const a = 0.5 * (1 - i / bw);
      for (const [p, q] of [[i, len - 1 - i], [len - 1 - i, i]]) {
        const o = idx(k, p), s = idx(k, q);
        for (let c = 0; c < 4; c++) out[o + c] = src[o + c] * (1 - a) + src[s + c] * a;
      }
    }
    return out;
  };
  let data = im.data;
  if (fx) data = pass(data, h, w, (y, x) => (y * w + x) * 4);
  if (fy) data = pass(data, w, h, (x, y) => (y * w + x) * 4);
  return { w, h, data };
}
const inset = (im, l, t, r, b) => crop(im, l, t, im.w - l - r, im.h - t - b);
const addPiece = (name, p) => { (frames[name] ||= []).push(p); pieces.push(p); };
// Fondo blanco puro: tolerancia estricta para no comerse la nieve ni los brillos.
const STRICT = [236, 14];
function sheetPieces(file) {
  const im = load(file);
  return contentRows(im).flat().map(box => trim(clearNeutralBackground(crop(im, ...box), ...STRICT), 0));
}

// Tiles de terreno, en el orden de LOCATIONS: suelo, relleno, plataforma, bloque (36 px = un tile en pantalla).
const TILE_SHEETS = [
  'Imagen de ChatGPT 24 sept 2026, 23_44_21.png', // Las Palmas
  'Imagen de ChatGPT 24 sept 2026, 23_46_05.png', // Cádiz
  'Imagen de ChatGPT 24 sept 2026, 23_46_38.png', // Sotogrande
  'Imagen de ChatGPT 24 sept 2026, 23_46_56.png', // Madrid
  'Imagen de ChatGPT 24 sept 2026, 23_46_49.png', // Parque Warner
  'Imagen de ChatGPT 24 sept 2026, 23_47_08.png', // Siam Park
  'Imagen de ChatGPT 24 sept 2026, 23_47_15.png', // El Teide
  'Imagen de ChatGPT 24 sept 2026, 23_46_27.png', // Andorra
];
const TS = 36;
TILE_SHEETS.forEach((file, i) => {
  if (!fs.existsSync(path.join(DIR, file))) return;
  const [top, fill, plat, block] = sheetPieces(file);
  if (!block) throw new Error(file + ': se esperaban 4 tiles');
  // se recorta un margen para quitar esquinas redondeadas y contornos laterales antes de fundir bordes
  const mx = Math.round(top.w * 0.018), mf = Math.round(fill.w * 0.018);
  addPiece('tiles_' + i, resizeTo(seamless(inset(top, mx, 0, mx, 0), true, false), TS, TS));
  addPiece('tiles_' + i, resizeTo(seamless(inset(fill, mf, mf, mf, mf), true, true), TS, TS));
  addPiece('tiles_' + i, resizeTo(plat, TS, Math.max(4, Math.round(TS * plat.h / plat.w))));
  addPiece('tiles_' + i, resizeTo(block, TS, TS));
});

// Fondo de los fosos: 3 filas (agua, lava, hielo) x 4 fotogramas; tiras repetibles en horizontal.
{
  const im = load('Imagen de ChatGPT 24 sept 2026, 23_44_12.png'), rows = contentRows(im);
  if (rows.length !== 3 || rows.some(r => r.length !== 4)) throw new Error('Fosos: se esperaban 3 filas de 4 y hay ' + rows.map(r => r.length).join(','));
  ['agua', 'lava', 'hielo'].forEach((kind, r) => rows[r].forEach(box => {
    const p = trim(clearNeutralBackground(crop(im, ...box), ...STRICT), 0);
    addPiece('foso_' + kind, resize(seamless(p, true, false, 0.15), 48));
  }));
}
// Manchas de tinta (3x2) que tapan la pantalla.
{
  const file = 'Imagen de ChatGPT 24 sept 2026, 23_43_58.png', im = load(file), cw = im.w / 3, ch = im.h / 2;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) add('tinta_mancha', im, [c * cw + 4, r * ch + 4, cw - 8, ch - 8], 128, { minLight: STRICT[0], maxSpread: STRICT[1] });
}
// Cadena (repetible en vertical) y reja con candado que cierra la arena del jefe.
{
  const [chain, gate] = sheetPieces('Imagen de ChatGPT 24 sept 2026, 23_43_32.png');
  addPiece('cadena', resize(chain, 64));
  addPiece('reja', resize(gate, 160));
}

// Empaquetado en atlas.
const AW = 1024; let px = 2, py = 2, rowH = 0;
for (const p of pieces) {
  if (px + p.w + 2 > AW) { px = 2; py += rowH + 2; rowH = 0; }
  p.x = px; p.y = py; px += p.w + 2; rowH = Math.max(rowH, p.h);
}
const AH = py + rowH + 2, atlas = Buffer.alloc(AW * AH * 4);
for (const p of pieces) for (let y = 0; y < p.h; y++) p.data.copy(atlas, ((p.y + y) * AW + p.x) * 4, y * p.w * 4, (y + 1) * p.w * 4);
const meta = {}; for (const [name, list] of Object.entries(frames)) meta[name] = list.map(p => [p.x, p.y, p.w, p.h]);
const png = encode(AW, AH, atlas);
fs.writeFileSync(path.join(__dirname, 'elements-preview.png'), png);
fs.writeFileSync(path.join(ROOT, 'js', 'elements.js'),
  '// Generado por tools/build-elements.js - no editar a mano\n' +
  'window.ELEMENT_ATLAS = "data:image/png;base64,' + png.toString('base64') + '";\n' +
  'window.ELEMENT_FRAMES = ' + JSON.stringify(meta) + ';\n' +
  // Cartel de META: el JPG trae los cuadros de "transparencia" pintados; se limpian al cargar el juego.
  'window.GOAL_SIGN = "data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, 'meta.jpg')).toString('base64') + '";\n' +
  // Sol y bandera animados del cartel (4x4: dos filas de bandera y dos de sol).
  'window.GOAL_FX = "data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, 'enemigos', 'sol y bandera.jpg')).toString('base64') + '";\n');
console.log('elementos', Object.keys(meta).length, 'grupos,', pieces.length, 'frames, atlas', AW + 'x' + AH, (png.length / 1024).toFixed(0) + 'KB');
