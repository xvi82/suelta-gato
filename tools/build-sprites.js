// Convierte las hojas de sprites originales en un atlas compacto + datos de frames -> js/sprites.js
// Uso: node tools/build-sprites.js
const fs = require('fs'), path = require('path'), { decode, encode } = require('./png.js');
const SRC = path.join(__dirname, '..', 'originales');
const RES = 1.5; // píxeles de atlas por unidad del mundo

// Hojas nuevas (carpeta "nuevas animaciones personajes"): la escala se toma de una pose de guardia (ref)
// para que midan lo mismo que el frame 0 de la hoja original. idx -> referencia a esa celda.
const NEW = path.join(__dirname, '..', 'nuevas animaciones personajes');
const extra = (file, cols, rows, ref, opt = {}) => idx => ({ file, dir: NEW, cols, rows, idx, ref, ...opt });
const BOY_HURT = extra('a255dfab-32e2-40c3-a096-34b2277fa7b6.png', 4, 1, 3);
const BOY_NEW = extra('Imagen de ChatGPT 24 sept 2026, 23_53_07.png', 4, 5, 7, { checker: true }); // cuadros de "transparencia" pintados
const GIRL_NEW = extra('Imagen de ChatGPT 24 sept 2026, 23_55_45.png', 4, 5, 7);
const TWENTY = [...Array(20).keys()];

// Orden de frames en el juego (niños): 0-3 quieto, 4-7 puñetazo, 8-11 patada, 12-15 daño, 16-23 andar,
// 24-27 salto, 28-31 lanzar, 32-35 KO, 36-39 victoria, 40-43 enjaulad@
const SHEETS = [
  { name: 'girl', file: 'carla.png', cols: 4, rows: 6, height: 96,
    order: [0, 1, 2, 3, 15, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 4, 5, 6, 7, 8, 9, 10, 11, ...TWENTY.map(GIRL_NEW)] },
  { name: 'boy', file: 'javier.png', cols: 4, rows: 6, height: 96,
    order: [0, 1, 2, 3, 13, 14, 14, 15, 12, 18, 18, 19, ...[0, 1, 2, 3].map(BOY_HURT), 4, 5, 6, 7, 8, 9, 10, 11, ...TWENTY.map(BOY_NEW)] },
  { name: 'cat', file: 'gato.png', cols: 4, rows: 4, height: 156, order: [...Array(16).keys()] },
];

