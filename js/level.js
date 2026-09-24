// ============================================================
//  NIVELES: ubicaciones, dificultad, generador aleatorio y validador
// ============================================================
const ROWS = 15, TILE = 24;
// tiles del mapa
const EMPTY = 0, TOP = 1, FILL = 2, BRICK = 3, QBLOCK = 4, USED = 5, PLAT = 6, BLOCK = 7;
const isSolidTile = t => t === TOP || t === FILL || t === BRICK || t === QBLOCK || t === USED || t === BLOCK;

const DIFFICULTY = {
  facil:   { key: 'facil', name: 'FÁCIL', tag: 'Paseo por la playa', hearts: 4, len: 240, maxGap: 3, enemyRate: 0.45, pitRate: 0.16, speed: 0.8, bossHP: 16, powerRate: 0.55, desc: ['4 corazones', 'Huecos pequeños', 'Bichos tranquilos'] },
  normal:  { key: 'normal', name: 'NORMAL', tag: 'Como un lunes', hearts: 3, len: 300, maxGap: 4, enemyRate: 0.7, pitRate: 0.26, speed: 1, bossHP: 24, powerRate: 0.4, desc: ['3 corazones', 'Saltos serios', 'Bichos con ganas'] },
  dificil: { key: 'dificil', name: 'DIFÍCIL', tag: 'Modo abuela con chancla', hearts: 2, len: 360, maxGap: 4, enemyRate: 1.0, pitRate: 0.36, speed: 1.25, bossHP: 32, powerRate: 0.28, desc: ['2 corazones', 'Abismos por todas partes', 'Bichos furiosos'] },
};

// Tipos de enemigo
const ENEMY_TYPES = {
  cangrejo:   { beh: 'walker', speed: 0.7, hp: 1, stomp: true, edge: true, pts: 100 },
  gaviota:    { beh: 'swooper', speed: 1.2, hp: 1, stomp: true, fly: true, pts: 200 },
  erizo:      { beh: 'walker', speed: 0.35, hp: 2, stomp: false, edge: true, pts: 300 },
  pulpo:      { beh: 'hopper', speed: 1.3, hp: 2, stomp: true, pts: 200 },
  pato:       { beh: 'walker', speed: 0.9, hp: 1, stomp: true, edge: false, pts: 100 },
  jabali:     { beh: 'charger', speed: 0.6, charge: 4.2, hp: 2, stomp: true, edge: true, pts: 300 },
  topo:       { beh: 'popper', speed: 0, hp: 1, stomp: true, pts: 200 },
  paloma:     { beh: 'dropper', speed: 1.3, hp: 1, stomp: true, fly: true, pts: 200 },
  rata:       { beh: 'walker', speed: 1.6, hp: 1, stomp: true, edge: false, pts: 150 },
  oso:        { beh: 'walker', speed: 0.5, hp: 4, stomp: true, edge: true, pts: 500 },
  mapache:    { beh: 'walker', speed: 1.1, hp: 2, stomp: true, edge: true, pts: 200 },
  conejo:     { beh: 'hopper', speed: 1.6, hp: 1, stomp: true, pts: 150 },
  murcielago: { beh: 'flyer', speed: 1.3, hp: 1, stomp: true, fly: true, pts: 200 },
  rana:       { beh: 'hopper', speed: 1.9, hp: 1, stomp: true, pts: 150 },
  medusa:     { beh: 'floater', speed: 0.4, hp: 1, stomp: true, fly: true, pts: 300 },
  tortuga:    { beh: 'walker', speed: 0.45, hp: 3, stomp: true, edge: true, pts: 250 },
  lagarto:    { beh: 'walker', speed: 1.8, hp: 1, stomp: true, edge: true, pts: 150 },
  cabra:      { beh: 'charger', speed: 0.5, charge: 4.6, hp: 2, stomp: true, edge: true, pts: 300 },
  cuervo:     { beh: 'swooper', speed: 1.5, hp: 1, stomp: true, fly: true, pts: 200 },
  pinguino:   { beh: 'slider', speed: 2.3, hp: 1, stomp: true, pts: 200 },
};

