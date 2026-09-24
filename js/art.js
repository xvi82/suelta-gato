// ============================================================
//  ARTE: sprites de enemigos/objetos (alta resolución sombreada),
//  tiles texturizados y fondos detallados estilo recreativa 90s
// ============================================================
const Art = (() => {
  const PAL = {
    k: '#1b1426', w: '#ffffff', g: '#a9a9bd', G: '#5d5d73', r: '#e0303a', R: '#8e1a24', o: '#f08a24', y: '#ffd23f',
    Y: '#c89a12', b: '#a8693a', B: '#5e3a1e', c: '#f5dcb0', p: '#f59ab8', P: '#8a3fb8', e: '#58c84a', E: '#1e7a32',
    u: '#3c64d8', U: '#22305e', l: '#9fe8f5', L: '#4fb4d8', s: '#e8b48a', n: '#ff6a00',
  };
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  // ---------------- color ----------------
  const rgbCache = {};
  function hexRgb(h) {
    if (typeof h !== 'string') return h;
    if (rgbCache[h]) return rgbCache[h];
    const v = h.length === 4 ? h.slice(1).split('').map(c => parseInt(c + c, 16)) : [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
    return (rgbCache[h] = v);
  }
  function sh(col, f) { const c = hexRgb(col); return f >= 0 ? c.map(v => Math.round(v + (255 - v) * f)) : c.map(v => Math.round(v * (1 + f))); }
  function mixc(a, b, t) { a = hexRgb(a); b = hexRgb(b); t = Math.max(0, Math.min(1, t)); return a.map((v, i) => Math.round(v + (b[i] - v) * t)); }
  const css = c => typeof c === 'string' ? c : 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
  function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  // ruido suave (periódico si se indica periodo)
  function vnoise(x, y, s, sc, per = 0) {
    const X = Math.floor(x / sc), Y = Math.floor(y / sc), fx = x / sc - X, fy = y / sc - Y;
    const w = v => per ? ((v % per) + per) % per : v;
    const a = hash(w(X), w(Y), s), b = hash(w(X + 1), w(Y), s), c = hash(w(X), w(Y + 1), s), d = hash(w(X + 1), w(Y + 1), s);
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  // ---------------- sprites de mapa de caracteres ----------------
  function grid(rows) { const w0 = Math.max(...rows.map(r => r.length)); return rows.map(r => (r + '.'.repeat(w0)).slice(0, w0).split('').map(c => c === ' ' ? '.' : c)); }
  function pix(rows, pal = {}, scale = 1) {
    const P = Object.assign({}, PAL, pal), g = grid(rows), w = g[0].length, h = g.length;
    const c = canvas(w * scale, h * scale), x = c.getContext('2d');
    g.forEach((row, j) => row.forEach((ch, i) => { if (ch !== '.' && P[ch]) { x.fillStyle = P[ch]; x.fillRect(i * scale, j * scale, scale, scale); } }));
    return c;
  }
  // Scale3x: suaviza el pixel-art al triplicar la resolución
  function scale3x(g) {
    const h = g.length, w = g[0].length, at = (x, y) => g[Math.max(0, Math.min(h - 1, y))][Math.max(0, Math.min(w - 1, x))];
    const out = Array.from({ length: h * 3 }, () => new Array(w * 3));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const A = at(x - 1, y - 1), B = at(x, y - 1), C = at(x + 1, y - 1), D = at(x - 1, y), E = at(x, y), F = at(x + 1, y), G = at(x - 1, y + 1), H = at(x, y + 1), I = at(x + 1, y + 1);
      const e = [E, E, E, E, E, E, E, E, E];
      if (B !== H && D !== F) {
        e[0] = D === B ? D : E;
        e[1] = (D === B && E !== C) || (B === F && E !== A) ? B : E;
        e[2] = B === F ? F : E;
        e[3] = (D === B && E !== G) || (D === H && E !== A) ? D : E;
        e[5] = (B === F && E !== I) || (H === F && E !== C) ? F : E;
        e[6] = D === H ? D : E;
        e[7] = (D === H && E !== I) || (H === F && E !== G) ? H : E;
        e[8] = H === F ? F : E;
      }
      for (let k = 0; k < 9; k++) out[y * 3 + Math.floor(k / 3)][x * 3 + (k % 3)] = e[k];
    }
    return out;
  }
  // Sprite en alta resolución con volumen: luz desde arriba-izquierda, sombra abajo-derecha
  function hq(rows, pal = {}) {
    const P = Object.assign({}, PAL, pal), big = scale3x(grid(rows)), h = big.length, w = big[0].length;
    const c = canvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h), d = id.data;
    const edge = (i, j) => { if (i < 0 || j < 0 || i >= w || j >= h) return true; const ch = big[j][i]; return ch === '.' || ch === 'k'; };
    const clear = (i, j) => i < 0 || j < 0 || i >= w || j >= h || big[j][i] === '.';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ch = big[j][i]; if (ch === '.' || !P[ch]) continue;
      let col = hexRgb(P[ch]);
      if (ch === 'k') {
        // contorno más fino: el borde interior del contorno se aclara ligeramente
        if (!clear(i - 1, j) && !clear(i + 1, j) && !clear(i, j - 1) && !clear(i, j + 1) && big[j][i - 1] !== 'k' && big[j][i + 1] !== 'k') col = [70, 52, 80];
      } else {
        let f = 0.1 - 0.22 * (j / h);
        if (edge(i, j - 1) || edge(i - 1, j)) f += 0.28; else if (edge(i, j - 2) || edge(i - 2, j)) f += 0.1;
        if (edge(i, j + 1) || edge(i + 1, j)) f -= 0.26; else if (edge(i, j + 2) || edge(i + 2, j)) f -= 0.1;
        if (hash(i, j, 3) < 0.05) f -= 0.05;
        col = sh(col, f);
      }
      const o = (j * w + i) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  function flip(src) { const c = canvas(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
  function whiten(src) { const c = canvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); return c; }
  const legs = (base, n, alt) => base.slice(0, base.length - n).concat(alt);

  // ---------------- ENEMIGOS (miran a la izquierda) ----------------
  const E = {};
  const crab = [
    '.kk..........kk.', 'krrk........krrk', 'krkrk......krkrk', '.krrk.k..k.krrk.', '..krk.kwkwk.krk.', '...kkkkkkkkkk...',
    '..krrrrrrrrrrk..', '.krrrrrrrrrrrrk.', 'krrRrrrrrrrrRrrk', '.krRrrrrrrrrRrk.', '..kkkkkkkkkkkk..', '.k.k.k....k.k.k.', 'k..k..k..k..k..k'];
  E.cangrejo = [crab, legs(crab, 2, ['..k.k.k..k.k.k..', '.k..k..kk..k..k.'])];
  const gull1 = [
    '.....k.....k....', '....kwk...kwk...', '....kwwk.kwwk...', '.....kwwkwwk....', '..kk..kwwwk.....', '.kwwk.kwwwwkkk..',
    'ykkwwwwwwwwwwgk.', '.kkwwwwwwwwwgk..', '...kkkwwwwkkk...', '......kk.kk.....'];
  const gull2 = [
    '................', '................', '................', '................', '..kk............', '.kwwk...........',
    'ykkwwwwwwwwwwgk.', '.kkwwwwkwwwwgk..', '...kkkwgkwkkk...', '.....kwwk.kwk...', '....kwgk...kgk..', '....kkk.....kk..'];
  E.gaviota = [gull1, gull2];
  E.cuervo = [gull1, gull2].map(f => f.map(r => r.replace(/w/g, 'U').replace(/g/g, 'G').replace(/y/g, 'Y')));
  const urchin = [
    '..k..k..k..k..', 'k..kPk.kPk..k.', '.kkPPPkPPPkk..', '..kPPPPPPPPk.k', 'kkPPwwkPwwkPkk', '.kPPwkkPwkkPk.',
    'kkPPPPPPPPPPkk', '.kPPPPPPPPPPk.', 'k.kPPPPPPPPk.k', '..kkPPPPPPkk..', '.k..kkkkkk..k.'];
  E.erizo = [urchin, legs(urchin, 1, ['..k.kkkkkk.k..'])];
  const octo = [
    '....kkkkkk....', '...kppppppk...', '..kppppppppk..', '.kppppppppppk.', '.kppwkppwkppk.', '.kppkkppkkppk.', '.kpppppppppppk',
    '..kppprrppppk.', '..kpkpkkpkpk..', '.kpkpkppkpkpk.', '.kpkpk.kpkpkk.', 'kpk.kp.kp.kpk.', 'kk..kk..kk.kk.'];
  E.pulpo = [octo, legs(octo, 3, ['.kpkpk.kpkpk..', '..kpkp.kpkpk..', '..kk.kk.kk.kk.'])];
  const duck = [
    '...kkkk.......', '..kyyyyk......', '.kyykyyk......', 'kooyyyyk......', '.kkkyyyk......', '...kyyyykkkk..',
    '..kyyyyyyyyyk.', '.kyyyywwyyyyk.', '.kyyyyywwyyykk', '..kyyyyyyyyk..', '...kkkkkkkk...', '....ko..ko....', '...koo.koo....'];
  E.pato = [duck, legs(duck, 2, ['...ko...ko....', '..koo...koo...'])];
  const boar = [
    '.....kk...........', '....kBk.kkkkkk....', '..kkBBkkBBBBBBkk..', '.kBBBBBBBBBBBBBBk.', 'kyBBkBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBBBBBk', 'kpBBBBBBBBBBBBBBk.', 'kpkBBBBBBBBBBBBBk.', '.kwkBBBBBBBBBBBk..', '..k.kBBkkkkBBBk...',
    '....kBk....kBk....', '....kBk....kBk....', '....kk.....kk.....'];
  E.jabali = [boar, legs(boar, 3, ['...kBk......kBk...', '..kBk......kBk....', '..kk.......kk.....'])];
  const mole = [
    '...kkkkkk...', '..kyyyyyyk..', '.kyyyyyyyyk.', 'kkkkkkkkkkkk', '.kBBBBBBBBk.', '.kBwkBBwkBk.', '.kBkkBBkkBk.',
    '.kBBBppBBBk.', 'kBBBBppBBBBk', 'kwkBBBBBBkwk', 'kwkBBBBBBkwk', '.kBBBBBBBBk.', 'kkBBBBBBBBkk'];
  E.topo = [mole, mole];
  const pig1 = [
    '.....kk...kk..', '....kgk..kgk..', '.....kgkkgk...', '..kk..kggk....', '.kgEk.kgggk...', 'okgEPggggggkk.',
    '.kkggggggggGGk', '...kkggggGGkk.', '.....kkkkk....', '......k.k.....'];
  const pig2 = [
    '..............', '..............', '..............', '..kk..........', '.kgEk.........', 'okgEPggggggkk.',
    '.kkgggkgggGGGk', '...kkgGkgGkkk.', '....kgGk.kGk..', '....kkk...kk..'];
  E.paloma = [pig1, pig2];
  const rat = [
    '..kk............', '.kGGk...........', 'kGGGGkkkkkk.....', 'kGwkGGGGGGGk....', 'pGGGGGGGGGGGk...',
    '.kkGGGGGGGGGGk..', '...kGkkkkkGk.kpk', '...kk.....kk..kp', '..............kk'];
  E.rata = [rat, legs(rat, 3, ['..kGk.....kGkkpk', '..kk.......kk.kp', '..............kk'])];
  const bear = [
    '..kk........kk..', '.kBBk......kBBk.', '.kBbkkkkkkkkbBk.', '..kbbbbbbbbbbk..', '.kbbbbbbbbbbbbk.', '.kbbwkbbbbwkbbk.',
    '.kbbkkbbbbkkbbk.', 'kbbbbbccccbbbbbk', 'kbbbbccBBccbbbbk', '.kbbbbcrrcbbbbk.', '..kkbbbbbbbbkk..', '.kbbbbbbbbbbbbk.',
    'kbbbkbbbbbbkbbbk', 'kbbbkbbccbbkbbbk', 'kbbbkbccccbkbbbk', '.kkkbbccccbbkkk.', '...kbbbkkbbbk...', '...kkkk..kkkk...'];
  E.oso = [bear, legs(bear, 2, ['..kbbbk..kbbbk..', '..kkkk....kkkk..'])];
  const racc = [
    '..k...k.........', '.kgk.kgk........', '.kgggggk........', 'kgkkkkkgk.......', 'kwkwkkwkgkkkkk..', 'kkgggggggggggGk.',
    '..kkgggggggggGkGk', '...kgggggggggkGkGk', '...kggggggggk.kGGk', '...kgkkkkkgk...kk.', '...kk.....kk......'];
  E.mapache = [racc, legs(racc, 2, ['..kgk.....kgk.....', '..kk.......kk.....'])];
  const bunny = [
    '..kk..kk....', '.kwpk.kwpk..', '.kwpk.kwpk..', '.kwpk.kwpk..', '..kwkkkwk...', '.kwwwwwwwk..', 'kwwkwwwkwwk.',
    'kwwwwpwwwwk.', '.kwwwwwwwk..', 'kwwwwwwwwwk.', 'kwwwwwwwwwwk', 'kwwwwwwwwwwk', '.kwwkkkkwwk.', '.kkk....kkk.'];
  E.conejo = [bunny, legs(bunny, 4, ['kwwwwwwwwwwk', 'kwwwwwwwwwwk', 'kwwkkkkkkwwk', 'kkk......kkk'])];
  const bat1 = [
    'k..............k', 'kk....k..k....kk', 'kPk...kkkk...kPk', 'kPPk.kPPPPk.kPPk', '.kPPkPwPPwPkPPk.', '..kPPPPPPPPPPk..',
    '...kk.kPPk.kk...', '.......kk.......'];
  const bat2 = [
    '.......kk.......', '......kkkk......', '.....kPPPPk.....', '....kPwPPwPk....', '..kkPPPPPPPPkk..', '.kPPPkPPPPkPPPk.',
    'kPPk..kPPk..kPPk', 'kk.....kk.....kk'];
  E.murcielago = [bat1, bat2];
  const frog = [
    '..kk....kk....', '.kwkk..kwkk...', '.kkEekkekEk...', 'kEeeeeeeeeEk..', 'keeeeeeeeeeek.', 'kerrrrrrrrrek.',
    '.keeeeeeeeek..', 'kEkeeeeeeekEk.', 'kEEkkkkkkkEEk.', 'kkk.......kkk.'];
  E.rana = [frog, legs(frog, 3, ['kEkeeeeeeekEk.', 'kEk.kkkkk.kEk.', 'kEk.......kEk.'])];
  const jelly1 = [
    '...kkkkkk...', '..kllllllk..', '.kllllllllk.', 'kllwllllwllk', 'klllpllplllk', 'kkkkkkkkkkkk', '.kl.kl.lk.k.',
    '.kl.kl..lk..', '..lk.lk.kl..', '..kl.kl.lk..', '.kl..lk..lk.', '.l....l...l.'];
  const jelly2 = [
    '............', '...kkkkkk...', '.kkllllllkk.', 'kllwllllwllk', 'klllpllplllk', 'kkkkkkkkkkkk', '..kl.kl.lk..',
    '..kl.kl.lk..', '.kl..lk..lk.', '.kl..lk..lk.', 'kl...l....lk', 'l..........l'];
  E.medusa = [jelly1, jelly2];
  const turtle = [
    '.....kkkkk......', '...kkEeEeEkk....', '..kEeEEeEEeEk...', '.kEEeEEeEEeEEk..', 'kkEEEEEEEEEEEEk.', 'kekkkkkkkkkkkkkk',
    'kewkeeeeeeeeeek.', 'keekkkkkkkkkkk..', '.kek.kek..kek...', '..k..kk....kk...'];
  E.tortuga = [turtle, legs(turtle, 2, ['.kek..kek..kek..', '..k...kk....kk..'])];
  const lizard = [
    '..kkkk............', '.keewkk...........', 'keeeekeekkkkkkk...', 'kreeeeeeuEeuEeekkk', '.kkeeeeeeeeeeeeeek',
    '..kek.kek..kek.kk.', '..kk..kk...kk.....'];
  E.lagarto = [lizard, legs(lizard, 2, ['...kek.kek..kek.kk', '...kk...kk..kk....'])];
  const goat = [
    '.kk.............', 'kBBk............', '.kBBk...........', '.kwwwk..........', 'kwkwwwk.........', 'kwwwwwkkkkkkkk..',
    '.kwwwwwwwwwwwwk.', '.gkwwwwwwwwwwwwk', '.gkkwwwwwwwwwwk.', '..kwwwwwwwwwwwk.', '...kwkkkkkkkwk..', '...kwk.....kwk..',
    '...kBk.....kBk..', '...kk......kk...'];
  E.cabra = [goat, legs(goat, 3, ['..kwk.......kwk.', '..kBk.......kBk.', '..kk........kk..'])];
  const peng = [
    '...kkkkk....', '..kUUUUUk...', '.kUwkUUUUk..', '.kUkkUUUUk..', 'yykUwwwwUUk.', '.kUwwwwwwUk.', 'kUUwwwwwwUUk',
    'kUUwwwwwwwUk', '.kUwwwwwwUk.', '.kUwwwwwwUk.', '..kUwwwwUk..', '..yyk..kyy..'];
  E.pinguino = [peng, legs(peng, 1, ['..kyy..yyk..'])];

  const enemySprites = {};
  function buildEnemies() {
    for (const k in E) {
      const frames = E[k].map(f => hq(f));
      const angry = frames.map(f => { const c = canvas(f.width, f.height), x = c.getContext('2d'); x.drawImage(f, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,40,30,0.45)'; x.fillRect(0, 0, c.width, c.height); return c; });
      enemySprites[k] = { L: frames, R: frames.map(flip), W: frames.map(whiten), AL: angry, AR: angry.map(flip) };
    }
  }

  // ---------------- OBJETOS ----------------
  const ITEMS = {
    peseta: ['..kkkk..', '.kyyyyk.', 'kyYkkYyk', 'kyYkYYyk', 'kyYkkYyk', 'kyYkYYyk', '.kyyyyk.', '..kkkk..'],
    churro: ['..........kk', '........kkok', '......kkoYok', '....kkoYoYk.', '..kkoYoYokk.', '.koYoYokk...', 'kooYokk.....', 'kokk........', 'kk..........'],
    chancla: ['..kkkkkkk...', '.kuuuuuuuk..', 'kuulllluuuk.', 'kuukuuuukuuk', 'kuuukkkkuuuk', '.kuuuuuuuuk.', '..kkkkkkkk..'],
    bocadillo: ['...kkkkkkkkk....', '..kbYYYYYYYYbk..', '.kbYYYYYYYYYYbk.', 'kbbbbbbbbbbbbbbk', 'kcwcwwcwcwwcwcck', 'kkwckcwkwckcwkkk', 'kbYYYYYYYYYYYYbk', '.kbbbbbbbbbbbbk.', '..kkkkkkkkkkkk..'],
    mojo: ['....kkkkk.....', '..kkbrbrbkk...', '.kbrbbrbbrbk..', 'kbrrbrrbrrbbk.', 'kkkkkkkkkkkkk.', 'kwwwwwwwwwwwk.', '.kwuwuwuwuwk..', '..kwwwwwwwk...', '...kkkkkkk....'],
    turron: ['.kkkkkkkkkkkk.', 'kcccyccccyccck', 'kccbcccbcccbck', 'kcyccbccycccck', 'kccccccbccbcck', 'kbcccyccccccck', '.kkkkkkkkkkkk.'],
    tortilla: ['.......kk.....', '.....kkyyk....', '...kkyyyyyk...', '.kkyyyYyyyyk..', 'kyyyyyyyyYyyk.', 'kyYyyyyyyyyyyk', 'kbbbbbbbbbbbbk', '.kkkkkkkkkkkk.'],
    // comidas nuevas (dibujo provisional hasta que existan las de elementos/comidas/)
    gazpacho: ['.kkkkkkkkk.', '.kllllllek.', '.krrrrrrrk.', '.krwrrrrrk.', '.krrrrrrrk.', '.krrrrrork.', '..krrrrrk..', '...kkkkk...'],
    paella: ['....kkkkkkkk....', '..kkyyryyyeyykk.', '.kyyeyyyrryyyyk.', 'kyrryyyeyyyyyryk', 'kGyyyyryyyeyyyGk', '.kGGGGGGGGGGGGk.', '..kkkkkkkkkkkk..'],
    cocido: ['....kkkkkk....', '..kkcrcccrckk.', '.kcccrcccrcck.', 'kbbbbbbbbbbbbk', 'kbBbbbbbbbbBbk', '.kbbbbbbbbbbk.', '..kBBBBBBBBk..', '...kkkkkkkk...'],
    cafe: ['...g..g......', '....g..g.....', '.kkkkkkkkk...', 'kwbcbccbcwkkk', 'kwwwwwwwwwk.k', 'kwwwwwwwwwkkk', '.kwwwwwwwk...', 'kkkkkkkkkkkk.', '.kgggggggggk.'],
    caca: ['...k...', '..kbk..', '.kbbbk.', '.kBbBk.', 'kbbbbbk', 'kkkkkkk'],
    pelo: ['.kkkk.', 'kokoyk', 'kyookk', 'kookok', 'koyook', '.kkkk.'],
    ovillo: ['..kkkk..', '.kpPpPk.', 'kPpPpPpk', 'kpPpPpPk', 'kPpPpPpk', 'kpPpPpPk', '.kPpPpk.', '..kkkkp.', '.......p'],
    fuego: ['..kk..', '.krrk.', 'kryyrk', 'kywyyk', '.kyyk.', '..kk..'],
    corazon: ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'],
    corazonV: ['.kk.kk.', 'kGGkGGk', 'kGGGGGk', 'kGGGGGk', '.kGGGk.', '..kGk..', '...k...'],
    bandera: ['kk......', 'kkrrrrrr', 'kkryyyrr', 'kkrrrrrr', 'kkyyyyyy', 'kkrrrrrr', 'kk......', 'kk......', 'kk......', 'kk......', 'kk......', 'kk......'],
  };
  const itemSprites = {};
  function buildItems() { for (const k in ITEMS) { itemSprites[k] = hq(ITEMS[k]); itemSprites[k + '_R'] = flip(itemSprites[k]); } }

  // ---------------- TILES (36x36 px, se dibujan a 24 unidades con zoom 1.5) ----------------
  const TS = 36, T = 24;
  const QMARK = ['.XXXX.', 'XX..XX', '....XX', '...XX.', '..XX..', '..XX..', '......', '..XX..'];
  function makeTiles(th) {
    const N = 10, c = canvas(TS * N, TS), x = c.getContext('2d'), id = x.createImageData(TS * N, TS), d = id.data, S = th.seed * 131;
    const put = (t, i, j, col) => { if (i < 0 || j < 0 || i >= TS || j >= TS) return; const o = (j * TS * N + t * TS + i) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; };
    const get = (t, i, j) => { const o = (j * TS * N + t * TS + i) * 4; return [d[o], d[o + 1], d[o + 2]]; };
    const F = hexRgb(th.fill), F2 = hexRgb(th.fill2), FD = hexRgb(th.fillDot), M = hexRgb(th.mortar || sh(th.fill2, -0.25));
    const TOP = hexRgb(th.top), TOP2 = hexRgb(th.top2), HI = hexRgb(th.topHi), OUT = [27, 20, 38];
    // grietas de lava precalculadas
    const lava = new Set();
    if (th.fillPattern === 'lava') for (let w = 0; w < 3; w++) { let i = Math.floor(hash(w, 1, S) * 36), j = Math.floor(hash(w, 2, S) * 36); for (let s = 0; s < 26; s++) { lava.add(((i % 36) + 36) % 36 + ',' + (((j % 36) + 36) % 36)); i += hash(w, s, S) < 0.5 ? 1 : 0; j += hash(s, w, S) < 0.6 ? 1 : -1; if (hash(s, s + w, S) < 0.3) i++; } }
    const pebbles = [0, 1, 2, 3, 4, 5, 6].map(n => ({ x: hash(n, 5, S) * 36, y: hash(n, 6, S) * 36, r: 1.3 + hash(n, 7, S) * 1.8 }));
    function fillPx(i, j, t) {
      const n = vnoise(i, j + t * 36, S, 9, 4);
      let col = mixc(F, F2, n * 0.9);
      switch (th.fillPattern) {
        case 'sand': { const r = hash(i, j + t * 36, S); if (r < 0.05) col = FD; else if (r > 0.95) col = sh(F2, -0.18); if ((i + j * 3) % 18 === 0) col = sh(col, -0.06); break; }
        case 'brick': {
          const row = Math.floor(j / 6), off = row % 2 ? 6 : 0, bx = (i + off) % 12, by = j % 6, bid = Math.floor((i + off) / 12) + row * 7 + t * 50;
          if (by === 0 || bx === 0) col = M;
          else { col = mixc(F, F2, hash(bid, 3, S) * 0.8); if (by === 1 || bx === 1) col = sh(col, 0.14); if (by === 5 || bx === 11) col = sh(col, -0.2); if (hash(i, j, S + t) < 0.08) col = sh(col, -0.1); }
          break;
        }
        case 'dirt': {
          for (const p of pebbles) { const dx = i - p.x, dy = (j + t * 13) % 36 - p.y; const dd = dx * dx + dy * dy; if (dd < p.r * p.r) { col = dd < 1.2 && dx < 0 && dy < 0 ? sh(FD, 0.3) : (dx + dy > 0.5 ? sh(FD, -0.25) : FD); } }
          if (hash(i, j, S + t) < 0.05) col = sh(col, -0.15);
          break;
        }
        case 'tiles': {
          const bx = i % 12, by = j % 12, bid = Math.floor(i / 12) + Math.floor(j / 12) * 3 + t * 9;
          if (bx === 0 || by === 0) col = M;
          else { col = mixc(F, F2, hash(bid, 1, S) * 0.5); if (bx === 1 || by === 1) col = sh(col, 0.22); if (bx === 11 || by === 11) col = sh(col, -0.18); if (bx + by > 4 && bx + by < 7 && bx < 6) col = sh(col, 0.3); }
          break;
        }
        case 'lava': {
          col = mixc(F, F2, vnoise(i, j, S, 6, 6));
          if (hash(i, j, S) < 0.06) col = sh(col, 0.15);
          if (lava.has(i + ',' + j)) col = hash(i, j, 9) < 0.5 ? [255, 120, 30] : [255, 190, 60];
          else if (lava.has((i + 1) + ',' + j) || lava.has((i - 1) + ',' + j) || lava.has(i + ',' + (j + 1))) col = [140, 42, 18];
          break;
        }
        case 'ice': { if (((i - j + 72) % 18) < 2) col = sh(col, 0.25); if (hash(i, j, S) < 0.04) col = FD; break; }
        default: if (hash(i, j, S) < 0.05) col = FD;
      }
      return col;
    }
    for (const t of [0, 1]) for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) put(t, i, j, fillPx(i, j, t));
    // --- superficie (tile 0)
    let band = 9;
    for (let i = 0; i < TS; i++) {
      const r1 = hash(i, 1, S), r2 = hash(i, 2, S);
      switch (th.topPattern) {
        case 'grass': {
          const drip = 9 + Math.floor(r2 * 6);
          for (let j = 0; j <= drip; j++) { let col = mixc(TOP, TOP2, j / drip); if (j < 2 && hash(i, j, S) < 0.6) col = HI; if (i % 3 === 0 && j > 1) col = sh(col, -0.12); if (j === drip) col = sh(TOP2, -0.3); put(0, i, j, col); }
          put(0, i, drip + 1, sh(get(0, i, drip + 1), -0.3)); band = 0; break;
        }
        case 'snow': {
          const depth = 10 + Math.round(Math.sin(i / 36 * Math.PI * 2) * 2 + r1 * 2);
          for (let j = 0; j <= depth; j++) { let col = j < 2 ? [255, 255, 255] : mixc([255, 255, 255], [200, 222, 245], j / depth); if (hash(i, j, S) < 0.03) col = [255, 255, 255]; if (j === depth) col = [150, 185, 225]; put(0, i, j, col); }
          put(0, i, depth + 1, sh(get(0, i, depth + 1), -0.2)); band = 0; break;
        }
        case 'stone': {
          const cx = i % 9, cy = 0;
          for (let j = 0; j < 9; j++) { let col = TOP; if (cx === 0 || j === 8) col = sh(TOP2, -0.35); else if (cx === 1 || j === 0) col = HI; else if (cx === 8 || j === 7) col = TOP2; if (hash(i, j, S) < 0.08) col = sh(col, -0.08); put(0, i, j + cy, col); }
          band = 9; break;
        }
        case 'slab': {
          for (let j = 0; j < 10; j++) { let col = mixc(TOP, TOP2, hash(Math.floor(i / 12), 4, S) * 0.4); if (i % 12 === 0) col = sh(TOP2, -0.3); else if (j === 0) col = HI; else if (j === 1 || i % 12 === 1) col = sh(col, 0.12); if (j === 8) col = sh(TOP2, -0.2); if (j === 9) col = sh(TOP2, -0.45); put(0, i, j, col); }
          band = 10; break;
        }
        case 'checker': {
          for (let j = 0; j < 10; j++) { let col = (Math.floor(i / 6) + Math.floor(j / 5)) % 2 ? TOP : [250, 245, 240]; if (j === 0) col = sh(col, 0.3); if (j === 9) col = sh(col, -0.3); put(0, i, j, col); }
          band = 10; break;
        }
        case 'wood': {
          for (let j = 0; j < 10; j++) { let col = mixc(TOP, TOP2, vnoise(i * 0.3, j * 3, S, 3)); if (i % 12 === 0) col = sh(TOP2, -0.35); if (j === 0) col = HI; if (j === 9) col = sh(TOP2, -0.4); if (i % 12 === 3 && j === 3) col = [200, 200, 210]; put(0, i, j, col); }
          band = 10; break;
        }
        case 'rock': {
          const depth = 6 + Math.floor(r1 * 4);
          for (let j = 0; j <= depth; j++) { let col = mixc(TOP, TOP2, vnoise(i, j, S, 4, 9)); if (j === 0 && r2 < 0.7) col = HI; if (j === depth) col = sh(TOP2, -0.35); put(0, i, j, col); }
          band = 0; break;
        }
        default: { // arena
          for (let j = 0; j < 8; j++) { let col = j === 0 ? HI : mixc(HI, TOP, j / 4); if (j >= 6) col = (i + j) % 2 ? TOP : get(0, i, j); if (hash(i, j, S) < 0.06) col = sh(col, -0.1); put(0, i, j, col); }
          band = 0;
        }
      }
      if (band) put(0, i, band, sh(get(0, i, band), -0.3));
    }
    // --- ladrillo (2)
    for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
      const row = Math.floor(j / 9), off = row % 2 ? 6 : 0, bx = (i + off) % 12, by = j % 9, bid = Math.floor((i + off) / 12) + row * 5;
      let col;
      if (bx === 0 || by === 0) col = hexRgb(th.brickMortar);
      else { col = mixc(th.brick, th.brick2, hash(bid, 2, S)); if (by === 1 || bx === 1) col = sh(col, 0.2); if (by === 8 || bx === 11) col = sh(col, -0.25); if (hash(i, j, S) < 0.07) col = sh(col, -0.1); }
      if (i === 35 || j === 35) col = OUT;
      put(2, i, j, col);
    }
    // --- bloque ? (3..6: brillo animado)
    for (let f = 0; f < 4; f++) for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
      let col = mixc([255, 222, 110], [226, 140, 20], j / 36);
      if (i === 0 || j === 0 || i === 35 || j === 35) col = OUT;
      else if (i === 1 || j === 1) col = [255, 246, 196];
      else if (i === 34 || j === 34) col = [150, 88, 8];
      else if (i === 2 || j === 2) col = sh(col, 0.2);
      const band2 = i + j - f * 22 + 10;
      if (i > 1 && j > 1 && i < 34 && j < 34 && band2 >= 0 && band2 < 5) col = sh(col, 0.4);
      for (const [rx, ry] of [[5, 5], [30, 5], [5, 30], [30, 30]]) { if (i === rx && j === ry) col = [255, 250, 220]; if ((i === rx + 1 || i === rx) && (j === ry + 1 || j === ry) && !(i === rx && j === ry)) col = [120, 64, 0]; }
      put(3 + f, i, j, col);
    }
    for (let f = 0; f < 4; f++) QMARK.forEach((row, jj) => [...row].forEach((ch, ii) => {
      if (ch !== 'X') return;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { put(3 + f, 10 + ii * 3 + a + 2, 7 + jj * 3 + b + 2, [120, 60, 0]); }
    }));
    for (let f = 0; f < 4; f++) QMARK.forEach((row, jj) => [...row].forEach((ch, ii) => {
      if (ch !== 'X') return;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) put(3 + f, 10 + ii * 3 + a, 7 + jj * 3 + b, b === 0 ? [255, 255, 255] : [255, 246, 220]);
    }));
    // --- bloque usado (7)
    for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
      let col = mixc([168, 118, 74], [120, 80, 50], j / 36);
      if (i === 0 || j === 0 || i === 35 || j === 35) col = OUT; else if (i === 1 || j === 1) col = [200, 150, 100]; else if (i === 34 || j === 34) col = [80, 50, 30];
      for (const [rx, ry] of [[5, 5], [30, 5], [5, 30], [30, 30]]) if (Math.abs(i - rx) < 2 && Math.abs(j - ry) < 2) col = i - rx + j - ry < 0 ? [210, 170, 120] : [70, 44, 26];
      if (hash(i, j, 77) < 0.05) col = sh(col, -0.1);
      put(7, i, j, col);
    }
    // --- plataforma (8)
    for (let i = 0; i < TS; i++) {
      for (let j = 0; j < 12; j++) {
        let col = mixc(th.plat, th.plat2, vnoise(i * 0.3, j * 2, S + 5, 3) * 0.6);
        if (j === 0) col = hexRgb(th.platHi); else if (j === 1) col = sh(col, 0.15); else if (j === 10) col = hexRgb(th.plat2); else if (j === 11) col = OUT;
        if (i % 18 === 5 && (j === 4 || j === 7)) col = [220, 220, 230];
        if (i % 18 === 6 && (j === 5 || j === 8)) col = [90, 90, 100];
        put(8, i, j, col);
      }
      for (const bx of [6, 26]) { const k = i - bx; if (k >= 0 && k < 5) for (let j = 12; j < 12 + (5 - k) * 2; j++) put(8, i, j, k === 0 ? sh(th.plat2, 0.2) : sh(th.plat2, -0.2)); }
    }
    // --- bloque decorativo (9)
    for (let j = 0; j < TS; j++) for (let i = 0; i < TS; i++) {
      let col = mixc(th.block, th.block2, vnoise(i, j, S + 9, 6, 6) * 0.5);
      if (hash(i, j, S + 9) < 0.06) col = sh(col, -0.1);
      if (i === 0 || j === 0 || i === 35 || j === 35) col = OUT;
      else if (i < 3 || j < 3) col = hexRgb(th.blockHi);
      else if (i > 32 || j > 32) col = hexRgb(th.block2);
      else if (i >= 8 && i <= 27 && j >= 8 && j <= 27) { if (i === 8 || j === 8) col = hexRgb(th.block2); else if (i === 27 || j === 27) col = hexRgb(th.blockHi); }
      put(9, i, j, col);
    }
    x.putImageData(id, 0, 0);
    return c;
  }

  // ---------------- FONDOS ----------------
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const W = 1280, H = 360;
  const R = (x, X, Y, w, h, col) => { if (w <= 0 || h <= 0) return; x.fillStyle = css(col); x.fillRect(Math.round(X), Math.round(Y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
  function dither(x, X, Y, w, h, col, ph = 0) { x.fillStyle = css(col); X = Math.round(X); Y = Math.round(Y); for (let j = 0; j < h; j++) for (let i = (j + ph) % 2; i < w; i += 2) x.fillRect(X + i, Y + j, 1, 1); }
  // Capa de píxeles (ImageData) para dibujos pixel a pixel
  function pixLayer() {
    const id = new ImageData(W, H), d = id.data;
    return {
      set(X, Y, col, a = 255) { X = ((Math.round(X) % W) + W) % W; Y = Math.round(Y); if (Y < 0 || Y >= H) return; const o = (Y * W + X) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = a; },
      commit(x) { const c = canvas(W, H); c.getContext('2d').putImageData(id, 0, 0); x.drawImage(c, 0, 0); },
    };
  }
  function makeSky(cols) {
    const c = canvas(640, 360), x = c.getContext('2d'), n = 18, bh = 300 / n;
    for (let i = 0; i < n; i++) {
      const col = mixc(cols[0], cols[1], i / (n - 1)), next = mixc(cols[0], cols[1], (i + 1) / (n - 1)), y0 = Math.round(i * bh);
      R(x, 0, y0, 640, Math.ceil(bh) + 1, col);
      if (i < n - 1) { dither(x, 0, y0 + Math.round(bh) - 3, 640, 1, next, 0); dither(x, 0, y0 + Math.round(bh) - 2, 640, 2, next, 1); }
    }
    R(x, 0, 300, 640, 60, cols[1]);
    return c;
  }
  // nube esponjosa con 3 tonos
  function cloud(x, X, Y, s, hi = [255, 255, 255], lo = [200, 216, 236], r = Math.random) {
    const blobs = [[0, 10, 11], [13, 3, 14], [30, 5, 12], [42, 11, 9], [20, 12, 13]].map(([a, b, c]) => [X + a * s, Y + b * s, c * s]);
    const x0 = X - 12 * s, x1 = X + 54 * s, y0 = Y - 12 * s, y1 = Y + 26 * s, bottom = Y + 16 * s, mid = [Math.round((hi[0] + lo[0]) / 2), Math.round((hi[1] + lo[1]) / 2), Math.round((hi[2] + lo[2]) / 2)];
    for (let py = Math.floor(y0); py < y1; py++) for (let px = Math.floor(x0); px < x1; px++) {
      if (py > bottom) continue;
      let inside = null;
      for (const b of blobs) { const dx = px - b[0], dy = py - b[1]; if (dx * dx + dy * dy < b[2] * b[2]) { inside = b; break; } }
      if (!inside) continue;
      const dx = px - inside[0], dy = py - inside[1], l = -(dx + dy * 1.4) / (inside[2] * 1.6);
      let col = l > 0.25 ? hi : l > -0.2 ? mid : lo;
      if (Math.abs(l - 0.25) < 0.06 || Math.abs(l + 0.2) < 0.06) col = (px + py) % 2 ? col : (l > 0 ? mid : lo);
      if (py > bottom - 3) col = lo;
      R(x, ((px % W) + W) % W, py, 1, 1, col);
    }
  }
  // cordillera con iluminación, nieve y bruma
  function mountains(x, baseY, peaks, o) {
    const L = pixLayer(), tops = new Float32Array(W + 4);
    for (let X = -2; X < W + 2; X++) {
      let top = baseY + 40;
      for (const p of peaks) { let dd = Math.abs(X - p.x); dd = Math.min(dd, W - dd); const y = baseY - p.h + dd * p.s; if (y < top) top = y; }
      top += (vnoise(X, 0, o.seed || 1, 40, W / 40) - 0.5) * 16 * (o.rough || 1) + (vnoise(X, 5, (o.seed || 1) + 3, 9, W / 9) - 0.5) * 6 * (o.rough || 1);
      tops[X + 2] = top;
    }
    for (let X = 0; X < W; X++) {
      const t = tops[X + 2], slope = tops[X + 4] - tops[X];
      const snowLine = o.snow ? baseY - o.snowAt + (vnoise(X, 9, 7, 14, W / 14) - 0.5) * 18 : -1e9;
      for (let Y = Math.max(0, Math.floor(t)); Y < H; Y++) {
        const gully = vnoise(X, Y * 0.35, 11, 7, 0) > 0.72;
        let col = slope < -0.4 ? o.lit : slope > 0.4 ? o.dark : o.mid;
        if (gully) col = o.dark;
        if (Y < snowLine && o.snow) col = slope > 0.3 || gully ? o.snowDark : o.snow;
        const depth = (Y - t) / Math.max(20, baseY + 40 - t);
        if (o.haze) col = mixc(col, o.haze, Math.min(0.75, depth * 0.9));
        if (Y - t < 1 && !(Y < snowLine && o.snow)) col = sh(col, 0.15);
        L.set(X, Y, col);
      }
    }
    L.commit(x);
  }
  function sea(x, Y, deep, shallow, foam, sunX = null) {
    const L = pixLayer();
    for (let y = Y; y < H; y++) {
      const t = (y - Y) / (H - Y), base = mixc(shallow, deep, Math.min(1, t * 1.6));
      for (let X = 0; X < W; X++) {
        let col = base;
        const wv = vnoise(X * 0.25, y * 1.6, 5, 5, 0);
        if (wv > 0.72) col = sh(base, 0.18 + (y - Y) * 0.002);
        if (wv > 0.84 && (X + y) % 2) col = foam;
        if (sunX !== null && Math.abs(X - sunX) < 30 - (y - Y) * 0.1 && hash(X, y, 2) < 0.2) col = [255, 240, 190];
        L.set(X, y, col);
      }
    }
    for (let X = 0; X < W; X++) L.set(X, Y, sh(shallow, 0.3));
    L.commit(x);
  }
  function sun(x, X, Y, r, core, glow) {
    for (let k = 3; k >= 1; k--) { const rr = r + k * 8; for (let j = -rr; j <= rr; j++) { const w = Math.sqrt(rr * rr - j * j); dither(x, X - w, Y + j, w * 2, 1, mixc(glow, core, 0.2 * (3 - k)), (k + j) % 2); } }
    for (let j = -r; j <= r; j++) { const w = Math.sqrt(r * r - j * j); R(x, X - w, Y + j, w * 2, 1, j < -r * 0.4 ? sh(core, 0.4) : core); }
  }
  // edificio detallado con ventanas, cornisa, balcones y lado en sombra
  function building(x, X, base, w, h, o, r) {
    const col = hexRgb(o.col), lit = sh(col, 0.14), dark = sh(col, -0.2), deep = sh(col, -0.42), top = base - h;
    R(x, X, top, w, h, col);
    for (let n = 0; n < w * h / 30; n++) R(x, X + r() * w, top + r() * h, 1, 1, r() < 0.5 ? sh(col, 0.06) : sh(col, -0.06));
    R(x, X, top, 2, h, lit); R(x, X + w - 4, top, 4, h, dark);
    // cornisa
    R(x, X - 2, top - 5, w + 4, 3, lit); R(x, X - 2, top - 2, w + 4, 2, deep); if (o.roof) { for (let j = 0; j < 8; j++) R(x, X - 2 + j, top - 13 + j, w + 4 - j * 2, 1, j % 2 ? o.roof : sh(o.roof, -0.15)); }
    const floorH = o.floorH || 18, ww = o.winW || 8, wh = o.winH || 11, gap = o.winGap || 14;
    for (let fy = top + 8; fy < base - floorH - 2; fy += floorH) {
      R(x, X + 1, fy + wh + 4, w - 2, 1, sh(col, -0.1));
      for (let fx = X + 6; fx + ww < X + w - 6; fx += gap) {
        const lit2 = o.night && r() < 0.35;
        R(x, fx - 1, fy - 1, ww + 2, wh + 2, o.frame || deep);
        const glass = lit2 ? [255, 214, 110] : (o.glass ? hexRgb(o.glass) : [70, 110, 150]);
        R(x, fx, fy, ww, wh, glass);
        R(x, fx, fy, ww, 2, sh(glass, -0.25));
        R(x, fx + 1, fy + 3, 2, wh - 5, sh(glass, 0.35));
        R(x, fx + ww / 2, fy, 1, wh, o.frame || deep);
        R(x, fx - 2, fy + wh + 1, ww + 4, 2, lit);
        if (o.shutters) { R(x, fx - 4, fy, 3, wh, o.shutters); R(x, fx + ww + 1, fy, 3, wh, o.shutters); }
        if (o.balcony && r() < 0.5) { R(x, fx - 3, fy + wh - 2, ww + 6, 1, [40, 40, 50]); for (let k = fx - 3; k < fx + ww + 3; k += 2) R(x, k, fy + wh - 1, 1, 4, [40, 40, 50]); R(x, fx - 3, fy + wh + 3, ww + 6, 1, [40, 40, 50]); }
      }
    }
    // planta baja
    if (o.shops) {
      const aw = o.awning || [200, 50, 50];
      for (let k = 0; k < w - 4; k += 6) R(x, X + 2 + k, base - floorH - 2, 6, 6, (k / 6) % 2 ? aw : [245, 240, 230]);
      R(x, X + 2, base - floorH + 4, w - 4, 1, deep);
      R(x, X + 6, base - floorH + 6, w * 0.4, floorH - 6, [60, 80, 100]); R(x, X + 7, base - floorH + 7, 3, floorH - 9, [150, 180, 200]);
      R(x, X + w * 0.6, base - floorH + 5, 12, floorH - 5, deep);
    }
  }
  function palm(x, X, gy, h, o = {}) {
    const trunk = hexRgb(o.trunk || '#9a6a3a'), leaf = hexRgb(o.leaf || '#3aa048'), bend = o.bend || 10;
    for (let i = 0; i < h; i += 4) {
      const off = Math.sin(i / h * 1.5) * bend, wd = 7 - i / h * 2;
      R(x, X + off, gy - i - 4, wd, 4, trunk); R(x, X + off, gy - i - 4, 2, 4, sh(trunk, 0.25)); R(x, X + off + wd - 2, gy - i - 4, 2, 4, sh(trunk, -0.3)); R(x, X + off, gy - i - 1, wd, 1, sh(trunk, -0.35));
    }
    const tx = X + Math.sin(1.5) * bend + 3, ty = gy - h;
    const fronds = [[-1, -0.25], [1, -0.2], [-0.85, 0.35], [0.9, 0.35], [-0.35, -0.9], [0.4, -0.85], [-0.2, 0.7], [0.3, 0.75]];
    fronds.forEach(([dx, dy], n) => {
      const L = 26 + (n % 3) * 5;
      for (let s = 0; s <= L; s++) {
        const t = s / L, px = tx + dx * s, py = ty + dy * s * 0.6 + t * t * 14;
        R(x, px, py, 2, 2, sh(leaf, -0.2));
        if (s % 2 === 0 && s > 2) { const len = 6 * (1 - t) + 2; for (let k = 1; k < len; k++) { R(x, px - dy * k * 0.3, py + k, 1, 1, k < len / 2 ? sh(leaf, 0.2) : leaf); R(x, px + dy * k * 0.3 + 1, py + k * 0.8, 1, 1, sh(leaf, -0.15)); } }
      }
    });
    for (const [a, b] of [[-3, 2], [2, 3], [-1, 5]]) { R(x, tx + a, ty + b, 4, 4, [110, 70, 30]); R(x, tx + a, ty + b, 1, 1, [180, 130, 70]); }
  }
  function pine(x, X, gy, h, o = {}) {
    const col = hexRgb(o.col || '#1f6a3c'), snow = o.snow;
    R(x, X - 2, gy - h * 0.2, 5, h * 0.2, [90, 58, 34]); R(x, X - 2, gy - h * 0.2, 1, h * 0.2, [130, 90, 50]);
    const tiers = 5;
    for (let l = 0; l < tiers; l++) {
      const tw = h * 0.55 * (1 - l * 0.16), ty = gy - h * 0.15 - l * h * 0.17, th = h * 0.26;
      for (let j = 0; j < th; j++) {
        const ww = tw * (j / th) + 2, jag = hash(Math.round(X), j + l * 20, 4) * 3;
        for (let i = -ww / 2 - jag; i < ww / 2 + jag; i++) {
          const f = i < -ww * 0.15 ? 0.12 : i > ww * 0.2 ? -0.28 : -0.05;
          let c2 = sh(col, f + (j === Math.floor(th) - 1 ? -0.2 : 0));
          if (snow && j < 3 + hash(i | 0, l, 3) * 3 && i < ww * 0.3) c2 = j === 0 ? [255, 255, 255] : [225, 238, 252];
          R(x, X + i, ty - th + j, 1, 1, c2);
        }
      }
    }
  }
  function tree(x, X, gy, h, o = {}) {
    const col = hexRgb(o.col || '#3f8a3a');
    R(x, X - 3, gy - h * 0.45, 7, h * 0.45, [110, 84, 56]); R(x, X - 3, gy - h * 0.45, 2, h * 0.45, [150, 120, 80]); R(x, X + 2, gy - h * 0.45, 2, h * 0.45, [80, 60, 40]);
    const blobs = [[0, -0.75, 0.3], [-0.28, -0.62, 0.24], [0.28, -0.6, 0.24], [-0.12, -0.9, 0.2], [0.16, -0.88, 0.2], [0, -0.55, 0.25]];
    for (const [bx, by, br] of blobs) {
      const cx = X + bx * h, cy = gy + by * h, r = br * h;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        if (i * i + j * j > r * r) continue;
        const l = -(i + j * 1.3) / (r * 1.6);
        let c2 = l > 0.3 ? sh(col, 0.22) : l > -0.15 ? col : sh(col, -0.28);
        if (hash(Math.round(cx + i), Math.round(cy + j), 8) < 0.12) c2 = sh(c2, -0.12);
        R(x, cx + i, cy + j, 1, 1, c2);
      }
    }
  }
  function lamp(x, X, gy, col = [40, 40, 56], glow = [255, 232, 150]) {
    R(x, X - 4, gy - 4, 11, 4, col); R(x, X - 3, gy - 8, 9, 4, sh(col, 0.15)); R(x, X, gy - 64, 3, 58, col); R(x, X, gy - 64, 1, 58, sh(col, 0.3));
    R(x, X - 6, gy - 70, 15, 3, col); R(x, X - 5, gy - 80, 13, 10, col); R(x, X - 4, gy - 79, 11, 8, glow); R(x, X - 4, gy - 79, 3, 8, sh(glow, 0.4));
    R(x, X - 2, gy - 84, 7, 4, col); R(x, X, gy - 87, 3, 3, col);
  }
  function umbrella(x, X, gy, c1, c2) {
    R(x, X, gy - 34, 2, 34, [230, 230, 230]); R(x, X + 1, gy - 34, 1, 34, [170, 170, 170]);
    for (let j = 0; j < 12; j++) { const w = 10 + j * 3; for (let i = 0; i < w; i++) { const seg = Math.floor(i / (w / 6)); R(x, X + 1 - w / 2 + i, gy - 46 + j, 1, 1, sh(seg % 2 ? c1 : c2, j < 3 ? 0.2 : (i > w * 0.7 ? -0.2 : 0))); } }
    for (let i = -20; i < 22; i += 4) R(x, X + i, gy - 35, 3, 2, c1);
    dither(x, X - 14, gy - 2, 34, 3, [0, 0, 0]);
  }
  function fence(x, Y, col, step = 18) { R(x, 0, Y, W, 3, col); R(x, 0, Y + 12, W, 2, col); for (let i = 0; i < W; i += step) { R(x, i, Y - 4, 3, 22, col); R(x, i, Y - 4, 1, 22, sh(col, 0.3)); } }
  function sign(x, X, Y, w, h, bg, fg, text) {
    R(x, X - 1, Y - 1, w + 2, h + 2, [27, 20, 38]); R(x, X, Y, w, h, bg); R(x, X, Y, w, 1, sh(bg, 0.3));
    x.fillStyle = css(fg); x.font = '8px "Press Start 2P", monospace'; x.textBaseline = 'top'; x.textAlign = 'center'; x.fillText(text, Math.round(X + w / 2), Math.round(Y + (h - 8) / 2 + 1));
  }

  const PAINTERS = {
    laspalmas(layer, x, r) {
      if (layer === 0) {
        sun(x, 1000, 70, 22, [255, 250, 210], [255, 230, 140]);
        for (let i = 0; i < 7; i++) cloud(x, r() * W, 25 + r() * 70, 0.7 + r() * 0.7);
        sea(x, 196, [20, 90, 170], [70, 160, 225], [210, 240, 255], 1000);
        mountains(x, 199, [{ x: 150, h: 70, s: 0.75 }, { x: 250, h: 52, s: 0.6 }, { x: 330, h: 88, s: 0.9 }], { lit: [196, 150, 110], mid: [160, 116, 86], dark: [118, 84, 66], haze: [150, 180, 210], seed: 3, rough: 0.8 });
        for (let i = 0; i < 4; i++) { const X = 500 + i * 160 + r() * 60; R(x, X, 193, 20, 3, [230, 230, 240]); R(x, X + 5, 189, 8, 4, [240, 240, 250]); R(x, X + 8, 185, 2, 4, [80, 80, 90]); }
      } else if (layer === 1) {
        // Auditorio Alfredo Kraus
        const ax = 150, b = 238;
        R(x, ax - 30, b - 40, 150, 40, [206, 186, 150]); for (let i = ax - 26; i < ax + 116; i += 6) R(x, i, b - 36, 2, 32, [150, 130, 100]);
        R(x, ax, b - 118, 70, 118, [218, 200, 164]); R(x, ax, b - 118, 3, 118, [240, 226, 196]); R(x, ax + 62, b - 118, 8, 118, [170, 150, 118]);
        for (let i = ax + 8; i < ax + 60; i += 7) { R(x, i, b - 108, 3, 96, [110, 96, 76]); R(x, i, b - 108, 1, 96, [80, 70, 56]); }
        R(x, ax - 2, b - 124, 74, 6, [240, 226, 196]);
        let X = 300;
        const cols = ['#f4e3c3', '#fdfdf8', '#f7c9a0', '#bfe0e8', '#f2d0e0', '#e8f0c0'];
        while (X < W - 30) { const w = 44 + r() * 36, h = 60 + r() * 70; building(x, X, b, w, h, { col: cols[Math.floor(r() * cols.length)], balcony: true, shops: r() < 0.5, awning: [30 + r() * 200, 80, 160], glass: '#5a8ab8' }, r); X += w + 2; }
        R(x, 0, b, W, 4, [240, 236, 220]); R(x, 0, b + 4, W, 2, [180, 170, 150]);
        for (let i = 0; i < W; i += 10) R(x, i, b - 6, 2, 6, [255, 255, 255]); R(x, 0, b - 7, W, 2, [255, 255, 255]);
        const L = pixLayer(); for (let y = b + 6; y < H; y++) for (let X2 = 0; X2 < W; X2++) L.set(X2, y, hash(X2, y, 1) < 0.05 ? [255, 240, 200] : mixc([246, 222, 150], [226, 190, 110], (y - b) / 80)); L.commit(x);
      } else {
        const gy = 262;
        for (let i = 0; i < 9; i++) palm(x, 40 + i * 145 + r() * 40, gy, 70 + r() * 40);
        for (let i = 0; i < 7; i++) umbrella(x, 110 + i * 180 + r() * 50, gy + 4, [[230, 50, 60], [40, 120, 230], [250, 170, 30]][i % 3], [255, 255, 255]);
        // torre de socorrista
        R(x, 700, gy - 60, 3, 60, [240, 240, 240]); R(x, 730, gy - 60, 3, 60, [240, 240, 240]); R(x, 696, gy - 76, 40, 16, [220, 40, 40]); R(x, 696, gy - 76, 40, 4, [255, 255, 255]); R(x, 700, gy - 40, 34, 2, [240, 240, 240]);
        const L = pixLayer(); for (let y = gy; y < H; y++) for (let X2 = 0; X2 < W; X2++) L.set(X2, y, hash(X2, y, 2) < 0.06 ? [255, 244, 210] : mixc([240, 212, 140], [222, 184, 104], (y - gy) / 60)); L.commit(x);
      }
    },
    cadiz(layer, x, r) {
      if (layer === 0) {
        sun(x, 880, 170, 34, [255, 236, 170], [255, 150, 90]);
        for (let i = 0; i < 6; i++) cloud(x, r() * W, 30 + r() * 80, 0.7 + r() * 0.8, [255, 214, 180], [224, 128, 110]);
        sea(x, 204, [150, 70, 90], [230, 130, 90], [255, 220, 160], 880);
      } else if (layer === 1) {
        const b = 236;
        let X = 0;
        while (X < W) {
          const w = 34 + r() * 36, h = 44 + r() * 50, col = ['#ffffff', '#f8f0e0', '#fff4d4', '#f4ead8'][Math.floor(r() * 4)];
          if (X > 470 && X < 780) { X += w; continue; }
          building(x, X, b, w, h, { col, shutters: r() < 0.5 ? [60, 120, 70] : null, glass: '#4a5a7a', balcony: true, night: true }, r);
          if (r() < 0.45) { const tx = X + w / 2 - 8; R(x, tx, b - h - 22, 16, 22, col); R(x, tx, b - h - 22, 16, 2, [230, 220, 200]); R(x, tx + 5, b - h - 16, 6, 8, [60, 70, 90]); R(x, tx - 2, b - h - 25, 20, 3, [220, 200, 170]); }
          X += w;
        }
        // Catedral de Cádiz
        const cx = 625, stone = [232, 214, 180];
        R(x, cx - 100, b - 96, 200, 96, stone); R(x, cx - 100, b - 96, 200, 3, [250, 238, 210]);
        for (let i = cx - 90; i < cx + 90; i += 16) { R(x, i, b - 80, 8, 30, [120, 100, 80]); R(x, i, b - 88, 8, 8, [200, 180, 150]); }
        R(x, cx - 18, b - 44, 36, 44, [110, 90, 70]); for (let j = 0; j < 18; j++) { const w2 = Math.sqrt(324 - j * j) * 2; R(x, cx - w2 / 2, b - 44 - (18 - j) + 0, w2, 1, [110, 90, 70]); }
        for (const tx of [cx - 125, cx + 95]) {
          R(x, tx, b - 170, 30, 170, stone); R(x, tx, b - 170, 3, 170, [250, 240, 214]); R(x, tx + 25, b - 170, 5, 170, [190, 170, 140]);
          R(x, tx + 9, b - 150, 12, 18, [70, 60, 60]); R(x, tx + 9, b - 118, 12, 18, [70, 60, 60]);
          R(x, tx + 4, b - 186, 22, 16, [224, 206, 172]); for (let j = 0; j < 14; j++) { const w2 = 22 - j * 1.4; R(x, tx + 15 - w2 / 2, b - 200 + j, w2, 1, j % 3 ? [240, 190, 50] : [200, 150, 30]); }
          R(x, tx + 14, b - 208, 2, 8, [60, 50, 40]);
        }
        const dr = 58, dcy = b - 96;
        for (let j = 0; j < dr; j++) { const w2 = Math.sqrt(dr * dr - (dr - j) * (dr - j)) * 2; for (let i = 0; i < w2; i++) { const u = i / w2; let c2 = u < 0.3 ? [255, 222, 110] : u > 0.75 ? [190, 130, 20] : [240, 184, 40]; if (Math.floor(i / (w2 / 10)) % 2 && j > 6) c2 = sh(c2, -0.1); if (j % 7 === 0) c2 = sh(c2, -0.2); R(x, cx - w2 / 2 + i, dcy - dr + j, 1, 1, c2); } }
        R(x, cx - 6, dcy - dr - 14, 12, 14, [240, 190, 50]); R(x, cx - 1, dcy - dr - 26, 2, 12, [60, 50, 40]); R(x, cx - 4, dcy - dr - 22, 8, 2, [60, 50, 40]);
      } else {
        const gy = 262, st = [200, 164, 100];
        for (let i = 0; i < 7; i++) palm(x, 70 + i * 180 + r() * 50, gy - 18, 80 + r() * 30, { leaf: '#2f8a44' });
        for (let i = 0; i < 8; i++) lamp(x, 30 + i * 160, gy - 18, [30, 30, 44]);
        // muralla del Campo del Sur (piedra ostionera)
        const L = pixLayer(); for (let y = gy - 18; y < H; y++) for (let X2 = 0; X2 < W; X2++) { let c2 = mixc(st, [160, 124, 70], vnoise(X2, y, 4, 5)); if (hash(X2, y, 4) < 0.08) c2 = [120, 90, 50]; if ((y - gy + 18) % 14 === 0 || (X2 + Math.floor((y - gy + 18) / 14) * 11) % 22 === 0) c2 = [150, 118, 70]; L.set(X2, y, c2); } L.commit(x);
        R(x, 0, gy - 30, W, 4, [230, 206, 150]); for (let i = 0; i < W; i += 8) { R(x, i + 2, gy - 26, 4, 8, [220, 196, 140]); R(x, i + 5, gy - 26, 1, 8, [170, 140, 90]); } R(x, 0, gy - 18, W, 2, [150, 120, 70]);
      }
    },
    sotogrande(layer, x, r) {
      if (layer === 0) {
        for (let i = 0; i < 7; i++) cloud(x, r() * W, 25 + r() * 60, 0.6 + r() * 0.8);
        mountains(x, 206, [{ x: 200, h: 26, s: 0.3 }, { x: 420, h: 34, s: 0.25 }, { x: 1100, h: 30, s: 0.3 }], { lit: [150, 170, 200], mid: [136, 156, 188], dark: [120, 140, 176], haze: [190, 210, 235], seed: 8, rough: 0.6 });
        sea(x, 206, [30, 100, 170], [80, 160, 220], [220, 240, 255]);
        // Peñón de Gibraltar
        const L = pixLayer();
        for (let X = 690; X < 960; X++) { const t = (X - 690) / 270, top = t < 0.12 ? 206 - t / 0.12 * 130 : 206 - 130 + (t - 0.12) * 146 + Math.sin(t * 20) * 3; for (let Y = Math.floor(top); Y < 207; Y++) { const lit = t < 0.14; let c2 = lit ? [200, 196, 186] : mixc([140, 150, 150], [100, 120, 110], (Y - top) / 60); if (vnoise(X, Y, 3, 5) > 0.7) c2 = sh(c2, -0.12); if (!lit && Y - top > 20 && vnoise(X, Y, 6, 8) > 0.5) c2 = [90, 120, 90]; L.set(X, Y, mixc(c2, [180, 200, 225], 0.35)); } }
        L.commit(x);
      } else if (layer === 1) {
        const b = 238;
        let X = 0; while (X < W) { const w = 60 + r() * 50, h = 36 + r() * 30; building(x, X, b - 14, w, h, { col: '#fbf7ee', roof: [200, 96, 58], glass: '#4a7090', shutters: [60, 100, 140], floorH: 20 }, r); X += w + 30 + r() * 50; }
        R(x, 0, b - 14, W, 14, [120, 150, 170]);
        for (let i = 0; i < 13; i++) {
          const X2 = i * 98 + r() * 30, hl = 54 + r() * 14, yb = b - 4;
          R(x, X2 + 24, yb - 80 - r() * 20, 2, 80, [230, 230, 238]); x.strokeStyle = 'rgba(80,80,90,0.6)'; x.beginPath(); x.moveTo(X2 + 25, yb - 96); x.lineTo(X2 + 2, yb - 14); x.moveTo(X2 + 25, yb - 96); x.lineTo(X2 + 52, yb - 14); x.stroke();
          for (let j = 0; j < 12; j++) R(x, X2 + j * 0.6, yb - 12 + j, hl - j * 1.2, 1, j < 4 ? [255, 255, 255] : j < 6 ? [30, 70, 140] : [236, 236, 244]);
          R(x, X2 + 14, yb - 22, 26, 10, [250, 250, 255]); for (let k = 0; k < 3; k++) R(x, X2 + 17 + k * 7, yb - 19, 5, 4, [60, 90, 120]);
        }
        R(x, 0, b, W, 5, [210, 196, 170]); for (let i = 0; i < W; i += 30) R(x, i, b - 8, 3, 13, [150, 120, 90]);
        const L = pixLayer(); for (let y = b + 5; y < H; y++) for (let X2 = 0; X2 < W; X2++) L.set(X2, y, mixc([60, 140, 200], [30, 90, 160], (y - b) / 60)); L.commit(x);
      } else {
        const gy = 258;
        const L = pixLayer(); for (let y = gy; y < H; y++) for (let X2 = 0; X2 < W; X2++) { let c2 = Math.floor((X2 + y * 0.6) / 40) % 2 ? [84, 176, 72] : [100, 196, 84]; if (hash(X2, y, 3) < 0.08) c2 = sh(c2, 0.15); L.set(X2, y, c2); } L.commit(x);
        for (let i = 0; i < 4; i++) { const X2 = 120 + i * 320 + r() * 40; for (let j = 0; j < 12; j++) { const w = Math.sqrt(144 - (j - 6) ** 2) * 4; R(x, X2 - w / 2, gy + 16 + j, w, 1, j < 3 ? [250, 236, 190] : [236, 214, 160]); } }
        for (let i = 0; i < 5; i++) { const X2 = 60 + i * 260 + r() * 40; R(x, X2, gy - 40, 2, 44, [245, 245, 245]); for (let j = 0; j < 10; j++) R(x, X2 + 2, gy - 40 + j, 16 - j * 1.2, 1, j < 3 ? [255, 90, 90] : [220, 40, 40]); dither(x, X2 - 8, gy + 2, 18, 3, [40, 90, 40]); }
        for (let i = 0; i < 14; i++) { const X2 = i * 92 + r() * 20; tree(x, X2, gy - 2, 34 + r() * 20, { col: '#2e7a3a' }); }
        fence(x, gy - 18, [250, 250, 250], 36);
      }
    },
    madrid(layer, x, r) {
      if (layer === 0) {
        for (let i = 0; i < 6; i++) cloud(x, r() * W, 25 + r() * 70, 0.6 + r() * 0.8);
        mountains(x, 214, [{ x: 900, h: 70, s: 0.3 }, { x: 1100, h: 60, s: 0.35 }, { x: 200, h: 40, s: 0.3 }], { lit: [190, 200, 225], mid: [170, 182, 212], dark: [150, 162, 196], snow: [245, 248, 255], snowDark: [210, 220, 240], snowAt: 50, haze: [205, 222, 245], seed: 11 });
        const glassT = (X, Y, w, h, tint) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let c2 = mixc(tint, [220, 236, 255], (i / w) * 0.5 + (j % 6 === 0 ? 0.2 : 0)); if (i % 5 === 0) c2 = sh(c2, -0.15); R(x, X + i, Y + j, 1, 1, c2); } };
        glassT(140, 40, 34, 176, [120, 150, 190]); R(x, 140, 26, 6, 14, [110, 130, 170]); R(x, 168, 26, 6, 14, [110, 130, 170]); R(x, 140, 24, 34, 4, [110, 130, 170]);
        glassT(192, 52, 32, 164, [140, 160, 180]); R(x, 196, 46, 24, 6, [120, 140, 160]);
        glassT(242, 60, 30, 156, [100, 140, 190]);
        glassT(290, 66, 32, 150, [150, 160, 190]); for (let j = 0; j < 14; j++) R(x, 290 + j, 52 + j, 32 - j, 1, [150, 160, 190]);
        for (let j = 0; j < 120; j++) { glassT(560 + j * 0.28, 214 - j, 26, 1, [140, 150, 180]); glassT(660 - j * 0.28, 214 - j, 26, 1, [140, 150, 180]); }
        R(x, 0, 214, W, 146, [170, 186, 210]);
      } else if (layer === 1) {
        const b = 236;
        let X = 0;
        while (X < W) { const w = 54 + r() * 40, h = 64 + r() * 60; if (X > 380 && X < 520) { X = 520; continue; } building(x, X, b, w, h, { col: ['#e8d0b0', '#d8b898', '#f0e0c8', '#e0c0a0', '#f2e6d6'][Math.floor(r() * 5)], glass: '#3a5070', balcony: true, shops: true, awning: [[160, 40, 40], [40, 90, 60], [60, 60, 120]][Math.floor(r() * 3)], roof: [120, 100, 100], floorH: 20 }, r); if (r() < 0.3) { const cx = X + w / 2; for (let j = 0; j < 14; j++) { const w2 = Math.sqrt(196 - (14 - j) ** 2) * 2; R(x, cx - w2 / 2, b - h - 16 + j, w2, 1, j % 3 ? [70, 80, 90] : [110, 120, 130]); } } X += w; }
        // Edificio Metrópolis
        const mx = 410, mw = 90, st = [246, 240, 228];
        R(x, mx, b - 150, mw, 150, st); R(x, mx, b - 150, 3, 150, [255, 255, 250]); R(x, mx + mw - 6, b - 150, 6, 150, [200, 192, 176]);
        for (let j = b - 140; j < b - 20; j += 16) for (let i = mx + 8; i < mx + mw - 10; i += 12) { R(x, i, j, 6, 10, [50, 60, 80]); R(x, i + 1, j + 1, 1, 8, [120, 140, 170]); }
        for (let i = mx + 4; i < mx + mw - 4; i += 10) R(x, i, b - 150, 3, 150, [226, 218, 200]);
        for (let j = 0; j < 36; j++) { const w2 = Math.sqrt(36 * 36 - (36 - j) ** 2) * 1.3; for (let i = 0; i < w2; i++) { const u = i / w2; R(x, mx + mw / 2 - w2 / 2 + i, b - 186 + j, 1, 1, Math.floor(u * 8) % 2 && j > 4 ? [212, 170, 60] : (u < 0.3 ? [60, 60, 70] : [26, 26, 34])); } }
        R(x, mx + mw / 2 - 3, b - 212, 6, 26, [226, 180, 50]); R(x, mx + mw / 2 - 14, b - 206, 28, 4, [226, 180, 50]); R(x, mx + mw / 2 - 2, b - 218, 4, 6, [226, 180, 50]);
      } else {
        const gy = 262;
        // Puerta de Alcalá
        const px = 300, gr = [214, 204, 186];
        R(x, px, gy - 110, 260, 110, gr); R(x, px, gy - 110, 260, 3, [240, 232, 216]);
        R(x, px - 8, gy - 118, 276, 8, [196, 186, 168]); R(x, px - 8, gy - 118, 276, 2, [230, 222, 206]);
        R(x, px + 100, gy - 146, 60, 28, gr); R(x, px + 104, gy - 150, 52, 4, [196, 186, 168]); R(x, px + 118, gy - 164, 24, 14, [150, 140, 130]);
        [[px + 16, 36], [px + 66, 54], [px + 140, 54], [px + 208, 36]].forEach(([ax, aw]) => {
          const top = gy - 64;
          for (let j = 0; j < aw / 2; j++) { const w2 = Math.sqrt((aw / 2) ** 2 - (aw / 2 - j) ** 2) * 2; R(x, ax + aw / 2 - w2 / 2, top - aw / 2 + j, w2, 1, [44, 38, 52]); }
          R(x, ax, top, aw, 64, [44, 38, 52]); R(x, ax + aw - 5, top - aw / 4, 5, 64 + aw / 4, [30, 26, 36]);
          R(x, ax - 3, top - aw / 2 - 4, aw + 6, 3, [240, 232, 216]);
        });
        for (let i = px + 6; i < px + 256; i += 22) { R(x, i, gy - 106, 7, 106, [200, 190, 172]); R(x, i, gy - 106, 2, 106, [236, 228, 212]); R(x, i - 2, gy - 108, 11, 4, [230, 222, 206]); }
        // Oso y el Madroño
        const ox = 820;
        R(x, ox, gy - 34, 70, 34, [140, 140, 150]); R(x, ox, gy - 34, 70, 3, [190, 190, 200]);
        tree(x, ox + 22, gy - 34, 90, { col: '#2f7a34' });
        for (let i = 0; i < 12; i++) R(x, ox + 2 + hash(i, 1, 1) * 40, gy - 110 + hash(i, 2, 1) * 50, 3, 3, [230, 40, 40]);
        R(x, ox + 34, gy - 70, 28, 26, [110, 80, 50]); R(x, ox + 34, gy - 84, 16, 16, [110, 80, 50]); R(x, ox + 30, gy - 58, 8, 24, [110, 80, 50]); R(x, ox + 52, gy - 50, 8, 16, [110, 80, 50]); R(x, ox + 34, gy - 84, 3, 40, [150, 110, 70]);
        for (let i = 0; i < 9; i++) lamp(x, 30 + i * 150, gy, [24, 32, 30]);
        for (let i = 0; i < 6; i++) { const X2 = i * 220 + 120; if (Math.abs(X2 - 430) > 160 && Math.abs(X2 - 850) > 80) tree(x, X2, gy, 100 + r() * 20, { col: '#4a8a3a' }); }
        sign(x, 250, gy - 90, 40, 14, [220, 30, 40], [255, 255, 255], 'METRO'); R(x, 268, gy - 76, 3, 76, [60, 60, 70]);
        sign(x, 1020, gy - 70, 60, 14, [30, 80, 150], [255, 255, 255], 'KM 0');
      }
    },
    warner(layer, x, r) {
      if (layer === 0) {
        for (let i = 0; i < 7; i++) cloud(x, r() * W, 20 + r() * 70, 0.6 + r() * 0.8);
        // montaña rusa de madera
        const wood = [176, 132, 86];
        for (let X = 0; X < W; X++) {
          const y = 150 + Math.sin(X / 90) * 40 + Math.sin(X / 37) * 12;
          R(x, X, y, 1, 4, [120, 80, 50]); R(x, X, y, 1, 1, [220, 180, 130]);
          if (X % 20 === 0) R(x, X, y + 4, 2, 250 - y, wood);
          if (X % 40 === 0) for (let j = y + 10; j < 250; j += 18) { x.strokeStyle = 'rgba(140,100,60,0.9)'; x.beginPath(); x.moveTo(X, j); x.lineTo(X + 20, j + 18); x.moveTo(X + 20, j); x.lineTo(X, j + 18); x.stroke(); }
        }
        // torre de caída
        R(x, 940, 40, 18, 210, [200, 70, 70]); R(x, 940, 40, 4, 210, [240, 120, 120]); R(x, 932, 32, 34, 12, [255, 210, 70]); for (let j = 56; j < 240; j += 14) R(x, 944, j, 10, 2, [255, 255, 255]);
        R(x, 0, 250, W, 110, [120, 150, 110]);
      } else if (layer === 1) {
        const b = 236;
        const tx = 190; R(x, tx + 10, b - 110, 4, 110, [90, 90, 110]); R(x, tx + 66, b - 110, 4, 110, [90, 90, 110]); for (let j = b - 100; j < b; j += 20) { x.strokeStyle = '#5a5a6e'; x.beginPath(); x.moveTo(tx + 12, j); x.lineTo(tx + 68, j + 20); x.stroke(); }
        for (let j = 0; j < 60; j++) { const w2 = 80 - (j < 6 ? 6 - j : 0) * 2; R(x, tx - w2 / 2 + 40, b - 170 + j, w2, 1, j > 14 && j < 26 ? [255, 255, 255] : mixc([90, 140, 220], [50, 90, 170], j / 60)); }
        R(x, tx - 6, b - 176, 92, 8, [40, 60, 120]); R(x, tx + 22, b - 192, 36, 16, [40, 60, 120]);
        let X = 320;
        while (X < W - 100) {
          const w = 80 + r() * 50, h = 70 + r() * 50, c2 = [[240, 106, 106], [106, 192, 240], [240, 196, 64], [168, 120, 224], [96, 208, 160]][Math.floor(r() * 5)];
          building(x, X, b, w, h, { col: c2, glass: '#fff4c0', floorH: 24, winW: 10, winH: 12, winGap: 18 }, r);
          R(x, X + 8, b - h + 10, w - 16, 16, [30, 20, 40]); for (let i = X + 10; i < X + w - 10; i += 4) R(x, i, b - h + 8, 2, 2, [255, 240, 150]);
          R(x, X + w / 2 - 14, b - 34, 28, 34, [50, 30, 60]);
          X += w + 12;
        }
      } else {
        const gy = 262;
        for (let i = 0; i < 4; i++) {
          const X2 = 60 + i * 320;
          for (let j = 0; j < 56; j++) { const w = j * 2.2 + 4; for (let k = 0; k < w; k++) R(x, X2 + 60 - w / 2 + k, gy - 76 + j, 1, 1, sh(Math.floor(k / (w / 8)) % 2 ? [230, 40, 50] : [255, 255, 255], k > w * 0.7 ? -0.2 : (k < w * 0.2 ? 0.1 : 0))); }
          R(x, X2 + 8, gy - 20, 104, 20, [200, 30, 40]); R(x, X2 + 48, gy - 20, 24, 20, [40, 20, 30]);
          R(x, X2 + 59, gy - 92, 2, 16, [60, 60, 60]); R(x, X2 + 61, gy - 92, 12, 7, [255, 210, 60]);
        }
        for (let i = 0; i < 3; i++) { const X2 = 250 + i * 330; R(x, X2, gy - 50, 60, 50, [240, 220, 120]); R(x, X2, gy - 58, 60, 10, [220, 40, 40]); sign(x, X2 + 2, gy - 44, 56, 12, [255, 255, 255], [220, 40, 40], 'POP'); R(x, X2 + 6, gy - 28, 48, 20, [255, 250, 220]); }
        for (let i = 0; i < 14; i++) { const X2 = r() * W, Y = 120 + r() * 80, c2 = [[255, 74, 106], [74, 138, 255], [255, 208, 64], [74, 224, 122]][i % 4]; for (let j = 0; j < 16; j++) { const w = Math.sqrt(64 - (j - 8) ** 2) * 1.6; R(x, X2 + 7 - w / 2, Y + j, w, 1, sh(c2, j < 5 ? 0.25 : j > 12 ? -0.2 : 0)); } for (let j = 0; j < 40; j += 3) R(x, X2 + 7 + Math.sin(j) * 2, Y + 17 + j, 1, 3, [60, 60, 60]); }
        fence(x, gy - 16, [50, 50, 66], 24);
      }
    },
    siam(layer, x, r) {
      if (layer === 0) {
        sun(x, 1060, 60, 20, [255, 252, 220], [255, 230, 150]);
        for (let i = 0; i < 6; i++) cloud(x, r() * W, 25 + r() * 60, 0.6 + r() * 0.8);
        mountains(x, 212, [{ x: 420, h: 110, s: 0.5 }], { lit: [186, 192, 216], mid: [170, 176, 204], dark: [150, 158, 190], snow: [250, 252, 255], snowDark: [220, 228, 245], snowAt: 92, haze: [200, 225, 245], seed: 5, rough: 0.6 });
        sea(x, 212, [20, 120, 180], [60, 190, 225], [220, 250, 255]);
      } else if (layer === 1) {
        const b = 238;
        // templo tailandés
        const tx = 300;
        R(x, tx + 20, b - 40, 180, 40, [246, 236, 214]); for (let i = tx + 28; i < tx + 196; i += 18) { R(x, i, b - 36, 8, 36, [210, 170, 60]); R(x, i, b - 36, 2, 36, [250, 210, 110]); }
        [[0, 220, 44, [200, 50, 40]], [26, 170, 38, [40, 120, 70]], [52, 120, 34, [200, 50, 40]]].forEach(([o, w, h, c2]) => {
          for (let j = 0; j < h; j++) { const ww = w - j * 1.3; for (let i = 0; i < ww; i++) R(x, tx + 110 - ww / 2 + i, b - 40 - o * 1.4 - j, 1, 1, j < 3 ? [255, 210, 60] : sh(c2, (i / ww) < 0.3 ? 0.15 : (i / ww) > 0.75 ? -0.25 : 0) ); }
          R(x, tx + 110 - w / 2 - 4, b - 40 - o * 1.4 - 6, 6, 2, [255, 210, 60]); R(x, tx + 110 + w / 2 - 2, b - 40 - o * 1.4 - 6, 6, 2, [255, 210, 60]);
        });
        for (let j = 0; j < 70; j++) R(x, tx + 110 - (70 - j) * 0.07, b - 190 - j, (70 - j) * 0.14 + 2, 1, j % 8 < 4 ? [255, 214, 70] : [220, 170, 40]);
        // Torre de toboganes
        const sx = 760; R(x, sx, b - 180, 56, 180, [236, 220, 180]); R(x, sx, b - 180, 3, 180, [255, 244, 214]); R(x, sx + 50, b - 180, 6, 180, [196, 176, 140]);
        for (let j = b - 170; j < b; j += 24) R(x, sx + 4, j, 48, 6, [200, 110, 60]);
        for (let j = 0; j < 30; j++) { const ww = 80 - j * 2.4; R(x, sx + 28 - ww / 2, b - 180 - 30 + j, ww, 1, j < 2 ? [255, 210, 60] : [180, 60, 40]); }
        for (let t = 0; t < 1; t += 0.003) { const a = [sx + 56 + t * 300, b - 170 + Math.pow(t, 0.6) * 160 + Math.sin(t * 9) * 10], c = [sx - t * 240, b - 150 + t * 140 + Math.sin(t * 7) * 14]; R(x, a[0], a[1], 9, 9, [255, 214, 60]); R(x, a[0], a[1], 9, 2, [255, 240, 150]); R(x, c[0], c[1], 9, 9, [60, 150, 240]); R(x, c[0], c[1], 9, 2, [150, 210, 255]); }
        for (let i = 0; i < 6; i++) palm(x, 40 + i * 230 + r() * 40, b, 70 + r() * 40);
      } else {
        const gy = 258;
        const L = pixLayer(); for (let y = gy; y < H; y++) for (let X2 = 0; X2 < W; X2++) { let c2 = mixc([90, 220, 235], [30, 160, 200], (y - gy) / 70); const wv = vnoise(X2 * 0.3, y * 1.5, 9, 4); if (wv > 0.7) c2 = sh(c2, 0.3); if (wv > 0.82 && (X2 + y) % 2) c2 = [240, 255, 255]; L.set(X2, y, c2); } L.commit(x);
        R(x, 0, gy - 6, W, 6, [240, 226, 196]); R(x, 0, gy - 6, W, 1, [255, 246, 220]);
        for (let i = 0; i < 8; i++) palm(x, 40 + i * 160 + r() * 40, gy - 6, 60 + r() * 50);
        for (let i = 0; i < 7; i++) { const X2 = 90 + i * 180 + r() * 50, c2 = [[255, 74, 106], [255, 208, 64], [74, 224, 122]][i % 3]; for (let j = 0; j < 10; j++) { const w = Math.sqrt(25 - (j - 5) ** 2) * 6; R(x, X2 + 15 - w / 2, gy + 10 + j, w, 1, j < 3 ? sh(c2, 0.3) : c2); } R(x, X2 + 9, gy + 13, 12, 4, [40, 170, 210]); }
        for (let i = 0; i < 5; i++) { const X2 = 170 + i * 260; R(x, X2, gy - 50, 3, 44, [110, 70, 40]); R(x, X2 - 2, gy - 58, 7, 8, [150, 100, 50]); R(x, X2, gy - 64, 3, 6, [255, 150, 40]); R(x, X2 + 1, gy - 68, 1, 4, [255, 230, 90]); }
      }
    },
    teide(layer, x, r) {
      if (layer === 0) {
        for (let i = 0; i < 4; i++) cloud(x, r() * W, 20 + r() * 40, 0.6 + r() * 0.6);
        mountains(x, 236, [{ x: 640, h: 200, s: 0.6 }, { x: 470, h: 92, s: 0.7 }, { x: 860, h: 110, s: 0.55 }], { lit: [170, 120, 96], mid: [140, 96, 80], dark: [100, 70, 62], snow: [250, 250, 255], snowDark: [200, 210, 235], snowAt: 150, haze: [150, 180, 220], seed: 21 });
        // mar de nubes
        const L = pixLayer(); for (let y = 224; y < H; y++) for (let X = 0; X < W; X++) { const n = vnoise(X, y * 2, 3, 22, W / 22), top = 224 + n * 16; if (y < top) continue; let c2 = y - top < 3 ? [255, 255, 255] : mixc([246, 248, 255], [205, 216, 236], (y - top) / 50); if (vnoise(X, y, 8, 10) > 0.72) c2 = sh(c2, -0.06); L.set(X, y, c2); } L.commit(x);
      } else if (layer === 1) {
        const b = 238;
        mountains(x, b + 10, [{ x: 200, h: 56, s: 0.5 }, { x: 900, h: 64, s: 0.4 }], { lit: [120, 84, 70], mid: [98, 68, 58], dark: [74, 50, 44], seed: 31, rough: 1.4 });
        // Roque Cinchado
        const rx = 500, L = pixLayer();
        for (let j = 0; j < 150; j++) { const y = b - 150 + j, w = j < 80 ? 44 + Math.sin(j / 80 * Math.PI) * 26 : 30 - (j - 80) * 0.12; for (let i = 0; i < w; i++) { const u = i / w; let c2 = u < 0.3 ? [176, 120, 90] : u > 0.7 ? [96, 62, 52] : [140, 96, 76]; if ((j + Math.floor(i / 7)) % 9 === 0) c2 = sh(c2, -0.18); if (hash(i, j, 5) < 0.06) c2 = sh(c2, 0.1); L.set(rx - w / 2 + i, y, c2); } }
        L.commit(x);
        // teleférico
        R(x, 1000, b - 170, 6, 170, [120, 120, 130]); R(x, 994, b - 176, 18, 6, [90, 90, 100]); x.strokeStyle = '#3a3a44'; x.beginPath(); x.moveTo(0, b - 60); x.lineTo(1003, b - 174); x.lineTo(1280, b - 200); x.stroke();
        R(x, 880, b - 150, 20, 16, [220, 50, 50]); R(x, 882, b - 147, 16, 6, [150, 200, 240]); R(x, 889, b - 162, 2, 12, [60, 60, 70]);
      } else {
        const gy = 262;
        const L = pixLayer(); for (let y = gy - 10; y < H; y++) for (let X2 = 0; X2 < W; X2++) { let c2 = mixc([80, 56, 50], [52, 36, 34], vnoise(X2, y, 2, 6)); if (hash(X2, y, 7) < 0.05) c2 = [120, 80, 64]; L.set(X2, y, c2); } L.commit(x);
        for (let i = 0; i < 7; i++) pine(x, 60 + i * 190 + r() * 60, gy - 6, 100 + r() * 50, { col: '#2f7a44' });
        for (let i = 0; i < 10; i++) {
          const X2 = 110 + i * 125 + r() * 40, h = 56 + r() * 40;
          R(x, X2 - 12, gy - 12, 24, 8, [90, 120, 80]); for (let k = 0; k < 6; k++) R(x, X2 - 14 + k * 5, gy - 16 - (k % 2) * 4, 4, 8, [110, 150, 90]);
          for (let j = 0; j < h; j++) { const w = 14 * (1 - j / h) + 3; for (let i2 = 0; i2 < w; i2++) R(x, X2 - w / 2 + i2, gy - 12 - j, 1, 1, (i2 + j) % 3 === 0 ? [255, 120, 140] : (i2 / w > 0.7 ? [170, 20, 50] : [226, 40, 72])); }
        }
      }
    },
    andorra(layer, x, r) {
      if (layer === 0) {
        for (let i = 0; i < 6; i++) cloud(x, r() * W, 20 + r() * 50, 0.7 + r() * 0.8, [255, 255, 255], [214, 224, 240]);
        mountains(x, 214, [{ x: 150, h: 160, s: 0.7 }, { x: 420, h: 190, s: 0.8 }, { x: 760, h: 150, s: 0.6 }, { x: 1050, h: 180, s: 0.75 }], { lit: [150, 166, 196], mid: [124, 140, 176], dark: [96, 110, 150], snow: [252, 253, 255], snowDark: [196, 212, 238], snowAt: 120, haze: [210, 226, 245], seed: 41 });
      } else if (layer === 1) {
        const b = 238;
        mountains(x, b + 20, [{ x: 300, h: 110, s: 0.5 }, { x: 900, h: 130, s: 0.45 }], { lit: [230, 238, 250], mid: [210, 222, 242], dark: [180, 196, 226], snow: [255, 255, 255], snowDark: [222, 232, 248], snowAt: 150, seed: 51, rough: 0.7 });
        // pueblo de piedra con tejados de pizarra
        const house = (X, w, h) => {
          const L = pixLayer();
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let c2 = mixc([150, 140, 130], [110, 100, 94], vnoise(X + i, j, 3, 4)); if ((j % 6 === 0) || ((i + Math.floor(j / 6) * 5) % 10 === 0)) c2 = [86, 78, 72]; if (i < 2) c2 = sh(c2, 0.15); if (i > w - 3) c2 = sh(c2, -0.2); L.set(X + i, b - h + j, c2); }
          L.commit(x);
          for (let j = 0; j < 18; j++) { const ww = w + 12 - j * ((w + 12) / 18) * 1; R(x, X + w / 2 - ww / 2, b - h - 1 - j, ww, 1, j < 5 ? [250, 252, 255] : [60, 66, 80]); }
          R(x, X + w - 14, b - h - 22, 7, 14, [120, 110, 100]); R(x, X + w - 15, b - h - 24, 9, 3, [255, 255, 255]);
          for (let k = 0; k < 3; k++) dither(x, X + w - 14 + k * 3, b - h - 32 - k * 7, 6, 5, [230, 230, 236], k);
          for (let i = X + 6; i < X + w - 10; i += 16) { R(x, i - 1, b - h + 10, 10, 12, [60, 40, 30]); R(x, i, b - h + 11, 8, 10, [255, 214, 120]); R(x, i + 4, b - h + 11, 1, 10, [60, 40, 30]); }
          R(x, X + w / 2 - 5, b - 16, 10, 16, [80, 50, 30]);
        };
        let X = 20; while (X < W - 60) { const w = 50 + r() * 30; if (X > 560 && X < 720) { X = 720; continue; } house(X, w, 40 + r() * 20); X += w + 20 + r() * 40; }
        // campanario románico
        const cx = 600; R(x, cx, b - 130, 34, 130, [150, 136, 120]); for (let j = b - 120; j < b - 20; j += 28) for (const i of [cx + 5, cx + 19]) { R(x, i, j, 10, 16, [40, 30, 30]); R(x, i + 1, j - 3, 8, 3, [40, 30, 30]); }
        for (let j = 0; j < 20; j++) R(x, cx - 3 + j * 0.2, b - 150 + j, 40 - j * 0.4, 1, j < 4 ? [255, 255, 255] : [66, 72, 86]);
        // Caldea (aguja de cristal)
        const kx = 680; for (let j = 0; j < 190; j++) { const w = 4 + j * 0.34; for (let i = 0; i < w; i++) { const u = i / w; R(x, kx - w / 2 + i, b - 190 + j, 1, 1, mixc(u < 0.45 ? [220, 240, 255] : [120, 160, 200], [90, 130, 180], (j % 12 === 0) ? 0.6 : 0)); } }
      } else {
        const gy = 262;
        const L = pixLayer(); for (let y = gy - 6; y < H; y++) for (let X2 = 0; X2 < W; X2++) { let c2 = mixc([252, 253, 255], [206, 222, 244], (y - gy) / 60 + vnoise(X2, y, 4, 14) * 0.3); if (hash(X2, y, 9) < 0.02) c2 = [255, 255, 255]; L.set(X2, y, c2); } L.commit(x);
        for (let i = 0; i < 9; i++) pine(x, 50 + i * 145 + r() * 40, gy - 2, 80 + r() * 50, { col: '#1f5e44', snow: true });
        for (let i = 0; i < 3; i++) {
          const X2 = 190 + i * 420;
          const ball = (cx, cy, rr) => { for (let j = -rr; j <= rr; j++) for (let k = -rr; k <= rr; k++) if (j * j + k * k <= rr * rr) R(x, cx + k, cy + j, 1, 1, (k + j) < -rr * 0.4 ? [255, 255, 255] : (k + j) > rr * 0.5 ? [196, 214, 238] : [236, 244, 255]); };
          ball(X2, gy - 14, 16); ball(X2, gy - 40, 11); R(x, X2 - 9, gy - 44, 18, 5, [27, 20, 38]); R(x, X2 - 11, gy - 44, 22, 2, [27, 20, 38]); R(x, X2, gy - 37, 8, 3, [240, 130, 30]); R(x, X2 - 12, gy - 30, 24, 4, [220, 40, 40]); R(x, X2 - 8, gy - 58, 16, 8, [27, 20, 38]); R(x, X2 - 12, gy - 51, 24, 2, [27, 20, 38]);
        }
        sign(x, 700, gy - 60, 70, 14, [220, 40, 40], [255, 255, 255], 'PISTA'); R(x, 733, gy - 46, 3, 46, [90, 60, 40]);
        fence(x, gy - 14, [200, 60, 50], 30);
      }
    },
  };
  function makeLayers(painter, seed) {
    return [0, 1, 2].map(l => { const c = canvas(W, H), x = c.getContext('2d'); PAINTERS[painter](l, x, rng(seed + l * 101)); return c; });
  }
  return { pix, hq, flip, whiten, canvas, buildEnemies, buildItems, enemySprites, itemSprites, makeTiles, makeLayers, makeSky, PAL, TS, BGW: W, rng };
})();