// Borra un fondo de cuadros gris/blanco pintado (sin alfa): lo conectado a los bordes de la imagen o de las
// celdas, más los huecos encerrados que tienen los dos tonos del cuadriculado. Luego quita el halo claro.
function removeChecker(im, cols, rows) {
  const { w, h, data } = im, N = w * h, gone = new Uint8Array(N), q = [];
  const lum = i => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  const spread = i => { const o = i * 4; return Math.max(data[o], data[o + 1], data[o + 2]) - Math.min(data[o], data[o + 1], data[o + 2]); };
  const cand = i => spread(i) <= 14 && lum(i) >= 190;
  const flood = (seeds, test) => {
    for (const i of seeds) if (!gone[i] && test(i)) { gone[i] = 1; q.push(i); }
    while (q.length) {
      const i = q.pop(), x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < N && !gone[j] && test(j)) { gone[j] = 1; q.push(j); }
    }
  };
  const seeds = [];
  for (let r = 0; r <= rows; r++) { const y = Math.min(h - 1, Math.round(r * h / rows)); for (let x = 0; x < w; x++) seeds.push(y * w + x); }
  for (let c = 0; c <= cols; c++) { const x = Math.min(w - 1, Math.round(c * w / cols)); for (let y = 0; y < h; y++) seeds.push(y * w + x); }
  flood(seeds, cand);
  // huecos encerrados (entre brazos, piernas...): sólo si mezclan el tono blanco y el gris del cuadriculado
  const seen = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (seen[i] || gone[i] || !cand(i)) continue;
    const comp = [i], st = [i]; seen[i] = 1;
    while (st.length) { const p = st.pop(), x = p % w; for (const j of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) if (j >= 0 && j < N && !seen[j] && !gone[j] && cand(j)) { seen[j] = 1; st.push(j); comp.push(j); } }
    const hi = comp.filter(p => lum(p) >= 240).length, lo = comp.filter(p => lum(p) < 225).length;
    if (comp.length >= 60 && hi > comp.length * 0.2 && lo > comp.length * 0.2) for (const p of comp) gone[p] = 1;
  }
  // halo: píxeles claros y grises pegados al fondo borrado
  for (let pass = 0; pass < 2; pass++) {
    const edge = [];
    for (let i = 0; i < N; i++) if (!gone[i] && lum(i) >= 140 && spread(i) <= 24) { const x = i % w; if ((x > 0 && gone[i - 1]) || (x < w - 1 && gone[i + 1]) || gone[i - w] || gone[i + w]) edge.push(i); }
    for (const i of edge) gone[i] = 1;
  }
  for (let i = 0; i < N; i++) if (gone[i]) data[i * 4 + 3] = 0;
}
// Separa una hoja en celdas: cada componente conectado se asigna a la celda de su centro
function cellsOf(file, cols, rows, opt = {}) {
  const im = decode(fs.readFileSync(path.join(opt.dir || SRC, file))), { w, h, data } = im, cw = w / cols, ch = h / rows;
  if (opt.checker) removeChecker(im, cols, rows);
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
    comps.push({ n, cx: sx / n, cy: sy / n, x0, y0, x1, y1 });
  }
  const cells = Array.from({ length: cols * rows }, (_, i) => ({ i, x0: 1e9, y0: 1e9, x1: -1, y1: -1, ids: new Set(), ccx: (i % cols + 0.5) * cw }));
  comps.forEach((c, id) => {
    if (c.n < 40) return;
    const col = Math.min(cols - 1, Math.floor(c.cx / cw)), row = Math.min(rows - 1, Math.floor(c.cy / ch)), b = cells[row * cols + col];
    b.ids.add(id); b.x0 = Math.min(b.x0, c.x0); b.y0 = Math.min(b.y0, c.y0); b.x1 = Math.max(b.x1, c.x1); b.y1 = Math.max(b.y1, c.y1);
  });
  return { im, lab, cells };
}
// Reduce una región (sólo píxeles de los componentes indicados) a la escala dada
function shrink(sheet, box, ids, scale) {
  const { im: { w, h, data }, lab } = sheet;
  const sw = box.x1 - box.x0 + 1, sh = box.y1 - box.y0 + 1;
  const dw = Math.max(1, Math.round(sw * scale)), dh = Math.max(1, Math.round(sh * scale)), out = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const ax = box.x0 + x / scale, bx = box.x0 + (x + 1) / scale, ay = box.y0 + y / scale, by = box.y0 + (y + 1) / scale;
    let r = 0, g = 0, bl = 0, a = 0, n = 0;
    for (let yy = Math.floor(ay); yy < Math.ceil(by); yy++) for (let xx = Math.floor(ax); xx < Math.ceil(bx); xx++) {
      n++; if (xx >= w || yy >= h) continue; const k = yy * w + xx; if (!ids.has(lab[k])) continue;
      const al = data[k * 4 + 3]; if (al < 150) continue; // descarta el halo semitransparente
      r += data[k * 4]; g += data[k * 4 + 1]; bl += data[k * 4 + 2]; a++;
    }
    const o = (y * dw + x) * 4;
    if (a / n > 0.45) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; out[o + 3] = 255; }
  }
  return { w: dw, h: dh, img: out };
}

