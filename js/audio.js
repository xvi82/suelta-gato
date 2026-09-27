// ============================================================
//  AUDIO: efectos y música chiptune sintetizados con WebAudio
// ============================================================
const Sound = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf, pulse25, pulse12;
  let musicOn = true, sfxOn = true;
  const prefs = (() => { try { return JSON.parse(localStorage.getItem('suelta-gato-audio') || '{}'); } catch (e) { return {}; } })();
  if (prefs.music === false) musicOn = false;
  if (prefs.sfx === false) sfxOn = false;
  const save = () => { try { localStorage.setItem('suelta-gato-audio', JSON.stringify({ music: musicOn, sfx: sfxOn })); } catch (e) {} };

  function makePulse(duty) {
    const n = 64, real = new Float32Array(n), imag = new Float32Array(n);
    for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
    return ctx.createPeriodicWave(real, imag);
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.7;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.55 : 0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pulse25 = makePulse(0.25); pulse12 = makePulse(0.125);
  }
  const now = () => ctx.currentTime;

  function osc(type, dest) {
    const o = ctx.createOscillator();
    if (type === 'pulse25') o.setPeriodicWave(pulse25);
    else if (type === 'pulse12') o.setPeriodicWave(pulse12);
    else o.type = type;
    return o;
  }
  // tono con envolvente y glissando opcional
  function tone({ type = 'square', f = 440, f2 = null, t = 0.1, v = 0.25, at = 0, attack = 0.004, dest = null, vib = 0 }) {
    if (!ctx) return;
    const s = now() + at, o = osc(type), g = ctx.createGain();
    o.frequency.setValueAtTime(f, s);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), s + t);
    if (vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 7; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(s); l.stop(s + t + 0.05);
    }
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(v, s + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, s + t);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(s); o.stop(s + t + 0.02);
  }
  function noise({ t = 0.15, v = 0.3, f = 2000, f2 = null, q = 1, type = 'bandpass', at = 0, dest = null }) {
    if (!ctx) return;
    const s = now() + at, src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; src.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, s); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, s + t);
    g.gain.setValueAtTime(v, s); g.gain.exponentialRampToValueAtTime(0.0001, s + t);
    src.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    src.start(s, Math.random() * 0.5); src.stop(s + t + 0.02);
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function jingle(notes, step, type = 'square', v = 0.2) {
    notes.forEach((n, i) => { if (n != null) tone({ type, f: mtof(n), t: step * 1.6, v, at: i * step }); });
  }

  // ---------------- efectos ----------------
  const sfx = {
    jump() { tone({ type: 'pulse25', f: 260, f2: 720, t: 0.16, v: 0.2 }); },
    punch() { noise({ t: 0.09, v: 0.35, f: 1400, f2: 400, q: 0.8 }); tone({ type: 'triangle', f: 180, f2: 70, t: 0.08, v: 0.3 }); },
    kick() { noise({ t: 0.14, v: 0.35, f: 900, f2: 250, q: 0.7 }); tone({ type: 'triangle', f: 140, f2: 50, t: 0.12, v: 0.35 }); },
    hit() { noise({ t: 0.12, v: 0.45, f: 3000, f2: 600, q: 0.6 }); tone({ type: 'square', f: 400, f2: 90, t: 0.12, v: 0.2 }); },
    stomp() { tone({ type: 'square', f: 320, f2: 900, t: 0.1, v: 0.22 }); noise({ t: 0.06, v: 0.25, f: 1800 }); },
    coin() { tone({ type: 'pulse25', f: 988, t: 0.07, v: 0.18 }); tone({ type: 'pulse25', f: 1319, t: 0.22, v: 0.18, at: 0.07 }); },
    bump() { tone({ type: 'triangle', f: 160, f2: 90, t: 0.1, v: 0.4 }); },
    brick() { noise({ t: 0.25, v: 0.45, f: 700, f2: 150, q: 0.5, type: 'lowpass' }); tone({ type: 'square', f: 200, f2: 60, t: 0.15, v: 0.15 }); },
    sprout() { for (let i = 0; i < 6; i++) tone({ type: 'square', f: 300 + i * 90, t: 0.05, v: 0.12, at: i * 0.04 }); },
    power() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ type: 'pulse25', f: mtof(n), t: 0.09, v: 0.2, at: i * 0.05 })); },
    weapon() { [67, 71, 74, 79].forEach((n, i) => tone({ type: 'square', f: mtof(n), t: 0.08, v: 0.18, at: i * 0.06 })); noise({ t: 0.3, v: 0.12, f: 5000, at: 0.1 }); },
    heal() { [72, 76, 79, 84].forEach((n, i) => tone({ type: 'triangle', f: mtof(n), t: 0.14, v: 0.3, at: i * 0.07 })); },
    powerdown() { [72, 67, 64, 60, 55].forEach((n, i) => tone({ type: 'square', f: mtof(n), t: 0.08, v: 0.16, at: i * 0.06 })); },
    hurt() { tone({ type: 'sawtooth', f: 600, f2: 150, t: 0.25, v: 0.2, vib: 40 }); },
    throw() { noise({ t: 0.12, v: 0.25, f: 2500, f2: 5000, q: 2 }); },
    fire() { noise({ t: 0.18, v: 0.3, f: 800, f2: 3000, q: 1 }); tone({ type: 'square', f: 200, f2: 500, t: 0.1, v: 0.1 }); },
    splat() { noise({ t: 0.2, v: 0.35, f: 400, f2: 120, q: 1.5, type: 'lowpass' }); tone({ type: 'sine', f: 300, f2: 80, t: 0.15, v: 0.3 }); },
    checkpoint() { [67, 72, 76, 79, 84].forEach((n, i) => tone({ type: 'pulse25', f: mtof(n), t: 0.12, v: 0.18, at: i * 0.08 })); },
    mama() { tone({ type: 'triangle', f: 880, f2: 620, t: 0.12, v: 0.22 }); tone({ type: 'triangle', f: 740, f2: 440, t: 0.2, v: 0.22, at: 0.13, vib: 25 }); },
    select() { tone({ type: 'pulse25', f: 660, t: 0.05, v: 0.15 }); },
    confirm() { tone({ type: 'square', f: 523, t: 0.07, v: 0.18 }); tone({ type: 'square', f: 1046, t: 0.15, v: 0.18, at: 0.07 }); },
    pause() { [76, 72, 76, 72].forEach((n, i) => tone({ type: 'square', f: mtof(n), t: 0.06, v: 0.15, at: i * 0.07 })); },
    boing() { tone({ type: 'sine', f: 150, f2: 600, t: 0.3, v: 0.35, vib: 30 }); },
    thud() { tone({ type: 'sine', f: 90, f2: 35, t: 0.35, v: 0.6 }); noise({ t: 0.3, v: 0.4, f: 300, type: 'lowpass' }); },
    meow(pitch = 1) {
      if (!ctx) return;
      const s = now(), o = osc('sawtooth'), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      fl.type = 'bandpass'; fl.Q.value = 4;
      o.frequency.setValueAtTime(420 * pitch, s); o.frequency.linearRampToValueAtTime(720 * pitch, s + 0.18); o.frequency.linearRampToValueAtTime(380 * pitch, s + 0.55);
      fl.frequency.setValueAtTime(700, s); fl.frequency.linearRampToValueAtTime(2200, s + 0.2); fl.frequency.linearRampToValueAtTime(800, s + 0.55);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.5, s + 0.05); g.gain.setValueAtTime(0.5, s + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.6);
      o.connect(fl); fl.connect(g); g.connect(sfxBus); o.start(s); o.stop(s + 0.65);
    },
    hiss() { noise({ t: 0.5, v: 0.4, f: 5000, q: 0.5, type: 'highpass' }); },
    die() { jingle([71, 70, 69, 68, null, 64, 62, 59, 55], 0.1, 'square', 0.2); },
    clear() { jingle([60, 64, 67, 72, null, 67, 72, 76, 79, null, 84, 84, 84], 0.09, 'pulse25', 0.2); },
    gameover() { jingle([67, null, 64, null, 60, null, 62, 60, 59, 60], 0.16, 'triangle', 0.35); },
    victory() { jingle([72, 72, 72, 72, null, 68, null, 70, null, 72, null, 70, 72, 72], 0.1, 'pulse25', 0.22); },
    tally() { tone({ type: 'pulse25', f: 1500, t: 0.03, v: 0.08 }); },
    balloon() { tone({ type: 'sine', f: 300, f2: 900, t: 0.6, v: 0.2, vib: 20 }); },
    yarn() { tone({ type: 'triangle', f: 700, f2: 300, t: 0.15, v: 0.2 }); },
  };

  // ---------------- música: canciones compuestas a mano ----------------
  // Cada canción tiene secciones (A, B...) con acordes por compás y una melodía escrita
  // como "nota:duración" en semicorcheas (16 por compás); "r" es silencio y "|" separa compases.
  // El bajo, el acompañamiento y la batería se generan a partir de los acordes según el estilo.
  const SONGS = {
    // Título: tema heroico y pegadizo
    title: { bpm: 140, lead: 'pulse25', echo: 3, bass: 'octave', acc: 'arp', drums: 'drive', form: 'AAB',
      A: { ch: 'C G Am F C G F G', m: `
        e5:2 g5:2 c6:4 b5:2 c6:2 d6:4 | b5:4 g5:4 d5:4 g5:4 | a5:2 c6:2 e6:4 d6:2 c6:2 b5:2 a5:2 | c6:6 a5:2 f5:8 |
        e5:2 g5:2 c6:4 b5:2 c6:2 e6:4 | d6:4 b5:2 g5:2 d6:4 b5:4 | a5:2 c6:2 f6:4 e6:2 d6:2 c6:2 a5:2 | b5:4 d6:4 g6:8` },
      B: { ch: 'Am F C G Am F D7 G', m: `
        e6:6 d6:2 c6:4 a5:4 | f5:2 a5:2 c6:2 f6:2 e6:4 c6:4 | g5:6 e5:2 c5:4 e5:4 | d5:2 g5:2 b5:2 d6:2 g6:4 f6:4 |
        e6:6 d6:2 c6:4 e6:4 | f6:4 e6:2 d6:2 c6:4 a5:4 | f#5:2 a5:2 c6:2 d6:2 f#6:4 e6:2 d6:2 | d6:4 b5:2 g5:2 g5:2 a5:2 b5:2 d6:2` } },
    // Las Palmas: calipso playero con marimba
    playas: { bpm: 132, lead: 'triangle', env: 'pluck', echo: 2, echoWave: 'pulse12', bass: 'calypso', acc: 'skank', drums: 'calypso', swing: 0.12, form: 'AABB',
      A: { ch: 'F Bb C F F Bb C7 F', m: `
        c5:2 f5:2 r:1 a5:3 g5:2 f5:2 a5:4 | bb5:3 a5:3 g5:2 f5:4 d5:4 | e5:2 g5:2 r:1 c6:3 bb5:2 a5:2 g5:4 | a5:6 f5:2 c5:8 |
        c5:2 f5:2 r:1 a5:3 g5:2 f5:2 c6:4 | d6:3 c6:3 bb5:2 a5:2 g5:2 f5:4 | e5:2 g5:2 bb5:2 c6:2 e6:3 d6:3 bb5:2 | c6:4 a5:4 f5:8` },
      B: { ch: 'Dm Bb F C Dm Bb Gm C7', m: `
        a5:3 a5:3 a5:2 f5:2 a5:2 d6:4 | d6:3 c6:3 bb5:2 f5:8 | c6:3 c6:3 c6:2 a5:2 c6:2 f6:4 | e6:6 d6:2 c6:8 |
        a5:3 a5:3 a5:2 f5:2 a5:2 d6:4 | f6:3 e6:3 d6:2 bb5:8 | g5:2 bb5:2 d6:2 g6:2 f6:3 e6:3 d6:2 | c6:4 bb5:2 g5:2 e5:2 g5:2 bb5:2 c6:2` } },
    // Cádiz: rumba flamenca con palmas y cadencia andaluza
    cadiz: { bpm: 150, lead: 'pulse25', env: 'pluck', echo: 3, bass: 'rumba', acc: 'strum', drums: 'rumba', form: 'AABB',
      A: { ch: 'Am G F E Am G F E', m: `
        e5:2 f5:1 e5:1 d5:2 c5:2 e5:4 a5:4 | g5:2 a5:1 g5:1 f5:2 e5:2 d5:4 b4:4 | a5:2 bb5:1 a5:1 g5:2 f5:2 a5:2 g5:2 f5:2 e5:2 | f5:2 e5:2 d5:2 c5:2 b4:2 c5:1 b4:1 g#4:4 |
        c6:2 b5:1 c6:1 a5:4 e5:2 a5:2 c6:4 | b5:2 a5:1 b5:1 g5:4 d5:2 g5:2 b5:4 | a5:2 g5:1 a5:1 f5:2 e5:2 f5:2 a5:2 g5:2 f5:2 | f5:2 e5:2 d5:2 f5:2 e5:8` },
      B: { ch: 'Dm Am E Am Dm Am F E', m: `
        f5:3 f5:3 f5:2 e5:2 f5:2 a5:4 | e5:3 e5:3 e5:2 d5:2 c5:2 e5:4 | g#5:2 a5:2 b5:2 c6:2 b5:2 a5:2 g#5:4 | a5:8 e5:4 c5:4 |
        d6:3 d6:3 d6:2 c6:2 bb5:2 a5:4 | c6:3 c6:3 c6:2 b5:2 a5:2 e5:4 | f5:2 g5:2 a5:2 bb5:2 a5:2 g5:2 f5:2 e5:2 | f5:1 e5:1 f5:2 e5:4 b4:4 e5:4` } },
    // Sotogrande: bossa nova de club de golf
    soto: { bpm: 116, lead: 'triangle', vib: 1, echo: 4, echoWave: 'sine', bass: 'bossa', acc: 'pad', drums: 'bossa', swing: 0.1, form: 'AABB',
      A: { ch: 'Dmaj7 Bm7 Em7 A7 Dmaj7 Bm7 Em7 A7', m: `
        f#5:3 a5:3 c#6:2 r:2 a5:2 f#5:4 | d6:6 b5:2 a5:2 f#5:2 d5:4 | e5:2 g5:2 b5:2 d6:2 c#6:2 b5:2 g5:4 | a5:6 g5:2 e5:2 c#5:2 a4:4 |
        f#5:3 a5:3 c#6:2 r:2 e6:2 d6:4 | b5:6 a5:2 f#5:2 d5:2 b4:4 | g5:2 b5:2 e6:2 d6:2 b5:2 g5:2 a5:2 g5:2 | e5:8 r:4 a4:2 c#5:2` },
      B: { ch: 'Gmaj7 Gm7 F#m7 B7 Em7 A7 Dmaj7 A7', m: `
        d5:2 f#5:2 b5:6 a5:2 f#5:4 | d5:2 f5:2 bb5:6 a5:2 f5:4 | c#5:2 e5:2 a5:6 g#5:2 e5:4 | d#5:2 f#5:2 a5:4 b5:4 r:4 |
        g5:3 f#5:3 e5:2 b5:3 a5:3 g5:2 | e5:2 g5:2 c#6:4 b5:2 a5:2 g5:4 | f#5:12 r:4 | a5:2 g5:2 e5:2 c#5:2 e5:4 r:4` } },
    // Madrid: chotis castizo de organillo
    madrid: { bpm: 120, lead: 'square', vib: 1, echo: 0, bass: 'oompah', acc: 'stab', drums: 'chotis', form: 'AABB',
      A: { ch: 'C C G7 G7 G7 G7 C C', m: `
        e5:3 f5:1 g5:4 c6:4 g5:4 | a5:3 g5:1 f5:3 e5:1 g5:8 | d5:3 e5:1 f5:4 b5:4 f5:4 | g5:3 f5:1 e5:3 d5:1 f5:8 |
        d5:3 e5:1 f5:4 g5:3 a5:1 b5:4 | d6:3 c6:1 b5:3 a5:1 g5:4 f5:4 | e5:3 g5:1 c6:4 e6:3 d6:1 c6:4 | c6:8 g5:4 r:4` },
      B: { ch: 'F F C C D7 G7 C G7', m: `
        a5:3 bb5:1 c6:4 f6:4 c6:4 | d6:3 c6:1 bb5:3 a5:1 c6:8 | g5:3 a5:1 g5:4 e6:4 g5:4 | c6:3 b5:1 a5:3 g5:1 e5:8 |
        f#5:3 g5:1 a5:4 d6:4 c6:4 | b5:3 c6:1 d6:4 f6:4 d6:4 | e6:3 d6:1 c6:3 g5:1 e5:4 g5:4 | f5:3 e5:1 d5:4 g5:4 r:4` } },
    // Parque Warner: marcha de dibujos animados, con escalas cromáticas
    warner: { bpm: 164, lead: 'pulse25', echo: 2, bass: 'octave', acc: 'stab', drums: 'cartoon', form: 'AABB',
      A: { ch: 'G E7 Am D7 G E7 A7 D7', m: `
        d5:2 g5:2 b5:2 d6:2 r:2 b5:2 d6:4 | g#5:2 b5:2 d6:2 e6:2 r:2 d6:2 b5:4 | c6:2 b5:2 a5:2 g#5:2 a5:2 c6:2 e6:4 | d6:2 c#6:2 d6:2 f#5:2 a5:2 c6:2 r:4 |
        d5:2 g5:2 b5:2 d6:2 r:2 g6:2 f#6:2 e6:2 | d6:2 b5:2 g#5:2 e5:2 r:2 g#5:2 b5:4 | c#6:2 e6:2 g6:2 e6:2 a5:4 c#6:4 | d6:4 a5:2 f#5:2 d5:2 e5:1 f#5:1 g5:2 a5:2` },
      B: { ch: 'C Cm G E7 A7 D7 G D7', m: `
        e6:6 d6:2 c6:2 g5:2 e5:4 | eb6:6 d6:2 c6:2 g5:2 eb5:4 | d6:2 b5:2 g5:2 b5:2 d6:2 g6:2 b6:4 | g#6:4 f6:2 e6:2 d6:2 b5:2 g#5:4 |
        a5:2 b5:2 c#6:2 d6:2 e6:2 f#6:2 g6:4 | f#6:4 e6:2 d6:2 c6:2 a5:2 f#5:4 | g5:2 r:2 g5:2 r:2 b5:2 d6:2 g6:4 | r:4 d6:2 c#6:2 c6:2 b5:2 a5:2 f#5:2` } },
    // Siam Park: pentatónica tailandesa con xilófono y bloques de madera
    siam: { bpm: 126, lead: 'pulse12', env: 'pluck', echo: 3, echoWave: 'triangle', bass: 'calypso', acc: 'arp', drums: 'siam', form: 'AABB',
      A: { ch: 'D D G A D Bm G A', m: `
        a5:2 b5:2 d6:2 e6:2 d6:2 b5:2 a5:4 | f#5:2 a5:2 b5:2 a5:2 f#5:2 e5:2 d5:4 | e5:2 f#5:2 a5:2 b5:2 d6:4 b5:4 | a5:2 b5:2 a5:2 f#5:2 e5:8 |
        a5:2 b5:2 d6:2 e6:2 f#6:4 e6:2 d6:2 | b5:4 a5:2 f#5:2 b5:4 d6:4 | e6:2 d6:2 b5:2 a5:2 b5:2 a5:2 f#5:2 e5:2 | e5:4 f#5:2 a5:2 e5:8` },
      B: { ch: 'G A F#m Bm G A D D', m: `
        d6:3 b5:3 d6:2 e6:4 d6:4 | e6:3 a5:3 e6:2 f#6:4 e6:4 | f#6:3 e6:3 c#6:2 a5:8 | b5:3 a5:3 f#5:2 d6:8 |
        d6:2 e6:2 d6:2 b5:2 a5:2 b5:2 d6:4 | e6:2 f#6:2 e6:2 c#6:2 a5:2 b5:2 c#6:4 | d6:8 a5:4 f#5:4 | a5:2 b5:2 a5:2 f#5:2 e5:4 r:4` } },
    // El Teide: épica volcánica en re menor
    teide: { bpm: 148, lead: 'square', vib: 1, echo: 3, bass: 'gallop', acc: 'arp', drums: 'drive', form: 'AABB',
      A: { ch: 'Dm C Bb C Dm C Bb A', m: `
        d5:2 a5:2 d6:4 c6:2 d6:2 a5:4 | g5:2 e5:2 c5:4 e5:2 g5:2 c6:4 | bb5:4 a5:2 g5:2 f5:4 d5:4 | e5:2 f5:2 g5:4 c6:4 e6:4 |
        f6:4 e6:2 d6:2 a5:4 d6:4 | e6:4 d6:2 c6:2 g5:4 c6:4 | d6:2 c6:2 bb5:2 a5:2 bb5:2 d6:2 f6:4 | e6:4 c#6:4 a5:4 e5:4` },
      B: { ch: 'Bb F C Dm Bb F Gm A', m: `
        f5:2 bb5:2 d6:6 c6:2 bb5:4 | a5:2 c6:2 f6:6 e6:2 c6:4 | g5:2 c6:2 e6:6 d6:2 c6:4 | d6:8 a5:4 f5:4 |
        f5:2 bb5:2 d6:6 f6:2 d6:4 | c6:2 f6:2 a6:6 g6:2 f6:4 | g6:4 f6:2 d6:2 bb5:4 g5:4 | a5:4 c#6:4 e6:4 a6:4` } },
    // Andorra: galope invernal con cascabeles
    nieve: { bpm: 150, lead: 'pulse12', vib: 1, echo: 3, echoWave: 'triangle', tr: -12, bass: 'octave', acc: 'arp', drums: 'sleigh', form: 'AABB',
      A: { ch: 'Am F C G Am F G E', m: `
        e6:2 c6:2 a5:2 c6:2 e6:4 a6:4 | g6:2 f6:2 e6:2 c6:2 a5:4 f5:4 | g5:2 c6:2 e6:2 g6:2 e6:4 c6:4 | d6:4 b5:2 g5:2 b5:4 d6:4 |
        e6:2 c6:2 a5:2 c6:2 e6:4 a6:4 | c7:4 b6:2 a6:2 f6:4 c6:4 | b6:2 a6:2 g6:2 d6:2 b5:2 d6:2 g6:4 | g#6:4 e6:4 b5:4 g#5:4` },
      B: { ch: 'Dm Am E Am Dm Am F E', m: `
        f6:3 e6:3 d6:2 a6:8 | c7:3 b6:3 a6:2 e6:8 | g#6:2 a6:2 b6:2 d7:2 c7:2 b6:2 g#6:4 | a6:12 e6:4 |
        d7:3 c7:3 a6:2 f7:8 | e7:3 d7:3 c7:2 a6:8 | f6:2 a6:2 c7:2 f7:2 e7:2 d7:2 c7:2 a6:2 | b6:4 g#6:4 e6:4 b5:4` } },
    // Jefes: tensión en mi menor armónica
    boss: { bpm: 176, lead: 'square', echo: 2, bass: 'drive', acc: 'arp', drums: 'boss', form: 'AABB',
      A: { ch: 'Em C Am B7 Em C D B7', m: `
        e5:2 r:1 e5:1 g5:2 e5:2 b5:3 a#5:1 b5:4 | c6:2 r:1 c6:1 b5:2 g5:2 e5:4 g5:4 | a5:2 r:1 a5:1 c6:2 a5:2 e6:3 d#6:1 e6:4 | f#6:2 e6:2 d#6:2 b5:2 f#5:2 a5:2 d#6:4 |
        e6:2 r:1 e6:1 d6:2 b5:2 g5:3 f#5:1 e5:4 | g5:2 r:1 g5:1 a5:2 b5:2 c6:3 b5:1 c6:4 | d6:2 r:1 d6:1 c6:2 a5:2 f#6:3 e6:1 d6:4 | d#6:4 f#6:4 b6:4 r:4` },
      B: { ch: 'Am Em Am B7 C D B7 B7', m: `
        a5:4 c6:4 e6:6 d6:2 | b5:4 g5:4 e5:6 f#5:2 | a5:4 c6:4 e6:4 a6:4 | a6:4 f#6:4 d#6:4 b5:4 |
        c6:2 e6:2 g6:2 e6:2 c6:2 e6:2 g6:2 c7:2 | d7:2 a6:2 f#6:2 d6:2 a6:2 f#6:2 d6:2 a5:2 | b5:2 d#6:2 f#6:2 b6:2 a6:2 f#6:2 d#6:2 b5:2 | b5:1 c6:1 b5:1 a#5:1 b5:4 f#5:4 d#5:4` } },
    // Turrón (invencible): frenética y en bucle corto
    star: { bpm: 192, lead: 'pulse25', echo: 1, bass: 'octave', acc: 'arp16', drums: 'star', form: 'AA',
      A: { ch: 'F Gm Bb C', m: `
        c6:2 c6:2 c6:2 r:2 a5:2 c6:2 r:2 f6:2 | d6:2 d6:2 d6:2 r:2 bb5:2 d6:2 r:2 g6:2 |
        f6:2 d6:2 bb5:2 d6:2 f6:2 bb6:2 f6:2 d6:2 | e6:2 g6:2 c7:2 g6:2 e6:2 c6:2 bb5:2 g5:2` } },
    // Final: tema cálido y emotivo
    ending: { bpm: 108, lead: 'triangle', vib: 1, echo: 4, echoWave: 'pulse12', bass: 'walk', acc: 'pad', drums: 'soft', swing: 0.08, form: 'AABB',
      A: { ch: 'C Am F G C Em F G', m: `
        e5:4 g5:4 c6:6 b5:2 | a5:8 e5:4 c6:4 | c6:4 a5:4 f5:4 a5:2 c6:2 | b5:8 d6:8 |
        e6:4 d6:4 c6:6 g5:2 | b5:8 g5:4 e5:4 | a5:4 c6:4 f6:4 e6:2 d6:2 | d6:12 r:4` },
      B: { ch: 'Am Em F C Dm G C G', m: `
        c6:4 e6:4 a6:6 g6:2 | g6:8 e6:4 b5:4 | a5:4 c6:4 f6:6 e6:2 | e6:8 c6:4 g5:4 |
        f5:4 a5:4 d6:6 c6:2 | b5:4 d6:4 g6:4 f6:4 | e6:8 g6:4 c7:4 | b6:4 a6:2 g6:2 d6:8` } },
  };
  // patrones de batería: 16 pasos; k=bombo s=caja h=charles o=charles abierto c=palmas r=madera j=cascabeles t=tom
  const DRUMS = {
    drive:   'kh - h k sh - h - kh - kh - sh - h h',
    calypso: 'kh - h k sh - h k kh - h k sh - hr -',
    rumba:   'kh - h c h - kc - kh - h c h - kc h',
    bossa:   'kh - h kr kh - hr - kh - hr k kh r h -',
    chotis:  'kh - j - sj - j - kh - j - sj - j j',
    cartoon: 'kh - h - sh - h k kh - k - sh - o -',
    siam:    'kh - t - rh - h - kh - t t rh - h r',
    sleigh:  'kj - j - sj - j - kj - kj - sj - j j',
    boss:    'kh k kh - sh - kh k kh - kh k sh - sh s',
    star:    'kh - kh - sh - kh - kh - kh - sh h sh s',
    soft:    'kh - h - rh - h - kh - h - rh - h -',
  };
  const FILLS = { boss: 't t t t s s s s', star: 's s s s s s s s', siam: 'r r t t t - t t', rumba: 'c - c - c c c c', bossa: 'r - r - r - r r', soft: 'r - r - r - r r' };
  // bajo: [paso, intervalo, duración]; r=fundamental 5=quinta 3=tercera 8=octava l=quinta grave a=aproximación al siguiente acorde
  const BASS = {
    octave:  [[0, 'r', 2], [2, '8', 2], [4, 'r', 2], [6, '8', 2], [8, 'r', 2], [10, '8', 2], [12, 'r', 2], [14, '8', 2]],
    drive:   [[0, 'r', 1], [1, 'r', 1], [2, '8', 2], [4, 'r', 1], [5, 'r', 1], [6, '8', 2], [8, 'r', 1], [9, 'r', 1], [10, '8', 2], [12, 'r', 1], [13, 'r', 1], [14, '5', 2]],
    calypso: [[0, 'r', 3], [3, '5', 1], [4, '8', 2], [6, '5', 2], [8, 'r', 3], [11, '5', 1], [12, '8', 2], [14, '5', 2]],
    rumba:   [[0, 'r', 3], [3, '5', 3], [6, '8', 2], [8, 'r', 3], [11, '5', 3], [14, '3', 2]],
    bossa:   [[0, 'r', 3], [3, 'l', 1], [4, 'l', 4], [8, 'r', 3], [11, 'l', 1], [12, 'l', 4]],
    oompah:  [[0, 'r', 3], [8, 'l', 3]],
    gallop:  [[0, 'r', 1], [2, 'r', 1], [3, 'r', 1], [4, '8', 2], [6, 'r', 1], [7, 'r', 1], [8, '5', 1], [10, '5', 1], [11, '5', 1], [12, '8', 2], [14, '5', 1], [15, 'r', 1]],
    walk:    [[0, 'r', 4], [4, '3', 4], [8, '5', 4], [12, 'a', 4]],
  };
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
  const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  const parseNote = s => { const m = s.match(/^([a-g])([#b]?)(\d)$/); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const parseChord = s => { const m = s.match(/^([A-G])([#b]?)(.*)$/); return { pc: (PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, q: QUAL[m[3]] || QUAL[''] }; };
  const cache = {};
  function compose(name) {
    if (cache[name]) return cache[name];
    const def = SONGS[name], tr = def.tr || 0;
    const total = [...def.form].reduce((a, k) => a + def[k].ch.trim().split(/\s+/).length * 16, 0);
    const ev = Array.from({ length: total }, () => []), drum = new Array(total).fill('');
    const add = (i, e) => ev[i % total].push(e);
    let base = 0;
    for (const key of def.form) {
      const sec = def[key], chords = sec.ch.trim().split(/\s+/).map(parseChord);
      // melodía (y su eco, estilo NES: la misma línea retrasada y más suave)
      let pos = base;
      sec.m.trim().split('|').forEach((bar, bi) => {
        const start = pos;
        bar.trim().split(/\s+/).forEach(tok => {
          const [n, l] = tok.split(':'), len = +l;
          if (n !== 'r') {
            const m = parseNote(n) + tr;
            add(pos, { ch: 'lead', n: m, len });
            if (def.echo) add(pos + def.echo, { ch: 'echo', n: m, len });
          }
          pos += len;
        });
        if (pos - start !== 16) console.warn(`música ${name}.${key} compás ${bi + 1}: ${pos - start} pasos`);
      });
      chords.forEach((ch, b) => {
        const i0 = base + b * 16, next = chords[(b + 1) % chords.length];
        // bajo
        const r = 36 + ch.pc;
        for (const [s, iv, len] of BASS[def.bass]) {
          const n = iv === 'r' ? r : iv === '8' ? r + 12 : iv === '5' ? r + 7 : iv === 'l' ? r - 5 : iv === '3' ? r + ch.q[1]
            : next.pc === ch.pc ? r + 7 : 35 + next.pc;
          add(i0 + s, { ch: 'bass', n: n < 31 ? n + 12 : n, len });
        }
        // acompañamiento con el acorde colocado entre sol3 y sol4
        const tones = ch.q.map(q => { let n = 60 + ch.pc + q; while (n > 67) n -= 12; while (n < 55) n += 12; return n; }).sort((a, c) => a - c);
        const chord = (s, len, v, roll) => tones.forEach((n, k) => add(i0 + s, { ch: 'acc', n, len, v, d: roll ? k * 0.014 : 0 }));
        if (def.acc === 'arp') for (let s = 1; s < 16; s += 2) add(i0 + s, { ch: 'acc', n: tones[(s >> 1) % tones.length] + (s > 8 ? 12 : 0), len: 1 });
        if (def.acc === 'arp16') for (let s = 0; s < 16; s++) add(i0 + s, { ch: 'acc', n: tones[s % tones.length] + 12 * ((s >> 2) & 1), len: 1 });
        if (def.acc === 'skank') [2, 6, 10, 14].forEach(s => chord(s, 1, 0.045));
        if (def.acc === 'stab') [4, 12].forEach(s => chord(s, 2, 0.05));
        if (def.acc === 'strum') [0, 3, 6, 8, 11, 14].forEach(s => chord(s, 2, s % 8 === 0 ? 0.06 : 0.04, true));
        if (def.acc === 'pad') chord(0, 16, 0.035);
        // batería con redoble al final de cada sección y platillo al empezarla
        const pat = DRUMS[def.drums].split(' '), fill = b === chords.length - 1 ? (FILLS[def.drums] || 's s s s s s s s').split(' ') : null;
        for (let s = 0; s < 16; s++) {
          let d = pat[s] === '-' ? '' : pat[s];
          if (fill && s >= 8 && (s >= 12 || FILLS[def.drums])) d = (d.includes('k') ? 'k' : '') + (fill[s - 8] === '-' ? '' : fill[s - 8]);
          if (b === 0 && s === 0) d += 'x';
          drum[i0 + s] = d;
        }
      });
      base += chords.length * 16;
    }
    return (cache[name] = { def, steps: total, ev, drum });
  }
  let cur = null, curName = null, step = 0, nextTime = 0, timer = null, songGain = null;
  function playNote(type, m, dur, t, v, dest, env, vib) {
    const o = osc(type), g = ctx.createGain();
    o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    if (env === 'pluck') g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur + 0.05, 0.45));
    else { g.gain.setValueAtTime(v * 0.75, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    if (vib && dur > 0.25) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * 0.012, t + 0.25);
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function hit(t, dest, { f = 2000, type = 'bandpass', q = 1, len = 0.05, v = 0.2 }) {
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(fl); fl.connect(g); g.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + len + 0.01);
  }
  function sweep(t, dest, f1, f2, len, v, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + len);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + 0.01);
  }
  function drumHit(k, t, dest) {
    if (k === 'k') sweep(t, dest, 150, 40, 0.15, 0.9);
    else if (k === 's') { hit(t, dest, { f: 1800, len: 0.13, v: 0.45 }); sweep(t, dest, 220, 120, 0.06, 0.25, 'triangle'); }
    else if (k === 'h') hit(t, dest, { f: 7000, type: 'highpass', len: 0.04, v: 0.16 });
    else if (k === 'o') hit(t, dest, { f: 7000, type: 'highpass', len: 0.22, v: 0.12 });
    else if (k === 'c') [0, 0.011, 0.022].forEach(d => hit(t + d, dest, { f: 1200, q: 1.5, len: d ? 0.09 : 0.02, v: 0.35 }));
    else if (k === 'r') sweep(t, dest, 1700, 1200, 0.05, 0.3, 'triangle');
    else if (k === 'j') { hit(t, dest, { f: 8500, q: 4, len: 0.09, v: 0.22 }); hit(t + 0.03, dest, { f: 9500, q: 4, len: 0.07, v: 0.14 }); }
    else if (k === 't') sweep(t, dest, 240, 110, 0.18, 0.55);
    else if (k === 'x') hit(t, dest, { f: 5000, type: 'highpass', len: 0.9, v: 0.16 });
  }
  function tick() {
    if (!cur || !ctx) return;
    const def = cur.def, sp = 60 / def.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % cur.steps, t = nextTime + (i % 4 === 2 ? (def.swing || 0) * sp * 2 : 0);
      for (const e of cur.ev[i]) {
        if (e.ch === 'lead') playNote(def.lead, e.n, e.len * sp * 0.95, t, 0.2, songGain, def.env, def.vib);
        else if (e.ch === 'echo') playNote(def.echoWave || 'pulse12', e.n, e.len * sp * 0.9, t, 0.055, songGain, def.env);
        else if (e.ch === 'bass') playNote('triangle', e.n, e.len * sp * 0.9, t, 0.48, songGain);
        else playNote(def.acc === 'pad' ? 'triangle' : 'pulse12', e.n, e.len * sp * (def.acc === 'pad' ? 1 : 0.8), t + (e.d || 0), e.v || 0.055, songGain, def.acc === 'strum' ? 'pluck' : null);
      }
      for (const k of cur.drum[i]) drumHit(k, t, songGain);
      step++; nextTime += sp;
    }
  }
  function play(name) {
    if (!ctx || curName === name) return;
    stop();
    curName = name; cur = compose(name); step = 0; nextTime = ctx.currentTime + 0.05;
    songGain = ctx.createGain(); songGain.gain.value = 1; songGain.connect(musicBus);
    timer = setInterval(tick, 25); tick();
  }
  function stop() {
    if (timer) clearInterval(timer); timer = null;
    if (songGain && ctx) { const g = songGain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); setTimeout(() => g.disconnect(), 300); }
    songGain = null; cur = null; curName = null;
  }
  return {
    init, play, stop, get current() { return curName; },
    sfx: new Proxy(sfx, { get: (o, k) => (...a) => { if (ctx && sfxOn && o[k]) o[k](...a); } }),
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; },
    toggleMusic() { musicOn = !musicOn; if (musicBus) musicBus.gain.value = musicOn ? 0.32 : 0; save(); },
    toggleSfx() { sfxOn = !sfxOn; if (sfxBus) sfxBus.gain.value = sfxOn ? 0.55 : 0; save(); },
    duck(on) { if (musicBus && musicOn) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.32, ctx.currentTime, 0.05); },
  };
})();
