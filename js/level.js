// ============================================================
//  NIVELES: ubicaciones, dificultad, generador aleatorio y validador
// ============================================================
const ROWS = 15, TILE = 24;
// tiles del mapa
const EMPTY = 0, TOP = 1, FILL = 2, BRICK = 3, QBLOCK = 4, USED = 5, PLAT = 6, BLOCK = 7, PIPE = 8, HIDDEN = 9, BOTIJO = 10;
const isSolidTile = t => t === TOP || t === FILL || t === BRICK || t === QBLOCK || t === USED || t === BLOCK || t === PIPE || t === BOTIJO;
// Sala secreta (se entra por una tubería): columnas que se añaden tras la pared final
const ROOM_W = 22;
// Letras que hay que juntar en cada nivel
const LETTERS = ['M', 'A', 'C', 'H', 'Í', 'N'];
// Tramos propios de cada ubicación (se reparten a lo largo del nivel)
const LOCAL_TRAMOS = {
  laspalmas: ['marea'], cadiz: ['viento'], sotogrande: ['golf'], madrid: ['metro'], warner: ['montana'],
  siam: ['tobogan', 'flotadores'], teide: ['erupcion', 'geiser'], andorra: ['telesilla', 'aludes'],
};

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
    // Atracciones (plataformas que se mueven, muelles, zonas con efectos...) y tramos
    // "virtuales" para el validador: por donde pasa una plataforma se puede ir de pie.
    const objs = [], vsegs = [], hot = [];
    const vseg = (r, c0, c1) => vsegs.push({ r, c0, c1, plat: true });
    let pipe = null, botijos = 0, hiddens = 0;
    const TR = {
      // foso con plataformas que se caen al pisarlas
      cae() {
        const pitW = ri(7, 9), start = c;
        let pos = 0, lastRow = h;
        while (pitW - pos > 2) {
          const g = ri(1, 2); let w = 2;
          if (pos + g + w > pitW - 1) w = pitW - 1 - pos - g;
          if (w <= 0) break;
          const pc = start + pos + g, pr = Math.max(6, Math.min(h - 1, lastRow + ri(-1, 1)));
          objs.push({ kind: 'cae', c: pc, r: pr, w }); vseg(pr, pc, pc + w - 1);
          for (let i = 0; i < w; i++) coin(pc + i, pr - 2);
          hot.push({ col: pc, row: pr - 3 });
          lastRow = pr; pos += g + w;
        }
        c += pitW; flat(ri(2, 4));
      },
      // foso ancho con una plataforma que va y viene
      mov() {
        const pitW = ri(9, 12), start = c, pr = h - ri(0, 1), w = 3, span = pitW - w - 2;
        objs.push({ kind: 'mov', c: start + 1, r: pr, w, dx: span, dy: 0, period: 150 + span * 16 });
        vseg(pr, start + 1, start + pitW - 2);
        for (let i = 2; i < pitW - 2; i += 2) coin(start + i, pr - 3);
        hot.push({ col: start + (pitW >> 1), row: pr - 4 });
        if (R() < D.enemyRate * 0.4) spawnAir(start + (pitW >> 1), pr - 5);
        c += pitW; flat(ri(3, 5));
      },
      // ascensor: una plataforma sube y baja junto a un muro demasiado alto para saltarlo
      ascensor() {
        if (h < 12) { h = ri(12, 13); flat(2); }
        const start = c, low = h, top = h - 5;
        objs.push({ kind: 'mov', c: start, r: low, w: 2, dx: 0, dy: top - low, period: 260 });
        for (let r = top; r <= low; r++) vseg(r, start, start + 1);
        for (let r = top; r < low - 2; r++) coin(start + (r % 2), r - 1);
        c += 2; h = top; flat(ri(4, 6));
        hot.push({ col: start + 4, row: top - 3 });
      },
      // muelle que te lanza hasta una plataforma muy alta con premio
      muelle() {
        const n = ri(7, 9), s = c; flat(n);
        objs.push({ kind: 'muelle', c: s + 2, r: h });
        const pr = Math.max(3, h - 8);
        for (let i = 0; i < 4; i++) { tiles[pr][s + 3 + i] = PLAT; coin(s + 3 + i, pr - 1); }
        hot.push({ col: s + 5, row: pr - 2 });
      },
      // tubería (o alcantarilla) que lleva a la sala secreta: una por nivel
      tuberia() {
        const n = ri(7, 9), s = c; flat(n);
        if (pipe) return;
        const pc = s + 3;
        tiles[h - 1][pc] = tiles[h - 1][pc + 1] = tiles[h - 2][pc] = tiles[h - 2][pc + 1] = PIPE;
        pipe = { c: pc, r: h - 2 };
        coin(pc, h - 4); coin(pc + 1, h - 4);
      },
      // Las Palmas: la marea sube y baja e inunda la hondonada
      marea() {
        if (h > 11) h = 11;
        flat(2);
        const n = ri(8, 11), low = h + 2, s = c;
        for (let i = 0; i < n; i++) setCol(c++, low);
        flat(2);
        objs.push({ kind: 'marea', c: s, w: n, r: low });
        for (let i = 1; i < n - 1; i += 2) coin(s + i, low - 2);
        hot.push({ col: s + (n >> 1), row: low - 2 });
        if (R() < D.enemyRate) spawnGround(s + ri(2, n - 3), low);
      },
      // Cádiz: ráfagas de levante que te empujan hacia atrás
      viento() {
        const s = c; flat(3);
        const gaps = ri(2, 3);
        for (let k = 0; k < gaps; k++) {
          for (let i = 0; i < 2; i++) { coin(c, h - 3); c++; }
          flat(ri(3, 5));
          if (R() < D.enemyRate * 0.5) spawnGround(c - 2, h);
        }
        objs.push({ kind: 'viento', c: s, w: c - s });
        hot.push({ col: s + 4, row: h - 5 });
        if (R() < D.enemyRate * 0.5) spawnAir(s + ((c - s) >> 1), h - 5);
      },
      // Sotogrande: búnker de arena (se corre y se salta menos) y un hoyo de golf con premio
      golf() {
        if (h > 12) h = 12;
        const s = c; flat(6);
        objs.push({ kind: 'bunker', c: s + 1, w: 4 });
        if (R() < D.enemyRate) spawns.push({ kind: 'topo', col: s + 3, row: h });
        flat(3);
        const hc = c; setCol(c++, h + 1); setCol(c++, h + 1);
        objs.push({ kind: 'hoyo', c: hc, r: h + 1 });
        flat(4);
        hot.push({ col: hc + 3, row: h - 4 });
      },
      // Madrid: vagones de metro que pasan por el foso y hacen de plataforma
      metro() {
        if (h > 12) h = 12;
        flat(1);
        const pitW = ri(10, 13), s = c;
        objs.push({ kind: 'metro', c: s, w: pitW, r: h + 1, n: 2, ww: 4, speed: 1.1 + R() * 0.4 });
        vseg(h + 1, s, s + pitW - 1);
        for (let i = 2; i < pitW - 1; i += 3) coin(s + i, h - 2);
        hot.push({ col: s + (pitW >> 1), row: h - 3 });
        c += pitW; flat(ri(3, 4));
      },
      // Parque Warner: vagoneta de montaña rusa que acelera y se estrella al final
      montana() {
        flat(1);
        const pitW = ri(12, 15), s = c;
        objs.push({ kind: 'vagoneta', c: s, w: pitW, r: h });
        vseg(h, s, s + pitW - 1);
        for (let i = 3; i < pitW - 1; i++) coin(s + i, h - 3 - Math.round(Math.sin((i - 3) / (pitW - 4) * Math.PI) * 2));
        hot.push({ col: s + (pitW >> 1), row: h - 6 });
        c += pitW;
        setCol(c, h); tiles[h - 1][c] = BLOCK; tiles[h - 2][c] = BLOCK; c++;
        flat(ri(6, 8)); // sitio para aterrizar si sales despedido
      },
      // Siam Park: tobogán cuesta abajo (te deslizas sin poder frenar)
      tobogan() {
        const hs = Math.max(6, Math.min(h, 8));
        while (h > hs) { h--; setCol(c++, h); setCol(c++, h); }
        flat(2);
        const s = c, drop = Math.min(5, 13 - h), h0 = h;
        for (let k = 1; k <= drop; k++) { h = h0 + k; setCol(c++, h); setCol(c++, h); coin(c - 1, h - 2); }
        objs.push({ kind: 'tobogan', c: s, w: c - s, r0: h0, r1: h });
        hot.push({ col: s + drop, row: h0 + (drop >> 1) - 3 });
        if (R() < D.enemyRate) spawnAir(s + drop, h0 - 2);
        flat(ri(4, 6));
      },
      // Siam Park: piscina con flotadores que se hunden si te quedas encima
      flotadores() {
        if (h > 12) h = 12;
        flat(1);
        const n = ri(2, 3), pitW = n * 3 + 1, s = c;
        for (let k = 0; k < n; k++) {
          const fc = s + 1 + k * 3;
          objs.push({ kind: 'flotador', c: fc, r: h, w: 2 }); vseg(h, fc, fc + 1);
          coin(fc, h - 2); coin(fc + 1, h - 2);
        }
        objs.push({ kind: 'piscina', c: s, w: pitW, r: h });
        hot.push({ col: s + (pitW >> 1), row: h - 4 });
        c += pitW; flat(ri(3, 4));
      },
      // El Teide: lluvia de rocas de lava (su sombra avisa de dónde caen)
      erupcion() {
        const s = c; flat(4);
        for (let k = 0; k < 2; k++) {
          if (R() < 0.5) h = Math.max(8, Math.min(13, h + (R() < 0.5 ? -1 : 1)));
          flat(ri(4, 6));
          if (R() < 0.5) { for (let i = 0; i < 2; i++) { coin(c, h - 3); c++; } flat(2); }
        }
        flat(2);
        objs.push({ kind: 'erupcion', c: s, w: c - s });
        hot.push({ col: s + 6, row: h - 5 });
      },
      // El Teide: géiser que te lanza muy alto
      geiser() {
        const n = ri(7, 9), s = c; flat(n);
        const gc = s + 3;
        objs.push({ kind: 'geiser', c: gc, r: h });
        const pr = Math.max(3, h - 8);
        for (let i = 0; i < 3; i++) { tiles[pr][gc - 1 + i] = PLAT; coin(gc - 1 + i, pr - 1); }
        hot.push({ col: gc, row: pr - 2 });
      },
      // Andorra: telesilla que sube en diagonal hasta una ladera más alta
      telesilla() {
        if (h < 12) h = ri(12, 13);
        flat(2);
        const pitW = ri(9, 11), s = c, top = h - ri(4, 5);
        objs.push({ kind: 'telesilla', c: s, w: pitW, r0: h, r1: top, n: 3 });
        const xs = (s - 2) * TILE, xe = (s + pitW) * TILE, ys = h * TILE, ye = top * TILE, cw = 2 * TILE;
        for (let f = 0; f <= 1.0001; f += 0.02) {
          const x = xs + (xe - xs) * f, y = ys + (ye - ys) * f;
          const c0 = Math.max(s, Math.floor(x / TILE)), c1 = Math.min(s + pitW - 1, Math.floor((x + cw - 1) / TILE));
          if (c1 >= c0) vseg(Math.floor(y / TILE), c0, c1);
        }
        for (let i = 1; i < pitW - 1; i += 2) coin(s + i, Math.round(h - (h - top) * (i + 2) / (pitW + 2)) - 3);
        hot.push({ col: s + (pitW >> 1), row: Math.round((h + top) / 2) - 4 });
        c += pitW; h = top; flat(ri(4, 6));
      },
      // Andorra: bolas de nieve que bajan rodando y van creciendo
      aludes() {
        const s = c; flat(ri(14, 18));
        objs.push({ kind: 'aludes', c: s, w: c - s });
        for (let i = s + 3; i < c - 2; i += 3) coin(i, h - 4);
        hot.push({ col: s + 8, row: h - 5 });
      },
    };
    // Reparto fijo: atracciones de la ubicación y comunes a todos los niveles
    const local = LOCAL_TRAMOS[loc.painter] || [];
    const sched = [];
    [0.12, 0.3, 0.58, 0.86].forEach((f, i) => { if (local.length) sched.push({ at: Math.floor(bodyLen * f), k: local[i % local.length] }); });
    [[0.2, 'cae'], [0.34 + R() * 0.1, 'tuberia'], [0.46, 'mov'], [0.64, 'muelle'], [0.93, R() < 0.5 ? 'ascensor' : 'cae']]
      .forEach(([f, k]) => sched.push({ at: Math.floor(bodyLen * f), k }));
    sched.sort((a, b) => a.at - b.at);
    flat(12);
    let checkpointX = null, miniCol = null;
    const checkAt = Math.floor(bodyLen / 2), miniAt = Math.floor(bodyLen * 0.75);
    while (c < bodyLen) {
      if (checkpointX === null && c >= checkAt) { const s = c; flat(7); checkpointX = (s + 3) * TILE; continue; }
      // arena del mini-jefe: suelo llano y despejado entre dos rejas
      if (miniCol === null && c >= miniAt) { miniCol = c; flat(MINI_W); continue; }
      if (sched.length && c >= sched[0].at) { TR[sched.shift().k](); continue; }
      const roll = R();
      let acc = 0;
      const pick = w => (acc += w) > roll;
      if (c > 20 && pick(0.035)) TR.cae();
      else if (c > 20 && pick(0.03)) TR.mov();
      else if (c > 20 && pick(0.025)) TR.muelle();
      else if (c > 20 && local.length && pick(0.04)) TR[local[Math.floor(R() * local.length)]]();
      else if (pick(0.3)) {
        // tramo llano con bloques, monedas y enemigos
        const n = ri(5, 10), s = c; flat(n);
        if (n >= 6 && h - 4 >= 3 && R() < 0.6) {
          const bn = ri(1, Math.min(4, n - 4)), bs = s + ri(1, n - bn - 2);
          for (let i = 0; i < bn; i++) {
            // el botijo mágico: uno por nivel, entre los bloques
            if (!botijos && bn >= 2 && i === 0 && c > 30 && R() < 0.35) { tiles[h - 4][bs] = BOTIJO; botijos++; continue; }
            const q = R() < 0.5 || bn === 1; tiles[h - 4][bs + i] = q ? QBLOCK : BRICK; if (q) contents[(bs + i) + ',' + (h - 4)] = content();
          }
          if (R() < 0.5) for (let i = 0; i < bn; i++) coin(bs + i, h - 5);
        } else {
          if (R() < 0.5) for (let i = s + 1; i < s + n - 1; i++) coin(i, h - 2);
          // bloque invisible con una vida extra (como mucho dos por nivel)
          if (hiddens < 2 && c > 30 && n >= 5 && h - 4 >= 3 && R() < 0.14) { tiles[h - 4][s + ri(1, n - 2)] = HIDDEN; hiddens++; }
        }
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
    const mainCols = cols;
    // Sala secreta: una cueva cerrada detrás de la pared final, llena de pesetas.
    // Se baja por la tubería del nivel y se vuelve por la tubería del fondo de la sala.
    let room = null;
    if (pipe) {
      const r0 = cols; cols += ROOM_W;
      tiles = tiles.map(row => { const n = new Uint8Array(cols); n.set(row); return n; });
      for (let r = 0; r < ROWS; r++) { tiles[r][r0] = BLOCK; tiles[r][cols - 1] = BLOCK; }
      for (let cc = r0 + 1; cc < cols - 1; cc++) { for (let r = 0; r < 3; r++) tiles[r][cc] = BLOCK; setCol(cc, 12); }
      tiles[3][r0 + 2] = tiles[3][r0 + 3] = PIPE; // entrada: cuelga del techo
      const ex = cols - 5;
      tiles[10][ex] = tiles[10][ex + 1] = tiles[11][ex] = tiles[11][ex + 1] = PIPE;
      for (let cc = r0 + 5; cc < ex - 1; cc++) { coin(cc, 11); coin(cc, 10); if (cc % 2) coin(cc, 5); }
      for (const cc of [r0 + 7, r0 + 11, r0 + 15]) { tiles[8][cc] = QBLOCK; contents[cc + ',8'] = 'multi'; }
      room = { c0: r0, c1: cols - 1, entry: r0 + 2, exit: ex };
    }
    // si no ha salido ningún botijo, un ladrillo se convierte en botijo
    if (!botijos) {
      const cand = [];
      for (let cc = 30; cc < goalStart - 2; cc++) for (let r = 3; r < ROWS; r++) if (tiles[r][cc] === BRICK && (miniCol === null || cc < miniCol || cc >= miniCol + MINI_W)) cand.push([cc, r]);
      if (cand.length) { const [cc, r] = cand[Math.floor(R() * cand.length)]; tiles[r][cc] = BOTIJO; botijos++; }
      else {
        // o se coloca sobre un suelo llano con sitio libre por encima
        const spots = [];
        for (let cc = 31; cc < goalStart - 3; cc++) {
          if (miniCol !== null && cc >= miniCol - 1 && cc <= miniCol + MINI_W) continue;
          let g = -1; for (let r = 4; r < ROWS; r++) if (tiles[r][cc] === TOP) { g = r; break; }
          if (g < 7 || tiles[g][cc - 1] !== TOP || tiles[g][cc + 1] !== TOP) continue;
          let clear = true;
          for (let dc = -1; dc <= 1 && clear; dc++) for (let r = g - 6; r < g; r++) if (tiles[r][cc + dc] !== EMPTY) { clear = false; break; }
          if (clear) spots.push([cc, g - 4]);
        }
        if (spots.length) { const [cc, r] = spots[Math.floor(R() * spots.length)]; tiles[r][cc] = BOTIJO; botijos++; }
      }
    }
    // Letras M-A-C-H-Í-N: una en cada sexto del nivel, en sitios arriesgados (y a veces una en la sala secreta)
    const letters = [], lo = 16, span = (goalStart - 4 - lo) / LETTERS.length;
    const okSpot = p => p.row >= 1 && p.row < ROWS && !isSolidTile(tiles[p.row][p.col]) && tiles[p.row][p.col] !== HIDDEN && (miniCol === null || p.col < miniCol - 1 || p.col > miniCol + MINI_W);
    const roomLetter = room ? ri(0, LETTERS.length - 1) : -1;
    for (let i = 0; i < LETTERS.length; i++) {
      if (i === roomLetter) { letters.push({ i, col: room.c0 + 11, row: 6 }); continue; }
      const a = lo + span * i, b = a + span, inB = p => p.col >= a && p.col < b && okSpot(p);
      let pool = hot.filter(inB), fromCoins = false;
      if (!pool.length) { pool = coins.filter(inB); fromCoins = true; }
      if (pool.length) {
        const p = pool[Math.floor(R() * pool.length)];
        letters.push({ i, col: p.col, row: p.row });
        const k = coins.findIndex(q => q.col === p.col && q.row === p.row); if (k >= 0) coins.splice(k, 1);
        continue;
      }
      // sin sitios buenos: flotando un poco por encima del suelo
      const mid = Math.floor((a + b) / 2);
      for (let d = 0; d < b - a; d++) {
        const cc = mid + (d % 2 ? -(d + 1) / 2 : d / 2);
        let g = -1; for (let r = 3; r < ROWS; r++) if (tiles[r][cc] === TOP) { g = r; break; }
        if (g > 3 && okSpot({ col: cc, row: g - 3 }) && okSpot({ col: cc, row: g - 1 })) { letters.push({ i, col: cc, row: g - 3 }); break; }
      }
    }
    const L = { locIdx, cols, mainCols, tiles, contents, coins, spawns, checkpointX, goalStart, isFinal, seed, miniCol, objs, vsegs, pipe, room, letters };
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
    // recorridos de las plataformas móviles, vagones, telesillas...
    for (const v of L.vsegs || []) segs.push(Object.assign({}, v));
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