const frames = {}, pieces = [], sheetCache = {};
const getSheet = (file, cols, rows, opt) => sheetCache[file] || (sheetCache[file] = cellsOf(file, cols, rows, opt));
for (const s of SHEETS) {
  const sheet = getSheet(s.file, s.cols, s.rows);
  const c0 = sheet.cells[0], scale = s.height * RES / 1.5 / (c0.y1 - c0.y0 + 1) * 1.5 / RES * (RES / 1.5);
  const pxScale = s.height / (c0.y1 - c0.y0 + 1); // altura en px de atlas del frame 0 = s.height
  frames[s.name] = s.order.map(ref => {
    let sh = sheet, idx = ref, sc = pxScale;
    if (typeof ref === 'string') { const [f, i] = ref.split(':'); sh = getSheet(f, 4, 4); idx = +i; const b0 = sh.cells[0]; sc = s.height / (b0.y1 - b0.y0 + 1); }
    else if (typeof ref === 'object') { sh = getSheet(ref.file, ref.cols, ref.rows, ref); idx = ref.idx; const b0 = sh.cells[ref.ref]; sc = s.height / (b0.y1 - b0.y0 + 1); }
    const b = sh.cells[idx], r = shrink(sh, b, b.ids, sc);
    const f = { w: r.w, h: r.h, ox: Math.round((b.x0 - b.ccx) * sc), oy: -r.h, img: r.img };
    pieces.push(f); return f;
  });
}

// ---- Jaula: jaulas cuadradas de las dos primeras filas, recortando la cadena por encima de la argolla
{
  const im = decode(fs.readFileSync(path.join(SRC, 'jaula.png'))), { w, h, data } = im;
  const solid = k => data[k * 4 + 3] >= 150, lab = new Int32Array(w * h).fill(-1), comps = [];
  for (let i = 0; i < w * h; i++) {
    if (lab[i] >= 0 || !solid(i)) continue;
    const id = comps.length, st = [i]; lab[i] = id; let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    while (st.length) { const j = st.pop(), x = j % w, y = (j / w) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; const k = ny * w + nx; if (lab[k] < 0 && solid(k)) { lab[k] = id; st.push(k); } } }
    comps.push({ id, n, x0, y0, x1, y1 });
  }
  const cages = comps.filter(c => c.x1 - c.x0 > 80 && c.y1 - c.y0 > 100 && c.y0 < h / 2).sort((a, b) => (Math.floor(a.y1 / (h / 4)) - Math.floor(b.y1 / (h / 4))) || a.x0 - b.x0);
  const pick = [0, 1, 3, 4, 5].map(i => cages[i]).filter(Boolean);
  frames.cage = pick.map(c => {
    // fila de la barra superior = primera fila ancha
    const rowCount = y => { let n = 0; for (let x = c.x0; x <= c.x1; x++) if (lab[y * w + x] === c.id) n++; return n; };
    let maxC = 0; for (let y = c.y0; y <= c.y1; y++) maxC = Math.max(maxC, rowCount(y));
    let tb = c.y0; while (tb < c.y1 && rowCount(tb) < maxC * 0.45) tb++;
    const bodyH = c.y1 - tb, top = Math.max(c.y0, tb - Math.round(bodyH * 0.2));
    let sx = 0, sn = 0; for (let x = c.x0; x <= c.x1; x++) if (lab[(tb + 2) * w + x] === c.id) { sx += x; sn++; }
    const barCx = sn ? sx / sn : (c.x0 + c.x1) / 2;
    const sc = 78 * RES / bodyH, box = { x0: c.x0, y0: top, x1: c.x1, y1: c.y1 };
    const r = shrink({ im, lab }, box, new Set([c.id]), sc);
    const f = { w: r.w, h: r.h, ox: Math.round((c.x0 - barCx) * sc), oy: -r.h, img: r.img };
    pieces.push(f); return f;
  });
  console.log('jaula', frames.cage.length, 'frames');
}