// Ubicaciones (un nivel por ubicación; la última incluye al jefe final)
const LOCATIONS = [
  { name: 'LAS PALMAS DE GRAN CANARIA', short: 'Las Palmas', sub: 'Playa de Las Canteras. Arena, sol... ¡y cangrejos con mala leche!',
    painter: 'laspalmas', sky: ['#2f86e0', '#bfe8ff'], music: 'playas', hazard: 'water', enemies: ['cangrejo', 'cangrejo', 'gaviota', 'erizo'],
    tiles: { seed: 1, top: '#f5d98a', top2: '#e0bc60', topHi: '#fff4c8', fill: '#e8c070', fill2: '#d4a850', fillDot: '#fff0c0', fillPattern: 'sand', topPattern: 'sand', brick: '#d06a3a', brick2: '#b85a30', brickMortar: '#7a3a20', plat: '#8a5a30', plat2: '#6a4020', platHi: '#b88a5a', block: '#8aa0b0', block2: '#6a8090', blockHi: '#c0d0dc' },
    cat: '¡Miau! Me llevo a {C} a comer papas arrugadas... ¡y tú no estás invitado!', help: '¡Socorro! ¡Este gato huele a sardina!' },
  { name: 'CÁDIZ', short: 'Cádiz', sub: 'La Tacita de Plata. Aquí hasta los pulpos tienen gracia.',
    painter: 'cadiz', sky: ['#ff8a5a', '#ffe0a8'], music: 'cadiz', hazard: 'water', enemies: ['pulpo', 'gaviota', 'cangrejo', 'erizo'],
    tiles: { seed: 2, top: '#e8d0a0', top2: '#c8a870', topHi: '#fff0d0', fill: '#c8a060', fill2: '#b08848', fillDot: '#e8c890', fillPattern: 'brick', mortar: '#8a6a3a', topPattern: 'stone', brick: '#f0f0f0', brick2: '#dcdcdc', brickMortar: '#a0a0a8', plat: '#4a7ab0', plat2: '#2a5a90', platHi: '#8ab0e0', block: '#d8c090', block2: '#b89a60', blockHi: '#f0e0b8' },
    cat: '¡Ay, qué arte tengo! ¡Me voy con {C} a cantar en la chirigota!', help: '¡Que alguien me saque de aquí! ¡No para de cantar!' },
  { name: 'SOTOGRANDE', short: 'Sotogrande', sub: 'Yates, golf y polo. Cuidado: los jabalíes no respetan el green.',
    painter: 'sotogrande', sky: ['#4a9ae8', '#d0ecff'], music: 'soto', hazard: 'water', enemies: ['pato', 'jabali', 'topo', 'gaviota'],
    tiles: { seed: 3, top: '#5ac04a', top2: '#3a9a3a', topHi: '#a0f080', fill: '#9a6a3a', fill2: '#7a5028', fillDot: '#b88a5a', fillPattern: 'dirt', topPattern: 'grass', brick: '#f0e8d8', brick2: '#e0d8c8', brickMortar: '#b0a890', plat: '#f0f0f0', plat2: '#c0c0c0', platHi: '#ffffff', block: '#c8603a', block2: '#a04828', blockHi: '#e88a5a' },
    cat: '¡Aquí solo entra gente con yate! ¡Y tú vas en chanclas!', help: '¡Me quiere enseñar a jugar al golf con bolas de pelo!' },
  { name: 'MADRID', short: 'Madrid', sub: 'De Madrid al cielo... pasando por las palomas.',
    painter: 'madrid', sky: ['#5aa8e8', '#dcefff'], music: 'madrid', hazard: 'void', enemies: ['paloma', 'rata', 'rata', 'oso'],
    tiles: { seed: 4, top: '#b8b8c0', top2: '#8a8a98', topHi: '#e0e0e8', fill: '#b84a30', fill2: '#a03a24', fillDot: '#d06a4a', fillPattern: 'brick', mortar: '#e8d8c8', topPattern: 'slab', brick: '#c8563a', brick2: '#b04a30', brickMortar: '#f0e0d0', plat: '#3a5a3a', plat2: '#2a4a2a', platHi: '#6a8a6a', block: '#9a9aa8', block2: '#7a7a88', blockHi: '#d0d0dc' },
    cat: '¡Corre, {C}, que en la M-30 hay atasco y perdemos el globo!', help: '¡Me ha dejado sin bocata de calamares!' },
  { name: 'PARQUE WARNER MADRID', short: 'Parque Warner', sub: 'Colas de dos horas y mapaches sin entrada.',
    painter: 'warner', sky: ['#3a7ae8', '#b8dcff'], music: 'warner', hazard: 'void', enemies: ['mapache', 'conejo', 'murcielago', 'pato'],
    tiles: { seed: 5, top: '#e04a6a', top2: '#b83050', topHi: '#ff9ab0', fill: '#6a4aa8', fill2: '#5a3a90', fillDot: '#8a6ac8', fillPattern: 'tiles', mortar: '#4a2a78', topPattern: 'checker', brick: '#ffc840', brick2: '#f0b020', brickMortar: '#b87a10', plat: '#40a0e0', plat2: '#2070b0', platHi: '#90d0ff', block: '#e04040', block2: '#b02020', blockHi: '#ff8080' },
    cat: '¡Me subo a la montaña rusa con {C}! ¡Tú a la cola, dos horitas!', help: '¡Me ha comprado un algodón de azúcar y se lo está comiendo él!' },
  { name: 'SIAM PARK (TENERIFE)', short: 'Siam Park', sub: 'Toboganes de vértigo. Las medusas no se han pagado la entrada.',
    painter: 'siam', sky: ['#20a0e8', '#c8f0ff'], music: 'siam', hazard: 'water', enemies: ['rana', 'medusa', 'tortuga', 'cangrejo'],
    tiles: { seed: 6, top: '#c89a5a', top2: '#a07840', topHi: '#e8c890', fill: '#30b8c8', fill2: '#2aa0b0', fillDot: '#a0f0f8', fillPattern: 'tiles', mortar: '#ffffff', topPattern: 'wood', brick: '#d0a040', brick2: '#c09030', brickMortar: '#8a6010', plat: '#ffd040', plat2: '#e0a020', platHi: '#fff0a0', block: '#e05050', block2: '#b03030', blockHi: '#ff9090' },
    cat: '¡Al tobogán más alto! Aunque... los gatos ODIAMOS el agua. ¡Me largo!', help: '¡Me ha dejado sin flotador!' },
  { name: 'TENERIFE - EL TEIDE', short: 'El Teide', sub: 'El pico más alto de España. Lagartos, cabras y cero cobertura.',
    painter: 'teide', sky: ['#1a58c0', '#a8d8ff'], music: 'teide', hazard: 'lava', enemies: ['lagarto', 'cabra', 'cuervo', 'lagarto'],
    tiles: { seed: 7, top: '#6a4a3e', top2: '#4a302a', topHi: '#9a6a5a', fill: '#3a2a28', fill2: '#2a1e1c', fillDot: '#5a3a30', fillPattern: 'lava', topPattern: 'rock', brick: '#8a4a3a', brick2: '#7a3a2a', brickMortar: '#3a1a14', plat: '#7a6a5a', plat2: '#5a4a3a', platHi: '#aa9a8a', block: '#5a4a48', block2: '#3a2e2c', blockHi: '#8a7a78' },
    cat: '¡Me subo con {C} a la cima del Teide! ¡Allí no llega la cobertura!', help: '¡Tengo frío y este gato no comparte la manta!' },
  { name: 'LA NIEVE - ANDORRA', short: 'Andorra', sub: 'Pistas heladas del Pirineo, pingüinos despistados... y la guarida de Machín.',
    painter: 'andorra', sky: ['#8ab8e0', '#eef6ff'], music: 'nieve', hazard: 'ice', slippery: true, snow: true, enemies: ['pinguino', 'cabra', 'cuervo', 'topo'],
    tiles: { seed: 8, top: '#ffffff', top2: '#d8e8f8', topHi: '#ffffff', fill: '#a8d0f0', fill2: '#90c0e8', fillDot: '#e0f4ff', fillPattern: 'ice', topPattern: 'snow', brick: '#c0e0f8', brick2: '#a8d0f0', brickMortar: '#6aa0d0', plat: '#8a5a3a', plat2: '#6a4028', platHi: '#b88a5a', block: '#d8ecfc', block2: '#a8cce8', blockHi: '#ffffff' },
    cat: '', help: '¡Ayúdame! ¡Me obliga a peinarle los bigotes!' },
];

