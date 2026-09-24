// Convierte las imágenes de fondo de la carpeta fondos/ en js/fondos.js
// Nombres de archivo = clave del nivel: laspalmas, cadiz, sotogrande, madrid, warner, siam, teide, andorra
// (.png se reduce a 480 px de alto; .webp y .jpg se incluyen tal cual)
// Uso: node tools/build-fondos.js
const fs = require('fs'), path = require('path'), { decode, encodeIndexed, quantize } = require('./png.js');
const DIR = path.join(__dirname, '..', 'fondos'), OUT = path.join(__dirname, '..', 'js', 'fondos.js');
const TARGET_H = 480;
const out = {};
if (fs.existsSync(DIR)) for (const f of fs.readdirSync(DIR).sort()) {
  const ext = path.extname(f).toLowerCase(), key = path.basename(f, ext).toLowerCase();
  const buf = fs.readFileSync(path.join(DIR, f));
  if (ext === '.webp' || ext === '.jpg' || ext === '.jpeg') {
    if (out[key]) continue;
    out[key] = 'data:image/' + (ext === '.webp' ? 'webp' : 'jpeg') + ';base64,' + buf.toString('base64');
    console.log(key, f, (buf.length / 1024 | 0) + 'KB');
  } else if (ext === '.png') {
    if (out[key]) continue;
    const im = decode(buf), k = Math.min(1, TARGET_H / im.h), w = Math.round(im.w * k), h = Math.round(im.h * k);
    const data = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / k), x1 = Math.min(im.w, Math.ceil((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.min(im.h, Math.ceil((y + 1) / k));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const o = (yy * im.w + xx) * 4; r += im.data[o]; g += im.data[o + 1]; b += im.data[o + 2]; n++; }
      const o = (y * w + x) * 4; data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n; data[o + 3] = 255;
    }
    const q = quantize(data, 256), png = encodeIndexed(w, h, q.idx, q.palette);
    out[key] = 'data:image/png;base64,' + png.toString('base64');
    console.log(key, f, im.w + 'x' + im.h, '->', w + 'x' + h, (png.length / 1024 | 0) + 'KB');
  }
}
fs.writeFileSync(OUT, '// Generado por tools/build-fondos.js - no editar a mano\nwindow.FONDOS = ' + JSON.stringify(out) + ';\n');
console.log('OK ->', OUT, Object.keys(out).length, 'fondos');
