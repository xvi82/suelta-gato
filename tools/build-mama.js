// Recorta la hoja de Mamá (originales/mama.png) -> js/mama.js
// Hoja: 4 columnas (preocupada, ¡ay Dios!, regañando, ofreciendo el abrigo) x 1 ó 2 filas
// (fila 2 opcional: las mismas poses con la boca cerrada, para que "hable").
// Fondo: transparente, o un color liso (verde croma, blanco...) que se borra desde los bordes de cada celda.
// Sin la imagen genera un js/mama.js vacío y el juego dibuja una Mamá provisional.
// Uso: node tools/build-mama.js
const fs = require('fs'), path = require('path'), { decode, encode } = require('./png.js');
const SRC = path.join(__dirname, '..', 'originales', 'mama.png'), OUT = path.join(__dirname, '..', 'js', 'mama.js');
const CELL = 128, COLS = 4, FLIP = true; // la hoja actual mira a la derecha; pon false si una nueva ya mira a la izquierda

if (!fs.existsSync(SRC)) {
  fs.writeFileSync(OUT, '// Generado por tools/build-mama.js - no editar a mano\nwindow.MAMA_ATLAS = null;\n');
  console.log('mamá: no hay originales/mama.png, se usa la Mamá provisional');
  return;
}
const im = decode(fs.readFileSync(SRC)), { w, h, data } = im, N = w * h;
const ROWS = Math.max(1, Math.min(2, Math.round(h / (w / COLS))));
const cw = w / COLS, ch = h / ROWS;

// ---- fondo
let clear = 0; for (let i = 3; i < data.length; i += 4) if (data[i] < 16) clear++;
const gone = new Uint8Array(N);
if (clear > N * 0.05) { for (let i = 0; i < N; i++) if (data[i * 4 + 3] < 16) gone[i] = 1; }
else {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x0 = Math.round(c * cw), y0 = Math.round(r * ch), x1 = Math.round((c + 1) * cw) - 1, y1 = Math.round((r + 1) * ch) - 1;
    const k = (y0 + 2) * w + x0 + 2, kr = data[k * 4], kg = data[k * 4 + 1], kb = data[k * 4 + 2];
    const bg = i => Math.abs(data[i * 4] - kr) + Math.abs(data[i * 4 + 1] - kg) + Math.abs(data[i * 4 + 2] - kb) < 90;
    const q = [], push = i => { if (!gone[i] && bg(i)) { gone[i] = 1; q.push(i); } };
    for (let x = x0; x <= x1; x++) { push(y0 * w + x); push(y1 * w + x); }
    for (let y = y0; y <= y1; y++) { push(y * w + x0); push(y * w + x1); }
    while (q.length) {
      const i = q.pop(), x = i % w, y = (i / w) | 0;
      if (x > x0) push(i - 1); if (x < x1) push(i + 1); if (y > y0) push(i - w); if (y < y1) push(i + w);
    }
  }
  // huecos de verde croma encerrados (entre el brazo y el cuerpo...)
  for (let i = 0; i < N; i++) { const o = i * 4; if (data[o + 1] > 150 && data[o + 1] > (data[o] + data[o + 2]) * 0.8 + 60) gone[i] = 1; }
  // quita el reflejo verde del croma en el borde de la figura
  for (let i = 0; i < N; i++) {
    if (gone[i]) continue;
    const x = i % w, near = (x > 0 && gone[i - 1]) || (x < w - 1 && gone[i + 1]) || (i >= w && gone[i - w]) || (i + w < N && gone[i + w]);
    const o = i * 4; if (near && data[o + 1] > Math.max(data[o], data[o + 2]) + 20) data[o + 1] = Math.max(data[o], data[o + 2]);
  }
}
for (let i = 0; i < N; i++) if (gone[i]) data[i * 4 + 3] = 0;

// ---- cajas de cada pose; misma escala para todas, pegadas abajo y centradas
const boxes = [];
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
  const X0 = Math.round(c * cw), Y0 = Math.round(r * ch), X1 = Math.round((c + 1) * cw), Y1 = Math.round((r + 1) * ch);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (data[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { x0 = X0; y0 = Y0; x1 = X1 - 1; y1 = Y1 - 1; }
  boxes.push({ x0, y0, x1, y1 });
}
const maxW = Math.max(...boxes.map(b => b.x1 - b.x0 + 1)), maxH = Math.max(...boxes.map(b => b.y1 - b.y0 + 1));
const k = Math.max(maxW / CELL, maxH / CELL); // píxeles de origen por píxel de salida

const AW = CELL * COLS, AH = CELL * ROWS, out = Buffer.alloc(AW * AH * 4);
boxes.forEach((b, n) => {
  const ox = (n % COLS) * CELL, oy = Math.floor(n / COLS) * CELL;
  const bw = (b.x1 - b.x0 + 1) / k, bh = (b.y1 - b.y0 + 1) / k, dx = Math.round((CELL - bw) / 2), dy = Math.round(CELL - bh);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const sx0 = b.x0 + (x - dx) * k, sy0 = b.y0 + (y - dy) * k;
    let r = 0, g = 0, bl = 0, a = 0, cnt = 0;
    for (let yy = Math.floor(sy0); yy < Math.ceil(sy0 + k); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx0 + k); xx++) {
      cnt++;
      if (xx < b.x0 || xx > b.x1 || yy < b.y0 || yy > b.y1) continue;
      const q = (yy * w + xx) * 4, al = data[q + 3] / 255; r += data[q] * al; g += data[q + 1] * al; bl += data[q + 2] * al; a += al;
    }
    const o = ((oy + y) * AW + ox + (FLIP ? CELL - 1 - x : x)) * 4;
    if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; out[o + 3] = Math.round(a / cnt * 255); }
  }
});
const png = encode(AW, AH, out);
fs.writeFileSync(OUT, '// Generado por tools/build-mama.js - no editar a mano\n' +
  'window.MAMA_ATLAS = "data:image/png;base64,' + png.toString('base64') + '";\nwindow.MAMA_CELL = ' + CELL + ';\nwindow.MAMA_ROWS = ' + ROWS + ';\n');
console.log('mamá', AW, AH, ROWS + ' fila(s)', (png.length / 1024).toFixed(0) + 'KB');