// Mini-jefes: el bicho más fuerte de cada ubicación, en tamaño gigante, en una arena a 3/4 del nivel
const MINI_W = 18; // columnas de la arena (las rejas van en la primera y la última)
const MINI_BOSSES = [
  { kind: 'erizo', name: 'EL ERIZO QUE ERIZA', scale: 2.6, hp: 8, hint: '¡No lo pises, que pincha! Dale puñetazos, patadas o lánzale cosas.',
    intro: '¡Machín me paga en sardinas! ¡De aquí no pasa nadie!', lose: '¡Ay, mis púas! ¡Me voy a otra playa!' },
  { kind: 'pulpo', name: 'EL PULPO CHIRIGOTERO', scale: 2.2, hp: 10, hint: 'Cuidado con su tinta. Salta sobre su cabeza o pégale.',
    intro: '¡Ocho brazos para darte ocho collejas! ¡Tararí, que te vi!', lose: '¡Me retiro del carnaval!' },
  { kind: 'jabali', name: 'EL JABALÍ DEL KE', scale: 2.2, hp: 10, hint: 'Cuando embiste, apártate. ¡Si choca con la reja se queda atontado!',
    intro: '¡Este green es mío! ¡Hoyo en uno en tu cara!', lose: '¡Bogey! ¡Me vuelvo al monte!' },
  { kind: 'oso', name: 'EL OSO QUE OSEA', scale: 1.6, hp: 12, hint: 'Tiene un zarpazo muy largo. ¡Sáltale encima!',
    intro: '¡GRRR! ¡Nadie toca mi madroño... ni a mi amigo Machín!', lose: '¡Vale, vale! ¡Me vuelvo a la Puerta del Sol!' },
  { kind: 'mapache', name: 'EL MAPACHE SIN ENTRADA', scale: 2.4, hp: 10, hint: 'Si te toca, te roba el arma. ¡Pégale para recuperarla!',
    intro: '¡Me colé en el parque y ahora me cuelo en tu camino!', lose: '¡Me voy a la cola de la montaña rusa!' },
  { kind: 'tortuga', name: 'LA TORTUGA SOCORRISTA', scale: 2.5, hp: 12, hint: 'Lenta pero dura. ¡Salta sobre su caparazón una y otra vez!',
    intro: '¡Prohibido correr por la piscina! ¡Silbatazo!', lose: '¡Me voy a echar la siesta al jacuzzi!' },
  { kind: 'cabra', name: 'LA CABRA MAGMÁTICA', scale: 2.1, hp: 10, hint: 'Embiste muy fuerte. ¡Esquívala y atácala cuando se choque!',
    intro: '¡Beeee! ¡Aquí arriba mando yo!', lose: '¡Beee... me vuelvo al Pico Viejo!' },
  { kind: 'pinguino', name: 'EL PINGÜINO EMPERADOR', scale: 2.8, hp: 10, hint: 'Se desliza muy rápido por el hielo. ¡Sáltale encima!',
    intro: '¡Soy el emperador de estas pistas! ¡Machín es mi vasallo!', lose: '¡Mi imperio de hielo se derrite!' },
];

