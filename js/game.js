// ============================================================
//  ¡SUELTA, MACHIN!  -  motor del juego
// ============================================================
(() => {
  'use strict';
  // Cambia aquí los nombres de los protagonistas si quieres
  const NAMES = { boy: 'JAVIER', girl: 'CARLA' };
  const CAT_NAME = 'MACHÍN', CAT = 'Machín';
  // Motes de Machín para los diálogos ({M} en los textos elige uno al azar)
  const NICKS = ['Machín', 'Machingán', 'Machín malo', 'Machanguito', 'Machuquito', 'Machín Huerta', 'Machinete', 'Don Machín', 'Machín el Malandrín'];
  let lastNick = '';
  function nick() { let n; do n = NICKS[Math.floor(Math.random() * NICKS.length)]; while (n === lastNick); return (lastNick = n); }

  const W = 640, H = 360, T = TILE;
  // El mundo se dibuja ampliado (personajes grandes, estilo recreativa); la cámara se mueve también en vertical
  const Z = 1.5, VW = W / Z, VH = H / Z, CAMY_MAX = H - VH, RES = window.SPRITE_RES || 1, BK = 0.6;
  const TIME_LIMIT = { facil: 350, normal: 280, dificil: 220 };
  let curZ = 1;
  const rz = v => Math.round(v * curZ) / curZ;
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const FONT = '"Press Start 2P", "Courier New", monospace';
  const IDLE = [0, 1, 2, 3], PUNCH = [4, 5, 6, 7], KICK = [8, 9, 10, 11], HURT = [12, 13, 14, 15], WALK = [16, 17, 18, 19, 20, 21, 22, 23];
  // sólo niños: salto (impulso, subida, cumbre, caída), lanzar, KO, victoria y enjaulad@
  const JUMP = [24, 25, 26, 27], THROW = [28, 29, 30, 31], KO = [32, 33, 34, 35], WIN = [36, 37, 38, 39], CAGED = [40, 41, 42, 43];
  const cagedFrame = (t = G.t) => CAGED[[0, 1, 0, 2, 3, 3][Math.floor(t / 45) % 6]];
  const winFrame = t => WIN[[0, 2, 3][Math.floor(t / 40) % 3]];

  // ---------------------------------------------------------- ENTRADA
  const Input = (() => {
    const KEYS = {
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      Space: 'jump', KeyZ: 'jump', KeyH: 'jump', KeyI: 'jump', KeyX: 'punch', KeyJ: 'punch', KeyC: 'kick', KeyK: 'kick', KeyV: 'throw', KeyL: 'throw',
      Enter: 'start', KeyP: 'start', Escape: 'back', KeyM: 'mute', KeyF: 'full', Backspace: 'back',
    };
    const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'punch', 'kick', 'throw', 'start', 'back', 'mute', 'full'];
    const kb = {}, cur = {}, prev = {}, virt = {};
    let padMsg = '', padMsgT = 0, usingPad = false;
    addEventListener('keydown', e => { const a = KEYS[e.code]; if (a) { kb[a] = true; e.preventDefault(); } usingPad = false; Sound.init(); });
    addEventListener('keyup', e => { const a = KEYS[e.code]; if (a) { kb[a] = false; e.preventDefault(); } });
    addEventListener('blur', () => { for (const k in kb) kb[k] = false; });
    let clicks = 0;
    addEventListener('pointerdown', () => { Sound.init(); clicks++; try { document.getElementById('game').focus(); } catch (e) {} });
    addEventListener('gamepadconnected', () => { padMsg = 'MANDO CONECTADO'; padMsgT = 180; });
    addEventListener('gamepaddisconnected', () => { padMsg = 'MANDO DESCONECTADO'; padMsgT = 180; });
    function poll() {
      for (const a of ACTIONS) { prev[a] = cur[a]; cur[a] = !!kb[a] || !!virt[a]; }
      cur.click = clicks > 0; clicks = 0;
      let pads = [];
      try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { pads = []; }
      for (const p of pads) {
        if (!p || !p.connected) continue;
        const b = i => p.buttons[i] && p.buttons[i].pressed, ax = p.axes || [];
        const any = p.buttons.some(x => x.pressed) || Math.abs(ax[0] || 0) > 0.5 || Math.abs(ax[1] || 0) > 0.5;
        if (any) { usingPad = true; Sound.init(); }
        if (b(14) || ax[0] < -0.4) cur.left = true;
        if (b(15) || ax[0] > 0.4) cur.right = true;
        if (b(12) || ax[1] < -0.6) cur.up = true;
        if (b(13) || ax[1] > 0.6) cur.down = true;
        if (b(0)) cur.jump = true;
        if (b(2) || b(4)) cur.punch = true;
        if (b(1)) cur.kick = true;
        if (b(3) || b(5) || b(7) || b(6)) cur.throw = true;
        if (b(9)) cur.start = true;
        if (b(8)) cur.back = true;
      }
      if (padMsgT > 0) padMsgT--;
    }
    const held = a => !!cur[a], pressed = a => !!cur[a] && !prev[a];
    return {
      poll, held, pressed, get padMsg() { return padMsgT > 0 ? padMsg : ''; }, get pad() { return usingPad; },
      confirm: () => pressed('jump') || pressed('punch') || pressed('start') || !!cur.click,
      backP: () => pressed('kick') || pressed('back'),
      clear() { for (const a of ACTIONS) prev[a] = cur[a] = true; }, virt,
    };
  })();

  // ---------------------------------------------------------- SPRITES
  const atlas = { normal: null, white: null, fire: null, rainbow: [], ghost: null };
  const elementSprites = {};
  function buildElementSprites(img) {
    for (const [name, list] of Object.entries(window.ELEMENT_FRAMES || {})) {
      elementSprites[name] = list.map(f => {
        const c = Art.canvas(f[2], f[3]), x = c.getContext('2d');
        x.drawImage(img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]);
        return c;
      });
    }
  }
  const elem = (name, frame = 0) => {
    const a = elementSprites[name];
    return a && a.length ? a[((frame % a.length) + a.length) % a.length] : null;
  };
  function buildAtlas(img) {
    const make = fn => {
      const c = Art.canvas(img.width, img.height), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      if (fn) {
        const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
        for (let i = 0; i < a.length; i += 4) if (a[i + 3]) { const o = fn(a[i], a[i + 1], a[i + 2]); a[i] = o[0]; a[i + 1] = o[1]; a[i + 2] = o[2]; }
        x.putImageData(d, 0, 0);
      }
      return c;
    };
    atlas.normal = make(null);
    atlas.white = make(() => [255, 255, 255]);
    atlas.red = make((r, g, b) => [Math.min(255, r * 0.6 + 120), g * 0.55, b * 0.5]);
    atlas.fire = make((r, g, b) => { const l = (r + g + b) / 3; return [Math.min(255, r * 0.7 + l * 0.5 + 50), Math.min(255, g * 0.5 + l * 0.25), b * 0.3]; });
    for (let k = 0; k < 6; k++) {
      const a = k * 60 * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      const m = [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072];
      atlas.rainbow.push(make((r, g, b) => [
        Math.min(255, (m[0] * r + m[1] * g + m[2] * b) * 1.15 + 20), Math.min(255, (m[3] * r + m[4] * g + m[5] * b) * 1.15 + 20), Math.min(255, (m[6] * r + m[7] * g + m[8] * b) * 1.15 + 20)]));
    }
  }
  function drawChar(who, idx, cx, feetY, face, scale = 1, variant = null) {
    const f = SPRITE_FRAMES[who][idx], k = scale / RES;
    const src = variant === 'white' ? atlas.white : variant === 'fire' ? atlas.fire : typeof variant === 'number' ? atlas.rainbow[variant % 6] : atlas.normal;
    const w = f[2] * k, h = f[3] * k, ox = f[4] * k;
    const x = face > 0 ? rz(cx + ox) : rz(cx - ox - w), y = rz(feetY - h);
    const eff = k * curZ;
    ctx.imageSmoothingEnabled = eff < 0.97;
    if (face > 0) ctx.drawImage(src, f[0], f[1], f[2], f[3], x, y, w, h);
    else { ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(src, f[0], f[1], f[2], f[3], 0, 0, w, h); ctx.restore(); }
    ctx.imageSmoothingEnabled = false;
    return { x, y, w, h };
  }

  // ---------------------------------------------------------- TEXTO
  function txt(s, x, y, o = {}) {
    const size = o.size || 8, col = o.col || '#ffffff', sh = o.sh === undefined ? '#1b1426' : o.sh;
    ctx.font = size + 'px ' + FONT; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'top';
    x = Math.round(x); y = Math.round(y);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (sh) { const d = Math.max(1, Math.round(size / 8)); ctx.fillStyle = sh; for (const [a, b] of [[-d, 0], [d, 0], [0, -d], [0, d], [d, d], [d * 2, d * 2]]) ctx.fillText(s, x + a, y + b); }
    ctx.fillStyle = col; ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }
  function wrap(s, max) {
    const out = []; let line = '';
    for (const w of s.split(' ')) { if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    if (line) out.push(line); return out;
  }
  function star(x, y, col = '#ffe066') { x = Math.round(x); y = Math.round(y); ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 3, y - 1, 7, 3); ctx.fillRect(x - 1, y - 3, 3, 7); ctx.fillStyle = col; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
  function box(x, y, w, h, fill = '#1b1426', border = '#ffffff') {
    ctx.fillStyle = border; ctx.fillRect(x, y, w, h); ctx.fillStyle = fill; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#1b1426'; ctx.fillRect(x + 2, y + h, w, 2); ctx.fillRect(x + w, y + 2, 2, h);
  }
  // recuadro translúcido: desenfoca lo que ya hay pintado debajo y le pone un tinte encima
  const glassCv = document.createElement('canvas'), glassCtx = glassCv.getContext('2d');
  function glassBox(x, y, w, h, sel, o = {}) {
    if (glassCv.width !== cv.width || glassCv.height !== cv.height) { glassCv.width = cv.width; glassCv.height = cv.height; }
    glassCtx.clearRect(0, 0, glassCv.width, glassCv.height); glassCtx.drawImage(cv, 0, 0);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.filter = 'blur(3px)'; ctx.drawImage(glassCv, 0, 0, W, H); ctx.filter = 'none';
    ctx.fillStyle = o.fill || (sel ? 'rgba(58,42,90,0.62)' : 'rgba(20,14,32,0.7)'); ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = o.border || (sel ? '#ffe066' : '#6a6a8a'); ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }
  const fill = (s, name) => s.replace(/\{C\}/g, name).replace(/\{M\}/g, () => nick());

  // ---------------------------------------------------------- PRESENTADOR
  const presImg = new Image();
  // viñetas lógicas 0..15; la 2, 12 y 13 nombran al secuestrado (Carla por defecto, Javier en 16..18)
  function presCell(idx) { if (G.captive === 'boy') { if (idx === 2) return 16; if (idx === 12) return 17; if (idx === 13) return 18; } return idx; }
  function drawPresenter(idx, x, y, size, o = {}) {
    const C = PRESENTER_CELL, c = presCell(idx), sx = (c % 5) * C, sy = Math.floor(c / 5) * C;
    const pop = o.t === undefined ? 1 : Math.min(1, o.t / 8), alpha = o.alpha === undefined ? 1 : o.alpha;
    if (pop <= 0 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(x + size / 2, y + size / 2); ctx.scale(pop, pop); ctx.translate(-(x + size / 2), -(y + size / 2));
    box(x - 4, y - 4, size + 8, size + 22, '#2a3a78', '#ffe066');
    // fondo de plató
    for (let j = 0; j < size; j += 4) { ctx.fillStyle = j % 8 ? '#3a56b0' : '#34509f'; ctx.fillRect(x, y + j, size, 4); }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < size; i += 16) ctx.fillRect(x + i, y, 2, size);
    const crop = o.noCaption ? Math.round(C * 0.19) : 0;
    ctx.imageSmoothingEnabled = true;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    ctx.drawImage(presImg, sx, sy + crop, C, C - crop, x, y + (o.noCaption ? size * 0.06 : 0), size, size * (C - crop) / C);
    ctx.restore(); ctx.imageSmoothingEnabled = false;
    if (o.caption) { const lines = wrap(o.caption, Math.floor(size / 8)); lines.forEach((l, i) => txt(l, x + size / 2, y + 4 + i * 10, { align: 'center', col: '#ffffff' })); }
    ctx.fillStyle = '#1b1426'; ctx.fillRect(x, y + size, size, 14);
    txt('PAPÁ', x + size / 2, y + size + 3, { align: 'center', col: '#ffe066' });
    if (size >= 150 && G.t % 60 < 40) { ctx.fillStyle = '#ff3030'; ctx.fillRect(x + 6, y + size - 13, 6, 6); txt('EN DIRECTO', x + 16, y + size - 14, { col: '#ffffff' }); }
    ctx.restore();
  }
  // aparición del presentador en una esquina durante la partida
  function presenterPop(idx, dur = 170) { if (!L) return; L.pres = { idx, t: 0, dur }; Sound.sfx.select(); }

  // ---------------------------------------------------------- ESTADO
  const G = {
    state: 'loading', t: 0, diff: 'normal', hero: 'boy', lives: 5, score: 0, pesetas: 0, levelIdx: 0, menu: 0, hi: 0,
    get captive() { return this.hero === 'boy' ? 'girl' : 'boy'; },
    get C() { return NAMES[this.captive]; },
    get rescued() { return this.captive === 'girl' ? 'rescatada' : 'rescatado'; },
  };
  try { G.hi = +localStorage.getItem('suelta-gato-hi') || 0; } catch (e) {}
  let L = null, P = null, D = DIFFICULTY.normal, uid = 0, S = null;
  const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---------------------------------------------------------- MUNDO
  function tileAt(c, r) {
    if (r < 0 || r >= ROWS) return EMPTY;
    if (c < 0 || c >= L.cols) return BLOCK;
    if (L.arenaLocked && (c === L.arenaStart || c === L.arenaStart + 18)) return BLOCK;
    if (L.miniFight === 'on' && (c === L.miniCol || c === L.miniCol + MINI_W - 1)) return BLOCK;
    return L.tiles[r][c];
  }
  const solidAt = (c, r) => isSolidTile(tileAt(c, r));
  function physX(e) {
    e.hitWall = 0; e.x += e.vx;
    const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 1) / T);
    if (e.vx > 0) { const c = Math.floor((e.x + e.w - 1) / T); for (let r = top; r <= bot; r++) if (solidAt(c, r)) { e.x = c * T - e.w; e.vx = 0; e.hitWall = 1; break; } }
    else if (e.vx < 0) { const c = Math.floor(e.x / T); for (let r = top; r <= bot; r++) if (solidAt(c, r)) { e.x = (c + 1) * T; e.vx = 0; e.hitWall = -1; break; } }
  }
  function physY(e) {
    const prevBottom = e.y + e.h; e.y += e.vy; e.onGround = false; e.bonk = null;
    const l = Math.floor(e.x / T), rr = Math.floor((e.x + e.w - 1) / T);
    if (e.vy >= 0) {
      const r = Math.floor((e.y + e.h) / T);
      for (let c = l; c <= rr; c++) {
        const t = tileAt(c, r);
        if (isSolidTile(t) || (t === PLAT && prevBottom <= r * T + 1)) { e.y = r * T - e.h; e.vy = 0; e.onGround = true; break; }
      }
    } else {
      const r = Math.floor(e.y / T); let best = null;
      for (let c = l; c <= rr; c++) if (solidAt(c, r)) { const d = Math.abs((c + 0.5) * T - (e.x + e.w / 2)); if (!best || d < best.d) best = { c, r, d }; }
      if (best) { e.y = (r + 1) * T; e.vy = 0.5; e.bonk = best; }
    }
  }

  // Fondos dibujados (carpeta fondos/): si existe la imagen del nivel, sustituye al fondo generado
  const photos = {}, PHOTO_H = 420; let LAIR = null;
  const photosReady = Promise.all(Object.entries(window.FONDOS || {}).map(([k, src]) => new Promise(r => { const im = new Image(); im.onload = () => { photos[k] = im; r(); }; im.onerror = r; im.src = src; })));
  function scaledPhoto(im) {
    const w = Math.round(im.width * PHOTO_H / im.height), c = Art.canvas(w, PHOTO_H), x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(im, 0, 0, w, PHOTO_H);
    return c;
  }
  // La guarida es un panorama ancho: se encaja entero en la pantalla
  // y solo sobran unos píxeles para un balanceo leve al cruzar la arena.
  function scaledLair(im) {
    const slack = 18, c = Art.canvas(W + slack, H), g = c.getContext('2d');
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0, W + slack, H);
    return c;
  }
  const levelAssets = {};
  // Sustituye suelo (0), relleno (1), plataforma (8) y bloque (9) del tileset generado por los dibujados.
  function withTileSprites(tileset, idx) {
    const a = elementSprites['tiles_' + idx]; if (!a || a.length < 4) return tileset;
    const x = tileset.getContext('2d'), TS = Art.TS;
    [[0, 0], [1, 1], [8, 2], [9, 3]].forEach(([slot, k]) => { x.clearRect(slot * TS, 0, TS, TS); x.drawImage(a[k], slot * TS, 0); });
    return tileset;
  }
  function assetsFor(idx) {
    if (!levelAssets[idx]) {
      const loc = LOCATIONS[idx], ph = photos[loc.painter];
      levelAssets[idx] = { tileset: withTileSprites(Art.makeTiles(loc.tiles), idx), photo: ph ? scaledPhoto(ph) : null, layers: ph ? null : Art.makeLayers(loc.painter, idx * 1000 + 7), sky: Art.makeSky(loc.sky) };
    }
    return levelAssets[idx];
  }
  // dibuja la imagen de fondo con un desplazamiento lento (fx, fy entre 0 y 1)
  function drawPhoto(ph, fx, fy) {
    const maxX = Math.max(0, ph.width - W), maxY = Math.max(0, ph.height - H);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ph, -Math.round(maxX * Math.max(0, Math.min(1, fx))), -Math.round(maxY * Math.max(0, Math.min(1, fy))));
  }

  function newPlayer() {
    return { x: 2 * T, y: 0, w: 20, h: 52, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0, act: null, actT: 0, hitSet: null,
      hurtT: 0, inv: 0, hearts: D.hearts, power: 'none', starT: 0, weapon: null, ammo: 0, dead: false, deadT: 0, anim: 0, combo: 0, idleT: 0, auto: null,
      shield: 0, cocido: false, airJumped: false, fastT: 0 };
  }
  // Agacharse: la caja de colisión se encoge desde arriba (los pies no se mueven)
  function canStand() {
    const top = P.y + P.h - P.fullH, l = Math.floor(P.x / T), r = Math.floor((P.x + P.w - 1) / T);
    for (let row = Math.floor(top / T); row <= Math.floor((P.y - 1) / T); row++) for (let c = l; c <= r; c++) if (solidAt(c, row)) return false;
    return true;
  }
  function setCrouch(on, force = false) {
    if (!!P.crouch === on) return true;
    if (on) { P.fullH = P.h; const ch = Math.round(P.h * 0.55); P.y += P.h - ch; P.h = ch; P.crouch = true; return true; }
    if (!force && !canStand()) return false;
    P.y += P.h - P.fullH; P.h = P.fullH; P.crouch = false; return true;
  }
  function setPower(p) {
    setCrouch(false, true);
    const oldH = P.h; P.power = p;
    const big = p === 'big' || p === 'fire';
    P.w = big ? 24 : 20; P.h = big ? 64 : 52; P.y += oldH - P.h;
  }
  const pScale = () => (P.power === 'big' || P.power === 'fire') ? 1.25 : 1;
  function groundYAt(col) { for (let r = 2; r < ROWS; r++) if (isSolidTile(L.tiles[r][col])) return r * T; return 12 * T; }
  // Fila del suelo real de una columna. -1 si es un pozo (no hay donde apoyar un sprite).
  function surfaceRow(col) {
    if (!L || col < 0 || col >= L.cols) return -1;
    for (let r = 2; r < ROWS; r++) {
      const t = L.tiles[r][col];
      if (isSolidTile(t) || t === PLAT) return r;
    }
    return -1;
  }

  const PROP_SETS = [
    [['lp_sombrilla', 1], ['lp_toalla', 1], ['lp_parada', 1], ['lp_guaguero', 1]],
    [['ca_farola', 1], ['ca_chirigotero', 3], ['ca_bombo', 1]],
    [['so_bandera', 3], ['so_carrito', 2], ['so_seto', 1]],
    [['ma_oso', 1], ['ma_metro', 1], ['ma_banco', 1]],
    [['wa_cola', 1], ['wa_vagoneta', 3], ['wa_barrera', 1]],
    [['si_flotador', 3], ['si_tobogan', 1], ['si_agua', 3]],
    [['te_tajinaste', 3], ['te_roca', 1], ['te_senal', 1]],
    [['an_telesilla', 3], ['an_nieve', 3], ['an_monticulo', 3], ['an_senal', 1]],
  ];
  function makeLevelProps(idx) {
    const defs = PROP_SETS[idx] || [], out = [], end = Math.max(45, L.goalStart - 12);
    defs.forEach(([kind, count], i) => {
      const im = elem(kind); if (!im) return;
      const span = Math.max(1, Math.ceil((im.width / Z) / T));
      const prefer = 18 + Math.floor((end - 24) * (i + 1) / (defs.length + 1));
      let found = -1;
      for (let d = 0; d < end && found < 0; d++) {
        const c = prefer + (d % 2 === 0 ? d / 2 : -Math.ceil(d / 2));
        if (c < 14 || c + span >= end) continue;
        const row = surfaceRow(c);
        if (row < 0) continue;
        let flat = true;
        for (let k = 0; k < span; k++) if (surfaceRow(c + k) !== row) flat = false;
        if (flat) found = c;
      }
      if (found < 0) return;
      out.push({ kind, count, x: (found + span / 2) * T, y: surfaceRow(found) * T, phase: i * 17 });
    });
    return out;
  }

  function loadLevel(idx) {
    const loc = LOCATIONS[idx], isFinal = idx === LOCATIONS.length - 1;
    const data = Level.generate(idx, G.diff, (Math.random() * 1e9) | 0, isFinal);
    L = Object.assign(data, assetsFor(idx), { loc, enemies: [], items: [], projs: [], parts: [], fx: [], props: [], texts: [], bubbles: [], camX: 0, camY: CAMY_MAX, timeLeft: TIME_LIMIT[G.diff] * 60, shake: 0,
      time: 0, kills: 0, coinsGot: 0, checkpointHit: false, bumps: [], boss: null, arenaLocked: false, multi: {}, snow: [], cs: null, catTauntT: 0 });
    data.coins.forEach(k => L.items.push(makeItem('peseta', k.col * T + 4, k.row * T + 4, true)));
    data.spawns.forEach(s => L.enemies.push(makeEnemy(s.kind, s.col, s.row)));
    if (loc.snow) for (let i = 0; i < 110; i++) L.snow.push({ x: rand(0, W), y: rand(0, H), s: rand(0.4, 1.4), p: rand(0, 6) });
    P = newPlayer(); P.y = groundYAt(2) - P.h;
    L.props = makeLevelProps(idx);
    L.camX = 0; L.nick = nick();
    L.mini = makeMini(); L.miniFight = null; L.cameo = null; L.freezeT = 0;
    if (L.mini) L.enemies.push(L.mini);
    // Machín se deja ver dos veces antes de la arena del mini-jefe
    const end = L.mini ? L.miniCol : L.goalStart;
    L.cameoAt = [Math.round(end * 0.3), Math.round(end * 0.78)];
  }
  function respawn() {
    const keepHearts = D.hearts;
    P = newPlayer(); P.hearts = keepHearts; P.inv = 120;
    let x = L.checkpointHit ? L.checkpointX : 2 * T;
    if (L.boss) { x = (L.arenaStart + 3) * T; L.boss.hp = Math.min(L.boss.maxHp, L.boss.hp + Math.round(L.boss.maxHp * 0.25)); L.boss.x = (L.arenaStart + 14) * T; L.boss.state = 'idle'; L.boss.st = 60; L.boss.vx = 0; }
    if (L.miniFight === 'on') {
      // se reabren las rejas y el mini-jefe recupera un poco de vida
      const m = L.mini; L.miniFight = null;
      m.hp = Math.min(m.maxHp, m.hp + Math.round(m.maxHp * 0.25)); m.rage = m.hp <= m.maxHp / 2;
      m.x = m.homeX; m.vx = 0; m.state = 'patrol'; m.stun = 0; m.inv = 0; m.poundT = 160;
    }
    L.cameo = null; L.freezeT = 0;
    P.x = x; P.y = groundYAt(Math.floor(x / T)) - P.h;
    L.enemies.forEach(e => { if (!e.ty.fly && !e.mini && Math.abs(e.x - x) < 160) e.remove = true; });
    L.projs = [];
    L.camX = Math.max(0, Math.min(L.cols * T - VW, x - VW / 3)); L.camY = CAMY_MAX;
    L.timeLeft = Math.max(L.timeLeft, TIME_LIMIT[G.diff] * 60 * (L.boss ? 0.5 : 1));
  }

  // ---------------------------------------------------------- EFECTOS
  function parts(x, y, n, cols, o = {}) {
    for (let i = 0; i < n; i++) L.parts.push({ x, y, vx: rand(-(o.sp || 2), o.sp || 2), vy: rand(-(o.up || 3), (o.down || 0.5)), life: o.life || rand(20, 40), col: pick(cols), s: o.s || 2, g: o.g === undefined ? 0.15 : o.g });
  }
  const FX_SPEED = { impacto: 3, polvo: 3, hielo: 3, agua: 4, burbujas: 8, lava: 5, ko: 5, tinta: 4, caca: 5 };
  function addFx(kind, x, y, o = {}) {
    const a = elementSprites[kind]; if (!a || !a.length || !L) return;
    L.fx.push({ kind, x, y, t: 0, speed: o.speed || FX_SPEED[kind] || 4, life: o.life || a.length * (o.speed || FX_SPEED[kind] || 4), face: o.face || 1, scale: o.scale || 1, bottom: o.bottom !== false });
  }
  function drawFx(f) {
    const a = elementSprites[f.kind], im = a[Math.min(a.length - 1, Math.floor(f.t / f.speed))]; if (!im) return;
    const w = im.width / Z * f.scale, h = im.height / Z * f.scale;
    ctx.save(); ctx.translate(rz(f.x), rz(f.y)); if (f.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(im, -w / 2, f.bottom ? -h : -h / 2, w, h); ctx.restore();
  }
  // Tiempo de lectura pausado (unas 8 letras por segundo) para lectores que empiezan
  const readTime = str => 100 + str.length * 7;
  function popText(x, y, str, col = '#ffffff', size = 8) { L.texts.push({ x, y, str, t: 0, col, size, life: Math.max(100, 50 + str.length * 4) }); }
  // hold = el diálogo espera a que se pulse un botón (o a que pase mucho tiempo)
  function bubble(target, text, dur = 150, hold = false) {
    L.bubbles = L.bubbles.filter(b => b.target !== target);
    L.bubbles.push({ target, text, t: 0, dur: hold ? readTime(text) * 2 : Math.max(dur, readTime(text)), hold });
  }
  function dialogueWait() {
    const hb = L.bubbles.find(b => b.hold);
    if (!hb) return false;
    if (hb.t > 30 && Input.confirm()) { hb.t = hb.dur; Sound.sfx.select(); return false; }
    return true;
  }
  // cartel grande al coger un objeto
  function showBanner(icon, title, desc) { L.banner = { icon, title, desc, t: 0, dur: 160 + (title.length + desc.length) * 5 }; }
  const HITWORDS = ['¡ZAS!', '¡POW!', '¡PLAF!', '¡CATAPLÁN!', '¡TOMA!', '¡OLÉ!', '¡PUMBA!', '¡ZASCA!'];
  function addScore(n) { G.score += n; }

  // ---------------------------------------------------------- OBJETOS
  function makeItem(type, x, y, stat) {
    const spr = Art.itemSprites[type];
    return { type, x, y, w: spr.width / Z, h: spr.height / Z, vx: 0, vy: 0, state: stat ? 'static' : 'sprout', t: 0, spr, id: ++uid };
  }
  const ITEM_INFO = {
    bocadillo: ['¡BOCATA DE CALAMARES!', 'Te pones grande: aguantas un golpe más y rompes ladrillos con la cabeza.'],
    mojo: ['¡MOJO PICÓN! ¡QUÉ PICANTE!', 'Pulsa {K} para escupir bolas de fuego de mojo.'],
    turron: ['¡SUBIDÓN DE TURRÓN!', 'Eres invencible un ratito. ¡Choca con los bichos y saldrán volando!'],
    tortilla: ['¡TORTILLA DE PATATAS!', 'Recuperas un corazón. (Con cebolla, que está más buena).'],
    churro: ['¡CHURRO DE COMBATE!', 'Tu puñetazo llega más lejos y pega el doble de fuerte.'],
    chancla: ['¡LA CHANCLA DE LA ABUELA!', 'Pulsa {K} para lanzar chanclas. Cada una que cojas trae 10.'],
    gazpacho: ['¡GAZPACHO FRESQUITO!', 'Los bichos se quedan congelados unos segundos. ¡Y el reloj también!'],
    paella: ['¡PAELLA DE LA ABUELA!', 'Tres paelleras te dan vueltas y te hacen de escudo: aguantan 3 golpes.'],
    cocido: ['¡COCIDO MADRILEÑO!', 'Con tanta energía puedes saltar otra vez en el aire. ¡Doble salto!'],
    cafe: ['¡CAFÉ CON LECHE!', 'Corres mucho más rápido durante 20 segundos.'],
  };
  const FREEZE_T = 360, CAFE_T = 1200;
  function collectItem(it) {
    it.remove = true;
    const cx = it.x + it.w / 2, cy = it.y;
    switch (it.type) {
      case 'peseta':
        G.pesetas++; L.coinsGot++; addScore(10); Sound.sfx.coin(); parts(cx, cy + 6, 4, ['#ffd23f', '#ffffff'], { sp: 1, up: 2, life: 15 });
        if (G.pesetas % 100 === 67) { popText(cx, cy - 26, '¡SIX SEVEN!', '#8affff', 16); Sound.sfx.checkpoint(); }
        if (G.pesetas % 50 === 0) { if (P.hearts < D.hearts + 1) P.hearts++; showBanner('corazon', '¡50 PESETAS!', 'Con 50 pesetas te regalan un corazón. ¡Sigue cogiendo monedas!'); Sound.sfx.heal(); }
        return;
      case 'bocadillo': if (P.power === 'none') setPower('big'); addScore(1000); Sound.sfx.power(); break;
      case 'mojo': if (P.power !== 'fire') setPower('fire'); addScore(1000); Sound.sfx.power(); break;
      case 'turron': P.starT = 600; addScore(1000); Sound.sfx.power(); Sound.play('star'); break;
      case 'tortilla': P.hearts = Math.min(D.hearts + 1, P.hearts + 1); addScore(500); Sound.sfx.heal(); break;
      case 'churro': P.weapon = 'churro'; addScore(500); Sound.sfx.weapon(); break;
      case 'chancla': P.ammo = Math.min(20, (P.weapon === 'chancla' ? P.ammo : 0) + (it.ammo || 10)); P.weapon = 'chancla'; addScore(500); Sound.sfx.weapon(); break;
      case 'gazpacho':
        L.freezeT = FREEZE_T; addScore(1000); Sound.sfx.power(); L.shake = 6;
        parts(cx, cy, 24, ['#ffffff', '#9fe8f5', '#4fb4d8'], { sp: 5, up: 4 });
        if (L.miniFight === 'on' || L.boss) popText(cx, cy - 40, '¡A LOS JEFES EL FRÍO NI LES VA NI LES VIENE!', '#9fe8f5');
        break;
      case 'paella': P.shield = 3; addScore(1000); Sound.sfx.power(); break;
      case 'cocido': P.cocido = true; addScore(1000); Sound.sfx.power(); break;
      case 'cafe': P.fastT = CAFE_T; addScore(1000); Sound.sfx.power(); break;
    }
    const info = ITEM_INFO[it.type]; if (info) showBanner(it.type, info[0], info[1].replace('{K}', Input.pad ? 'Y (mando)' : 'V o L'));
    parts(cx, cy, 16, ['#ffe066', '#ffffff', '#ff8ab0'], { sp: 3, up: 4 });
  }
  function updateItem(it) {
    it.t++;
    if (it.state === 'static') { if (overlap(it, P) && !P.dead) collectItem(it); return; }
    if (it.state === 'sprout') { it.y -= 1; if (it.t >= it.h + 2) { it.state = 'live'; it.t = 0; if (it.type === 'bocadillo' || it.type === 'tortilla') it.vx = 1.2; if (it.type === 'turron') it.vx = 1.8; if (it.type === 'cafe') it.vx = 1.6; } return; }
    if (it.state === 'coinpop') { it.y += it.vy; it.vy += 0.5; if (it.t > 22) { it.remove = true; popText(it.x, it.y, '+10', '#ffe066'); } return; }
    if (it.vx) {
      it.vy = Math.min(it.vy + 0.4, 7); physX(it); if (it.hitWall) it.vx = -it.hitWall * Math.abs(it.vx || 1.2);
      if (!it.vx) it.vx = 1.2;
      physY(it);
      if (it.type === 'turron' && it.onGround) it.vy = -6;
      if (it.y > H + 30) it.remove = true;
    }
    if (overlap(it, P) && !P.dead) collectItem(it);
  }

  function bumpBlock(c, r) {
    const t = L.tiles[r][c], k = c + ',' + r;
    L.enemies.forEach(e => { if (!e.dead && e.onGround && Math.abs(e.y + e.h - r * T) < 3 && e.x + e.w > c * T && e.x < (c + 1) * T) killEnemy(e, 'bump'); });
    L.items.forEach(it => { if (it.state === 'static' && it.x + it.w > c * T && it.x < (c + 1) * T && it.y + it.h > r * T - T && it.y < r * T) collectItem(it); });
    if (t === QBLOCK) {
      const ct = L.contents[k] || 'peseta';
      L.bumps.push({ c, r, t: 10 });
      if (ct === 'peseta' || ct === 'multi') {
        const it = makeItem('peseta', c * T + 4, r * T - 20); it.state = 'coinpop'; it.vy = -7; L.items.push(it);
        G.pesetas++; L.coinsGot++; addScore(10); Sound.sfx.coin();
        L.multi[k] = (L.multi[k] || 0) + 1;
        if (ct === 'peseta' || L.multi[k] >= 7) L.tiles[r][c] = USED;
      } else {
        const it = makeItem(ct, 0, 0); it.x = c * T + T / 2 - it.w / 2; it.y = r * T; it.clipY = r * T; L.items.push(it); Sound.sfx.sprout(); L.tiles[r][c] = USED;
      }
    } else if (t === BRICK) {
      if (P.power !== 'none') {
        L.tiles[r][c] = EMPTY; Sound.sfx.brick(); addScore(50);
        for (let i = 0; i < 4; i++) L.parts.push({ x: c * T + 6 + (i % 2) * 12, y: r * T + 6 + (i >> 1) * 12, vx: (i % 2 ? 1.5 : -1.5), vy: -6 + (i >> 1) * 2, life: 60, col: L.loc.tiles.brick, s: 8, g: 0.35 });
      } else { L.bumps.push({ c, r, t: 10 }); Sound.sfx.bump(); }
    } else Sound.sfx.bump();
  }

  // ---------------------------------------------------------- ENEMIGOS
  const ENEMY_SCALE = { oso: 1.5, jabali: 1.3, cabra: 1.3, pulpo: 1.2, tortuga: 1.2, pato: 1.1, rata: 0.9, lagarto: 1.1, mapache: 1.1 };
  const HD = window.ENEMY_ANIMS || {};
  function makeEnemy(kind, col, row, big = 1) {
    const ty = ENEMY_TYPES[kind], spr = Art.enemySprites[kind], sc = (ENEMY_SCALE[kind] || 1) * big, hd = HD[kind];
    let sw = spr.L[0].width / Z * sc, sh = spr.L[0].height / Z * sc, w = sw - 6 * sc, h = sh - 4 * sc;
    if (hd) { const f = SPRITE_FRAMES['en_' + kind][(ty.fly ? hd.fly || hd.idle : hd.idle)[0]]; sw = f[2] / RES * big; sh = f[3] / RES * big; w = sw * 0.62; h = sh * 0.82; }
    const e = { kind, ty, spr, hd, sw, sh, w, h, big, hp: ty.hp + (G.diff === 'dificil' && ty.hp > 1 ? 1 : 0), dir: -1, face: -1, vx: 0, vy: 0,
      t: Math.floor(Math.random() * 100), state: 'patrol', st: 0, flash: 0, active: false, dead: false, id: ++uid, cool: 60, drops: 0 };
    e.x = col * T + T / 2 - e.w / 2;
    if (ty.fly) { e.y = row * T; e.baseY = e.y; } else e.y = row * T - e.h;
    e.homeX = e.x;
    if (ty.beh === 'popper') { e.hide = 1; e.state = 'hidden'; e.st = 30; e.groundY = row * T; }
    e.maxHp = e.hp;
    return e;
  }
  function killEnemy(e, how) {
    if (e.dead) return;
    e.dead = true; e.deadT = 0; L.kills++;
    if (e.loot) { const it = makeItem(e.loot.weapon, e.x, e.y - 10); it.state = 'live'; it.ammo = e.loot.ammo; L.items.push(it); popText(e.x + e.w / 2, e.y - 24, '¡RECUPERADO!', '#8aff8a'); }
    if (e.mini) { miniDefeated(e); return; }
    const pts = e.ty.pts * (how === 'stomp' ? Math.min(8, 1 << P.combo) : 1);
    addScore(pts);
    const cx = e.x + e.w / 2, cy = e.y;
    if (how === 'stomp') { e.squash = true; popText(cx, cy - 10, '¡CHOF! ' + pts, '#ffffff'); }
    else { e.vy = -6; e.vx = (cx < P.x + P.w / 2 ? -2 : 2); e.rot = 0; e.spin = e.vx > 0 ? 0.25 : -0.25; popText(cx, cy - 12, pick(HITWORDS) + ' ' + pts, '#ffe066'); }
    addFx(how === 'stomp' ? 'impacto' : 'ko', cx, cy + e.h * 0.7, { scale: how === 'stomp' ? 0.72 : 0.82 });
    parts(cx, cy + e.h / 2, 10, ['#ffffff', '#ffe066', '#ff8a3a'], { sp: 3, up: 3 });
  }
  function damageEnemy(e, dmg, fromX, how) {
    if (e.dead || (e.ty.beh === 'popper' && e.hide > 0.5)) return false;
    if (e.mini) return hitMini(e, dmg, fromX, how);
    e.hp -= dmg; e.flash = 8; L.shake = Math.max(L.shake, 3);
    Sound.sfx.hit();
    addFx('impacto', e.x + e.w / 2, e.y + e.h / 2, { bottom: false, scale: 0.55, face: fromX < e.x ? 1 : -1 });
    parts(e.x + e.w / 2, e.y + e.h / 2, 6, ['#ffffff', '#ffe066'], { sp: 3, up: 2 });
    if (e.hp <= 0) killEnemy(e, how);
    else { e.stun = 20; if (!e.ty.fly) { e.vx = Math.sign(e.x + e.w / 2 - fromX) * 3; e.vy = -3; } popText(e.x + e.w / 2, e.y - 8, pick(['¡AUCH!', '¡AY!', '¡OUCH!']), '#ffffff'); if (e.kind === 'pato') e.angry = true; }
    return true;
  }
  function grav(e) { e.vy = Math.min(e.vy + 0.45, 8); physX(e); physY(e); }

  // ---------------------------------------------------------- MINI-JEFES
  // El bicho más fuerte del nivel, gigante. Espera en su arena; al entrar se cierran las rejas.
  function makeMini() {
    const M = MINI_BOSSES[L.locIdx]; if (!M || L.miniCol === null || L.miniCol === undefined) return null;
    const col = L.miniCol + MINI_W - 5, e = makeEnemy(M.kind, col, surfaceRow(col), M.scale);
    e.mini = M; e.hp = e.maxHp = Math.round(M.hp * { facil: 0.7, normal: 1, dificil: 1.3 }[G.diff]);
    e.inv = 0; e.poundT = 160; e.homeX = e.x;
    e.anchor = () => ({ x: e.x + e.w / 2, y: e.y - 14 });
    return e;
  }
  function startMiniFight() {
    const e = L.mini;
    L.miniFight = 'on'; L.gateMT = 0; L.shake = 12;
    Sound.stop(); Sound.sfx.thud(); Sound.sfx.hiss(); Sound.play('boss');
    L.timeLeft += 30 * 60;
    bubble(e, e.mini.intro, 150);
    L.miniHintT = 160; // el consejo sale cuando termina de hablar
  }
  function hitMini(e, dmg, fromX, how) {
    if (e.inv > 0 || L.miniFight !== 'on') return false;
    e.hp -= dmg; e.flash = 10; e.inv = 22; L.shake = Math.max(L.shake, 6);
    Sound.sfx.hit();
    addFx('impacto', e.x + e.w / 2, e.y + e.h / 2, { bottom: false, scale: 0.9, face: fromX < e.x ? 1 : -1 });
    parts(e.x + e.w / 2, e.y + e.h / 2, 12, ['#ffffff', '#ffe066', '#ff8a3a'], { sp: 4, up: 3 });
    popText(e.x + e.w / 2, e.y - 10, pick(HITWORDS), '#ffe066', 16);
    if (e.hp <= 0) { killEnemy(e, how); return true; }
    if (!e.rage && e.hp <= e.maxHp / 2) { e.rage = true; bubble(e, pick(['¡AHORA SÍ QUE ME HE ENFADADO!', '¡Se acabó el recreo!', '¡Machín me va a pagar el doble!']), 110); Sound.sfx.hiss(); }
    if (e.state !== 'pound' && !e.shell) { e.stun = 10; if (!e.ty.fly) { e.vx = Math.sign(e.x + e.w / 2 - fromX) * 1.5; e.vy = -2; } }
    return true;
  }
  function miniDefeated(e) {
    L.miniFight = 'done'; L.kills++;
    addScore(5000); popText(e.x + e.w / 2, e.y - 30, '¡K.O.! 5000', '#ffe066', 16);
    e.vy = -8; e.vx = e.x + e.w / 2 < P.x + P.w / 2 ? -2 : 2; e.rot = 0; e.spin = e.vx > 0 ? 0.15 : -0.15;
    L.shake = 18; Sound.stop(); Sound.sfx.clear();
    addFx('ko', e.x + e.w / 2, e.y + e.h * 0.7, { scale: 1.4 });
    parts(e.x + e.w / 2, e.y + e.h / 2, 30, ['#ffffff', '#ffe066', '#ff8a3a', '#ff8ab0'], { sp: 5, up: 5 });
    L.projs = L.projs.filter(p => p.owner === 'p');
    // el bocadillo se queda donde cayó derrotado (el jefe sale volando y se hunde fuera de pantalla)
    const ko = { x: e.x + e.w / 2, y: Math.max(40, e.y - 14) };
    bubble({ anchor: () => ko }, e.mini.lose, 150);
    // premio: una tortilla y lluvia de pesetas
    const it = makeItem('tortilla', e.x + e.w / 2 - 8, e.y); it.state = 'live'; it.vx = 1.2; it.vy = -5; L.items.push(it);
    for (let i = 0; i < 8; i++) { const c = makeItem('peseta', e.x + e.w / 2 - 6 + (i - 3.5) * 14, e.y - 10 - (i % 2) * 14, true); L.items.push(c); }
    L.miniMusicT = 110; // la música del nivel vuelve tras la fanfarria
    bubble(P, fill(pick(['¡Toma ya! ¡A por ti, {M}!', '¡Literalmente K.O., bro!', '¡Six seven! ¡Siguiente!', '¡Aguanta, {C}, que voy!']), G.C), 120);
  }
  // Truco común de los mini-jefes: salto aplastante que manda dos ondas por el suelo
  function updateMini(e, dx) {
    if (e.inv > 0) e.inv--;
    if (L.miniFight !== 'on') { e.vx = 0; e.face = dx < 0 ? -1 : 1; grav(e); return true; }
    // el mapache gigante no huye para siempre: se guarda lo robado y vuelve a la carga
    if (e.state === 'flee' && ++e.fleeT > 200) { e.state = 'patrol'; e.fleeT = 0; }
    if (e.state === 'pound') {
      e.st++;
      if (e.st === 1) { e.vy = -10.5; e.vx = Math.max(-3.5, Math.min(3.5, dx / 40)); Sound.sfx.boing(); }
      e.vy = Math.min(e.vy + 0.45, 9); physX(e); physY(e);
      if (e.st > 4 && e.onGround) {
        e.state = 'patrol'; e.vx = 0; e.poundT = (e.rage ? 150 : 240) / D.speed; e.land = 8;
        L.shake = 14; Sound.sfx.thud();
        addFx('polvo', e.x + e.w / 2, e.y + e.h, { scale: 1.3 });
        const sp = (e.rage ? 3.8 : 3) * D.speed;
        [-1, 1].forEach(d => L.projs.push({ kind: 'onda', owner: 'e', x: e.x + e.w / 2 + d * (e.w / 2) - 8, y: e.y + e.h - 22, w: 16, h: 22, vx: d * sp, t: 0, life: 90 }));
      }
      return true;
    }
    if (e.state === 'patrol' && e.onGround && !e.stun && --e.poundT <= 0) { e.state = 'pound'; e.st = 0; popText(e.x + e.w / 2, e.y - 14, '¡PATAPLUM!', '#ff6a6a'); return true; }
    return false;
  }
  // Cada bicho tiene su truco
  function special(e, dx, dy) {
    const ad = Math.abs(dx), same = Math.abs(dy) < 44, face = dx < 0 ? -1 : 1, cx = e.x + e.w / 2;
    if (e.land > 0) e.land--;
    switch (e.kind) {
      case 'cangrejo':
        if (e.state === 'patrol' && e.onGround && ad < 95 && same && e.cool <= 0 && !P.dead) { e.state = 'snap'; e.st = 44; popText(cx, e.y - 8, '¡CLAC, CLAC!', '#ff8a8a'); Sound.sfx.bump(); }
        if (e.state === 'snap') { e.face = face; e.angry = e.st > 14; e.vx = e.st < 14 ? face * 3.4 : 0; if (--e.st <= 0) { e.state = 'patrol'; e.cool = 110; e.dir = face; e.angry = false; } grav(e); return true; }
        return false;
      case 'oso':
        if (e.roarT > 0) e.roarT--;
        if (!e.roared && ad < 250 && same) { e.roared = true; e.roarT = 50; popText(cx, e.y - 14, '¡GRRROAAAR!', '#ff6a6a', 16); Sound.sfx.hiss(); L.shake = 8; }
        if (e.state === 'patrol' && ad < 72 && same && e.cool <= 0 && !P.dead) { e.state = 'swipe'; e.st = 46; }
        if (e.state === 'swipe') {
          e.face = face; e.vx = 0; e.angry = e.st > 16;
          if (e.st === 16) { Sound.sfx.punch(); const hb = { x: face > 0 ? e.x + e.w : e.x - 42, y: e.y + 6, w: 42, h: e.h - 6 }; if (overlap(hb, P)) hurtPlayer(e); }
          if (--e.st <= 0) { e.state = 'patrol'; e.cool = 80; e.angry = false; e.dir = face; }
          grav(e); return true;
        }
        return false;
      case 'rana':
        if (e.onGround && e.state !== 'tongue' && ad < 115 && same && e.cool <= 0 && !P.dead) { e.state = 'tongue'; e.st = 44; e.face = face; Sound.sfx.boing(); }
        if (e.state === 'tongue') {
          e.vx = 0; e.tongue = e.st > 30 ? 0 : e.st > 15 ? (30 - e.st) / 15 : e.st / 15;
          const len = e.tongue * 95;
          if (len > 12) { const hb = { x: e.face > 0 ? e.x + e.w : e.x - len, y: e.y + e.h * 0.35, w: len, h: 7 }; if (overlap(hb, P)) hurtPlayer(e); }
          if (--e.st <= 0) { e.state = 'patrol'; e.cool = 110; e.tongue = 0; }
          grav(e); return true;
        }
        return false;
      case 'pulpo':
        if (e.onGround && ad < 330 && ad > 40 && e.cool <= 0 && e.state !== 'ink' && !P.dead) { e.state = 'ink'; e.st = 34; e.face = face; }
        if (e.state === 'ink') {
          e.vx = 0; e.angry = true;
          if (e.st === 12) { L.projs.push({ kind: 'tinta', owner: 'e', x: cx - 6, y: e.y + 4, w: 12, h: 12, vx: dx / 55, vy: -6.5, g: 0.23, t: 0 }); Sound.sfx.splat(); popText(cx, e.y - 10, '¡PFFF!', '#8a8aa8'); }
          if (--e.st <= 0) { e.state = 'patrol'; e.cool = 220; e.angry = false; }
          grav(e); return true;
        }
        return false;
      case 'topo':
        if (e.state === 'up' && e.st === 45 && ad < 380 && !P.dead) { L.projs.push({ kind: 'golf', owner: 'e', x: cx - 4, y: e.y, w: 8, h: 8, vx: dx / 60, vy: -7.5, g: 0.25, t: 0 }); Sound.sfx.throw(); popText(cx, e.y - 10, '¡FORE!', '#ffffff'); }
        return false;
      case 'medusa':
        e.glow = (e.t % 200) > 140;
        if (e.t % 200 === 141) Sound.sfx.fire();
        if (e.glow && !P.dead && Math.hypot(dx, dy) < 46) hurtPlayer(e);
        return false;
      case 'mapache':
        if (e.state === 'flee') {
          e.vx = e.dir * 3.3; grav(e); if (e.hitWall) e.dir = -e.dir; e.face = e.dir;
          if (e.onGround && edgeAhead(e)) e.vy = -7;
          if (e.t % 50 === 0) popText(cx, e.y - 10, pick(['¡JI, JI, JI!', '¡ES MÍO!']), '#ffffff');
          return true;
        }
        return false;
      case 'rata':
        if (e.onGround && e.state === 'patrol' && edgeAhead(e)) { e.vy = -7; e.vx = e.dir * 2.4; }
        return false;
      case 'pato':
        if (e.angry && e.hp > 0) { e.vx = e.dir * 2.2; }
        return false;
    }
    return false;
  }
  // La tortuga se esconde en su caparazón; una patada lo manda deslizando y arrasa con todo
  function updateShell(e) {
    if (e.shell === 'idle') { e.vx *= 0.8; if (++e.st > 420) { e.shell = null; e.hideT = 12; e.h = e.h0; e.y -= e.h0 - e.hs; popText(e.x + e.w / 2, e.y - 8, '¡YA SALGO!', '#ffffff'); } }
    if (e.shell === 'slide') {
      e.vx = e.sdir * 6;
      if (e.kickT > 0) e.kickT--;
      for (const o of L.enemies) if (o !== e && !o.dead && overlap(o, e)) { if (o.mini) { damageEnemy(o, 2, e.x + e.w / 2, 'hit'); continue; } P.combo++; killEnemy(o, 'hit'); addScore(200); }
    }
    e.vy = Math.min(e.vy + 0.45, 8); physX(e); physY(e);
    if (e.hitWall && e.shell === 'slide') { e.sdir = -e.sdir; Sound.sfx.bump(); }
    if (e.y > H + 40) e.remove = true;
  }
  function kickShell(e, dir) { e.shell = 'slide'; e.sdir = dir; e.kickT = 14; Sound.sfx.kick(); popText(e.x + e.w / 2, e.y - 8, '¡ALLÁ VA!', '#8affff'); }
  function edgeAhead(e) {
    const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2, t = tileAt(Math.floor(fx / T), Math.floor((e.y + e.h + 4) / T));
    return !isSolidTile(t) && t !== PLAT;
  }
  function updateEnemy(e) {
    if (e.dead) {
      e.deadT++;
      if (e.squash) { if (e.deadT > 30) e.remove = true; }
      else { e.vy += 0.4; e.x += e.vx; e.y += e.vy; e.rot += e.spin; if (e.y > H + 80) e.remove = true; }
      return;
    }
    if (!e.active) { if (e.x < L.camX + VW + 30 && e.x + e.w > L.camX - 30) e.active = true; else return; }
    e.t++; if (e.flash) e.flash--; if (e.cool > 0) e.cool--;
    const ty = e.ty, spd = ty.speed * D.speed * (e.mini ? (e.rage ? 1.6 : 1.2) : 1);
    const dx = (P.x + P.w / 2) - (e.x + e.w / 2), dy = (P.y + P.h / 2) - (e.y + e.h / 2);
    if (e.shell) { updateShell(e); return; }
    if (e.stun > 0) {
      e.stun--;
      if (e.inv > 0) e.inv--;
      if (!ty.fly) { e.vx *= 0.9; e.vy = Math.min(e.vy + 0.45, 8); physX(e); physY(e); }
      return;
    }
    if (e.mini && updateMini(e, dx)) return;
    if (e.hideT > 0) e.hideT--;
    const wasGround = e.onGround;
    if (special(e, dx, dy)) { if (e.onGround && !wasGround) e.land = 8; return; }
    switch (ty.beh) {
      case 'walker': case 'slider': {
        e.vx = e.dir * spd * (e.angry && e.kind === 'pato' ? 2.4 : 1); e.vy = Math.min(e.vy + 0.45, 8);
        physX(e); if (e.hitWall) e.dir = -e.hitWall;
        physY(e);
        if (ty.edge && e.onGround && edgeAhead(e)) e.dir = -e.dir;
        e.face = e.dir;
        if (ty.beh === 'slider' && e.onGround && e.t % 6 === 0) parts(e.x + e.w / 2, e.y + e.h, 1, ['#ffffff'], { sp: 0.5, up: 1, life: 15 });
        break;
      }
      case 'hopper': {
        e.vy = Math.min(e.vy + 0.4, 8);
        if (e.onGround) {
          e.vx *= 0.7; e.face = dx < 0 ? -1 : 1;
          e.st = (e.st || 40) - 1;
          if (e.st <= 0 && Math.abs(dx) < 420) { e.vy = -(6.5 + Math.random() * 2.2); e.vx = e.face * spd * 1.3; e.st = 50 + Math.random() * 50; }
        }
        physX(e); if (e.hitWall) e.vx = -e.vx * 0.5;
        physY(e);
        break;
      }
      case 'charger': {
        e.vy = Math.min(e.vy + 0.45, 8);
        if (e.state === 'patrol') {
          e.vx = e.dir * spd;
          if (Math.abs(dx) < 230 && Math.abs(dy) < 60 && Math.sign(dx) === e.dir && !P.dead) { e.state = 'wind'; e.st = 32; popText(e.x + e.w / 2, e.y - 14, '!', '#ff4a4a', 16); Sound.sfx.hiss(); }
        } else if (e.state === 'wind') { e.vx = 0; if (--e.st <= 0) { e.state = 'charge'; e.st = 110; } }
        else if (e.state === 'charge') {
          e.vx = e.dir * ty.charge * D.speed;
          if (e.t % 4 === 0) parts(e.x + e.w / 2 - e.dir * e.w / 2, e.y + e.h, 1, ['#d8c8a8', '#ffffff'], { sp: 0.6, up: 1.5, life: 18 });
          if (--e.st <= 0) { e.state = 'stunned'; e.st = 30; }
        } else if (e.state === 'stunned') { e.vx = 0; if (--e.st <= 0) e.state = 'patrol'; }
        physX(e);
        if (e.hitWall) { if (e.state === 'charge') { e.state = 'stunned'; e.st = 60; L.shake = 6; Sound.sfx.thud(); popText(e.x + e.w / 2, e.y - 10, '¡CLONK!', '#ffffff'); } e.dir = -e.hitWall; }
        physY(e);
        if (e.onGround && edgeAhead(e)) { if (e.state === 'charge') { e.state = 'stunned'; e.st = 40; } e.dir = -e.dir; }
        e.face = e.dir;
        break;
      }
      case 'popper': {
        if (e.state === 'hidden') { if (Math.abs(dx) < 260 && --e.st <= 0) { e.state = 'rising'; Sound.sfx.select(); } }
        else if (e.state === 'rising') { e.hide -= 0.07; if (e.hide <= 0) { e.hide = 0; e.state = 'up'; e.st = 80; } }
        else if (e.state === 'up') { e.face = dx < 0 ? -1 : 1; if (--e.st <= 0) e.state = 'sinking'; }
        else if (e.state === 'sinking') { e.hide += 0.05; if (e.hide >= 1) { e.hide = 1; e.state = 'hidden'; e.st = 60 + Math.random() * 60; } }
        break;
      }
      case 'flyer': {
        e.x += e.dir * spd;
        if (e.x < e.homeX - 150) e.dir = 1; if (e.x > e.homeX + 150) e.dir = -1;
        e.y = e.baseY + Math.sin(e.t * 0.07) * 28; e.face = e.dir;
        break;
      }
      case 'swooper': {
        if (e.state === 'patrol') {
          e.x += e.dir * spd; if (e.x < e.homeX - 140) e.dir = 1; if (e.x > e.homeX + 140) e.dir = -1;
          e.y = e.baseY + Math.sin(e.t * 0.06) * 10; e.face = e.dir;
          if (Math.abs(dx) < 130 && dy > 30 && e.cool <= 0 && !P.dead) {
            // el picado toca fondo a la altura de la cabeza del jugador de pie: agachándose se esquiva
            const standH = P.crouch ? P.fullH : P.h, depth = (P.y + P.h - standH * 0.68) - (e.y + e.h);
            const v0 = Math.max(1.5, Math.min(5.5, Math.sqrt(2 * 0.07 * Math.max(0, depth)))), tLow = v0 / 0.07;
            e.state = 'dive'; e.vy = v0; e.face = Math.sign(dx);
            e.vx = Math.sign(dx) * Math.min(3.2, Math.abs(dx) / tLow); Sound.sfx.hurt();
          }
        } else if (e.state === 'dive') {
          e.x += e.vx; e.y += e.vy; e.vy -= 0.07;
          if (e.vy <= 0 || e.y > H - 40) e.state = 'rise';
        } else { e.x += e.vx * 0.6; e.y -= 1.8; if (e.y <= e.baseY) { e.y = e.baseY; e.state = 'patrol'; e.cool = 100; e.homeX = e.x; } }
        break;
      }
      case 'floater': {
        e.y = e.baseY + Math.sin(e.t * 0.035) * 36; e.x = e.homeX + Math.sin(e.t * 0.013) * 40; e.face = -1;
        break;
      }
      case 'dropper': {
        if (e.leaving) { e.y -= 1.2; e.x += e.dir * 2; e.face = e.dir; if (e.y < -40) e.remove = true; break; }
        e.y = e.baseY + Math.sin(e.t * 0.08) * 6;
        e.vx = Math.max(-spd * 1.6, Math.min(spd * 1.6, (e.vx || 0) + Math.sign(dx) * 0.06));
        e.x += e.vx; e.face = e.vx < 0 ? -1 : 1;
        if (Math.abs(dx) < 26 && dy > 0 && e.cool <= 0 && !P.dead) {
          L.projs.push({ kind: 'caca', owner: 'e', x: e.x + e.w / 2 - 6, y: e.y + e.h, w: 12, h: 12, vx: e.vx * 0.3, vy: 1, g: 0.3, t: 0 });
          e.cool = 90 / D.speed; e.drops++;
          if (e.drops >= 3) { e.leaving = true; e.dir = e.face; popText(e.x, e.y - 10, '¡CURRUCUCÚ!', '#ffffff'); }
        }
        break;
      }
    }
    if (e.y > H + 40) e.remove = true;
  }
  // Dibuja un frame de la hoja del enemigo: el dibujo mira a la derecha, anclado por los pies
  function drawHDFrame(kind, idx, cx, feet, face, o = {}) {
    const f = SPRITE_FRAMES['en_' + kind][idx]; if (!f) return;
    const src = o.variant === 'white' ? atlas.white : o.variant === 'red' ? atlas.red : atlas.normal, k = (o.scale || 1) / RES;
    const w = f[2] * k, h = f[3] * k, ox = f[4] * k, oy = f[5] * k;
    ctx.save(); ctx.translate(rz(cx), rz(feet));
    if (o.rot) { ctx.translate(0, -h / 2); ctx.rotate(o.rot); ctx.translate(0, h / 2); }
    ctx.scale((o.kx || 1) * (face < 0 ? -1 : 1), o.ky || 1);
    ctx.imageSmoothingEnabled = k * curZ < 0.97;
    ctx.drawImage(src, f[0], f[1], f[2], f[3], ox, oy, w, h);
    ctx.imageSmoothingEnabled = false; ctx.restore();
  }
  function hdIndex(e) {
    const A = e.hd, cyc = (arr, sp) => arr[Math.floor(e.t / sp) % arr.length], prog = (arr, k) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(k * arr.length)))];
    const pickA = (...n) => { for (const x of n) if (A[x]) return A[x]; return A.idle || A.walk || A.fly; }, moving = Math.abs(e.vx) > 0.15;
    if (e.dead) { const k = pickA('ko', 'hurt'); return k[k.length - 1]; }
    if (e.shell) return e.shell === 'slide' ? cyc(A.spin, 3) : A.shell[0];
    if (e.hideT > 0) return prog(A.hide, 1 - e.hideT / 12);
    if (e.stun > 0 || e.flash) return cyc(pickA('hurt'), 6);
    switch (e.kind) {
      case 'cangrejo': return e.state === 'snap' ? (e.st > 14 ? cyc(A.attack, 5) : cyc(A.dash, 4)) : moving ? cyc(A.walk, 5) : cyc(A.idle, 10);
      case 'erizo': return Math.abs(P.x - e.x) < 90 ? cyc(A.attack, 6) : cyc(A.walk, 7);
      case 'gaviota': return e.state === 'dive' ? A.dive[1 + Math.floor(e.t / 6) % 3] : e.state === 'rise' ? cyc(A.swoop, 5) : cyc(A.fly, 5);
      case 'jabali': return e.state === 'wind' ? cyc(A.angry, 5) : e.state === 'charge' ? cyc(A.charge, 4) : e.state === 'stunned' ? cyc(A.hurt, 8) : moving ? cyc(A.walk, 6) : cyc(A.idle, 10);
      case 'oso': return e.state === 'swipe' ? prog(A.attack, (46 - e.st) / 46) : e.roarT > 0 ? cyc(A.roar, 7) : moving ? cyc(A.walk, 7) : cyc(A.idle, 10);
      case 'paloma': return (!e.leaving && e.cool > 90 / D.speed - 24) ? cyc(A.drop, 6) : cyc(A.fly, 4);
      case 'pato': return e.angry ? cyc(A.angry, 4) : moving ? cyc(A.walk, 5) : cyc(A.idle, 10);
      case 'pulpo': return e.state === 'ink' ? prog(A.ink, (34 - e.st) / 34) : !e.onGround ? cyc(A.jump, 6) : cyc(A.move, 8);
      case 'rata': return !e.onGround ? A.walk[2] : moving ? cyc(A.walk, 3) : cyc(A.idle, 10);
      case 'conejo': return !e.onGround ? (e.vy < 0 ? A.air[Math.floor(e.t / 6) % 2] : A.air[2 + Math.floor(e.t / 6) % 2]) : e.land > 0 ? A.land[e.land > 4 ? 0 : 1] : (e.st < 12 ? cyc(A.crouch, 6) : cyc(A.idle, 20));
      case 'rana': return e.state === 'tongue' ? (e.tongue > 0.2 ? A.open[0] : A.open[0]) : !e.onGround ? (e.vy < 0 ? A.air[0] : A.air[1]) : e.land > 0 ? A.land[0] : cyc(A.idle, 14);
      case 'mapache': return e.state === 'flee' ? cyc(A.flee, 4) : Math.abs(P.x - e.x) < 70 ? cyc(A.attack, 6) : moving ? cyc(A.walk, 6) : cyc(A.idle, 10);
      case 'medusa': return e.glow ? cyc(A.attack, 5) : cyc(A.idle, 12);
      case 'murcielago': return Math.abs(P.x - e.x) < 60 && Math.abs(P.y - e.y) < 60 ? cyc(A.bite, 5) : cyc(A.fly, 4);
      case 'cabra': return e.state === 'wind' ? cyc(A.rear, 8) : e.state === 'charge' ? cyc(A.charge, 4) : e.state === 'stunned' ? cyc(A.hurt, 8) : moving ? cyc(A.walk, 5) : cyc(A.idle, 10);
      case 'cuervo': return e.state === 'dive' ? A.dive[Math.min(3, 1 + Math.floor(e.t / 8) % 3)] : e.state === 'rise' ? cyc(A.steal, 8) : cyc(A.fly, 4);
      case 'lagarto': return Math.abs(P.x - e.x) < 60 && Math.abs(P.y - e.y) < 50 ? cyc(A.attack, 6) : moving ? cyc(A.walk, 3) : cyc(A.idle, 10);
      case 'pinguino': return e.onGround && Math.abs(e.vx) > 1.2 ? cyc(A.slide, 5) : moving ? cyc(A.walk, 5) : cyc(A.idle, 10);
      case 'tortuga': return Math.abs(P.x - e.x) < 60 && Math.abs(P.y - e.y) < 50 ? cyc(A.attack, 7) : moving ? cyc(A.walk, 8) : cyc(A.idle, 12);
      case 'topo':
        if (e.state === 'hidden') return A.hide[A.hide.length - 1];
        if (e.state === 'rising') return prog(A.emerge, 1 - e.hide);
        if (e.state === 'sinking') return prog(A.hide, e.hide);
        if (e.state === 'up' && e.st <= 53 && e.st >= 38) return prog(A.golf, (53 - e.st) / 16);
        if (e.state === 'up' && Math.abs(P.x - e.x) < 80) return cyc(A.dig, 6);
        return cyc(A.idle, 12);
    }
    return moving ? cyc(pickA('walk', 'fly'), 6) : cyc(pickA('idle', 'fly'), 10);
  }
  function drawEnemyHD(e) {
    const cx = e.x + e.w / 2, feet = e.y + e.h + (e.kind === 'topo' && !e.dead ? T * 0.55 : 0), idx = hdIndex(e); // el montículo del topo se hunde en el césped
    let variant = null;
    if (e.flash && e.flash % 4 < 2) variant = 'white';
    else if ((e.angry || e.state === 'wind' || e.state === 'charge' || e.state === 'snap' && e.st > 14) && e.t % 8 < 4) variant = 'red';
    if (e.dead && e.squash) { drawHDFrame(e.kind, idx, cx, feet, e.face, { ky: 0.45, kx: 1.2, scale: e.big }); return; }
    if (e.dead) { drawHDFrame(e.kind, idx, cx, feet, e.face, { rot: e.rot, scale: e.big }); return; }
    let kx = 1, ky = 1, bob = 0;
    if (e.shell || (e.kind === 'topo' && e.state !== 'up')) { /* el topo sale y se esconde con sus propios frames */ }
    else if (e.ty.beh === 'hopper' || e.kind === 'rata') { if (!e.onGround) { ky = 1 + Math.min(0.15, Math.abs(e.vy) * 0.02); kx = 2 - ky; } else if (e.land > 0) { ky = 1 - e.land * 0.03; kx = 2 - ky; } }
    else if (!e.ty.fly && !(Math.abs(e.vx) > 0.15)) { ky = 1 + Math.sin(e.t * 0.08) * 0.025; kx = 2 - ky; }
    if (e.state === 'wind') bob = (e.t % 4 < 2 ? 1 : -1) * 0.6;
    if (e.mini && e.rage && !variant && e.t % 16 < 5) variant = 'red';
    drawHDFrame(e.kind, idx, cx + bob, feet, e.face, { kx, ky, variant, scale: e.big });
    if (L.freezeT > 0 && !e.mini) {
      // escarcha del gazpacho: capa blanca translúcida y un destello
      ctx.save(); ctx.globalAlpha = 0.5; drawHDFrame(e.kind, idx, cx + bob, feet, e.face, { kx, ky, variant: 'white', scale: e.big }); ctx.restore();
      star(cx + Math.cos(G.t * 0.1 + e.id) * e.sw * 0.3, feet - e.sh * 0.6 + Math.sin(G.t * 0.13 + e.id) * e.sh * 0.25, '#9fe8f5');
    }
    const x = cx - e.sw / 2, y = feet - e.sh;
    if (e.state === 'stunned') for (let i = 0; i < 2; i++) star(cx + Math.cos(e.t * 0.2 + i * 3) * 10, y - 4 + Math.sin(e.t * 0.2 + i * 3) * 3);
    if (e.tongue > 0.05) { const len = e.tongue * 95, ty2 = y + e.sh * 0.45, tx0 = cx + e.face * e.sw * 0.3, tx1 = tx0 + e.face * len; ctx.fillStyle = '#1b1426'; ctx.fillRect(Math.min(tx0, tx1), ty2 - 1, Math.abs(tx1 - tx0), 5); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(Math.min(tx0, tx1), ty2, Math.abs(tx1 - tx0), 3); ctx.beginPath(); ctx.arc(tx1, ty2 + 1.5, 4, 0, Math.PI * 2); ctx.fillStyle = '#1b1426'; ctx.fill(); ctx.beginPath(); ctx.arc(tx1, ty2 + 1.5, 3, 0, Math.PI * 2); ctx.fillStyle = '#ff8aa8'; ctx.fill(); }
    if (e.kind === 'medusa' && e.glow) { ctx.strokeStyle = e.t % 4 < 2 ? '#aaffff' : '#ffff88'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + e.t * 0.2, my = feet - e.sh / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 16, my + Math.sin(a) * 16); ctx.lineTo(cx + Math.cos(a + 0.3) * 28, my + Math.sin(a - 0.2) * 28); ctx.lineTo(cx + Math.cos(a) * 38, my + Math.sin(a) * 38); ctx.stroke(); } }
    if (e.loot && e.state !== 'flee') { const li = Art.itemSprites[e.loot.weapon]; ctx.drawImage(li, cx - 8, y - 12, 16, 16 * li.height / li.width); }
    if (!e.mini && e.maxHp > 1 && e.hp < e.maxHp && e.hp > 0) { ctx.fillStyle = '#1b1426'; ctx.fillRect(cx - 12, y - 6, 24, 4); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(cx - 11, y - 5, 22 * e.hp / e.maxHp, 2); }
    if (e.mini && e.state === 'pound' && !e.onGround) for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - e.sw * 0.3 + i * e.sw * 0.3, y + e.sh + 4 + i * 3, 2, 8); }
  }
  function drawEnemy(e) {
    if (e.hd) { drawEnemyHD(e); return; }
    const s = e.spr, fr = e.ty.beh === 'hopper' ? (e.onGround ? 0 : 1) : (e.ty.fly ? Math.floor(e.t / 8) % 2 : (Math.abs(e.vx) > 0.1 || e.ty.beh === 'floater' ? Math.floor(e.t / 10) % 2 : 0));
    const img = e.flash && e.flash % 4 < 2 ? s.W[fr] : (e.face > 0 ? s.R[fr] : s.L[fr]);
    let x = rz(e.x + e.w / 2 - e.sw / 2), y = rz(e.y + e.h - e.sh + 2);
    if (e.state === 'wind') x += (e.t % 4 < 2 ? -1 : 1) / Z;
    if (e.dead && e.squash) { ctx.drawImage(img, x, y + e.sh * 0.6, e.sw, e.sh * 0.4); return; }
    if (e.dead) { ctx.save(); ctx.translate(x + e.sw / 2, y + e.sh / 2); ctx.rotate(e.rot); ctx.scale(1, -1); ctx.drawImage(img, -e.sw / 2, -e.sh / 2, e.sw, e.sh); ctx.restore(); return; }
    if (e.ty.beh === 'popper') {
      const gy = e.groundY;
      ctx.save(); ctx.beginPath(); ctx.rect(x - 8, gy - e.sh - 10, e.sw + 16, e.sh + 10); ctx.clip();
      ctx.drawImage(img, x, rz(y + e.hide * (e.sh + 2)), e.sw, e.sh); ctx.restore();
      ctx.fillStyle = '#6a4020'; ctx.fillRect(x - 4, gy - 4, e.sw + 8, 4); ctx.fillStyle = '#8a5a30'; ctx.fillRect(x, gy - 6, e.sw, 2);
      return;
    }
    if (e.ty.beh === 'slider' && !e.hd) { ctx.save(); ctx.translate(x + e.sw / 2, y + e.sh / 2 + 6); ctx.rotate(e.face * 0.5); ctx.drawImage(img, -e.sw / 2, -e.sh / 2, e.sw, e.sh); ctx.restore(); return; }
    if (e.state === 'stunned') for (let i = 0; i < 2; i++) star(x + e.sw / 2 + Math.cos(e.t * 0.2 + i * 3) * 10, y - 4 + Math.sin(e.t * 0.2 + i * 3) * 3);
    let im = img;
    if ((e.angry || e.state === 'wind' || e.state === 'charge') && !e.flash && e.t % 8 < 5) im = e.face > 0 ? s.AR[fr] : s.AL[fr];
    if (e.kind === 'medusa' && e.glow && e.t % 6 < 3) im = s.W[fr];
    // volumen animado: estirar al saltar, aplastar al aterrizar, respirar al andar
    let kx = 1, ky = 1, bob = 0;
    if (e.shell) { ky = 0.62; kx = 1.05; }
    else if (e.ty.beh === 'hopper' || e.kind === 'rata') { if (!e.onGround) { ky = 1 + Math.min(0.22, Math.abs(e.vy) * 0.03); kx = 2 - ky; } else if (e.land > 0) { ky = 1 - e.land * 0.035; kx = 2 - ky; } }
    else if (!e.ty.fly && Math.abs(e.vx) > 0.1) { bob = Math.abs(Math.sin(e.t * 0.25)) * 1.6; ky = 1 + Math.sin(e.t * 0.5) * 0.035; kx = 2 - ky; }
    else if (!e.ty.fly) { ky = 1 + Math.sin(e.t * 0.08) * 0.03; kx = 2 - ky; }
    if (e.shell === 'slide') { ctx.save(); ctx.translate(x + e.sw / 2, y + e.sh - e.sh * 0.3); ctx.scale(1.05, 0.62); ctx.drawImage(im, -e.sw / 2, -e.sh / 2, e.sw, e.sh); ctx.restore(); for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + e.sw / 2 - e.sdir * (10 + i * 6), y + e.sh - 6 - i * 3, 5, 1); } }
    else { ctx.save(); ctx.translate(x + e.sw / 2, y + e.sh - bob); ctx.scale(kx, ky); ctx.drawImage(im, -e.sw / 2, -e.sh, e.sw, e.sh); ctx.restore(); }
    if (e.tongue > 0.05) { const len = e.tongue * 95, ty2 = y + e.sh * 0.42, tx0 = e.face > 0 ? x + e.sw - 6 : x + 6, tx1 = tx0 + e.face * len; ctx.fillStyle = '#1b1426'; ctx.fillRect(Math.min(tx0, tx1), ty2 - 1, Math.abs(tx1 - tx0), 5); ctx.fillStyle = '#ff6a8a'; ctx.fillRect(Math.min(tx0, tx1), ty2, Math.abs(tx1 - tx0), 3); ctx.beginPath(); ctx.arc(tx1, ty2 + 1.5, 4, 0, Math.PI * 2); ctx.fillStyle = '#1b1426'; ctx.fill(); ctx.beginPath(); ctx.arc(tx1, ty2 + 1.5, 3, 0, Math.PI * 2); ctx.fillStyle = '#ff8aa8'; ctx.fill(); }
    if (e.kind === 'oso' && e.state === 'swipe' && e.st <= 16 && e.st > 6) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); const ax = e.face > 0 ? x + e.sw + 6 : x - 6; ctx.arc(ax, y + e.sh * 0.45 + i * 7, 16, e.face > 0 ? -1.2 : Math.PI - 0.2, e.face > 0 ? 0.2 : Math.PI + 1.2); ctx.stroke(); } }
    if (e.kind === 'medusa' && e.glow) { ctx.strokeStyle = e.t % 4 < 2 ? '#aaffff' : '#ffff88'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + e.t * 0.2; ctx.beginPath(); ctx.moveTo(x + e.sw / 2 + Math.cos(a) * 14, y + e.sh / 2 + Math.sin(a) * 14); ctx.lineTo(x + e.sw / 2 + Math.cos(a + 0.3) * 26, y + e.sh / 2 + Math.sin(a - 0.2) * 26); ctx.lineTo(x + e.sw / 2 + Math.cos(a) * 36, y + e.sh / 2 + Math.sin(a) * 36); ctx.stroke(); } }
    if (e.loot) { const li = Art.itemSprites[e.loot.weapon]; ctx.drawImage(li, x + e.sw / 2 - 8, y - 12, 16, 16 * li.height / li.width); }
    if (e.maxHp > 1 && e.hp < e.maxHp && e.hp > 0) { ctx.fillStyle = '#1b1426'; ctx.fillRect(x + e.sw / 2 - 12, y - 6, 24, 4); ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x + e.sw / 2 - 11, y - 5, 22 * e.hp / e.maxHp, 2); }
  }

  // ---------------------------------------------------------- JUGADOR
  const ACTS = {
    punch: { len: 16, frames: [[0, 4], [4, 5], [10, 6], [13, 7]], on: [4, 11], box: [6, 8, 30, 18], dmg: 1 },
    kick: { len: 22, frames: [[0, 8], [5, 9], [12, 10], [17, 11]], on: [5, 16], box: [2, 18, 42, 24], dmg: 2 },
    throw: { len: 12, frames: [[0, 28], [3, 29], [6, 30], [9, 31]], on: [99, 99], box: [0, 0, 0, 0], dmg: 0 },
  };
  function attackBox() {
    if (!P.act) return null;
    const a = ACTS[P.act], s = pScale();
    if (P.actT < a.on[0] || P.actT > a.on[1]) return null;
    let len = a.box[2] * s, dmg = a.dmg;
    if (P.act === 'punch' && P.weapon === 'churro') { len += 24; dmg = 2; }
    const cx = P.x + P.w / 2, off = a.box[0] * s;
    return { x: P.face > 0 ? cx + off : cx - off - len, y: P.y + a.box[1] * s, w: len, h: a.box[3] * s, dmg };
  }
  function doThrow() {
    const cx = P.x + P.w / 2, y = P.y + 14 * pScale();
    if (P.power === 'fire') {
      if (L.projs.filter(p => p.kind === 'fuego').length >= 3) return false;
      L.projs.push({ kind: 'fuego', owner: 'p', x: cx + P.face * 10 - 6, y, w: 12, h: 12, vx: P.face * 5, vy: 1, g: 0.35, t: 0, dmg: 1, bounce: true });
      Sound.sfx.fire(); return true;
    }
    if (P.weapon === 'chancla' && P.ammo > 0) {
      P.ammo--; if (!P.ammo) { P.weapon = null; popText(cx, P.y - 20, '¡SIN CHANCLAS!', '#ffffff'); }
      L.projs.push({ kind: 'chancla', owner: 'p', x: cx + P.face * 10 - 12, y, w: 24, h: 14, vx: P.face * 6.5, vy: -2.2, g: 0.12, t: 0, dmg: 2, rot: 0 });
      Sound.sfx.throw(); return true;
    }
    popText(cx, P.y - 20, '¡NO TENGO NADA QUE LANZAR!', '#ffffff');
    return false;
  }
  function hurtPlayer(src) {
    if (P.inv > 0 || P.starT > 0 || P.dead || G.state !== 'play') return;
    const sx = src ? src.x + (src.w || 0) / 2 : P.x;
    // la paellera para el golpe
    if (P.shield > 0) {
      P.shield--; P.inv = 60; L.shake = 5; Sound.sfx.bump(); Sound.sfx.stomp();
      P.vx = (P.x + P.w / 2 < sx ? -1 : 1) * 2;
      const hx = P.x + P.w / 2 + (sx < P.x + P.w / 2 ? -14 : 14);
      addFx('impacto', hx, P.y + P.h / 2, { bottom: false, scale: 0.6 });
      parts(hx, P.y + P.h / 2, 12, ['#ffd23f', '#e0303a', '#58c84a', '#a9a9bd'], { sp: 3, up: 3 });
      popText(P.x + P.w / 2, P.y - 14, P.shield ? '¡CLONG! Quedan ' + P.shield : '¡CLONG! ¡SIN PAELLA!', '#ffd23f');
      return;
    }
    P.hurtT = 30; P.inv = 100; P.act = null;
    P.vx = (P.x + P.w / 2 < sx ? -1 : 1) * 3; P.vy = -4.5;
    L.shake = 8;
    if (P.power === 'fire') { setPower('big'); Sound.sfx.powerdown(); popText(P.x + P.w / 2, P.y - 12, '¡SE ACABÓ EL MOJO!', '#ffffff'); return; }
    if (P.power === 'big') { setPower('none'); Sound.sfx.powerdown(); popText(P.x + P.w / 2, P.y - 12, '¡ADIÓS BOCATA!', '#ffffff'); return; }
    P.hearts--; Sound.sfx.hurt();
    popText(P.x + P.w / 2, P.y - 12, pick(['¡AY!', '¡AUCH!', '¡QUÉ DAÑO, BRO!', '¡MI MADRE!', '¡LITERALMENTE ME HA DOLIDO!', '¡POR LA CARÍSIMA, QUÉ DAÑO!', '¡BRO, EN SERIO?!']), '#ff8a8a');
    if (P.weapon === 'churro' && P.hearts > 0) { P.weapon = null; popText(P.x + P.w / 2, P.y - 26, '¡MI CHURRO!', '#ffe066'); }
    if (P.hearts <= 0) killPlayer();
  }
  function killPlayer() {
    if (P.dead) return;
    P.dead = true; P.deadT = 0; P.vy = -8; P.vx = 0; P.hearts = 0; P.starT = 0;
    Sound.stop(); Sound.sfx.die();
    L.bubbles = [];
  }
  function updatePlayer() {
    if (P.dead) {
      P.deadT++;
      if (P.deadT > 30) { P.vy += 0.4; P.y += P.vy; }
      if (P.deadT === 150) {
        G.lives--;
        if (G.lives <= 0) { G.state = 'gameover'; G.t = 0; Sound.sfx.gameover(); saveHi(); }
        else { G.state = 'respawn'; G.t = 0; }
      }
      return;
    }
    const auto = P.lock;
    const hl = auto ? P.auto === -1 : Input.held('left'), hr = auto ? P.auto === 1 : Input.held('right');
    const ice = !!L.loc.slippery, star = P.starT > 0;
    const fast = P.fastT > 0;
    const maxV = (G.hero === 'boy' ? 3.15 : 3.0) * (star ? 1.15 : 1) * (fast ? 1.45 : 1), jumpV = G.hero === 'boy' ? 9.8 : 10.1;
    // agacharse (ABAJO en el suelo): esquiva lo que viene a la altura de la cabeza
    const wantCrouch = !auto && Input.held('down') && P.onGround && !P.act && P.hurtT < 18;
    if (wantCrouch) setCrouch(true);
    else if (P.crouch) setCrouch(false, !P.onGround);
    let ax = (hr ? 1 : 0) - (hl ? 1 : 0);
    if (P.hurtT > 18) ax = 0;
    if (P.crouch) { if (ax) P.face = ax; if (canStand()) ax = 0; } // agachado no anda (salvo si no cabe de pie)
    const acc = (P.onGround ? (ice ? 0.13 : 0.42) : 0.3) * (fast ? 1.35 : 1);
    if (ax) { P.vx += ax * acc; if (!P.act) P.face = ax; }
    else if (P.onGround) { P.vx *= ice ? 0.965 : 0.72; if (Math.abs(P.vx) < 0.08) P.vx = 0; }
    if (P.act && P.onGround && !ice) P.vx *= 0.82;
    const vMax = P.crouch ? 1 : maxV;
    P.vx = Math.max(-vMax, Math.min(vMax, P.vx));
    // salto con buffer y "coyote time"
    if (!auto && (Input.pressed('jump') || Input.pressed('up'))) P.jumpBuf = 7; else if (P.jumpBuf > 0) P.jumpBuf--;
    if (P.onGround) { P.coyote = 6; P.combo = 0; P.airJumped = false; } else if (P.coyote > 0) P.coyote--;
    if (P.jumpBuf > 0 && P.coyote > 0 && P.hurtT < 18 && setCrouch(false)) {
      P.vy = -jumpV; P.jumpBuf = 0; P.coyote = 0; Sound.sfx.jump();
      parts(P.x + P.w / 2, P.y + P.h, 5, ['#ffffff', '#e8e0d0'], { sp: 1.2, up: 1, life: 16, g: 0 });
    } else if (P.jumpBuf > 0 && P.cocido && !P.onGround && !P.airJumped && P.vy > -jumpV * 0.6 && P.hurtT < 18) {
      // doble salto del cocido: una nubecilla bajo los pies
      P.vy = -jumpV * 0.92; P.jumpBuf = 0; P.airJumped = true; Sound.sfx.jump(); Sound.sfx.boing();
      addFx('polvo', P.x + P.w / 2, P.y + P.h + 6, { scale: 0.8 });
      parts(P.x + P.w / 2, P.y + P.h, 10, ['#ffffff', '#f5dcb0', '#e0303a'], { sp: 2, up: 0.5, down: 2, life: 18, g: 0 });
    }
    const holdJ = Input.held('jump') || Input.held('up');
    P.vy += (P.vy < 0 && !holdJ) ? 1.0 : 0.45;
    if (P.vy > 9.5) P.vy = 9.5;
    // ataques
    if (!auto && !P.act && P.hurtT < 18) {
      if (Input.pressed('punch')) { P.act = 'punch'; P.actT = 0; P.hitSet = new Set(); Sound.sfx.punch(); }
      else if (Input.pressed('kick')) { P.act = 'kick'; P.actT = 0; P.hitSet = new Set(); Sound.sfx.kick(); }
      else if (Input.pressed('throw')) { if (doThrow()) { P.act = 'throw'; P.actT = 0; P.hitSet = new Set(); } }
    }
    if (P.act) { P.actT++; if (P.actT >= ACTS[P.act].len) P.act = null; }
    const wasGround = P.onGround, vyBefore = P.vy;
    physX(P); physY(P);
    if (P.onGround && !wasGround && vyBefore > 5) { parts(P.x + P.w / 2, P.y + P.h, 6, ['#ffffff', '#e8e0d0'], { sp: 1.5, up: 1, life: 14, g: 0 }); addFx(ice ? 'hielo' : 'polvo', P.x + P.w / 2, P.y + P.h, { scale: 0.75 }); }
    if (P.bonk) bumpBlock(P.bonk.c, P.bonk.r);
    if (P.y > H + 30) {
      if (L.loc.hazard === 'water') { addFx('agua', P.x + P.w / 2, H - 4, { scale: 1.15 }); addFx('burbujas', P.x + P.w / 2 + 12, H - 8, { scale: 0.8 }); }
      else if (L.loc.hazard === 'lava') addFx('lava', P.x + P.w / 2, H - 3, { scale: 1.1 });
      killPlayer(); P.vy = -10; P.y = H + 30;
    }
    if (P.hurtT > 0) P.hurtT--;
    if (P.inv > 0) P.inv--;
    if (P.starT > 0) { P.starT--; if (P.t % 3 === 0) parts(P.x + rand(0, P.w), P.y + rand(0, P.h), 1, ['#ffffff', '#ffe066', '#ff8ab0', '#8affff'], { sp: 0.5, up: 1, life: 20, g: 0 }); if (P.starT === 0) Sound.play(currentMusic()); }
    if (P.fastT > 0) {
      P.fastT--;
      if (P.onGround && Math.abs(P.vx) > 3 && P.anim % 3 === 0) parts(P.x + P.w / 2 - Math.sign(P.vx) * 10, P.y + P.h - 2, 1, ['#c89a5a', '#f5dcb0', '#ffffff'], { sp: 0.4, up: 0.8, life: 16, g: 0 });
      if (P.fastT === 120) popText(P.x + P.w / 2, P.y - 20, '¡SE ACABA EL CAFÉ!', '#c89a5a');
    }
    if (P.power === 'fire' && P.anim % 5 === 0) parts(P.x + rand(0, P.w), P.y + rand(0, 10), 1, ['#ff6a00', '#ffd23f'], { sp: 0.3, up: 1.2, life: 16, g: -0.05 });
    P.anim++; P.t = (P.t || 0) + 1; P.walk = ((P.walk || 0) + Math.abs(P.vx) * 0.085) % 8;
    if (ice && P.onGround && Math.abs(P.vx) > 1.8 && ax && Math.sign(ax) !== Math.sign(P.vx) && P.anim % 10 === 0) addFx('hielo', P.x + P.w / 2 - Math.sign(P.vx) * 8, P.y + P.h, { face: -Math.sign(P.vx), scale: 0.55 });
    if (!P.act && Math.abs(P.vx) < 0.1 && P.onGround && !auto) P.idleT++; else P.idleT = 0;
    if (P.idleT === 360) bubble(P, fill(pick(['Bro... ¿seguimos o qué?', 'Six... seven... ¿Seguimos?', 'Literalmente me aburro, bro.', '¿Dónde se habrá metido {M}?', '¿Hola? ¿Seguimos o qué?', 'Tengo hambre... ¿alguien tiene un bocata?', '¡Que el gato se escapa!', 'Me estoy quedando frit' + (G.hero === 'boy' ? 'o' : 'a') + '...']), G.C), 180);
    // ataque cuerpo a cuerpo contra enemigos y proyectiles enemigos
    const ab = attackBox();
    if (ab) {
      L.enemies.forEach(e => { if (!e.dead && !P.hitSet.has(e.id) && overlap(ab, e)) { P.hitSet.add(e.id); if (e.shell) kickShell(e, P.face); else damageEnemy(e, ab.dmg, P.x + P.w / 2, 'hit'); } });
      L.projs.forEach(p => { if (p.owner === 'e' && !p.remove && overlap(ab, p) && p.kind !== 'onda') { p.remove = true; addScore(50); popText(p.x, p.y - 8, '¡DEVUELTA! 50', '#8affff'); addFx('impacto', p.x + p.w / 2, p.y + p.h / 2, { bottom: false, scale: 0.55 }); parts(p.x + p.w / 2, p.y + p.h / 2, 8, ['#ffffff', '#ffe066'], {}); Sound.sfx.stomp(); } });
      if (L.boss && !P.hitSet.has('boss') && overlap(ab, L.boss.hit())) { P.hitSet.add('boss'); hitBoss(ab.dmg); }
    }
    // contacto con enemigos
    for (const e of L.enemies) {
      if (e.dead || !e.active) continue;
      if (e.ty.beh === 'popper' && e.hide > 0.5) continue;
      if (!overlap(P, e)) continue;
      if (P.starT > 0) { if (e.mini) damageEnemy(e, 1, P.x + P.w / 2, 'hit'); else { killEnemy(e, 'hit'); Sound.sfx.hit(); } continue; }
      const fromAbove = P.vy > 0 && (P.y + P.h - P.vy) <= e.y + 10;
      // congelados por el gazpacho: no hacen daño al tocarlos, pero se pueden pisar
      const frozen = L.freezeT > 0 && !e.mini;
      if (frozen && (!fromAbove || e.shell)) continue;
      if (e.shell) {
        if (fromAbove) { if (e.shell === 'slide') { e.shell = 'idle'; e.st = 0; } else kickShell(e, P.x + P.w / 2 < e.x + e.w / 2 ? 1 : -1); P.vy = -6; P.y = e.y - P.h - 1; Sound.sfx.stomp(); }
        else if (e.shell === 'idle') kickShell(e, P.x + P.w / 2 < e.x + e.w / 2 ? 1 : -1);
        else if (e.kickT <= 0) hurtPlayer(e);
        continue;
      }
      if (fromAbove && e.kind === 'tortuga' && e.ty.stomp && !e.mini) {
        e.shell = 'idle'; e.st = 0; e.h0 = e.h; e.hs = e.h * 0.6; e.y += e.h - e.hs; e.h = e.hs; e.vx = 0;
        P.vy = -6.5; P.y = e.y - P.h - 1; Sound.sfx.stomp(); popText(e.x + e.w / 2, e.y - 8, '¡ME ESCONDO!', '#ffffff'); addScore(100);
        continue;
      }
      if (e.kind === 'mapache' && P.weapon && e.state !== 'flee' && P.inv <= 0 && !frozen) {
        e.loot = { weapon: P.weapon, ammo: P.ammo }; P.weapon = null; P.ammo = 0; e.state = 'flee'; e.dir = P.x + P.w / 2 < e.x + e.w / 2 ? 1 : -1;
        P.inv = 60; Sound.sfx.powerdown(); popText(e.x + e.w / 2, e.y - 16, '¡ME LO LLEVO!', '#ffb060');
        bubble(P, '¡Eh! ¡Devuélveme eso, mapache ladrón!', 0);
        continue;
      }
      if (e.kind === 'cuervo' && !fromAbove && G.pesetas > 0 && P.inv <= 0) { const n = Math.min(5, G.pesetas); G.pesetas -= n; popText(P.x + P.w / 2, P.y - 26, '¡MIS PESETAS! -' + n, '#ffe066'); }
      const stompable = e.ty.stomp && !(e.kind === 'medusa' && e.glow);
      if (fromAbove && stompable) {
        P.combo++;
        if (P.combo === 3) popText(P.x + P.w / 2, P.y - 24, pick(['¡LITERALMENTE IMPARABLE!', '¡BRO, QUÉ PRO!', '¡POR LA CARÍSIMA!']), '#8affff');
        if (P.combo === 6) popText(P.x + P.w / 2, P.y - 36, '¡SIX SEVEN!', '#ffe066', 16);
        const dmg = 2;
        if (e.mini) hitMini(e, dmg, P.x + P.w / 2, 'stomp');
        else {
          e.hp -= dmg; e.flash = 8;
          if (e.hp <= 0) killEnemy(e, 'stomp'); else { popText(e.x + e.w / 2, e.y - 8, '¡UFF!', '#ffffff'); if (e.kind === 'pato') { e.angry = true; popText(e.x + e.w / 2, e.y - 20, '¡CUAC! ¡ME ENFADO!', '#ff6a6a'); } }
        }
        P.vy = (Input.held('jump') || Input.held('up')) ? -9.5 : -6; P.y = e.y - P.h - 1;
        Sound.sfx.stomp();
      } else if (fromAbove && !stompable) {
        hurtPlayer(e); P.vy = -7; popText(e.x + e.w / 2, e.y - 10, '¡QUE PINCHA!', '#ffffff');
      } else hurtPlayer(e);
    }
  }
  function playerFrame() {
    if (P.dead) return P.deadT < 30 ? KO[0] : KO[1];
    // al aterrizar tras un salto se agacha un instante
    if (!P.onGround) P.airT = (P.airT || 0) + 1; else { if (P.airT > 10) P.landT = 6; P.airT = 0; }
    if (G.state === 'ending' && L.freed && L.endT > 330) return P.onGround ? winFrame(L.endT) : WIN[1];
    if (P.hurtT > 0) return P.hurtT > 15 ? HURT[0] : HURT[1];
    if (P.act) { const fr = ACTS[P.act].frames; let f = fr[0][1]; for (const [t, i] of fr) if (P.actT >= t) f = i; return f; }
    if (!P.onGround) return P.vy < -2 ? JUMP[1] : P.vy < 2.5 ? JUMP[2] : JUMP[3];
    if (P.crouch) return JUMP[0];
    if (P.landT > 0) { P.landT--; return JUMP[0]; }
    if (Math.abs(P.vx) > 0.4) return WALK[Math.floor(P.walk || 0) % 8];
    return IDLE[Math.floor(P.anim / 12) % 4];
  }
  function drawPlayer() {
    if (P.inv > 0 && !P.dead && Math.floor(P.inv / 3) % 2 === 0 && P.starT <= 0) return;
    const f = playerFrame(), s = pScale();
    let feet = P.y + P.h;
    const variant = P.starT > 0 ? Math.floor(P.anim / 3) : (P.power === 'fire' ? 'fire' : null);
    const r = drawChar(G.hero, f, P.x + P.w / 2, feet, P.face, s, variant);
    // escudo de paella: las paelleras que quedan giran alrededor
    if (P.shield > 0) {
      const im = elem('paella') || Art.itemSprites.paella, w = 18, h = w * im.height / im.width, cy = P.y + P.h * 0.5;
      for (let i = 0; i < P.shield; i++) {
        const a = G.t * 0.09 + i * Math.PI * 2 / 3, px = P.x + P.w / 2 + Math.cos(a) * 24, py = cy + Math.sin(a) * 10;
        ctx.drawImage(im, rz(px - w / 2), rz(py - h / 2), w, h);
      }
    }
    // churro en la mano durante el puñetazo
    if (P.weapon === 'churro' && P.act === 'punch' && P.actT >= 4) {
      const img = P.face > 0 ? Art.itemSprites.churro : Art.itemSprites.churro_R;
      const cx = P.x + P.w / 2 + P.face * 26 * s;
      ctx.drawImage(img, rz(P.face > 0 ? cx : cx - img.width / Z), rz(P.y + 2 * s), img.width / Z, img.height / Z);
    }
    return r;
  }

  // ---------------------------------------------------------- PROYECTILES
  function updateProj(p) {
    p.t++;
    if (p.kind === 'onda' || p.kind === 'zarpazo') { p.x += p.vx; if (p.t > (p.life || 60)) p.remove = true; }
    else {
      p.vy += p.g || 0; p.x += p.vx; p.y += p.vy;
      if (p.kind === 'fuego') {
        const r = Math.floor((p.y + p.h) / T), c = Math.floor((p.x + p.w / 2) / T), t = tileAt(c, r);
        if ((isSolidTile(t) || t === PLAT) && p.vy > 0) { p.y = r * T - p.h; p.vy = -4.5; }
        if (solidAt(Math.floor((p.x + (p.vx > 0 ? p.w : 0)) / T), Math.floor((p.y + p.h / 2) / T))) { p.remove = true; parts(p.x, p.y, 5, ['#ff6a00', '#ffd23f'], {}); }
        if (p.t > 140) p.remove = true;
        if (p.t % 3 === 0) parts(p.x + 6, p.y + 6, 1, ['#ff6a00', '#ffd23f'], { sp: 0.3, up: 0.5, life: 12, g: 0 });
      } else if (p.kind === 'chancla') {
        p.rot += 0.5 * Math.sign(p.vx);
        if (solidAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h / 2) / T))) { p.remove = true; Sound.sfx.bump(); parts(p.x, p.y, 5, ['#3c64d8', '#ffffff'], {}); }
      } else if (p.kind === 'caca' || p.kind === 'pelo' || p.kind === 'ovillo' || p.kind === 'tinta' || p.kind === 'golf') {
        const r = Math.floor((p.y + p.h) / T), c = Math.floor((p.x + p.w / 2) / T);
        if (solidAt(c, r) && p.vy > 0) {
          p.remove = true;
          if (p.kind === 'tinta') { addFx('tinta', p.x + 6, p.y + 12, { scale: 0.85 }); parts(p.x + 6, p.y + 10, 8, ['#1b1426', '#3a2a5a'], { sp: 1.5, up: 2 }); }
          else if (p.kind === 'golf') { parts(p.x + 4, p.y + 6, 4, ['#ffffff'], { sp: 1, up: 1 }); }
          else if (p.kind === 'caca') { Sound.sfx.splat(); popText(p.x, p.y - 6, '¡PLOF!', '#c89a5a'); addFx('caca', p.x + 6, p.y + 12, { scale: 0.85 }); parts(p.x + 6, p.y + 10, 8, ['#8a5a30', '#5e3a1e'], { sp: 1.5, up: 2 }); }
          else if (p.kind === 'ovillo') { Sound.sfx.yarn(); parts(p.x + 8, p.y + 10, 8, ['#f59ab8', '#8a3fb8'], { sp: 2, up: 3 }); }
          else parts(p.x + 6, p.y + 6, 6, ['#f08a24', '#ffd23f'], {});
        }
      }
    }
    if (p.y > H + 40 || p.x < L.camX - 100 || p.x > L.camX + VW + 100) p.remove = true;
    if (p.remove) return;
    if (p.owner === 'p') {
      for (const e of L.enemies) if (!e.dead && e.active && overlap(p, e)) { if (damageEnemy(e, p.dmg, p.x, 'hit')) { p.remove = true; break; } }
      if (!p.remove && L.boss && overlap(p, L.boss.hit())) { hitBoss(p.dmg); p.remove = true; }
    } else if (!P.dead && overlap(p, P)) {
      if (p.kind === 'tinta') {
        p.remove = true; Sound.sfx.splat(); popText(P.x + P.w / 2, P.y - 20, '¡PUAJ! ¡TINTA DE PULPO!', '#8a8aa8');
        L.ink = { t: 0, dur: 240, blobs: Array.from({ length: 7 }, () => ({ x: rand(80, W - 80), y: rand(80, H - 60), r: rand(26, 54) })) };
        return;
      }
      if (p.kind === 'caca') { popText(P.x + P.w / 2, P.y - 14, '¡QUÉ ASCO!', '#c89a5a'); Sound.sfx.splat(); }
      hurtPlayer(p); p.remove = true;
    }
  }
  function drawProj(p) {
    const names = { fuego: 'fuego', chancla: 'chancla_throw', caca: 'caca', pelo: 'pelo', ovillo: 'ovillo', onda: 'onda', tinta: 'tinta', golf: 'golf', zarpazo: 'zarpazo' };
    const speeds = { fuego: 3, chancla: 2, caca: 6, pelo: 3, ovillo: 4, onda: 4, tinta: 5, golf: 4, zarpazo: 4 };
    const a = elementSprites[names[p.kind]], im = a && a[Math.floor(p.t / speeds[p.kind]) % a.length];
    if (im) {
      const w = im.width / Z, h = im.height / Z, cx = rz(p.x + p.w / 2), cy = rz(p.y + p.h / 2);
      ctx.save(); ctx.translate(cx, cy); if (p.vx < 0) ctx.scale(-1, 1); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    }
    if (p.kind === 'ovillo') { const gy = groundYAt(Math.floor((p.x + 8) / T)); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 8, gy - 1, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  // ---------------------------------------------------------- JEFE FINAL: DON BIGOTES
  function makeBoss() {
    const A = L.arenaStart;
    const B = { x: (A + 14) * T, y: -140, w: 48, h: 88, vx: 0, vy: 0, face: -1, hp: D.bossHP, maxHp: D.bossHP, state: 'intro', st: 0, t: 0, inv: 0, flash: 0, onGround: false, quips: {} };
    B.hit = () => ({ x: B.x, y: B.y, w: B.w, h: B.h });
    return B;
  }
  function hitBoss(dmg) {
    const B = L.boss;
    if (!B || B.inv > 0 || B.state === 'defeat' || B.state === 'intro') return;
    B.hp -= dmg; B.inv = 26; B.flash = 12; L.shake = 8;
    Sound.sfx.hit(); Sound.sfx.meow(1.4);
    addFx('impacto', B.x + B.w / 2, B.y + 42, { bottom: false, scale: 0.9, face: B.face });
    parts(B.x + B.w / 2, B.y + 30, 14, ['#ffffff', '#ffe066', '#f08a24'], { sp: 4, up: 4 });
    popText(B.x + B.w / 2, B.y - 10, pick(HITWORDS), '#ffe066', 16);
    const r = B.hp / B.maxHp;
    const q = [[0.75, '¡Ay, mis bigotes!'], [0.5, '¡Esto no es justo! ¡Yo solo quería mimos!'], [0.25, '¡Nooo, que me despeino! ¡Y no me llames Machanguito!']];
    B.hits = (B.hits || 0) + 1;
    if (B.hits % 5 === 0 && B.hp > 0) bubble(P, fill(pick(['¡Qué daño, bro! ...pero para ti, {M}!', '¡Literalmente te estoy ganando!', '¡Toma, {M}!', '¡Chúpate esa, {M}!', '¡Eso por secuestrador, {M}!', '¡A dormir, Machín malo!', '¡Machuquito, estás perdiendo!']), G.C), 90);
    if (B.hp > 0) for (const [th, s] of q) if (r <= th && !B.quips[th]) { B.quips[th] = 1; bubble(B, s, 150); if (th === 0.5) presenterPop(10); }
    if (B.hp <= 0) {
      B.hp = 0; B.state = 'defeat'; B.st = 0; B.vx = 0; Sound.stop(); Sound.sfx.meow(0.7); L.shake = 20;
      L.projs = L.projs.filter(p => p.owner === 'p'); addScore(10000);
      popText(B.x + B.w / 2, B.y - 30, '¡K.O.! 10000', '#ffe066', 16);
      return;
    }
    if (B.state !== 'jump' && B.onGround) { B.state = 'hurt'; B.st = 20; B.vx = (B.x + B.w / 2 < P.x + P.w / 2 ? -2.5 : 2.5); }
  }
  function updateBoss() {
    const B = L.boss; if (!B) return;
    B.t++; if (B.inv > 0) B.inv--; if (B.flash > 0) B.flash--;
    const phase2 = B.hp <= B.maxHp / 2, sp = D.speed * (phase2 ? 1.3 : 1);
    const dx = (P.x + P.w / 2) - (B.x + B.w / 2), A = L.arenaStart;
    const face = () => { B.face = dx < 0 ? -1 : 1; };
    B.vy = Math.min(B.vy + 0.5, 10);
    switch (B.state) {
      case 'intro': if (B.onGround && B.st === 0) { B.st = 1; L.shake = 16; Sound.sfx.thud(); Sound.sfx.meow(); bubble(B, '¡Por fin nos vemos las caras! ¡Soy Machín Huerta, para los amigos Machuquito! ¡Mis siete vidas contra tus cinco!', 0, true); } else if (B.st >= 1 && !dialogueWait() && ++B.st > 40) { B.state = 'idle'; B.st = 40; Sound.play('boss'); } break;
      case 'idle':
        face(); B.vx = 0;
        if (--B.st <= 0) {
          const ad = Math.abs(dx), r = Math.random();
          if (ad < 100) B.state = r < 0.55 ? 'punch' : 'kick';
          else if (r < 0.3) B.state = 'walk';
          else if (r < 0.55) B.state = 'jump';
          else if (r < 0.8 || !phase2) B.state = 'hairball';
          else B.state = 'yarn';
          B.st = 0;
        }
        break;
      case 'walk':
        face(); B.vx = B.face * 1.7 * sp; B.st++;
        if (Math.abs(dx) < 90) { B.state = Math.random() < 0.5 ? 'punch' : 'kick'; B.st = 0; }
        else if (B.st > 70) { B.state = 'idle'; B.st = 20; }
        break;
      case 'punch': {
        B.vx = 0; B.st++;
        if (B.st === 10) { Sound.sfx.punch(); B.vx = B.face * 3; if (phase2 || G.diff === 'dificil') { L.projs.push({ kind: 'zarpazo', owner: 'e', x: B.x + B.w / 2 + B.face * 30, y: B.y + 30, w: 30, h: 40, vx: B.face * 4.5, t: 0, life: 70 }); } }
        if (B.st >= 10 && B.st <= 20) { const hb = { x: B.face > 0 ? B.x + B.w : B.x - 50, y: B.y + 20, w: 50, h: 40 }; if (overlap(hb, P)) hurtPlayer(B.hit()); }
        if (B.st > 34 / sp + 6) { B.state = 'idle'; B.st = phase2 ? 25 : 45; }
        break;
      }
      case 'kick': {
        B.vx = 0; B.st++;
        if (B.st === 12) { Sound.sfx.kick(); B.vx = B.face * 4; }
        if (B.st >= 12 && B.st <= 26) { const hb = { x: B.face > 0 ? B.x + B.w : B.x - 70, y: B.y + 40, w: 70, h: 40 }; if (overlap(hb, P)) hurtPlayer(B.hit()); }
        if (B.st > 40 / sp + 6) { B.state = 'idle'; B.st = phase2 ? 25 : 45; }
        break;
      }
      case 'jump':
        if (B.st === 0) { face(); B.vy = -12; B.vx = Math.max(-6, Math.min(6, dx / 50)); B.onGround = false; Sound.sfx.boing(); bubble(B, pick(['¡Salto gatuno!', '¡Miaaau!', '¡Aterrizaje felino!']), 60); }
        B.st++;
        if (B.st > 5 && B.onGround) {
          L.shake = 14; Sound.sfx.thud(); B.vx = 0;
          [-1, 1].forEach(d => L.projs.push({ kind: 'onda', owner: 'e', x: B.x + B.w / 2 + d * 30 - 8, y: B.y + B.h - 22, w: 16, h: 22, vx: d * 3.5 * sp, t: 0, life: 70 }));
          B.state = 'idle'; B.st = phase2 ? 30 : 55;
        }
        break;
      case 'hairball':
        face(); B.vx = 0; B.st++;
        if (B.st === 1) { Sound.sfx.hiss(); if (Math.random() < 0.5) bubble(B, pick(['¡Toma bola de pelo!', '¡Cof, cof... ¡PTUI!', '¡Regalito!']), 80); }
        { const n = phase2 ? 3 : (G.diff === 'facil' ? 1 : 2); for (let i = 0; i < n; i++) if (B.st === 20 + i * 14) {
          const tx = dx + rand(-40, 40), tt = 50;
          L.projs.push({ kind: 'pelo', owner: 'e', x: B.x + B.w / 2 + B.face * 20, y: B.y + 30, w: 14, h: 14, vx: tx / tt, vy: -7, g: 0.28, t: 0 }); Sound.sfx.throw();
        } }
        if (B.st > 70) { B.state = 'idle'; B.st = 40; }
        break;
      case 'yarn':
        B.vx = 0; B.st++;
        if (B.st === 1) { Sound.sfx.meow(1.2); bubble(B, '¡LLUVIA DE OVILLOS!', 90); }
        if (B.st % 14 === 0 && B.st < 100) L.projs.push({ kind: 'ovillo', owner: 'e', x: (A + 2) * T + Math.random() * 15 * T, y: -20, w: 16, h: 18, vx: 0, vy: 1, g: 0.18, t: 0 });
        if (B.st > 120) { B.state = 'idle'; B.st = 30; }
        break;
      case 'hurt':
        B.vx *= 0.85; if (--B.st <= 0) { B.state = Math.random() < 0.4 ? 'jump' : 'idle'; B.st = B.state === 'jump' ? 0 : 20; }
        break;
      case 'defeat':
        B.vx = 0; B.st++;
        if (B.st === 90) { G.state = 'ending'; G.t = 0; startEnding(); }
        break;
    }
    physX(B); physY(B);
    B.x = Math.max((A + 1) * T, Math.min((A + 18) * T - B.w, B.x));
    // contacto
    if (!P.dead && B.state !== 'defeat' && B.state !== 'intro' && B.state !== 'hurt' && overlap(P, B.hit())) {
      if (P.vy > 0 && P.y + P.h - P.vy <= B.y + 16) { P.vy = -10; hitBoss(2); Sound.sfx.stomp(); }
      else if (P.starT > 0) hitBoss(1);
      else hurtPlayer(B.hit());
    }
  }
  function bossFrame(B) {
    const st = B.state;
    if (st === 'defeat') return HURT[2];
    if (st === 'hurt') return B.st > 10 ? HURT[0] : HURT[1];
    if (st === 'intro') return B.onGround ? IDLE[0] : KICK[0];
    if (st === 'punch') return B.st < 10 ? PUNCH[0] : B.st < 16 ? PUNCH[1] : B.st < 24 ? PUNCH[2] : PUNCH[3];
    if (st === 'kick') return B.st < 12 ? KICK[0] : B.st < 19 ? KICK[1] : B.st < 28 ? KICK[2] : KICK[3];
    if (st === 'jump') return B.onGround ? KICK[3] : KICK[0];
    if (st === 'hairball') return B.st < 18 ? PUNCH[0] : PUNCH[1];
    if (st === 'yarn') return IDLE[2];
    if (st === 'walk') return IDLE[Math.floor(B.t / 7) % 4];
    return IDLE[Math.floor(B.t / 12) % 4];
  }
  function drawBoss() {
    const B = L.boss; if (!B) return;
    if (B.inv > 0 && B.state !== 'defeat' && B.t % 4 < 2 && !B.flash) return;
    drawChar('cat', bossFrame(B), B.x + B.w / 2, B.y + B.h, B.face, 1, B.flash && B.flash % 4 < 2 ? 'white' : null);
    if (B.state === 'defeat') for (let i = 0; i < 3; i++) { const a = B.t * 0.08 + i * 2.1; star(B.x + B.w / 2 + Math.cos(a) * 30, B.y + 50 + Math.sin(a) * 8); }
  }

  // ---------------------------------------------------------- ESCENAS (jaula, globo)
  // top = parte de arriba del cuerpo de la jaula (la argolla queda 16 unidades por encima)
  function drawCage(cx, top, who, frame, open = 0, o = {}) {
    const bottom = top + 78, fi = open >= 1 ? 4 : open > 0 ? 1 + Math.min(2, Math.floor(open * 3)) : 0;
    ctx.save();
    if (o.angle) { ctx.translate(cx, top - 16); ctx.rotate(o.angle); ctx.translate(-cx, -(top - 16)); }
    // la jaula entera detrás, el niño encima y otra vez los barrotes semitransparentes por delante:
    // a este tamaño los barrotes quedan casi opacos y taparían al niño
    drawChar('cage', fi, cx, bottom, 1, 1);
    if (who) {
      drawChar(who, frame, cx, bottom - 7, -1, 0.9);
      const a = ctx.globalAlpha; ctx.globalAlpha = a * 0.5;
      drawChar('cage', fi, cx, bottom, 1, 1);
      ctx.globalAlpha = a;
    }
    ctx.restore();
  }
  // Cartel de META y su sol/bandera animados: JPG con los cuadros de "transparencia" pintados.
  // Se borra el fondo claro conectado a los bordes (o a los bordes de cada celda) y las motas sueltas.
  function clearChecker(d, w, h, cell = 0) {
    const N = w * h, bg = new Uint8Array(N), st = [];
    const light = i => { const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; return Math.max(r, g, b) - Math.min(r, g, b) <= 30 && (r + g + b) / 3 >= 150; };
    for (let i = 0; i < w; i++) st.push(i, (h - 1) * w + i);
    for (let j = 0; j < h; j++) st.push(j * w, j * w + w - 1);
    if (cell) for (let gx = cell; gx < w; gx += cell) for (let j = 0; j < h; j++) st.push(j * w + gx);
    while (st.length) { const i = st.pop(); if (bg[i] || !light(i)) continue; bg[i] = 1; const X = i % w; if (X > 0) st.push(i - 1); if (X < w - 1) st.push(i + 1); if (i >= w) st.push(i - w); if (i < N - w) st.push(i + w); }
    return bg;
  }
  function dropSpecks(bg, w, h, min = 120) {
    const N = w * h, lab = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (bg[i] || lab[i]) continue;
      const comp = [i]; lab[i] = 1;
      for (let k = 0; k < comp.length; k++) { const j = comp[k], X = j % w; for (const n of [X > 0 ? j - 1 : -1, X < w - 1 ? j + 1 : -1, j - w, j + w]) if (n >= 0 && n < N && !bg[n] && !lab[n]) { lab[n] = 1; comp.push(n); } }
      if (comp.length < min) for (const j of comp) bg[j] = 1;
    }
  }
  function cleanCanvas(img, erase, cell) {
    const w = img.width, h = img.height, c = Art.canvas(w, h), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, w, h), d = id.data, bg = clearChecker(d, w, h, cell);
    if (erase) erase(d, bg, w);
    dropSpecks(bg, w, h);
    for (let i = 0; i < w * h; i++) if (bg[i]) d[i * 4 + 3] = 0;
    x.putImageData(id, 0, 0);
    return { c, bg, w, h };
  }
  // Recorta la caja [bx, by, bw, bh] ya limpia y la reduce a escala k. anchor(x0, y0, x1, y1) da el punto de apoyo en el original.
  function cutScaled(c, bg, w, bx, by, bw, bh, k, anchor) {
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let j = by; j < by + bh; j++) for (let i = bx; i < bx + bw; i++) if (!bg[j * w + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 < 0) return null;
    const [ax, ay] = anchor(x0, y0, x1, y1);
    const ow = Math.max(1, Math.round((x1 - x0 + 1) * k)), oh = Math.max(1, Math.round((y1 - y0 + 1) * k)), out = Art.canvas(ow, oh), o = out.getContext('2d');
    o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
    o.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, ow, oh);
    return { img: out, x0, y0, ox: Math.round((ax - x0) * k), oy: Math.round((ay - y0) * k) };
  }
  // media x de la tinta en las últimas filas: el poste / mástil
  const baseAnchor = (bg, w, rows) => (x0, y0, x1, y1) => {
    let sx = 0, sn = 0; for (let j = y1 - rows; j <= y1; j++) for (let i = x0; i <= x1; i++) if (!bg[j * w + i]) { sx += i; sn++; }
    return [sn ? sx / sn : (x0 + x1) / 2, y1];
  };
  const GOAL_K = 0.18; // 1024 px del original -> ~110 px en pantalla
  // Dónde estaban (en meta.jpg) el sol y el pie del mástil estáticos, que se sustituyen por los animados.
  const GOAL_SUN = [370, 261], GOAL_POLE = [648, 425]; // el pie del mástil queda tapado por el cartel
  let GOAL = null;
  const GOAL_FLAG = [], GOAL_SUNS = [];
  function buildGoalSign(img) {
    const { c, bg, w, h } = cleanCanvas(img, (d, bg, w) => {
      const gray = i => { const o = i * 4; return Math.max(d[o], d[o + 1], d[o + 2]) - Math.min(d[o], d[o + 1], d[o + 2]) < 25; };
      for (let y = 0; y < 400; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x < 465 && y < 345) bg[i] = 1; // sol
        else if (gray(i) && ((x >= 625 && x < 880 && y < 362) || (x >= 630 && x < 690 && y < 394))) bg[i] = 1; // bandera y mástil
      }
    });
    GOAL = cutScaled(c, bg, w, 0, 0, w, h, GOAL_K, baseAnchor(bg, w, 20));
  }
  function buildGoalFx(img) {
    // Hoja 4x4 de 256 px: filas 0-1 bandera (8 fases), filas 2-3 sol (8 pulsos). El rótulo inferior se ignora.
    const { c, bg, w } = cleanCanvas(img, null, 256), rows = [[0, 250], [250, 245], [495, 223], [718, 222]];
    for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
      const f = cutScaled(c, bg, w, col * 256, rows[r][0], 256, rows[r][1], r < 2 ? GOAL_K * 1.25 : GOAL_K, r < 2 ? baseAnchor(bg, w, 10) : (x0, y0, x1, y1) => [(x0 + x1) / 2, (y0 + y1) / 2]);
      if (f) (r < 2 ? GOAL_FLAG : GOAL_SUNS).push(f);
    }
  }
  // ax: x del poste en el mundo; gy: suelo
  function drawGoalSign(ax, gy) {
    const sx = Math.round(ax - GOAL.ox), sy = gy - GOAL.oy;
    const at = (p, f) => ctx.drawImage(f.img, Math.round(sx + (p[0] - GOAL.x0) * GOAL_K - f.ox), Math.round(sy + (p[1] - GOAL.y0) * GOAL_K - f.oy));
    if (GOAL_FLAG.length) at(GOAL_POLE, GOAL_FLAG[Math.floor(G.t / 6) % GOAL_FLAG.length]);
    ctx.drawImage(GOAL.img, sx, sy);
    if (GOAL_SUNS.length) at(GOAL_SUN, GOAL_SUNS[Math.floor(G.t / 8) % GOAL_SUNS.length]);
  }
  // Globo: hoja de sprites en JPG con fondo negro -> se recorta al cargar y se le redibuja el contorno
  let BAL = null;
  function buildBalloon(img) {
    const w = img.width, h = img.height, c = Art.canvas(w, h), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, w, h), d = id.data, N = w * h, bg = new Uint8Array(N);
    const dark = i => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < 52;
    const st = [];
    for (let i = 0; i < w; i++) st.push(i, (h - 1) * w + i);
    for (let j = 0; j < h; j++) st.push(j * w, j * w + w - 1);
    for (let gx = 1; gx < 4; gx++) for (let j = 0; j < h; j++) st.push(j * w + Math.round(gx * w / 4));
    for (let gy = 1; gy < 4; gy++) for (let i = 0; i < w; i++) st.push(Math.round(gy * h / 4) * w + i);
    while (st.length) { const i = st.pop(); if (bg[i] || !dark(i)) continue; bg[i] = 1; const X = i % w; if (X > 0) st.push(i - 1); if (X < w - 1) st.push(i + 1); if (i >= w) st.push(i - w); if (i < N - w) st.push(i + w); }
    // quita motas sueltas
    const lab = new Int32Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if (bg[i] || lab[i] >= 0) continue;
      const comp = [i]; lab[i] = i;
      for (let k = 0; k < comp.length; k++) { const j = comp[k], X = j % w; for (const n of [X > 0 ? j - 1 : -1, X < w - 1 ? j + 1 : -1, j - w, j + w]) if (n >= 0 && n < N && !bg[n] && lab[n] < 0) { lab[n] = i; comp.push(n); } }
      if (comp.length < 80) for (const j of comp) bg[j] = 1;
    }
    for (let i = 0; i < N; i++) {
      if (bg[i]) { d[i * 4 + 3] = 0; continue; }
      const X = i % w;
      if ((X > 0 && bg[i - 1]) || (X < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < N - w && bg[i + w])) { d[i * 4] = 27; d[i * 4 + 1] = 20; d[i * 4 + 2] = 38; }
    }
    x.putImageData(id, 0, 0);
    const frames = [];
    for (let cy = 0; cy < 4; cy++) for (let cx = 0; cx < 4; cx++) {
      const x0c = Math.round(cx * w / 4), x1c = Math.round((cx + 1) * w / 4), y0c = Math.round(cy * h / 4), y1c = Math.round((cy + 1) * h / 4);
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let j = y0c; j < y1c; j++) for (let i = x0c; i < x1c; i++) if (!bg[j * w + i]) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
      let sx = 0, sn = 0, bl = 1e9, br = -1; for (let j = y1 - 12; j <= y1; j++) for (let i = x0; i <= x1; i++) if (!bg[j * w + i]) { sx += i; sn++; if (i < bl) bl = i; if (i > br) br = i; }
      frames.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ax: sn ? sx / sn : (x0 + x1) / 2, bw: br - bl + 1 });
    }
    BAL = { c, f: frames, h0: frames[0].h };
  }
  const BAL_SWAY = [14, 13, 12, 13, 14, 10, 11, 10];
  // by = referencia del globo: el fondo de la cesta queda en by + 84
  function drawBalloon(bx, by, opts = {}) {
    const bb = by + 84;
    if (opts.cage) {
      const cx = opts.cageX === undefined ? bx : opts.cageX, ct = opts.cageTop === undefined ? by + 103 : opts.cageTop;
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - 8, bb - 2); ctx.lineTo(cx, ct - 16); ctx.moveTo(bx + 8, bb - 2); ctx.lineTo(cx, ct - 16); ctx.stroke();
      drawCage(cx, ct, opts.cage, CAGED[0], 0, { angle: (cx - bx) * 0.01 });
    }
    if (!BAL) return;
    const fi = opts.frame !== undefined ? opts.frame : BAL_SWAY[Math.floor(G.t / 12) % 8], f = BAL.f[fi], k = 128 / BAL.h0;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(BAL.c, f.x, f.y, f.w, f.h, bx - (f.ax - f.x) * k, bb - f.h * k, f.w * k, f.h * k);
    ctx.imageSmoothingEnabled = false;
    // el gato asoma por encima del borde de la cesta
    if (opts.cat !== undefined && opts.cat !== null) { ctx.save(); ctx.beginPath(); ctx.rect(bx - 120, bb - 160, 240, 160 - 128 * 0.22); ctx.clip(); drawChar('cat', opts.cat, bx - 2, bb - 4, -1, 0.42); ctx.restore(); }
  }
  // puerta de la cesta: 0 cerrada, 1-3 abriéndose, 4 abierta, 5-7 cerrándose
  function doorFrame(k) { return k < 0.08 ? 1 : k < 0.16 ? 2 : k < 0.24 ? 3 : k < 0.85 ? 4 : 5; }

  // ---------------------------------------------------------- CÁMARA Y RENDER DEL MUNDO
  function updateCamera() {
    let tx, ty;
    if (L.arenaLocked || L.boss) { tx = L.arenaStart * T + (19 * T - VW) / 2; ty = 88; }
    else if (L.miniFight === 'on') {
      tx = L.miniCol * T + (MINI_W * T - VW) / 2;
      ty = surfaceRow(L.miniCol + 1) * T - VH * 0.8;
    }
    else {
      tx = L.cs && L.catCol ? (P.x + L.catCol * T + 72) / 2 - VW / 2 + 10 : P.x + P.w / 2 - VW * 0.4 + P.face * 20;
      if (P.onGround || P.lastGY === undefined) P.lastGY = P.y + P.h;
      ty = L.cs ? 55 : Math.min(P.lastGY - VH * 0.74, P.y - 36);
    }
    L.camX += (tx - L.camX) * 0.12; L.camY += (ty - L.camY) * 0.08;
    L.camX = Math.max(0, Math.min(L.cols * T - VW, L.camX));
    L.camY = Math.max(0, Math.min(CAMY_MAX, L.camY));
  }
  const toScreen = (x, y) => ({ x: (x - L.camX) * Z, y: (y - L.camY) * Z });
  function shadow(cx, footY, w) {
    const c = Math.floor(cx / T); let gy = null;
    for (let r = Math.max(0, Math.floor((footY - 2) / T)); r < ROWS && r <= Math.floor(footY / T) + 7; r++) { const t = tileAt(c, r); if ((isSolidTile(t) || t === PLAT) && r * T >= footY - 2) { gy = r * T; break; } }
    if (gy === null) return;
    const d = gy - footY, a = Math.max(0, 0.34 - d / 220), k = Math.max(0.35, 1 - d / 160);
    if (a <= 0) return;
    ctx.fillStyle = 'rgba(20,10,30,' + a + ')'; ctx.beginPath(); ctx.ellipse(cx, gy + 1, w * k / 2, 3.2 * k, 0, 0, Math.PI * 2); ctx.fill();
  }
  // cosas tumbadas en el suelo: se pintan delante del terreno y hundidas un poco para no flotar
  const PROP_SINK = { lp_toalla: 0.6, so_bandera: 0.15 };
  function drawLevelProps(front) {
    for (const p of L.props || []) {
      if (!!PROP_SINK[p.kind] !== !!front) continue;
      const a = elementSprites[p.kind]; if (!a || !a.length) continue;
      const col = Math.floor(p.x / T), row = surfaceRow(col);
      if (row < 0) continue;
      const speed = p.kind === 'an_telesilla' ? 16 : 12;
      const frame = a.length > 1 ? Math.floor((G.t + p.phase) / speed) % a.length : 0, im = a[frame];
      const w = im.width / Z, h = im.height / Z, y = row * T + (PROP_SINK[p.kind] || 0) * T;
      ctx.drawImage(im, rz(p.x - w / 2), rz(y - h), w, h);
    }
  }
  function drawWorld() {
    const cam = L.camX, camY = L.camY, sx = L.shake > 0 ? rand(-L.shake, L.shake) / 2 / Z : 0, sy = L.shake > 0 ? rand(-L.shake, L.shake) / 2 / Z : 0;
    const vy = (CAMY_MAX - camY) * Z;
    if (L.photo) drawPhoto(L.photo, cam / Math.max(1, L.cols * T - VW), camY / CAMY_MAX);
    else { ctx.drawImage(L.sky, 0, 0); [0.1, 0.25, 0.5].forEach((p, i) => { const img = L.layers[i], off = -Math.round((cam * Z * p) % Art.BGW), oy = Math.round(vy * (0.12 + i * 0.12)); ctx.drawImage(img, off, oy); ctx.drawImage(img, off + Art.BGW, oy); }); }
    if (L.isFinal && L.boss && photos.guarida) {
      if (!LAIR) LAIR = scaledLair(photos.guarida);
      L.lairT = Math.min(1, (L.lairT || 0) + 0.02);
      ctx.save(); ctx.globalAlpha = L.lairT;
      const across = Math.max(0, Math.min(1, (P.x + P.w / 2 - L.arenaStart * T) / (18 * T)));
      drawPhoto(LAIR, across, 0);
      ctx.restore();
      L.lairTT = (L.lairTT || 0) + 1; if (L.lairTT < 150) { const a = Math.min(1, L.lairTT / 20, (150 - L.lairTT) / 20); txt('LA GUARIDA DE MACHÍN', W / 2, 54, { size: 16, align: 'center', col: '#ff6aff', alpha: a }); }
    }
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-cam + sx, -camY + sy); curZ = Z;
    // peligro del fondo de los fosos
    const hz = L.loc.hazard, t = G.t;
    const strip = { water: 'foso_agua', lava: 'foso_lava', ice: 'foso_hielo' }[hz], sa = strip && elementSprites[strip];
    if (sa && sa.length) {
      // agua y lava alternan fotogramas; el hielo solo se desliza despacio (sus fotogramas no encadenan)
      const im = hz === 'ice' ? sa[0] : sa[Math.floor(t / (hz === 'lava' ? 10 : 14)) % sa.length];
      const w = im.width / Z, h = im.height / Z, drift = (t * (hz === 'ice' ? 0.12 : 0.3)) % w;
      for (let x = Math.floor((cam - drift) / w) * w + drift - w; x < cam + VW + w; x += w) ctx.drawImage(im, Math.round(x), H + 2 - h, Math.ceil(w) + 1, h);
    } else if (hz !== 'void') {
      const cols = { water: ['#1a6ab8', '#3a9ae0', '#bfe8ff'], lava: ['#c02a10', '#ff6a1a', '#ffd040'], ice: ['#3a6a9a', '#6aa0d0', '#e0f4ff'] }[hz];
      ctx.fillStyle = cols[0]; ctx.fillRect(cam - 10, H - 22, VW + 20, 22);
      ctx.fillStyle = cols[1]; for (let x = cam - (cam % 32) - 32; x < cam + VW + 32; x += 32) ctx.fillRect(x + ((t >> 2) % 32), H - 22 + ((x / 32) % 2) * 2, 18, 2);
      ctx.fillStyle = cols[2]; for (let x = cam - (cam % 48) - 48; x < cam + VW + 48; x += 48) ctx.fillRect(x + 48 - ((t >> 1) % 48), H - 20, 6, 1.4);
    } else { const g = ctx.createLinearGradient(0, H - 60, 0, H); g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,0.8)'); ctx.fillStyle = g; ctx.fillRect(cam - 10, H - 60, VW + 20, 60); }
    // atrezo local, detrás del terreno y sin colisión
    drawLevelProps();
    // tiles
    const c0 = Math.max(0, Math.floor(cam / T) - 1), c1 = Math.min(L.cols - 1, Math.floor((cam + VW) / T) + 1), qf = Math.floor(G.t / 8) % 4, TS = Art.TS;
    for (let r = 0; r < ROWS; r++) for (let c = c0; c <= c1; c++) {
      const tt = L.tiles[r][c]; if (!tt) continue;
      let si = tt === TOP ? 0 : tt === FILL ? 1 : tt === BRICK ? 2 : tt === QBLOCK ? 3 + qf : tt === USED ? 7 : tt === PLAT ? 8 : 9;
      if (tt === TOP && r > 0 && isSolidTile(L.tiles[r - 1][c]) && L.tiles[r - 1][c] !== BLOCK) si = 1;
      let y = r * T; const b = L.bumps.find(b => b.c === c && b.r === r); if (b) y -= Math.sin(b.t / 10 * Math.PI) * 8;
      const custom = tt === BRICK ? elem('brick', b ? 1 : 0) : tt === QBLOCK ? elem('qblock', b ? 2 : (Math.floor(G.t / 18) % 2)) : tt === USED ? elem('qblock', 3) : null;
      if (custom) ctx.drawImage(custom, c * T, y, T, T); else ctx.drawImage(L.tileset, si * TS, 0, TS, TS, c * T, y, T, T);
      // sombra ambiental bajo salientes
      if ((tt === TOP || tt === FILL) && c > 0 && !isSolidTile(L.tiles[r][c - 1])) { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(c * T, y, 1, T); }
      if ((tt === TOP || tt === FILL) && c < L.cols - 1 && !isSolidTile(L.tiles[r][c + 1])) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(c * T + T - 2, y, 2, T); }
    }
    drawLevelProps(true);
    if (L.arenaLocked) {
      const gate = elem('reja');
      if (gate) {
        // las rejas caen desde arriba al cerrarse la arena y se apilan hasta el techo
        L.gateT = Math.min(1, (L.gateT || 0) + 0.04);
        const w = gate.width / Z, h = gate.height / Z, gy = groundYAt(L.arenaStart + 1), drop = (1 - L.gateT) * (1 - L.gateT) * gy;
        [L.arenaStart, L.arenaStart + 18].forEach(c => { for (let y = gy - drop; y > 0; y -= h) ctx.drawImage(gate, c * T + T / 2 - w / 2, y - h, w, h); });
      } else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; [L.arenaStart, L.arenaStart + 18].forEach(c => ctx.fillRect(c * T, 0, T, H)); }
    }
    // rejas de la arena del mini-jefe
    if (L.miniFight === 'on') {
      const gate = elem('reja'), gy = surfaceRow(L.miniCol + 1) * T, cs = [L.miniCol, L.miniCol + MINI_W - 1];
      L.gateMT = Math.min(1, (L.gateMT || 0) + 0.05);
      if (gate) { const w = gate.width / Z, h = gate.height / Z, drop = (1 - L.gateMT) * (1 - L.gateMT) * gy; cs.forEach(c => { for (let y = gy - drop; y > 0; y -= h) ctx.drawImage(gate, c * T + T / 2 - w / 2, y - h, w, h); }); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.15)'; cs.forEach(c => ctx.fillRect(c * T, 0, T, gy)); }
    }
    // bandera de control
    if (L.checkpointX) {
      const fx = L.checkpointX, gy = groundYAt(Math.floor(fx / T));
      const a = elementSprites['checkpoint_' + L.locIdx], fi = !L.checkpointHit ? 0 : (L.checkpointAnim || 0) < 18 ? 1 : 2, im = a && a[fi];
      // el reborde oscuro de la base se hunde 12 px de pantalla para que el aro apoye en el suelo
      if (im) { const w = im.width / Z, h = im.height / Z; ctx.drawImage(im, fx - w * 0.28, gy - h + 12 / Z, w, h); }
      else ctx.drawImage(Art.itemSprites.bandera, fx, L.checkpointHit ? gy - 72 : gy - 26, 16, 24);
    }
    if (!L.isFinal) drawGoalScene();
    if (L.isFinal) drawArenaCage();
    // sombras
    L.enemies.forEach(e => { if (e.active && !e.dead && !(e.ty.beh === 'popper' && e.hide > 0.5)) shadow(e.x + e.w / 2, e.y + e.h, e.w * 0.9); });
    if (L.boss && L.boss.state !== 'intro') shadow(L.boss.x + L.boss.w / 2, L.boss.y + L.boss.h, 56);
    if (!P.dead) shadow(P.x + P.w / 2, P.y + P.h, 26 * pScale());
    L.items.forEach(it => {
      const bob = it.state === 'static' ? Math.sin((G.t + it.x) * 0.05) * 1.5 : 0;
      const a = elementSprites[it.type], seq = a && a.length === 3 ? [0, 1, 2, 1] : null;
      const fi = it.state === 'sprout' || !a ? 0 : seq ? seq[Math.floor((G.t + it.id * 3) / 8) % seq.length] : Math.floor((G.t + it.id * 3) / 6) % a.length;
      const spr = a ? a[fi] : it.spr, iw = spr.width / Z, ih = spr.height / Z, ix = it.x + it.w / 2 - iw / 2, iy = it.y + it.h - ih;
      if (it.type === 'peseta' && it.state !== 'sprout') ctx.drawImage(spr, rz(ix), rz(iy + bob), iw, ih);
      else if (it.state === 'sprout') { ctx.save(); ctx.beginPath(); ctx.rect(it.x - 4, 0, it.w + 8, it.clipY); ctx.clip(); ctx.drawImage(it.spr, rz(it.x), rz(it.y), it.w, it.h); ctx.restore(); }
      else ctx.drawImage(spr, rz(ix), rz(iy + (it.vx ? 0 : Math.sin(G.t * 0.1) * 2)), iw, ih);
    });
    L.enemies.forEach(e => { if (e.active || e.dead) drawEnemy(e); });
    drawBoss();
    drawCameo();
    if (!P.hidden) drawPlayer();
    if (L.cs && L.cs.draw) L.cs.draw();
    L.projs.forEach(drawProj);
    L.fx.forEach(drawFx);
    L.parts.forEach(p => { ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.s * 0.75, p.s * 0.75); });
    ctx.restore(); curZ = 1;
    // velo frío del gazpacho (parpadea cuando está a punto de acabarse)
    if (L.freezeT > 0 && (L.freezeT > 90 || G.t % 20 < 12)) { ctx.fillStyle = 'rgba(150,215,255,0.16)'; ctx.fillRect(0, 0, W, H); }
    // textos y bocadillos en coordenadas de pantalla (nítidos)
    L.texts.forEach(tx => { const p = toScreen(tx.x, tx.y - Math.min(tx.t, 50) * 0.5); txt(tx.str, Math.max(tx.str.length * 4 + 4, Math.min(W - tx.str.length * 4 - 4, p.x)), Math.max(52, p.y), { col: tx.col, align: 'center', size: tx.size, alpha: Math.min(1, (tx.life - tx.t) / 25) }); });
    if (L.ink && elementSprites.tinta_mancha) {
      // las manchas aparecen de golpe (un pelín más grandes) y se desvanecen al final
      const a = Math.min(1, (L.ink.dur - L.ink.t) / 40) * 0.95, pop = 1 + Math.max(0, 1 - L.ink.t / 8) * 0.25;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      L.ink.blobs.forEach((b, i) => { const im = elem('tinta_mancha', i), s = b.r * 3.6 * pop / im.height; ctx.drawImage(im, b.x - im.width * s / 2, b.y - im.height * s / 2, im.width * s, im.height * s); });
      ctx.restore();
    } else if (L.ink) { const a = Math.min(1, (L.ink.dur - L.ink.t) / 40) * 0.92; ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = '#140c22'; for (const b of L.ink.blobs) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(b.x + Math.cos(k * 1.3) * b.r, b.y + Math.sin(k * 1.3) * b.r, b.r * 0.3, 0, Math.PI * 2); ctx.fill(); } } ctx.restore(); }
    L.bubbles.forEach(b => drawBubble(b));
    if (L.snow.length && !(L.lairT > 0.5)) { L.snow.forEach(s => { s.y += s.s; s.x += Math.sin((G.t + s.p * 50) * 0.02) * 0.4 - (L.camX - (L.prevCam || L.camX)) * Z * 0.3 * s.s; if (s.y > H) { s.y = -4; s.x = rand(0, W); } s.x = (s.x + W) % W; ctx.fillStyle = s.s > 1 ? '#ffffff' : '#dfeaff'; ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s > 1 ? 3 : 2, s.s > 1 ? 3 : 2); }); }
    L.prevCam = L.camX;
  }
  function bubbleAnchor(tg) {
    if (tg === P) return { x: P.x + P.w / 2, y: P.y - 18 * pScale() };
    if (L.boss && tg === L.boss) return { x: L.boss.x + L.boss.w / 2, y: L.boss.y - 24 };
    if (tg && tg.anchor) return tg.anchor();
    return { x: 0, y: 0 };
  }
  function drawBubble(b, z = Z) {
    const a0 = bubbleAnchor(b.target), a = { x: (a0.x - L.camX) * z, y: (a0.y - (L.camY || 0)) * z };
    const lines = wrap(b.text, 26), w = Math.max(...lines.map(l => l.length)) * 8 + 16, h = lines.length * 11 + 12;
    let x = Math.round(a.x - w / 2), y = Math.round(a.y - h - 10);
    x = Math.max(4, Math.min(W - w - 4, x)); y = Math.max(50, Math.min(H - h - 14, y));
    const pop = Math.min(1, b.t / 6);
    ctx.save(); ctx.translate(x + w / 2, y + h); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + h));
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 3, y + 3, w + 2, h + 2);
    ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#e4e4f0'; ctx.fillRect(x, y + h - 3, w, 3);
    const tx = Math.max(x + 8, Math.min(x + w - 14, a.x - 3));
    ctx.fillStyle = '#1b1426'; ctx.fillRect(tx - 2, y + h, 10, 8); ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, y + h, 6, 6);
    lines.forEach((l, i) => txt(l, x + 8, y + 7 + i * 11, { col: '#1b1426', sh: null }));
    if (b.hold && b.t > 30 && G.t % 40 < 26) { ctx.fillStyle = '#e03040'; for (let i = 0; i < 4; i++) ctx.fillRect(x + w - 14 + i, y + h - 9 + i, 7 - i * 2, 1); }
    ctx.restore();
  }
  // Cadena entre dos puntos: el sprite (vertical) se repite a lo largo; sin sprite, una línea.
  function drawChain(x0, y0, x1, y1) {
    const im = elem('cadena'), len = Math.hypot(x1 - x0, y1 - y0);
    if (!im) { ctx.strokeStyle = '#3a3a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); return; }
    const w = im.width / Z, h = im.height / Z;
    ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
    for (let s = 0; s < len; s += h) { const part = Math.min(h, len - s); ctx.drawImage(im, 0, 0, im.width, im.height * part / h, -w / 2, s, w, part); }
    ctx.restore();
  }
  function drawGoalScene() {
    const cx = L.catCol * T, gy = 12 * T;
    const cs = L.cs;
    const mx = (L.goalCol - 1) * T;
    if (GOAL) drawGoalSign(mx + 12, gy);
    else {
      ctx.fillStyle = '#6a4020'; ctx.fillRect(mx + 10, gy - 40, 4, 40); ctx.fillStyle = '#9a6a40'; ctx.fillRect(mx + 10, gy - 40, 1, 40);
      box(mx - 14, gy - 58, 52, 22, '#e03040', '#ffffff'); txt('META', mx + 12, gy - 51, { align: 'center' });
    }
    if (cs && cs.phase >= 2) return;
    shadow(cx, gy, 60);
    drawCage(cx - 64, gy - 78, G.captive, cagedFrame());
    drawChain(cx - 64, gy - 94, cx - 20, gy - 50);
    drawChar('cat', IDLE[Math.floor(G.t / 12) % 4], cx, gy, -1, 1);
  }
  function drawArenaCage() {
    const A = L.arenaStart, cx = (A + 16) * T;
    if (L.cageY === undefined) L.cageY = 96;
    drawChain(cx, 0, cx, L.cageY - 16);
    if (!L.freed) drawCage(cx, L.cageY, G.captive, cagedFrame(), L.cageOpen, { angle: L.cageOpen ? 0 : Math.sin(G.t * 0.04) * 0.06 });
    else drawCage(cx, L.cageY, null, 0, 1);
  }

  // ---------------------------------------------------------- HUD (estilo recreativa)
  function portrait(who, x, y, size, face = 1) {
    ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 2, y - 2, size + 4, size + 4);
    const g = ctx.createLinearGradient(0, y, 0, y + size); g.addColorStop(0, '#5a8ad8'); g.addColorStop(1, '#2a3a78'); ctx.fillStyle = g; ctx.fillRect(x, y, size, size);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    if (who === 'cat') drawChar('cat', IDLE[0], x + size / 2 - face * 4, y + size * 3.3, face, 1.35);
    else drawChar(who, IDLE[0], x + size / 2 - 2, y + size * 2.45, face, 1.55);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, size, 1); ctx.fillRect(x, y, 1, size);
  }
  function lifeBar(x, y, w, h, frac, segs, cols = ['#ffe066', '#ff9a2a']) {
    ctx.fillStyle = '#1b1426'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#5a1420'; ctx.fillRect(x, y, w, h);
    const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
    if (fw > 0) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]); ctx.fillStyle = g; ctx.fillRect(x, y, fw, h); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, y + 1, fw, 2); }
    ctx.fillStyle = '#1b1426'; if (segs > 1) for (let i = 1; i < segs; i++) ctx.fillRect(x + Math.round(w * i / segs) - 1, y, 2, h);
  }
  function drawHUD() {
    const g = ctx.createLinearGradient(0, 0, 0, 46); g.addColorStop(0, 'rgba(10,6,24,0.85)'); g.addColorStop(1, 'rgba(10,6,24,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 46); ctx.fillStyle = '#1b1426'; ctx.fillRect(0, 46, W, 2); ctx.fillStyle = '#ffe066'; ctx.fillRect(0, 45, W, 1);
    // jugador 1
    portrait(G.hero, 6, 5, 36);
    txt('1P', 48, 5, { col: '#ffe066' });
    txt(NAMES[G.hero], 70, 5, { col: '#ffffff' });
    txt('=' + G.lives, 70 + NAMES[G.hero].length * 8 + 6, 5, { col: '#8affff' });
    txt(String(G.score).padStart(7, '0'), 238, 5, { align: 'right' });
    const maxH = D.hearts + (P && P.hearts > D.hearts ? 1 : 0);
    lifeBar(50, 20, 188, 11, P ? P.hearts / maxH : 0, maxH);
    // objeto / poder
    ctx.fillStyle = '#1b1426'; ctx.fillRect(48, 35, 192, 10);
    let label = '', icon = null;
    if (P) {
      if (P.starT > 0) { label = 'TURRÓN ' + Math.ceil(P.starT / 60) + 's'; icon = 'turron'; }
      else if (P.weapon === 'chancla') { label = 'CHANCLA x' + P.ammo; icon = 'chancla'; }
      else if (P.weapon === 'churro') { label = 'CHURRO'; icon = 'churro'; }
      if (P.power === 'fire') label = (label ? label + ' + ' : '') + 'MOJO';
      else if (P.power === 'big') label = (label ? label + ' + ' : '') + 'BOCATA';
    }
    if (icon) { const im = Art.itemSprites[icon], k = 9 / im.height; ctx.drawImage(im, 52, 36, im.width * k, 9); }
    txt(label || 'PUÑOS', icon ? 80 : 52, 36, { col: label ? '#ffb060' : '#8a8aa8' });
    // comidas activas: fichas bajo el marcador
    if (P && L && G.state !== 'ending') {
      const chips = [];
      if (L.freezeT > 0) chips.push(['gazpacho', Math.ceil(L.freezeT / 60) + 's', '#9fe8f5']);
      if (P.shield > 0) chips.push(['paella', 'x' + P.shield, '#ffd23f']);
      if (P.cocido) chips.push(['cocido', '2 SALTOS', '#f5dcb0']);
      if (P.fastT > 0) chips.push(['cafe', Math.ceil(P.fastT / 60) + 's', '#c89a5a']);
      // en columna a la izquierda, para no chocar con los carteles del centro
      chips.forEach(([ic, s, col], i) => {
        const w = 22 + s.length * 8, y = 50 + i * 18;
        ctx.fillStyle = 'rgba(10,6,24,0.7)'; ctx.fillRect(6, y, w, 16);
        const im = elem(ic) || Art.itemSprites[ic], k = Math.min(16 / im.width, 12 / im.height);
        ctx.drawImage(im, 9 + (16 - im.width * k) / 2, y + 2 + (12 - im.height * k) / 2, im.width * k, im.height * k);
        txt(s, 26, y + 4, { col });
      });
    }
    // centro: récord y tiempo
    txt('HI ' + String(Math.max(G.hi, G.score)).padStart(7, '0'), W / 2, 4, { align: 'center', col: '#ff6a6a' });
    const secs = L ? Math.ceil(L.timeLeft / 60) : 0, hurry = secs <= 30 && G.t % 30 < 15;
    txt('TIME', W / 2, 15, { align: 'center', col: '#c8c8e0' });
    txt(String(secs).padStart(3, '0'), W / 2, 25, { align: 'center', size: 16, col: hurry ? '#ff4a4a' : '#ffe066', sh: '#7a2a10' });
    // derecha: jefe o nivel
    if (L && L.boss && L.boss.state !== 'intro' && G.state !== 'ending') {
      const B = L.boss;
      portrait('cat', W - 42, 5, 36, -1);
      txt(CAT_NAME, W - 50, 5, { align: 'right', col: '#ffb060' });
      txt('JEFE', W - 50, 36, { align: 'right', col: '#ff6a6a' });
      lifeBar(W - 50 - 190, 20, 190, 11, B.hp / B.maxHp, 1, ['#ff8a5a', '#c01e2e']);
    } else if (L && L.miniFight === 'on') {
      const m = L.mini, f = SPRITE_FRAMES['en_' + m.kind][m.hd.idle[0]], k = Math.min(34 / (f[2] / RES), 34 / (f[3] / RES));
      ctx.fillStyle = '#1b1426'; ctx.fillRect(W - 44, 3, 40, 40);
      const g2 = ctx.createLinearGradient(0, 5, 0, 41); g2.addColorStop(0, '#d85a5a'); g2.addColorStop(1, '#6a1a2a'); ctx.fillStyle = g2; ctx.fillRect(W - 42, 5, 36, 36);
      drawHDFrame(m.kind, m.hd.idle[0], W - 24, 39, -1, { scale: k });
      txt('MINI-JEFE', W - 50, 5, { align: 'right', col: '#ff6a6a' });
      txt(m.mini.name, W - 50, 36, { align: 'right', col: '#ffb060' });
      lifeBar(W - 50 - 190, 20, 190, 11, m.hp / m.maxHp, 1, ['#ff8a5a', '#c01e2e']);
    } else {
      ctx.drawImage(Art.itemSprites.peseta, W - 44, 6, 12, 12);
      txt('x' + String(G.pesetas).padStart(3, '0'), W - 28, 8, { col: '#ffe066' });
      txt(L ? L.loc.short.toUpperCase() : '', W - 8, 22, { align: 'right', col: '#ffffff' });
      txt('NIVEL ' + (G.levelIdx + 1) + '/' + LOCATIONS.length, W - 8, 34, { align: 'right', col: '#8a8aa8' });
    }
    if (L && L.pres && (G.state === 'play' || G.state === 'cutscene' || G.state === 'ending')) { const p = L.pres; p.t++; const out = p.dur - p.t; drawPresenter(p.idx, 10, H - 124, 96, { t: Math.min(p.t, out) }); if (p.t >= p.dur) L.pres = null; }
    if (L && L.banner && (G.state === 'play' || G.state === 'cutscene')) {
      const b = L.banner, a = Math.min(1, b.t / 8, (b.dur - b.t) / 20), lines = wrap(b.desc, 44), bw = 440, bh = 34 + lines.length * 12, x = W / 2 - bw / 2, y = 54;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      glassBox(x, y, bw, bh, true, { fill: 'rgba(42,31,69,0.6)' });
      const im = elem(b.icon) || Art.itemSprites[b.icon]; if (im) { const k = Math.min(40 / im.width, 32 / im.height); ctx.drawImage(im, x + 10 + (40 - im.width * k) / 2, y + (bh - im.height * k) / 2, im.width * k, im.height * k); }
      txt(b.title, x + 60, y + 10, { col: '#ffe066' });
      lines.forEach((l, i) => txt(l, x + 60, y + 26 + i * 12, { col: '#ffffff' }));
      ctx.restore();
    }
    const pm = Input.padMsg; if (pm) txt(pm, W / 2, 56, { align: 'center', col: '#8affff' });
  }

  // ---------------------------------------------------------- FLUJO DE PARTIDA
  function currentMusic() { if (L && ((L.boss && L.boss.state !== 'intro' && L.boss.state !== 'defeat') || L.miniFight === 'on')) return 'boss'; return L ? L.loc.music : 'title'; }
  function saveHi() { if (G.score > G.hi) { G.hi = G.score; try { localStorage.setItem('suelta-gato-hi', String(G.hi)); } catch (e) {} } }
  function startGame() {
    D = DIFFICULTY[G.diff]; G.lives = 5; G.score = 0; G.pesetas = 0; G.levelIdx = 0;
    startStory();
  }
  function startLevelIntro() { G.state = 'intro'; G.t = 0; loadLevel(G.levelIdx); Sound.stop(); Sound.sfx.confirm(); }
  function beginPlay() { G.state = 'play'; G.t = 0; Sound.play(L.loc.music); bubble(P, fill(pick(['¡Vamos, bro!', '¡Esto va a ser literalmente épico!', '¡Por la carísima que te pillo, {M}!', '¡Six seven! ¡A por él!', '¡Allá voy, {C}!']), G.C), 0); }

  function updatePlay() {
    if (Input.pressed('start') || Input.pressed('back')) { G.state = 'pause'; G.menu = 0; Sound.sfx.pause(); Sound.duck(true); return; }
    L.time++;
    const frozen = L.freezeT > 0;
    if (frozen && --L.freezeT === 0) { Sound.sfx.select(); popText(P.x + P.w / 2, P.y - 20, '¡SE DESCONGELAN!', '#9fe8f5'); }
    if (!P.dead && !L.cs && L.boss?.state !== 'defeat' && !frozen) {
      L.timeLeft--;
      if (L.timeLeft === 30 * 60) { Sound.sfx.hurt(); popText(P.x + P.w / 2, P.y - 30, '¡DATE PRISA!', '#ff6a6a'); }
      if (L.timeLeft <= 0) { L.timeLeft = 0; popText(P.x + P.w / 2, P.y - 30, '¡SE ACABÓ EL TIEMPO!', '#ff6a6a'); killPlayer(); }
    }
    updatePlayer();
    // el gazpacho congela bichos, sus proyectiles y a Machín de paso (los jefes no se inmutan)
    L.enemies.forEach(e => { if (!frozen || e.dead || e.mini) updateEnemy(e); });
    updateBoss();
    if (!frozen) updateCameo();
    L.items.forEach(updateItem);
    L.projs.forEach(p => { if (!frozen || p.owner === 'p') updateProj(p); });
    updateCommon();
    // Machín de paso
    if (!L.cameo && L.cameoAt.length && !P.dead && P.x > L.cameoAt[0] * T && startCameo(L.cameoAt.length === 1)) L.cameoAt.shift();
    // mini-jefe: al entrar en su arena se cierran las rejas
    if (L.mini && !L.miniFight && !P.dead && P.x > (L.miniCol + 2) * T) startMiniFight();
    if (L.miniMusicT > 0 && --L.miniMusicT === 0 && P.starT <= 0) Sound.play(currentMusic());
    if (L.miniHintT > 0 && --L.miniHintT === 0 && L.miniFight === 'on') showBanner('bandera', L.mini.mini.name, L.mini.mini.hint);
    // puntos de control y meta
    if (L.checkpointX && !L.checkpointHit && P.x + P.w > L.checkpointX) { L.checkpointHit = true; L.checkpointAnim = 1; Sound.sfx.checkpoint(); popText(L.checkpointX, P.y - 20, '¡PUNTO DE CONTROL!', '#8aff8a'); presenterPop(8); }
    if (!L.isFinal && !P.dead && P.x + P.w > L.goalCol * T) startGoalCutscene();
    if (L.isFinal && !L.boss && !P.dead && P.x > (L.arenaStart + 2) * T) {
      L.arenaLocked = true; L.boss = makeBoss(); L.timeLeft += 120 * 60; Sound.stop(); Sound.sfx.meow(); presenterPop(13, 220);
      bubble(P, fill('¡Suelta a {C} ahora mismo, {M}!', G.C), 120);
    }
    if (!L.isFinal && !L.cs && !P.dead && L.catCol && Math.abs(P.x - L.catCol * T) < 420 && L.catTauntT-- <= 0) {
      L.catTauntT = 400;
      bubble({ anchor: () => ({ x: L.catCol * T, y: 12 * T - 110 }) }, fill(pick(CAT_TAUNTS), G.C).replace('{A}', G.hero === 'boy' ? 'o' : 'a'), 120);
      Sound.sfx.meow(1.2);
    }
  }
  function updateCommon() {
    L.parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; });
    L.parts = L.parts.filter(p => p.life > 0);
    L.fx.forEach(f => f.t++); L.fx = L.fx.filter(f => f.t < f.life);
    if (L.checkpointAnim) L.checkpointAnim++;
    L.texts.forEach(t => t.t++); L.texts = L.texts.filter(t => t.t < t.life);
    if (L.banner && ++L.banner.t >= L.banner.dur) L.banner = null;
    L.bubbles.forEach(b => b.t++); L.bubbles = L.bubbles.filter(b => b.t < b.dur);
    L.bumps.forEach(b => b.t--); L.bumps = L.bumps.filter(b => b.t > 0);
    L.enemies = L.enemies.filter(e => !e.remove); L.items = L.items.filter(i => !i.remove); L.projs = L.projs.filter(p => !p.remove);
    if (L.ink && ++L.ink.t >= L.ink.dur) L.ink = null;
    if (L.shake > 0) L.shake *= 0.85; if (L.shake < 0.5) L.shake = 0;
    updateCamera();
  }

  const PLAYER_TAUNTS = [
    '¡{M}, eres literalmente lo peor!', '¡Bro, suelta a {C} ya!', '¡Por la carísima que te pillo, {M}!', '¡Six seven, {M}! ¡SIX SEVEN!', '¡Qué daño me haces, bro! ¡Devuélveme a {C}!',
    '¡Suelta a {C}, gato pulgoso!', '¡Vuelve aquí, bola de pelo!', '¡Devuélveme a {C}, {M}!', '¡{M}, eres un gato sarnoso!',
    '¡Te voy a dejar sin bigotes, {M}!', '¡Espérate, {M}, saco de pulgas!', '¡{M}, cara de ovillo!', '¡Baja de ahí, {M}, bigotes de escoba!',
    '¡{M}, que te conozco! ¡Suelta a {C}!', '¡Gato apestoso! ¡Te vas a enterar, {M}!', '¡{M}, eres más feo que un pie!', '¡Como te pille, {M}, te baño con champú!',
  ];
  const CAPTIVE_LINES = [
    '¡Bro, sácame de aquí, literalmente!', '¡Por la carísima, date prisa!', '¡{M} dice six seven cada cinco minutos!',
    '¡{M} ronca como una moto!', '¡{M} no se ha lavado las patas en un año!', '¡Date prisa, que {M} me quiere cantar una nana!',
    '¡Sácame de aquí! ¡{M} huele a lata de atún!', '¡{M} me ha robado el bocadillo!', '¡Me ha dicho que le llame Machín Huerta, que suena más elegante!',
  ];
  const CAT_TAUNTS = [
    '¡Six seveeen! ¡Miau!', '¡Soy literalmente el mejor gato del mundo!', '¡Bro, no me pillas ni en sueños!',
    '¡Ven a por mí si te atreves!', '¡Ja! ¡No me pillas!', '¡Soy {M} y nadie me pilla!', '¡Llámame Machingán, el gato más rápido del oeste!',
    '¡Miau, miau! ¡Qué lent{A}!', '¡Machanguito siempre gana!',
  ];
  // --- Machín de paso: aparece en mitad del nivel, se burla, ataca y huye.
  // Si le das antes de que se vaya, suelta pesetas.
  const CAMEO_HI = ['¡Cucú! ¡Soy {M}! ¿Me buscabas?', '¡{C} está conmigo comiendo pipas! ¡Ñam!', '¡Six seven! ¡Miau! ¡No me pillas!', '¡Mis bichos te van a dar una paliza!', '¡Qué lento vas, bro! ¡Así no me pillas!'];
  const CAMEO_BIG = '¡Más adelante te espera un amigo MUY grande! ¡Miau, miau!';
  const CAMEO_OUCH = ['¡MIAU! ¡Eso no vale!', '¡Ay, mi cola!', '¡Me chivo a mi mamá!', '¡Mis bigotes! ¡Me largo!'];
  function startCameo(last) {
    // busca un trozo de suelo llano delante del jugador para aterrizar
    const want = Math.floor((P.x + 210) / T);
    let col = -1;
    for (let d = 0; d < 6 && col < 0; d++) for (const c of [want + d, want - d]) { const r = surfaceRow(c); if (r >= 0 && surfaceRow(c - 1) === r && surfaceRow(c + 1) === r) { col = c; break; } }
    if (col < 0) return false;
    const gy = surfaceRow(col) * T;
    const K = L.cameo = { t: 0, state: 'enter', x0: L.camX + VW + 40, y0: gy - 140, tx: (col + 0.5) * T, gy, x: L.camX + VW + 40, y: gy - 140, face: -1, flash: 0,
      attack: pick(['pelo', 'ovillo']), line: last && L.mini ? CAMEO_BIG : fill(pick(CAMEO_HI), G.C) };
    K.anchor = () => ({ x: K.x, y: K.y - 100 });
    K.box = () => ({ x: K.x - 22, y: K.y - 84, w: 44, h: 84 });
    Sound.sfx.meow(1.2);
    return true;
  }
  function cameoHit(K) {
    if (K.state === 'ouch' || K.state === 'leave') return;
    K.state = 'ouch'; K.t = 0; K.flash = 14; L.shake = 8;
    Sound.sfx.hit(); Sound.sfx.meow(1.5);
    addFx('impacto', K.x, K.y - 50, { bottom: false, scale: 0.8, face: K.face });
    parts(K.x, K.y - 50, 14, ['#ffffff', '#ffe066', '#f08a24'], { sp: 4, up: 4 });
    addScore(1000); popText(K.x, K.y - 30, '¡TOCADO! 1000', '#ffe066', 16);
    bubble(K, pick(CAMEO_OUCH), 90);
    for (let i = 0; i < 5; i++) L.items.push(makeItem('peseta', K.x - 34 + i * 14, K.y - 40 - (i % 2) * 14, true));
  }
  function updateCameo() {
    const K = L.cameo; if (!K) return;
    K.t++; if (K.flash > 0) K.flash--;
    const dx = P.x + P.w / 2 - K.x;
    if (K.state === 'enter') {
      const k = Math.min(1, K.t / 40);
      K.x = K.x0 + (K.tx - K.x0) * k; K.y = K.y0 + (K.gy - K.y0) * k - Math.sin(k * Math.PI) * 60;
      if (k >= 1) { K.state = 'taunt'; K.t = 0; Sound.sfx.thud(); addFx('polvo', K.x, K.y, { scale: 0.9 }); bubble(K, K.line, 130); }
    } else if (K.state === 'taunt' || K.state === 'attack') {
      K.face = dx < 0 ? -1 : 1;
      if (Math.abs(dx) < 56 && Math.abs(P.y + P.h - K.y) < 60) { K.state = 'leave'; K.t = 0; bubble(K, '¡Uy, que me pilla! ¡Patitas pa qué os quiero!', 90); }
      else if (K.state === 'taunt' && K.t > 80) { K.state = 'attack'; K.t = 0; Sound.sfx.hiss(); }
      else if (K.state === 'attack') {
        if (K.attack === 'pelo' && (K.t === 12 || K.t === 34)) {
          const tt = 45; L.projs.push({ kind: 'pelo', owner: 'e', x: K.x + K.face * 16 - 7, y: K.y - 60, w: 14, h: 14, vx: (dx + rand(-20, 20)) / tt, vy: -6, g: 0.27, t: 0 }); Sound.sfx.throw();
        }
        if (K.attack === 'ovillo' && K.t % 16 === 0 && K.t <= 48) { L.projs.push({ kind: 'ovillo', owner: 'e', x: P.x + P.w / 2 + rand(-90, 90), y: L.camY - 20, w: 16, h: 18, vx: 0, vy: 1, g: 0.18, t: 0 }); if (K.t === 16) bubble(K, '¡Lluvia de ovillos!', 70); }
        if (K.t > 75) { K.state = 'leave'; K.t = 0; bubble(K, pick(['¡Adiós, pringad' + (G.hero === 'boy' ? 'o' : 'a') + '!', '¡Hasta luego, Lucas!', '¡JA, JA, JA! ¡Nos vemos!']), 90); Sound.sfx.boing(); }
      }
    } else if (K.state === 'ouch') {
      if (K.t > 28) { K.state = 'leave'; K.t = 0; Sound.sfx.boing(); }
    } else if (K.state === 'leave') {
      // huye a grandes saltos (sin atravesar el suelo) más rápido que el jugador hasta salir de la pantalla
      K.face = 1; K.x += 8;
      K.vy = K.t === 1 ? -9 : (K.vy || 0) + 0.45; K.y += K.vy;
      if (K.y >= K.gy) { K.y = K.gy; K.vy = -7; }
      if (K.x > L.camX + VW + 60 || K.t > 300) { L.cameo = null; L.bubbles = L.bubbles.filter(b => b.target !== K); }
      return;
    }
    // los golpes le hacen soltar pesetas
    if (K.state === 'enter') return;
    const b = K.box(), ab = attackBox();
    if (ab && overlap(ab, b)) { cameoHit(K); return; }
    for (const p of L.projs) if (p.owner === 'p' && !p.remove && overlap(p, b)) { p.remove = true; cameoHit(K); return; }
    if (!P.dead && P.vy > 0 && overlap(P, b) && P.y + P.h - P.vy <= b.y + 14) { P.vy = -9; Sound.sfx.stomp(); cameoHit(K); }
  }
  function drawCameo() {
    const K = L.cameo; if (!K) return;
    const f = K.state === 'enter' || K.state === 'leave' ? KICK[0] : K.state === 'ouch' ? HURT[K.t < 14 ? 0 : 1]
      : K.state === 'attack' ? (K.attack === 'pelo' ? (K.t % 22 < 10 ? PUNCH[0] : PUNCH[1]) : IDLE[2]) : IDLE[Math.floor(G.t / 12) % 4];
    if (K.state !== 'enter' && K.state !== 'leave') shadow(K.x, K.y, 50);
    drawChar('cat', f, K.x, K.y, K.face, 1, K.flash && K.flash % 4 < 2 ? 'white' : null);
  }

  // --- escena de meta: el gato se escapa en globo
  function startGoalCutscene() {
    G.state = 'cutscene'; Sound.stop(); Sound.sfx.meow();
    P.act = null; P.auto = 1; P.lock = true; P.inv = 0; P.hurtT = 0;
    const cx = L.catCol * T, gy = 12 * T, next = LOCATIONS[G.levelIdx + 1];
    L.enemies.forEach(e => { if (!e.dead && Math.abs(e.x - P.x) < 700) killEnemy(e, 'hit'); });
    L.cameo = null;
    L.projs = [];
    const cs = L.cs = { t: 0, phase: 0, catX: cx, catY: gy, bx: cx + 72, by: -140, cageX: cx - 64, cageTop: gy - 78 };
    const catT = { anchor: () => ({ x: cs.catX, y: cs.catY - 110 }) }, capT = { anchor: () => ({ x: cs.cageX, y: cs.cageTop - 12 }) };
    cs.script = [
      [20, () => bubble(catT, fill(L.loc.cat, G.C), 0, true)],
      [40, () => bubble(capT, Math.random() < 0.5 ? L.loc.help : fill(pick(CAPTIVE_LINES), G.C), 0, true)],
      [60, () => bubble(P, fill(pick(PLAYER_TAUNTS), G.C), 0, true)],
      [80, () => { cs.phase = 2; Sound.sfx.balloon(); }],
      [170, () => { cs.phase = 3; Sound.sfx.boing(); }],
      [220, () => { cs.phase = 4; Sound.sfx.meow(1.3); bubble({ anchor: () => ({ x: cs.bx, y: cs.by - 50 }) }, pick(['¡JA, JA, JA! ¡Nos vemos en ', '¡Adiós, pringad' + (G.hero === 'boy' ? 'o' : 'a') + '! ¡Machingán se va a ', '¡Chao! ¡Machanguito vuela a ']) + (next ? next.short : 'la nieve') + '!', 0, true); }],
      [380, () => { startClear(); }],
    ];
    cs.draw = () => {
      if (cs.phase < 2) return;
      if (cs.phase === 2 || cs.phase === 3) {
        drawBalloon(cs.bx, cs.by, { frame: cs.phase === 3 ? doorFrame((cs.t - 170) / 50) : 0 });
        drawCage(cs.cageX, cs.cageTop, G.captive, CAGED[1]);
        const k = cs.phase === 3 ? Math.min(1, (cs.t - 170) / 50) : 0;
        drawChar('cat', cs.phase === 3 ? KICK[0] : IDLE[Math.floor(G.t / 12) % 4], cs.catX, cs.catY, -1, 1 - 0.5 * k);
      } else { cs.p4 = (cs.p4 || 0) + 1; drawBalloon(cs.bx, cs.by, { frame: cs.p4 < 10 ? 6 : cs.p4 < 20 ? 7 : undefined, cat: IDLE[Math.floor(G.t / 10) % 4], cage: G.captive, cageX: cs.bx + Math.sin(cs.p4 * 0.05) * 6, cageTop: Math.min(cs.by + 103, 12 * T - 78) }); }
    };
  }
  function updateCutscene() {
    const cs = L.cs;
    const waiting = dialogueWait();
    if (!waiting) { cs.t++; for (const [at, fn] of cs.script) if (cs.t === at) fn(); }
    if (P.auto && P.x + P.w / 2 >= (L.goalCol + 2) * T) { P.auto = 0; P.face = 1; }
    if (cs.phase === 2) { cs.by = Math.min(12 * T - 158, cs.by + 3); }
    if (cs.phase === 3) { const k2 = Math.min(1, (cs.t - 170) / 50), gy = 12 * T; cs.catX = L.catCol * T + (cs.bx - L.catCol * T) * k2; cs.catY = gy + ((cs.by + 146 * BK) - gy) * k2 - Math.sin(k2 * Math.PI) * 80; cs.cageX += (cs.bx - cs.cageX) * 0.08; cs.cageTop += (Math.min(cs.by + 103, 12 * T - 78) - cs.cageTop) * 0.08; }
    if (cs.phase === 4 && !waiting) { cs.by -= 1.1; cs.bx += 0.8; }
    updatePlayer(); updateCommon();
    L.items.forEach(updateItem);
    L.enemies.forEach(e => { if (e.dead) updateEnemy(e); });
  }
  function startClear() {
    G.state = 'clear'; G.t = 0; L.pres = null;
    const secs = Math.floor(L.time / 60);
    L.bonus = { time: Math.floor(L.timeLeft / 60) * 20, hearts: P.hearts * 500, kills: L.kills, coins: L.coinsGot, secs };
    L.bonusPaid = 0; L.bonusTotal = L.bonus.time + L.bonus.hearts;
    Sound.sfx.clear();
  }
  function updateClear() {
    G.t++;
    if (G.t > 90 && L.bonusPaid < L.bonusTotal) { const step = Math.min(L.bonusTotal - L.bonusPaid, 100); L.bonusPaid += step; G.score += step; if (G.t % 3 === 0) Sound.sfx.tally(); }
    if ((G.t > 150 && Input.confirm()) || G.t > 900) { G.score += L.bonusTotal - L.bonusPaid; L.bonusPaid = L.bonusTotal; G.levelIdx++; saveHi(); startLevelIntro(); }
  }

  // --- final
  function startEnding() {
    Sound.play('ending');
    L.projs = []; L.endT = 0; P.act = null; P.vx = 0; P.hurtT = 0; P.inv = 0; P.starT = 0;
    const A = L.arenaStart;
    L.freedX = (A + 16) * T;
  }
  function updateEnding() {
    G.t++; if (!dialogueWait()) L.endT++;
    const e = L.endT, B = L.boss, A = L.arenaStart, gy = 12 * T;
    if (L.cageY < gy - 78) L.cageY = Math.min(gy - 78, L.cageY + 2);
    else if (!L.freed && (L.cageOpen = Math.min(1, (L.cageOpen || 0) + 0.02)) >= 1) { L.freed = true; Sound.sfx.power(); parts(L.freedX, gy - 40, 30, ['#ffe066', '#ffffff', '#ff8ab0'], { sp: 4, up: 5 }); L.capX = L.freedX; }
    if (L.freed) {
      const target = P.x + P.w / 2 + 50;
      if (L.capX > target) L.capX -= 1.6;
    }
    if (e === 60) bubble(B, 'Miau... vale, vale. Machanguito se rinde. Me vuelvo a mi arenero...', 0, true);
    if (e === 300) bubble({ anchor: () => ({ x: L.capX, y: gy - 80 }) }, '¡Gracias! ¡Sabía que vendrías a por mí!', 0, true);
    if (e === 500) bubble(P, fill('¡Vámonos a casa! Y tú, {M}... ¡castigado sin croquetas!', G.C), 0, true);
    if (e === 180) presenterPop(9, 240);
    if (e > 300 && e % 50 === 0) { parts(P.x + P.w / 2, P.y, 6, ['#ff4a8a', '#ff8ab0'], { sp: 1, up: 3, g: -0.02, life: 50 }); }
    if (e > 700 && Input.confirm()) { saveHi(); G.state = 'title'; G.t = 0; G.menu = 0; Sound.play('title'); }
    P.vy = Math.min(P.vy + 0.45, 9); physY(P);
    if (e > 330 && e < 700 && P.onGround && e % 40 === 0) { P.vy = -6; Sound.sfx.jump(); }
    updateCommon();
  }
  function drawEnding() {
    const gy = 12 * T, e = L.endT;
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-L.camX, -L.camY); curZ = Z;
    if (L.freed) {
      const jump = e > 330 && e < 700 ? Math.abs(Math.sin(e * 0.08)) * 18 : 0;
      const walking = L.capX > P.x + P.w / 2 + 51; drawChar(G.captive, walking ? WALK[Math.floor(e / 5) % 8] : e > 300 ? (jump > 2 ? WIN[1] : winFrame(e)) : IDLE[Math.floor(e / 12) % 4], L.capX, gy - jump, -1, 1);
    }
    ctx.restore(); curZ = 1;
    if (e > 620) {
      const a = Math.min(1, (e - 620) / 60);
      ctx.fillStyle = `rgba(12,8,24,${0.75 * a})`; ctx.fillRect(0, 0, W, H);
      txt('¡FIN!', W / 2, 60, { size: 32, col: '#ffe066', align: 'center', alpha: a });
      txt(fill('¡{C} ha sido ' + G.rescued + '!', G.C), W / 2, 110, { size: 16, align: 'center', alpha: a });
      txt(CAT + ' ha aprendido la lección... por ahora.', W / 2, 142, { align: 'center', col: '#c8c8e0', alpha: a });
      txt('PUNTUACIÓN: ' + G.score, W / 2, 180, { size: 16, align: 'center', col: '#8affff', alpha: a });
      txt('PESETAS: ' + G.pesetas + '    DIFICULTAD: ' + D.name, W / 2, 210, { align: 'center', alpha: a });
      txt(G.score >= G.hi ? '¡NUEVO RÉCORD!' : 'RÉCORD: ' + G.hi, W / 2, 230, { align: 'center', col: '#ff8ab0', alpha: a });
      txt('¡GRACIAS POR JUGAR!', W / 2, 272, { size: 16, align: 'center', col: '#ffffff', alpha: a });
      drawPresenter(14, 20, 150, 96, { alpha: a, noCaption: true, caption: '¡BRAVO!' });
      if (e > 700 && G.t % 60 < 40) txt('PULSA ENTER / START', W / 2, 310, { align: 'center', col: '#ffe066' });
    }
  }

  // ---------------------------------------------------------- PANTALLAS DE MENÚ
  let titleBg = null;
  function drawParallaxBg(idx, scroll) {
    const a = assetsFor(idx), TS = Art.TS;
    if (a.photo) { const m = Math.max(1, a.photo.width - W), p = (scroll * 0.25) % (2 * m); drawPhoto(a.photo, (p > m ? 2 * m - p : p) / m, 1); }
    else { ctx.drawImage(a.sky, 0, 0); [0.1, 0.25, 0.5].forEach((p, i) => { const off = -Math.round((scroll * p) % Art.BGW); ctx.drawImage(a.layers[i], off, 0); ctx.drawImage(a.layers[i], off + Art.BGW, 0); }); }
    const o = Math.round(scroll) % TS;
    for (let c = 0; c < 20; c++) { ctx.drawImage(a.tileset, 0, 0, TS, TS, c * TS - o, 252, TS, TS); ctx.drawImage(a.tileset, TS, 0, TS, TS, c * TS - o, 288, TS, TS); ctx.drawImage(a.tileset, TS, 0, TS, TS, c * TS - o, 324, TS, TS); }
  }
  function logo(y) {
    const bounce = Math.sin(G.t * 0.05) * 3;
    ctx.save(); ctx.translate(W / 2, y + bounce);
    txt('¡SUELTA,', 0, 0, { size: 32, align: 'center', col: '#ffe066', sh: '#7a2a10' });
    txt('MACHIN!', 0, 38, { size: 32, align: 'center', col: '#ff8a3a', sh: '#7a2a10' });
    ctx.restore();
  }
  function drawCover(img) { const k = Math.max(W / img.width, H / img.height); ctx.imageSmoothingEnabled = true; ctx.drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k); ctx.imageSmoothingEnabled = false; }
  function drawTitle() {
    if (titleBg === null) titleBg = Math.floor(Math.random() * LOCATIONS.length);
    const ini = photos.inicio;
    if (ini) {
      drawCover(ini);
      const g = ctx.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, 'rgba(12,8,24,0.45)'); g.addColorStop(1, 'rgba(12,8,24,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 170);
      logo(24);
      txt('Una aventura de puñetazos, chanclas y pesetas', W / 2, 102, { align: 'center', col: '#ffffff' });
      if (G.t % 70 < 48) txt('PULSA ENTER O START', W / 2, 124, { size: 16, align: 'center', col: '#ffe066' });
      ctx.fillStyle = 'rgba(12,8,24,0.72)'; ctx.fillRect(0, H - 22, W, 22);
      const lines = ['FLECHAS/WASD  ABAJO agacharse  ZXCV/HJKL: saltar, puño, patada, lanzar', 'MANDO: ABAJO agacharse  A saltar  X puño  B patada  Y/RB lanzar  START pausa'];
      txt(lines[Math.floor(G.t / 240) % 2], W / 2, H - 15, { align: 'center', col: Math.floor(G.t / 240) % 2 ? '#8affff' : '#ffffff' });
      txt('RÉCORD ' + String(G.hi).padStart(7, '0'), W - 8, 6, { align: 'right', col: '#ff8ab0' });
      return;
    }
    drawParallaxBg(titleBg, G.t * 1.2);
    ctx.fillStyle = 'rgba(12,8,24,0.35)'; ctx.fillRect(0, 0, W, H);
    logo(34);
    txt('Una aventura de puñetazos, chanclas y pesetas', W / 2, 112, { align: 'center', col: '#ffffff' });
    drawChar('boy', IDLE[Math.floor(G.t / 12) % 4], 120, 254, 1, 1.5);
    drawChar('girl', IDLE[Math.floor(G.t / 12 + 2) % 4], 520, 254, -1, 1.5);
    drawChar('cat', IDLE[Math.floor(G.t / 14) % 4], 320, 258, 1, 1.05);
    if (G.t % 70 < 48) txt('PULSA ENTER O START', W / 2, 134, { size: 16, align: 'center', col: '#ffe066' });
    box(96, 296, 448, 58, '#1b1426', '#ffe066');
    txt('FLECHAS/WASD mover   ABAJO agacharse', W / 2, 304, { align: 'center', col: '#ffffff' });
    txt('ZXCV o HJKL: saltar, puño, patada, lanzar', W / 2, 318, { align: 'center', col: '#ffffff' });
    txt('MANDO  A saltar  X puño  B patada  Y/RB lanzar', W / 2, 334, { align: 'center', col: '#8affff' });
    txt('RÉCORD ' + String(G.hi).padStart(7, '0'), W - 8, 6, { align: 'right', col: '#ff8ab0' });
  }
  function updateTitle() { G.t++; if (Input.confirm()) { Sound.init(); Sound.sfx.confirm(); G.state = 'select'; G.t = 0; G.menu = G.hero === 'boy' ? 0 : 1; Sound.play('title'); } if (G.t === 2) Sound.play('title'); }
  function updateSelect() {
    G.t++;
    if (Input.pressed('left') || Input.pressed('right')) { G.menu = 1 - G.menu; Sound.sfx.select(); }
    if (Input.backP()) { G.state = 'title'; Sound.sfx.select(); }
    if (Input.confirm()) { G.hero = G.menu === 0 ? 'boy' : 'girl'; Sound.sfx.confirm(); G.state = 'difficulty'; G.menu = 1; G.t = 0; }
  }
  function drawSelect() {
    if (photos.inicio) drawCover(photos.inicio); else drawParallaxBg(titleBg || 0, G.t * 0.6);
    ctx.fillStyle = 'rgba(12,8,24,0.55)'; ctx.fillRect(0, 0, W, H);
    txt('ELIGE PERSONAJE', W / 2, 12, { size: 16, align: 'center', col: '#ffe066' });
    const info = {
      boy: [['Especialidad:|Patada voladora', '#ffffff'], ['Corre un pelín más', '#8affff'],
        ['Punto débil:|Las máquinas recreativas', '#ffd08a'], ['Merienda: bocata de Nocilla', '#ffd08a'], ['"¡Eso lo arreglo yo!"', '#ff8ab0']],
      girl: [['Especialidad:|Puñetazo con gafas', '#ffffff'], ['Salta un pelín más', '#8affff'],
        ['Punto débil:|Sin gafas ve fantasmas', '#ffd08a'], ['Merienda: Phoskitos y Tang', '#ffd08a'], ['"¿Me estás vacilando?"', '#ff8ab0']]
    };
    ['boy', 'girl'].forEach((who, i) => {
      const cx = 170 + i * 300, sel = G.menu === i, bx = cx - 120, by = 36, bw = 240, bh = 292;
      glassBox(bx, by, bw, bh, sel);
      const f = sel ? WALK[Math.floor(G.t / 5) % 8] : IDLE[0];
      drawChar(who, f, cx, 146, i === 0 ? 1 : -1, 1.2);
      txt(NAMES[who], cx, 152, { size: 16, align: 'center', col: sel ? '#ffe066' : '#c8c8e0' });
      let y = 176;
      for (const [s, col] of info[who]) {
        for (const l of s.split('|')) { txt(l, cx, y, { align: 'center', col }); y += 11; }
        y += 4;
      }
      txt('Rescata a ' + NAMES[who === 'boy' ? 'girl' : 'boy'], cx, by + bh - 18, { align: 'center', col: '#8aff8a' });
    });
    txt('IZQ/DER elegir     ENTER/A confirmar', W / 2, 340, { align: 'center', col: '#c8c8e0' });
  }
  function updateDifficulty() {
    G.t++;
    if (Input.pressed('up')) { G.menu = (G.menu + 2) % 3; Sound.sfx.select(); }
    if (Input.pressed('down')) { G.menu = (G.menu + 1) % 3; Sound.sfx.select(); }
    if (Input.backP()) { G.state = 'select'; G.menu = G.hero === 'boy' ? 0 : 1; Sound.sfx.select(); }
    if (Input.confirm()) { G.diff = ['facil', 'normal', 'dificil'][G.menu]; Sound.sfx.confirm(); startGame(); }
  }
  function drawDifficulty() {
    if (photos.inicio) drawCover(photos.inicio); else drawParallaxBg(titleBg || 0, G.t * 0.6);
    ctx.fillStyle = 'rgba(12,8,24,0.6)'; ctx.fillRect(0, 0, W, H);
    txt('ELIGE DIFICULTAD', W / 2, 20, { size: 16, align: 'center', col: '#ffe066' });
    ['facil', 'normal', 'dificil'].forEach((k, i) => {
      const d = DIFFICULTY[k], sel = G.menu === i, y = 56 + i * 86;
      glassBox(82, y, 476, 74, sel);
      txt(d.name, 102, y + 12, { size: 16, col: sel ? ['#8aff8a', '#ffe066', '#ff6a6a'][i] : '#c8c8e0' });
      txt('"' + d.tag + '"', 102, y + 36, { col: '#ffffff' });
      txt(d.desc.join(' · '), 102, y + 52, { col: '#8affff' });
      for (let h = 0; h < d.hearts; h++) ctx.drawImage(Art.itemSprites.corazon, 500 - h * 18, y + 12, 14, 14);
      if (sel && G.t % 40 < 28) txt('>', 89, y + 14, { col: '#ffe066' });
    });
    txt('Tienes 5 vidas en todas las dificultades', W / 2, 322, { align: 'center', col: '#ff8ab0' });
    txt('ARRIBA/ABAJO elegir   ENTER/A empezar   C/B volver', W / 2, 340, { align: 'center', col: '#c8c8e0' });
  }

  // --- historia inicial
  const KIDNAP_CAT = [
    '¡MIAU! ¡Soy MACHÍN, pero llámame Machingán! ¡Me aburro! ¡Me llevo a {C}!',
    "Por vuestra culpa ya no soy el 'Principesco'",
  ];
  function startStory() {
    G.state = 'story'; G.t = 0; Sound.play('title');
    S = { t: 0, catY: -160, catX: 430, catVy: 0, cageY: -120, bx: 520, by: -200, cageX: 300, carried: false, shake: 0, catLine: fill(pick(KIDNAP_CAT), G.C) };
  }
  function updateStory() {
    const s = S; G.t++;
    if (Input.backP()) { startLevelIntro(); return; }
    if (s.hold) {
      s.holdT++;
      if ((s.holdT > 30 && Input.confirm()) || s.holdT > s.holdMax) { s.hold = false; Sound.sfx.select(); }
      return;
    }
    s.t++;
    const HOLDS = { 100: 480, 230: 620, 320: 480, 600: 460, 770: 1100, 900: 700 };
    if (HOLDS[s.t]) { s.hold = true; s.holdT = 0; s.holdMax = HOLDS[s.t]; }
    const gy = 300;
    if (s.t === 120) Sound.sfx.meow();
    if (s.t > 120 && s.catY < gy) { s.catVy += 0.6; s.catY = Math.min(gy, s.catY + s.catVy); if (s.catY === gy) { Sound.sfx.thud(); s.shake = 10; } }
    if (s.t > 240 && s.cageY < gy - 78) { s.cageY = Math.min(gy - 78, s.cageY + 6); if (s.cageY === gy - 78) { Sound.sfx.brick(); s.shake = 6; } }
    if (s.t > 320 && s.by < gy - 164) s.by += 3;
    if (s.t === 322) Sound.sfx.balloon();
    if (s.t > 400 && s.t <= 450) { const k = (s.t - 400) / 50; s.catX = 430 + (s.bx - 430) * k; s.catY = gy + ((s.by + 146 * BK) - gy) * k - Math.sin(k * Math.PI) * 80; s.catS = 1 - 0.5 * k; s.cageX += (s.bx - s.cageX) * 0.1; s.cageY += (Math.min(s.by + 103, gy - 78) - s.cageY) * 0.1; }
    if (s.t === 450) Sound.sfx.meow(1.3);
    if (s.t > 450) { s.carried = true; s.by -= 1.3; s.bx += 1.2; }
    if (s.shake) s.shake *= 0.85;
    if (s.t === 125 || s.t === 230 || s.t === 460 || s.t === 640 || s.t === 780) Sound.sfx.select();
    if (s.t > 920) startLevelIntro();
  }
  function drawStory() {
    const s = S, gy = 300;
    ctx.save(); if (s.shake > 0.5) ctx.translate(Math.round(rand(-s.shake, s.shake) / 2), 0);
    drawParallaxBg(0, 0);
    const loc = LOCATIONS[0];
    const heroF = s.t > 250 ? (s.t > 460 ? (Math.floor(s.t / 8) % 2 ? KICK[0] : IDLE[0]) : HURT[0]) : IDLE[Math.floor(s.t / 12) % 4];
    drawChar(G.hero, heroF, 220, gy, 1, 1);
    if (s.carried) drawBalloon(s.bx, s.by, { frame: s.t < 460 ? 6 : s.t < 470 ? 7 : undefined, cat: IDLE[Math.floor(s.t / 10) % 4], cage: G.captive, cageX: s.bx + Math.sin(s.t * 0.05) * 6, cageTop: Math.min(s.by + 103, gy - 78) });
    else {
      if (s.t > 320) drawBalloon(s.bx, s.by, { frame: s.t > 400 ? doorFrame((s.t - 400) / 50) : 0 });
      if (s.t <= 400) drawChar(G.captive, s.t > 150 ? HURT[0] : IDLE[Math.floor(s.t / 12 + 1) % 4], 300, gy, -1, 1);
      if (s.t > 240) drawCage(s.cageX, s.cageY, s.t > 400 ? G.captive : null, CAGED[1]);
      if (s.t > 120) drawChar('cat', s.catY < gy || s.t > 400 ? KICK[0] : IDLE[Math.floor(s.t / 12) % 4], s.catX, s.catY, -1, s.catS || 1);
    }
    // bocadillos
    const say = (x, y, str) => { const fake = { target: { anchor: () => ({ x, y }) }, text: str, t: 10, dur: 99 }; const cam = L; L = { camX: 0, camY: 0 }; drawBubble(fake, 1); L = cam; };
    if (s.t > 30 && s.t < 110) say(300, gy - 72, '¡Qué buen día de playa!');
    if (s.t > 150 && s.t < 240) say(430, gy - 130, s.catLine);
    if (s.t > 250 && s.t < 330) say(300, gy - 100, '¡Eeeh! ¡Suéltame, bicho peludo!');
    if (s.t > 470 && s.t < 620) say(220, gy - 72, fill('¡{C}! ¡Espera, que voy!', G.C));
    ctx.restore();
    // el presentador comenta en directo
    if (s.t >= 125 && s.t < 620) { const idx = s.t < 230 ? 0 : s.t < 460 ? 1 : 2, st = s.t - (idx === 0 ? 125 : idx === 1 ? 230 : 460); drawPresenter(idx, 14, 236, 96, { t: st }); }
    // narración
    glassBox(24, 8, W - 48, 40, true, { fill: 'rgba(27,20,38,0.6)' });
    const n = s.t < 140 ? 'Un día tranquilo en ' + loc.short + '...' : s.t < 450 ? '...hasta que apareció ' + CAT + ', el gato más travieso de España.' : fill('¡' + CAT + ' se ha llevado a {C} en globo!', G.C);
    wrap(n, 70).forEach((l, i) => txt(l, 36, 16 + i * 12, { col: '#ffffff' }));
    // plató de TV: el presentador lo cuenta todo
    if (s.t >= 620) {
      const k = Math.min(1, (s.t - 620) / 20);
      ctx.fillStyle = 'rgba(12,8,24,' + (0.85 * k) + ')'; ctx.fillRect(0, 0, W, H);
      const idx = s.t < 780 ? 3 : 4, st = s.t - (idx === 3 ? 640 : 780);
      if (s.t >= 640) drawPresenter(idx, 40, 70, 180, { t: st });
      glassBox(250, 70, 360, 200, true, { fill: 'rgba(27,20,38,0.6)' });
      txt('ÚLTIMA HORA', 266, 84, { size: 16, col: '#ff5a5a' });
      const hero = NAMES[G.hero], cap = NAMES[G.captive];
      const lines = [
        '¡Terrible noticia! ' + CAT + ', el gato más travieso de España, ha secuestrado a ' + cap + '.',
        'Se la lleva en globo de ciudad en ciudad. ¡Solo ' + hero + ' puede alcanzarlo!',
      ];
      if (G.captive === 'boy') lines[1] = 'Se lo lleva en globo de ciudad en ciudad. ¡Solo ' + hero + ' puede alcanzarlo!';
      let yy = 110; const shown = Math.floor((s.t - 640) * 1.2);
      let left = Math.max(0, shown);
      lines.forEach(l => { wrap(l, 40).forEach(w => { const part = w.slice(0, Math.max(0, left)); left -= w.length; txt(part, 266, yy, { col: '#ffffff' }); yy += 13; }); yy += 8; });
      if (s.t > 780) txt('¡Pisa, pega y patea a los bichos!', 266, 234, { col: '#8affff' });
      // rótulo inferior tipo telediario
      ctx.fillStyle = '#c81e2e'; ctx.fillRect(0, 300, W, 22); ctx.fillStyle = '#1b1426'; ctx.fillRect(0, 322, W, 16);
      const ticker = '+++ ÚLTIMA HORA: ' + CAT_NAME + ' SECUESTRA A ' + cap + ' +++ SE BUSCA GATO NARANJA CON GLOBO +++ ' + hero + ' SALE EN SU BÚSQUEDA +++ TAMBIÉN CONOCIDO COMO MACHINGÁN, MACHANGUITO, MACHUQUITO O MACHÍN HUERTA +++ ';
      const off = (s.t * 2) % (ticker.length * 8);
      txt(ticker + ticker, 8 - off, 307, { col: '#ffffff' });
    }
    if (s.hold && s.holdT > 30 && G.t % 50 < 34) txt('PULSA A / ESPACIO PARA SEGUIR', W / 2, H - 26, { align: 'center', col: '#ffe066' });
    txt('B / ESC: saltar la historia', W - 10, H - 12, { align: 'right', col: '#8a8aa8' });
  }

  // --- intro de nivel
  function updateIntro() { G.t++; if (G.t === 10) Sound.sfx.select(); if ((G.t > 40 && Input.confirm()) || G.t > 480) beginPlay(); }
  function drawIntro() {
    ctx.fillStyle = '#0c0818'; ctx.fillRect(0, 0, W, H);
    const a = assetsFor(G.levelIdx);
    ctx.globalAlpha = 0.35; if (a.photo) drawPhoto(a.photo, (G.t % 600) / 600, 0.5); else { ctx.drawImage(a.sky, 0, 0); ctx.drawImage(a.layers[0], -((G.t * 0.5) % Art.BGW), 0); ctx.drawImage(a.layers[1], -((G.t) % Art.BGW), 0); } ctx.globalAlpha = 1;
    const loc = LOCATIONS[G.levelIdx], final = G.levelIdx === LOCATIONS.length - 1;
    txt('NIVEL ' + (G.levelIdx + 1) + (final ? ' - ¡FINAL!' : ''), W / 2, 50, { size: 16, align: 'center', col: final ? '#ff6a6a' : '#c8c8e0' });
    const nameSize = loc.name.length > 18 ? 16 : 24;
    txt(loc.name, W / 2, 84, { size: nameSize, align: 'center', col: '#ffe066' });
    wrap(loc.sub, 56).forEach((l, i) => txt(l, W / 2, 124 + i * 14, { align: 'center', col: '#ffffff' }));
    drawPresenter([15, 5, 6, 7, 8, 9, 10, 11][G.levelIdx] ?? 14, 30, 182, 104, { t: G.t - 10 });
    drawChar(G.hero, WALK[Math.floor(G.t / 5) % 8], W / 2 - 50, 270, 1, 1);
    txt('x ' + G.lives, W / 2 + 10, 240, { size: 16 });
    txt('Bichos de la zona:', W / 2, 280, { align: 'center', col: '#8affff' });
    const kinds = [...new Set(loc.enemies)];
    kinds.forEach((k, i) => { const x = W / 2 - kinds.length * 36 + i * 72 + 36; if (HD[k]) { const A = HD[k], an = ENEMY_TYPES[k].fly ? (A.fly || A.idle) : (A.walk || A.idle); const f = SPRITE_FRAMES['en_' + k][an[0]], sc = Math.min(1.3, 48 / (f[3] / RES)); drawHDFrame(k, an[Math.floor(G.t / 6) % an.length], x, 352, -1, { scale: sc }); } else { const img = Art.enemySprites[k].L[Math.floor(G.t / 15) % 2]; ctx.drawImage(img, Math.round(x - img.width / 2), 352 - img.height); } });
    if (final) txt('¡La guarida de ' + (L && L.nick || CAT) + ' te espera al final!', W / 2, 162, { align: 'center', col: '#ff8ab0' });
  }

  // --- pausa
  function updatePause() {
    const opts = 4;
    if (Input.pressed('up')) { G.menu = (G.menu + opts - 1) % opts; Sound.sfx.select(); }
    if (Input.pressed('down')) { G.menu = (G.menu + 1) % opts; Sound.sfx.select(); }
    if (Input.pressed('back') || (Input.pressed('start') && G.menu === 0)) { G.state = 'play'; Sound.duck(false); Input.clear(); return; }
    if (Input.pressed('jump') || Input.pressed('punch') || Input.pressed('start')) {
      Sound.sfx.confirm();
      if (G.menu === 0) { G.state = 'play'; Sound.duck(false); Input.clear(); }
      else if (G.menu === 1) { Sound.toggleMusic(); Sound.duck(true); }
      else if (G.menu === 2) Sound.toggleSfx();
      else { saveHi(); Sound.duck(false); G.state = 'title'; G.t = 0; Sound.stop(); Sound.play('title'); }
    }
  }
  function drawPause() {
    ctx.fillStyle = 'rgba(12,8,24,0.7)'; ctx.fillRect(0, 0, W, H);
    glassBox(170, 70, 300, 220, true, { fill: 'rgba(27,20,38,0.6)' });
    txt('PAUSA', W / 2, 88, { size: 16, align: 'center', col: '#ffe066' });
    ['CONTINUAR', 'MÚSICA: ' + (Sound.musicOn ? 'SÍ' : 'NO'), 'EFECTOS: ' + (Sound.sfxOn ? 'SÍ' : 'NO'), 'SALIR AL TÍTULO'].forEach((o, i) => {
      txt((G.menu === i ? '> ' : '  ') + o, 210, 126 + i * 22, { col: G.menu === i ? '#ffe066' : '#ffffff' });
    });
    txt('ZXCV o HJKL: saltar, puño, patada, lanzar', W / 2, 228, { align: 'center', col: '#8affff' });
    txt('Pisa a los bichos (¡menos erizos', W / 2, 246, { align: 'center', col: '#c8c8e0' });
    txt('y medusas, que pican!)', W / 2, 258, { align: 'center', col: '#c8c8e0' });
    txt('F pantalla completa   M música', W / 2, 272, { align: 'center', col: '#8a8aa8' });
  }

  // --- respawn / game over
  function updateRespawn() { G.t++; if (G.t === 100) { respawn(); } if (G.t > 150) { G.state = 'play'; Sound.play(currentMusic()); } }
  function drawRespawn() {
    const a = G.t < 100 ? Math.min(1, G.t / 30) : Math.max(0, 1 - (G.t - 100) / 30);
    ctx.fillStyle = `rgba(12,8,24,${a})`; ctx.fillRect(0, 0, W, H);
    if (G.t < 100) {
      txt(pick(['¡AY, MI MADRE!']), W / 2, 130, { size: 16, align: 'center', col: '#ff8a8a', alpha: a });
      txt('VIDAS x ' + G.lives, W / 2, 170, { size: 16, align: 'center', alpha: a });
      drawPresenter(7, W / 2 - 50, 200, 100, { alpha: a, t: G.t - 20 });
    }
  }
  function updateGameover() {
    G.t++;
    if (G.t > 60 && Input.pressed('start')) { G.lives = 5; G.score = 0; startLevelIntro(); return; }
    if (G.t > 60 && (Input.pressed('jump') || Input.pressed('punch')) && G.t > 660) { G.state = 'title'; G.t = 0; Sound.play('title'); }
    if (G.t > 660 + 60 * 5) { G.state = 'title'; G.t = 0; Sound.play('title'); }
  }
  function drawGameover() {
    ctx.fillStyle = 'rgba(12,8,24,0.85)'; ctx.fillRect(0, 0, W, H);
    txt('GAME OVER', W / 2, 70, { size: 32, align: 'center', col: '#ff5a5a' });
    txt('¡Te has quedado frit' + (G.hero === 'boy' ? 'o' : 'a') + ' como una croqueta!', W / 2, 120, { align: 'center' });
    drawChar(G.hero, KO[3], W / 2 - 40, 230, 1, 1);
    drawChar('cat', IDLE[Math.floor(G.t / 12) % 4], W / 2 + 60, 230, -1, 0.7);
    drawPresenter(0, 24, 130, 100, { t: G.t - 30 });
    const cd = Math.max(0, 10 - Math.floor(G.t / 66));
    if (G.t < 660) {
      txt('¿CONTINUAR?  ' + cd, W / 2, 256, { size: 16, align: 'center', col: '#ffe066' });
      txt('Pulsa ENTER / START (la puntuación vuelve a 0)', W / 2, 284, { align: 'center', col: '#c8c8e0' });
    } else txt('Pulsa ESPACIO / A para volver al título', W / 2, 284, { align: 'center', col: '#c8c8e0' });
    txt('PUNTUACIÓN ' + G.score + '   RÉCORD ' + G.hi, W / 2, 320, { align: 'center', col: '#8affff' });
  }

  function drawClear() {
    ctx.fillStyle = 'rgba(12,8,24,0.72)'; ctx.fillRect(0, 0, W, H);
    txt('¡' + L.loc.short.toUpperCase() + ' SUPERADO!', W / 2, 50, { size: 16, align: 'center', col: '#ffe066' });
    txt(fill('...pero ' + (L.nick || CAT) + ' se ha escapado con {C}', G.C), W / 2, 80, { align: 'center', col: '#ff8ab0' });
    const b = L.bonus, rows = [['Bichos vencidos', b.kills], ['Pesetas recogidas', b.coins], ['Tiempo', b.secs + ' s'], ['Bonus tiempo', b.time], ['Bonus corazones', b.hearts]];
    rows.forEach(([k, v], i) => { if (G.t > 20 + i * 14) { txt(k, 190, 116 + i * 22); txt(String(v), 490, 116 + i * 22, { align: 'right', col: '#8affff' }); } });
    drawPresenter(12, 24, 110, 110, { t: G.t - 40 });
    drawChar(G.hero, G.t < 40 ? WIN[1] : winFrame(G.t), 580, 236, -1, 1);
    txt('PUNTUACIÓN  ' + String(G.score).padStart(7, '0'), W / 2, 250, { size: 16, align: 'center' });
    const next = LOCATIONS[G.levelIdx + 1];
    if (next) txt('Siguiente parada: ' + next.short, W / 2, 290, { align: 'center', col: '#ffe066' });
    if (G.t > 150 && G.t % 60 < 40) txt('PULSA ENTER / A', W / 2, 320, { align: 'center', col: '#ffffff' });
  }

  // ---------------------------------------------------------- BUCLE PRINCIPAL
  function update() {
    Input.poll();
    if (Input.pressed('mute')) Sound.toggleMusic();
    if (Input.pressed('full')) { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); else document.exitFullscreen(); } catch (e) {} }
    switch (G.state) {
      case 'title': updateTitle(); break;
      case 'select': updateSelect(); break;
      case 'difficulty': updateDifficulty(); break;
      case 'story': updateStory(); break;
      case 'intro': updateIntro(); break;
      case 'play': G.t++; updatePlay(); break;
      case 'pause': updatePause(); break;
      case 'cutscene': G.t++; updateCutscene(); break;
      case 'clear': updateClear(); break;
      case 'respawn': updateCommon(); L.enemies.forEach(e => { if (e.dead) updateEnemy(e); }); updateRespawn(); break;
      case 'gameover': updateGameover(); break;
      case 'ending': updateEnding(); updateBossIdle(); break;
    }
  }
  function updateBossIdle() { const B = L.boss; if (B) { B.t++; B.vy = Math.min(B.vy + 0.5, 10); physY(B); } }
  function render() {
    ctx.imageSmoothingEnabled = false;
    switch (G.state) {
      case 'loading': ctx.fillStyle = '#0c0818'; ctx.fillRect(0, 0, W, H); txt('CARGANDO...', W / 2, H / 2, { align: 'center' }); break;
      case 'title': drawTitle(); break;
      case 'select': drawSelect(); break;
      case 'difficulty': drawDifficulty(); break;
      case 'story': drawStory(); break;
      case 'intro': drawIntro(); break;
      case 'play': case 'cutscene': case 'pause': case 'respawn': case 'gameover': case 'clear': case 'ending':
        drawWorld(); drawHUD();
        if (G.state === 'pause') drawPause();
        if (G.state === 'respawn') drawRespawn();
        if (G.state === 'gameover') drawGameover();
        if (G.state === 'clear') drawClear();
        if (G.state === 'ending') drawEnding();
        break;
    }
  }
  let acc = 0, last = performance.now();
  function frame(now) {
    acc += Math.min(100, now - last); last = now;
    let n = 0;
    while (acc >= 1000 / 60 && n < 5) { if (!window.__freeze) update(); acc -= 1000 / 60; n++; }
    render();
    requestAnimationFrame(frame);
  }

  // escalado de la pantalla
  function resize() {
    const s = Math.min(innerWidth / W, innerHeight / H), k = s >= 2 ? Math.floor(s) : s;
    cv.style.width = Math.floor(W * k) + 'px'; cv.style.height = Math.floor(H * k) + 'px';
  }
  addEventListener('resize', resize); resize();

  // arranque
  const img = new Image();
  const elementImg = new Image();
  const fontReady = (document.fonts && document.fonts.load) ? Promise.race([document.fonts.load('16px "Press Start 2P"', ' ¡¿ÁÉÍÓÚáéíóúÑñÜü'), new Promise(r => setTimeout(r, 2500))]) : Promise.resolve();
  const imgReady = Promise.all([new Promise(r => { img.onload = r; img.onerror = r; }), new Promise(r => { elementImg.onload = r; elementImg.onerror = r; }), new Promise(r => { presImg.onload = r; presImg.onerror = r; presImg.src = PRESENTER_ATLAS; })]);
  img.src = SPRITE_ATLAS;
  elementImg.src = window.ELEMENT_ATLAS || '';
  requestAnimationFrame(frame);
  Promise.all([fontReady, imgReady, photosReady, new Promise(r => { const bi = new Image(); bi.onload = () => { try { buildBalloon(bi); } catch (e) { console.warn(e); } r(); }; bi.onerror = r; bi.src = window.BALLOON_SHEET || ''; }), new Promise(r => { const gi = new Image(); gi.onload = () => { try { buildGoalSign(gi); } catch (e) { console.warn(e); } r(); }; gi.onerror = r; gi.src = window.GOAL_SIGN || ''; }), new Promise(r => { const fi = new Image(); fi.onload = () => { try { buildGoalFx(fi); } catch (e) { console.warn(e); } r(); }; fi.onerror = r; fi.src = window.GOAL_FX || ''; })]).then(() => {
    buildAtlas(img); buildElementSprites(elementImg); Art.buildEnemies(); Art.buildItems();
    for (const k of ['peseta', 'bocadillo', 'mojo', 'turron', 'tortilla', 'churro', 'chancla', 'corazon']) if (elem(k)) Art.itemSprites[k] = elem(k);
    G.state = 'title'; G.t = 0;
    // depuración: ?test=N salta directamente al nivel N
    window.__game = { G, get L() { return L; }, get P() { return P; }, Level, mk: (k, c, r) => makeEnemy(k, c, r), step(n = 1) { for (let i = 0; i < n; i++) update(); render(); return G.state; }, hold(a, v = true) { Input.virt[a] = v; }, tap(a) { Input.virt[a] = true; update(); Input.virt[a] = false; update(); render(); }, jump(i, diff = 'normal', hero = 'boy') { G.diff = diff; D = DIFFICULTY[diff]; G.hero = hero; G.levelIdx = i; startLevelIntro(); } };
  });
})();