// ---- Enemigos dibujados (carpeta enemigos/): cada animación = lista de [fila, columna]
const { analyzeSheet } = require('./enemy-sheets.js');
const R = (r, a, b) => { const o = []; for (let c = a; c <= b; c++) o.push([r, c]); return o; };
const ENEMY_SPECS = {
  cangrejo: { h: 34, anims: { idle: R(0, 0, 3), attack: R(1, 0, 3), dash: R(2, 0, 3), hurt: R(3, 1, 2), ko: [[3, 2]], walk: [...R(4, 0, 3), ...R(5, 0, 3)] } },
  erizo:    { h: 32, anims: { idle: R(0, 0, 3), attack: R(1, 0, 3), hurt: R(3, 0, 1), ko: [[3, 2]], walk: [...R(4, 0, 3), ...R(5, 0, 3)] } },
  gaviota:  { h: 34, anims: { idle: R(0, 0, 3), dive: R(1, 0, 3), swoop: R(2, 0, 3), hurt: R(3, 0, 1), ko: R(3, 2, 3), fly: [...R(4, 0, 3), ...R(5, 0, 3)] } },
  jabali:   { h: 46, anims: { idle: R(0, 0, 2), charge: R(1, 0, 3), attack: R(2, 0, 3), angry: R(3, 0, 3), hurt: R(3, 1, 2), ko: [[3, 2]], walk: R(4, 0, 7) } },
  oso:      { h: 66, anims: { idle: R(0, 0, 3), attack: R(1, 0, 3), roar: R(2, 0, 3), hurt: R(3, 1, 2), ko: [[3, 2]], walk: R(4, 0, 7) } },
  paloma:   { h: 30, anims: { idle: R(0, 0, 3), drop: R(1, 0, 3), peck: R(2, 0, 3), hurt: R(3, 0, 1), ko: [[3, 2]], fly: R(4, 0, 7) } },
  pato:     { h: 34, anims: { idle: R(0, 0, 3), attack: R(0, 4, 6), angry: R(1, 0, 3), hurt: R(1, 4, 5), ko: R(1, 6, 7), walk: R(2, 0, 7) } },
  pulpo:    { h: 42, anims: { idle: R(0, 0, 3), ink: R(1, 0, 3), slap: R(2, 0, 3), hurt: R(3, 0, 1), ko: [[3, 2]], move: R(4, 0, 3), jump: R(5, 0, 3) } },
  rata:     { h: 26, anims: { idle: R(0, 0, 2), attack: R(1, 0, 3), hurt: R(3, 0, 1), ko: [[3, 2]], walk: R(4, 0, 7) }, opt: { minX: 200 } },
  conejo:   { h: 34, anims: { idle: [[0, 0], [0, 3]], crouch: [[0, 1], [0, 2]], attack: [[1, 3], [1, 4]], air: [[0, 5], [1, 0], [3, 0], [3, 1]], land: [[3, 2], [3, 3]], hurt: R(2, 0, 1), ko: [[2, 2]] } },
  mapache:  { h: 38, anims: { idle: R(0, 0, 3), attack: R(1, 0, 3), growl: R(2, 0, 3), hurt: R(3, 0, 1), ko: [[3, 2]], walk: R(4, 0, 3), flee: R(5, 0, 3) } },
  medusa:   { h: 40, anims: { idle: R(0, 0, 3), attack: [...R(1, 0, 3), ...R(2, 0, 3)], hurt: R(3, 0, 1), ko: [[3, 2]], swim: R(4, 0, 7) }, norm: false, normW: [4] },
  murcielago: { h: 30, anims: { idle: R(0, 0, 3), bite: R(1, 0, 3), screech: R(2, 0, 3), hurt: R(3, 1, 2), ko: R(3, 3, 4), fly: R(4, 0, 7) }, opt: { minX: 180, bodyFrac: 0.2 } }, // bodyFrac: la onda del chillido va pegada al murciélago
  rana:     { h: 30, anims: { idle: R(0, 0, 3), open: [[1, 0]], attack: R(1, 1, 2), air: [[2, 1], [2, 2, 'body'], [4, 1], [4, 2]], land: [[2, 3], [5, 3]], hurt: [[3, 1], [3, 3]], ko: [[3, 2]] } },
  // en la hoja de la tortuga las columnas 4 y 5 de la fila 0 se tocan: se separan con un corte vertical (x en px de la hoja); 'body' = sólo el dibujo, sin las estelas sueltas
  tortuga:  { h: 36, anims: { idle: R(0, 0, 3), attack: [[0, 4, 0, 993], [0, 5, 'body'], [0, 6, 'body']], hide: R(1, 0, 3), shell: [[1, 3]], hurt: R(1, 4, 5), ko: [[1, 7]], walk: R(2, 0, 3), spin: R(2, 4, 7) } },
  topo:     { h: 40, anims: { idle: R(0, 0, 3), golf: R(1, 0, 3), dig: R(2, 0, 3), hurt: R(3, 0, 2), ko: [[3, 3]], emerge: R(4, 0, 3), hide: R(5, 0, 3) } },
};
Object.assign(ENEMY_SPECS, {
  cabra:    { h: 46, anims: { idle: R(0, 0, 3), charge: R(0, 4, 6), rear: R(1, 0, 1), hurt: R(1, 4, 5), ko: [[1, 7]], walk: R(2, 0, 7) } },
  cuervo:   { h: 34, anims: { idle: R(0, 0, 3), dive: R(1, 0, 3), steal: R(2, 0, 3), hurt: R(3, 0, 2), ko: [[3, 3]], fly: [...R(4, 0, 3), ...R(5, 0, 3)] }, norm: false },
  lagarto:  { h: 30, anims: { idle: R(0, 0, 3), attack: R(1, 0, 3), tail: R(2, 0, 3), hurt: R(3, 0, 2), ko: [[3, 3]], walk: [...R(4, 0, 3), ...R(5, 0, 3)] }, opt: { minX: 250 }, norm: false },
  pinguino: { h: 32, file: 'pingüino.png', anims: { idle: [[0, 0], [0, 1], [0, 2], [0, 1]], attack: R(0, 4, 7), slide: R(1, 0, 3), hurt: R(2, 0, 1), ko: R(2, 2, 3), walk: R(3, 0, 7) } },
});
const ENEMY_ANIMS = {};
const EDIR = path.join(__dirname, '..', 'enemigos');
for (const kind in ENEMY_SPECS) {
  const file = path.join(EDIR, ENEMY_SPECS[kind].file || kind + '.png');
  if (!fs.existsSync(file)) continue;
  const spec = ENEMY_SPECS[kind], sheet = analyzeSheet(file, spec.opt || {});
  const med = (r, wd) => { const hs = sheet.rows[r].items.map(b => wd ? b.x1 - b.x0 : b.y1 - b.y0).sort((a, b) => a - b); return hs[hs.length >> 1]; };
  const base = spec.h * RES / med(0);
  // filas de 7+ dibujos (andar/volar) que la hoja pinta más pequeñas se igualan a la altura de la postura (o a su ancho con normW)
  const rowScale = r => (spec.normW || []).includes(r) ? base * med(0, 1) / med(r, 1)
    : (spec.norm !== false && sheet.rows[r].items.length >= 7 && med(r) < med(0) * 0.9) ? spec.h * RES / med(r) : base;
  const list = []; frames['en_' + kind] = list; ENEMY_ANIMS[kind] = {};
  const cache = {};
  for (const an in spec.anims) {
    ENEMY_ANIMS[kind][an] = spec.anims[an].map(([r, c, cx0, cx1]) => {
      const key = [r, c, cx0, cx1] + ''; if (cache[key] !== undefined) return cache[key];
      const row = sheet.rows[r]; if (!row) throw new Error(kind + ': falta la fila ' + r);
      let b = row.items[Math.min(c, row.items.length - 1)], sc = rowScale(r);
      if (cx0 === 'body') { const m = b.parts[0]; b = { ...b, ids: new Set([m.id]), gx0: m.x0, gy0: m.y0, gx1: m.x1, gy1: m.y1 }; }
      else if (cx0 !== undefined) { // corte vertical: recalcula la caja con sólo los píxeles de ese tramo
        const { w } = sheet.im; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = b.gy0; y <= b.gy1; y++) for (let x = Math.max(cx0, b.gx0); x <= Math.min(cx1, b.gx1); x++) if (b.ids.has(sheet.lab[y * w + x])) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        b = { ...b, x0, x1, gx0: x0, gx1: x1, gy0: y0, y1 };
      }
      const rr = shrink(sheet, { x0: b.gx0, y0: b.gy0, x1: b.gx1, y1: b.gy1 }, b.ids, sc);
      const f = { w: rr.w, h: rr.h, ox: Math.round((b.gx0 - (b.x0 + b.x1) / 2) * sc), oy: Math.round((b.gy0 - b.y1) * sc), img: rr.img };
      pieces.push(f); list.push(f); return (cache[key] = list.length - 1);
    });
  }
  console.log('enemigo', kind, list.length, 'frames');
}