const Level = (() => {
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function build(locIdx, D, seed, isFinal) {
    const R = rng(seed), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), loc = LOCATIONS[locIdx];
    const bodyLen = D.len, extra = isFinal ? 46 : 34;
    let cols = bodyLen + 140;
    let tiles = Array.from({ length: ROWS }, () => new Uint8Array(cols));
    const contents = {}, coins = [], spawns = [];
    let c = 0, h = 12;
    const setCol = (col, hh) => { for (let r = hh; r < ROWS; r++) tiles[r][col] = r === hh ? TOP : FILL; };
    const flat = n => { for (let i = 0; i < n && c < cols; i++) setCol(c++, h); };
    const coin = (col, row) => { if (row > 1 && col < cols) coins.push({ col, row }); };
    const pickEnemy = (fly) => {
      const list = loc.enemies.filter(k => !!ENEMY_TYPES[k].fly === fly);
      return list.length ? list[Math.floor(R() * list.length)] : null;
    };
    const spawnGround = (col, row) => { const k = pickEnemy(false); if (k) spawns.push({ kind: k, col, row }); };
    const spawnAir = (col, row) => { const k = pickEnemy(true); if (k) spawns.push({ kind: k, col, row: Math.max(3, row) }); };
    const content = () => {
      const r = R();
      if (r > D.powerRate) return R() < 0.25 ? 'multi' : 'peseta';
      const list = ['bocadillo', 'bocadillo', 'mojo', 'churro', 'chancla', 'chancla', 'turron', 'tortilla', 'tortilla', 'gazpacho', 'gazpacho', 'paella', 'paella', 'cocido', 'cocido', 'cafe', 'cafe'];
      return list[Math.floor(R() * list.length)];
    };
    flat(12);
    let checkpointX = null, miniCol = null;
    const checkAt = Math.floor(bodyLen / 2), miniAt = Math.floor(bodyLen * 0.75);
    while (c < bodyLen) {
      if (checkpointX === null && c >= checkAt) { const s = c; flat(7); checkpointX = (s + 3) * TILE; continue; }
      // arena del mini-jefe: suelo llano y despejado entre dos rejas
      if (miniCol === null && c >= miniAt) { miniCol = c; flat(MINI_W); continue; }
      const roll = R();
      let acc = 0;
      const pick = w => (acc += w) > roll;
      if (pick(0.3)) {
        // tramo llano con bloques, monedas y enemigos
        const n = ri(5, 10), s = c; flat(n);
        if (n >= 6 && h - 4 >= 3 && R() < 0.6) {
          const bn = ri(1, Math.min(4, n - 4)), bs = s + ri(1, n - bn - 2);
          for (let i = 0; i < bn; i++) { const q = R() < 0.5 || bn === 1; tiles[h - 4][bs + i] = q ? QBLOCK : BRICK; if (q) contents[(bs + i) + ',' + (h - 4)] = content(); }
          if (R() < 0.5) for (let i = 0; i < bn; i++) coin(bs + i, h - 5);
        } else if (R() < 0.5) for (let i = s + 1; i < s + n - 1; i++) coin(i, h - 2);
        if (c > 16 && R() < D.enemyRate) spawnGround(s + ri(2, n - 1), h);
        if (c > 16 && R() < D.enemyRate * 0.35) spawnAir(s + ri(1, n - 1), h - 5);
      } else if (pick(D.pitRate)) {
        // hueco
        let w = ri(2, D.maxGap), nh = Math.max(8, Math.min(13, h + ri(-2, 2)));
        if (nh < h) w = Math.max(2, Math.min(w, D.maxGap - 1));
        const topRow = Math.min(h, nh);
        for (let i = 0; i < w; i++) { coin(c, topRow - 3 - (i > 0 && i < w - 1 ? 1 : 0)); c++; }
        if (R() < D.enemyRate * 0.3) spawnAir(c - Math.ceil(w / 2), topRow - 4);
        h = nh; flat(ri(2, 4));
      } else if (pick(0.16)) {
        // escalón
        let nh = Math.max(8, Math.min(13, h + (R() < 0.5 ? -1 : 1) * ri(1, 3)));
        if (nh === h) nh = h - 1;
        h = nh; const s = c; flat(ri(3, 6));
        if (c > 16 && R() < D.enemyRate * 0.6) spawnGround(s + 2, h);
      } else if (pick(0.1 + D.pitRate * 0.3)) {
        // foso con plataformas flotantes
        const pitW = ri(6, 8 + (D.maxGap > 3 ? 2 : 0)), start = c;
        let pos = 0, lastRow = h;
        while (pitW - pos > 2) {
          const g = ri(1, 2); let L = ri(2, 3);
          if (pos + g + L > pitW - 1) L = pitW - 1 - pos - g;
          if (L <= 0) break;
          let pr = Math.max(6, Math.min(h - 1, lastRow + ri(-2, 1)));
          if (pr >= h) pr = h - 1;
          for (let i = 0; i < L; i++) { tiles[pr][start + pos + g + i] = PLAT; coin(start + pos + g + i, pr - 2); }
          lastRow = pr; pos += g + L;
        }
        c += pitW;
        if (R() < D.enemyRate * 0.5) spawnAir(start + Math.floor(pitW / 2), lastRow - 4);
        flat(ri(2, 4));
      } else if (pick(0.1)) {
        // columnas / obstáculos
        flat(2);
        const ph = ri(1, 3), pw = ri(1, 2);
        for (let i = 0; i < pw; i++) { setCol(c, h); for (let r = 1; r <= ph; r++) tiles[h - r][c] = BLOCK; coin(c, h - ph - 2); c++; }
        const s = c; flat(ri(3, 5));
        if (R() < D.enemyRate * 0.7) spawnGround(s + 1, h);
      } else {
        // escalera tipo pirámide
        const steps = ri(3, 4);
        for (let i = 0; i < steps; i++) { setCol(c, h); for (let r = 1; r <= i + 1; r++) tiles[h - r][c] = BLOCK; c++; }
        if (R() < 0.5) {
          const g = ri(1, 2); for (let i = 0; i < g; i++) { coin(c, h - steps - 2); c++; }
          for (let i = steps; i > 0; i--) { setCol(c, h); for (let r = 1; r <= i; r++) tiles[h - r][c] = BLOCK; c++; }
        } else for (let i = steps - 1; i > 0; i--) { setCol(c, h); for (let r = 1; r <= i; r++) tiles[h - r][c] = BLOCK; c++; }
        flat(2);
      }
    }
    // Zona final: bajar/subir a la altura estándar
    if (h !== 12) { if (h > 12) { h = 12; } else { while (h < 12) { flat(1); h = Math.min(12, h + 2); } } }
    const goalStart = c;
    cols = goalStart + extra;
    tiles = tiles.map(row => row.slice(0, cols));
    while (c < cols) setCol(c++, h);
    // pared final
    for (let r = 0; r < ROWS; r++) tiles[r][cols - 1] = BLOCK;
    const L = { locIdx, cols, tiles, contents, coins, spawns, checkpointX, goalStart, isFinal, seed, miniCol };
    if (isFinal) {
      L.arenaStart = goalStart + 12;
      const A = L.arenaStart;
      for (let i = 3; i < 6; i++) tiles[8][A + i] = PLAT;
      for (let i = 13; i < 16; i++) tiles[8][A + i] = PLAT;
      L.goalCol = A + 9;
    } else {
      L.catCol = goalStart + 21;
      L.goalCol = goalStart + 12;
    }
    // garantizar power-ups: uno antes del punto de control y otro después
    const mid = checkpointX !== null ? Math.floor(checkpointX / TILE) : Math.floor(goalStart / 2);
    ensurePower(L, R, 8, mid, ['bocadillo', 'bocadillo', 'mojo']);
    ensurePower(L, R, mid, goalStart - 2, ['bocadillo', 'mojo', 'mojo', 'turron']);
    // la arena del mini-jefe queda despejada (sin bloques por encima del suelo)
    if (miniCol !== null) for (let c2 = miniCol; c2 < miniCol + MINI_W; c2++) for (let r = 0; r < ROWS; r++) {
      if (tiles[r][c2] === TOP) break;
      tiles[r][c2] = EMPTY; delete contents[c2 + ',' + r];
    }
    // no dejar enemigos en la zona final
    L.spawns = L.spawns.filter(s => s.col < goalStart - 2 && s.col > 14 && (miniCol === null || s.col < miniCol - 2 || s.col > miniCol + MINI_W + 1));
    return L;
  }

  // Si el tramo [c0, c1) no tiene ningún power-up, convierte un bloque existente o coloca uno nuevo
  const POWERS = ['bocadillo', 'mojo', 'turron'];
  function ensurePower(L, R, c0, c1, choices) {
    const { tiles, contents } = L, pick = () => choices[Math.floor(R() * choices.length)];
    const inRange = k => { const c = +k.split(',')[0]; return c >= c0 && c < c1; };
    if (Object.keys(contents).some(k => inRange(k) && POWERS.includes(contents[k]))) return;
    // bloque ? existente del tramo
    const qs = Object.keys(contents).filter(inRange);
    if (qs.length) { contents[qs[Math.floor(R() * qs.length)]] = pick(); return; }
    // ladrillo existente -> bloque ?
    const bricks = [];
    for (let c = c0; c < c1; c++) for (let r = 3; r < ROWS; r++) if (tiles[r][c] === BRICK) bricks.push([c, r]);
    if (bricks.length) { const [c, r] = bricks[Math.floor(R() * bricks.length)]; tiles[r][c] = QBLOCK; contents[c + ',' + r] = pick(); return; }
    // bloque nuevo sobre suelo llano, con espacio libre por encima y a los lados
    const spots = [];
    for (let c = c0 + 1; c < c1 - 1; c++) {
      let g = -1; for (let r = 4; r < ROWS; r++) if (tiles[r][c] === TOP) { g = r; break; }
      if (g < 7 || tiles[g][c - 1] !== TOP || tiles[g][c + 1] !== TOP) continue;
      let clear = true;
      for (let dc = -1; dc <= 1 && clear; dc++) for (let r = g - 6; r < g; r++) if (tiles[r][c + dc] !== EMPTY) { clear = false; break; }
      if (clear) spots.push([c, g - 4]);
    }
    if (!spots.length) return;
    const [c, r] = spots[Math.floor(R() * spots.length)];
    tiles[r][c] = QBLOCK; contents[c + ',' + r] = pick();
  }

  // Comprueba con un grafo de alcanzabilidad que el nivel se puede completar
  function validate(L) {
    const { tiles, cols } = L, segs = [];
    const free = (c, r) => r < 0 || !isSolidTile(tiles[r][c]);
    for (let r = 3; r < ROWS; r++) {
      let cur = null;
      for (let c = 0; c < cols; c++) {
        const t = tiles[r][c], ok = (isSolidTile(t) || t === PLAT) && free(c, r - 1) && free(c, r - 2) && free(c, r - 3) && c < cols - 1;
        if (ok) { if (cur && cur.c1 === c - 1) cur.c1 = c; else { cur = { r, c0: c, c1: c, plat: t === PLAT }; segs.push(cur); } }
      }
    }
    const reach = (A, B) => {
      const dy = A.r - B.r; // >0: B está más alto
      if (dy > 4) return false;
      let gap;
      if (B.c0 > A.c1) gap = B.c0 - A.c1 - 1; else if (B.c1 < A.c0) gap = A.c0 - B.c1 - 1; else gap = -1;
      if (gap < 0) {
        if (dy <= 0) return B.c0 < A.c0 || B.c1 > A.c1;
        return dy <= 3 || (dy === 4 && B.plat);
      }
      if (dy <= 0) return gap <= 4 + Math.floor(-dy / 2);
      if (dy === 1) return gap <= 3;
      if (dy === 2) return gap <= 3;
      if (dy === 3) return gap <= 2;
      return gap <= 0;
    };
    const start = segs.find(s => s.c0 <= 1 && s.c1 >= 1);
    const goal = segs.find(s => s.c0 <= L.goalCol && s.c1 >= L.goalCol && s.r >= 10);
    if (!start || !goal) return false;
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const a = q.shift();
      if (a === goal) return true;
      for (const b of segs) if (!seen.has(b) && reach(a, b)) { seen.add(b); q.push(b); }
    }
    return false;
  }

  function generate(locIdx, diffKey, seed, isFinal) {
    const D = DIFFICULTY[diffKey];
    for (let i = 0; i < 80; i++) {
      const L = build(locIdx, D, seed + i * 7919, isFinal);
      if (validate(L)) { L.attempts = i + 1; return L; }
    }
    // Plan B (nunca debería ocurrir): nivel sin huecos
    return build(locIdx, Object.assign({}, D, { pitRate: 0, maxGap: 2 }), seed, isFinal);
  }
  return { generate, validate, build };
})();
