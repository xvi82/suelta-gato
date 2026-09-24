// Genera versiones de un solo archivo con todo el juego dentro:
//   dist/suelta-gato.html  -> para jugar en local (doble clic)
//   dist/web.html          -> el mismo juego, listo para publicar online
// Uso: node tools/build.js
const fs = require('fs'), path = require('path');
require('./build-fondos.js'); // regenera js/fondos.js con las imágenes de fondos/
require('./build-elements.js'); // recorta y empaqueta objetos, efectos, props y banderas
const root = path.join(__dirname, '..');
let body = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
body = body.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  '<script>\n' + fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const local = /<!doctype/i.test(body)
  ? (body.endsWith('\n') ? body : body + '\n')
  : '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
for (const [name, content] of [['suelta-gato.html', local], ['web.html', local]]) {
  const out = path.join(root, 'dist', name);
  fs.writeFileSync(out, content);
  console.log('OK ->', out, (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
}