// Empaquetado en estanterías
const AW = 1536; let x = 0, y = 0, rowH = 0;
[...pieces].sort((a, b) => b.h - a.h).forEach(f => {
  if (x + f.w + 1 > AW) { x = 0; y += rowH + 1; rowH = 0; }
  f.x = x; f.y = y; x += f.w + 1; rowH = Math.max(rowH, f.h);
});
const AH = y + rowH, atlas = Buffer.alloc(AW * AH * 4);
for (const f of pieces) for (let yy = 0; yy < f.h; yy++) f.img.copy(atlas, ((f.y + yy) * AW + f.x) * 4, yy * f.w * 4, (yy + 1) * f.w * 4);
const png = encode(AW, AH, atlas);
fs.writeFileSync(path.join(__dirname, 'atlas-preview.png'), png);
const meta = {}; for (const k in frames) meta[k] = frames[k].map(f => [f.x, f.y, f.w, f.h, f.ox, f.oy]);
fs.writeFileSync(path.join(__dirname, '..', 'js', 'sprites.js'),
  '// Generado por tools/build-sprites.js - no editar a mano\n' +
  'window.SPRITE_ATLAS = "data:image/png;base64,' + png.toString('base64') + '";\n' +
  'window.SPRITE_FRAMES = ' + JSON.stringify(meta) + ';\nwindow.SPRITE_RES = ' + RES + ';\nwindow.ENEMY_ANIMS = ' + JSON.stringify(ENEMY_ANIMS) + ';\n' +
  'window.BALLOON_SHEET = "data:image/jpeg;base64,' + fs.readFileSync(path.join(SRC, 'globo.jpg')).toString('base64') + '";\n');
console.log('atlas', AW, AH, (png.length / 1024).toFixed(0) + 'KB');

// ---- Presentador: 16 viñetas (versión "Carla") + 3 viñetas con "Javier" (2, 12, 13) -> índices 16, 17, 18
const CELL = 160, cellsOut = [];
const pc = decode(fs.readFileSync(path.join(SRC, 'presentador-carla.png'))), pj = decode(fs.readFileSync(path.join(SRC, 'presentador-javier.png')));
for (let i = 0; i < 16; i++) cellsOut.push([pc, i]);
for (const i of [2, 12, 13]) cellsOut.push([pj, i]);
const PW = CELL * 5, PH = CELL * 4, pres = Buffer.alloc(PW * PH * 4);
cellsOut.forEach(([im, i], n) => {
  const src = im.w / 4, sx0 = (i % 4) * src, sy0 = Math.floor(i / 4) * src, k = src / CELL, ox = (n % 5) * CELL, oy = Math.floor(n / 5) * CELL;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let r = 0, g = 0, bl = 0, a = 0, cnt = 0;
    for (let yy = Math.floor(sy0 + y * k); yy < Math.min(im.h, Math.ceil(sy0 + (y + 1) * k)); yy++) for (let xx = Math.floor(sx0 + x * k); xx < Math.min(im.w, Math.ceil(sx0 + (x + 1) * k)); xx++) {
      const q = (yy * im.w + xx) * 4, al = im.data[q + 3] / 255; cnt++; r += im.data[q] * al; g += im.data[q + 1] * al; bl += im.data[q + 2] * al; a += al;
    }
    const o = ((oy + y) * PW + ox + x) * 4;
    if (a > 0) { pres[o] = r / a; pres[o + 1] = g / a; pres[o + 2] = bl / a; pres[o + 3] = Math.round(a / cnt * 255); }
  }
});
const ppng = encode(PW, PH, pres);
fs.appendFileSync(path.join(__dirname, '..', 'js', 'sprites.js'), 'window.PRESENTER_ATLAS = "data:image/png;base64,' + ppng.toString('base64') + '";\nwindow.PRESENTER_CELL = ' + CELL + ';\n');
console.log('presentador', PW, PH, (ppng.length / 1024).toFixed(0) + 'KB');
