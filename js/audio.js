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

  // ---------------- música (compositor procedural determinista) ----------------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygdom: [0, 1, 4, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], harm: [0, 2, 3, 5, 7, 8, 11],
  };
  const QUAL = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], dim: [0, 3, 6] };
  const SONG_DEFS = {
    title:   { bpm: 132, key: 60, scale: 'major', prog: ['0M', '7M', '9m', '5M', '0M', '7M', '5M', '7M'], bass: 'octave', drums: 'rock', lead: 'pulse25', seed: 7 },
    playas:  { bpm: 138, key: 65, scale: 'major', prog: ['0M', '5M', '7M', '0M', '2m', '5M', '7M', '7M'], bass: 'reggae', drums: 'latin', lead: 'square', seed: 21 },
    cadiz:   { bpm: 150, key: 64, scale: 'phrygdom', prog: ['5m', '3M', '1M', '0M', '5m', '3M', '1M', '0M'], bass: 'gallop', drums: 'rumba', lead: 'pulse25', seed: 33 },
    soto:    { bpm: 124, key: 62, scale: 'major', prog: ['0M7', '9m7', '2m7', '7:7', '0M7', '9m7', '2m7', '7:7'], bass: 'walk', drums: 'swing', lead: 'triangle', seed: 45 },
    madrid:  { bpm: 140, key: 62, scale: 'harm', prog: ['0m', '5m', '7:7', '0m', '10M', '5m', '7M', '7:7'], bass: 'octave', drums: 'rock', lead: 'square', seed: 58 },
    warner:  { bpm: 162, key: 67, scale: 'major', prog: ['0M', '5M', '7M', '0M', '9m', '5M', '7M', '7M'], bass: 'octave', drums: 'rock', lead: 'pulse25', seed: 64 },
    siam:    { bpm: 128, key: 62, scale: 'pent', prog: ['0M', '7M', '9m', '5M', '0M', '7M', '5M', '7M'], bass: 'reggae', drums: 'latin', lead: 'triangle', seed: 77 },
    teide:   { bpm: 146, key: 62, scale: 'dorian', prog: ['0m7', '5M', '0m7', '5M', '10M', '0m', '10M', '5M'], bass: 'gallop', drums: 'rock', lead: 'pulse25', seed: 88 },
    nieve:   { bpm: 152, key: 69, scale: 'minor', prog: ['0m', '8M', '3M', '10M', '0m', '8M', '10M', '7M'], bass: 'octave', drums: 'rock', lead: 'pulse12', seed: 93 },
    boss:    { bpm: 172, key: 64, scale: 'harm', prog: ['0m', '8M', '10M', '11dim', '0m', '8M', '5m', '7M'], bass: 'gallop', drums: 'boss', lead: 'square', seed: 101 },
    star:    { bpm: 196, key: 65, scale: 'major', prog: ['0M', '2m', '0M', '2m', '0M', '2m', '5M', '7M'], bass: 'octave', drums: 'rock', lead: 'pulse25', seed: 5 },
    ending:  { bpm: 118, key: 60, scale: 'major', prog: ['0M', '9m', '5M', '7M', '0M', '4m', '5M', '7M'], bass: 'walk', drums: 'swing', lead: 'triangle', seed: 12 },
  };
  function rngFrom(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function parseChord(s) { const m = s.match(/^(\d+):?(.*)$/); return { root: +m[1], q: QUAL[m[2]] || QUAL.M }; }
  const cache = {};
  function compose(name) {
    if (cache[name]) return cache[name];
    const def = SONG_DEFS[name], rnd = rngFrom(def.seed), sc = SCALES[def.scale];
    const chords = def.prog.map(parseChord), bars = chords.length, steps = bars * 16;
    const lead = new Array(steps).fill(null), bass = new Array(steps).fill(null), arp = new Array(steps).fill(null), drum = new Array(steps).fill(null);
    // notas de escala disponibles (octavas 4-6)
    const scaleNotes = []; for (let o = -12; o <= 24; o += 12) sc.forEach(i => scaleNotes.push(def.key + o + i));
    const rhythms = [
      [1,0,1,0, 1,0,0,1, 0,1,1,0, 1,0,0,0], [1,0,0,1, 0,0,1,0, 1,0,1,0, 1,1,1,0], [1,1,0,1, 1,0,1,0, 1,0,0,0, 1,0,1,0],
      [1,0,1,1, 0,1,0,1, 1,0,0,0, 1,0,0,0], [1,0,0,0, 1,0,1,0, 1,1,1,0, 1,0,0,0], [1,1,1,0, 1,0,1,0, 0,1,0,1, 1,0,0,0],
    ];
    const pick = a => a[Math.floor(rnd() * a.length)];
    const motifR = [pick(rhythms), pick(rhythms)], motifB = [pick(rhythms), pick(rhythms)];
    let prev = def.key + 12;
    const chordTones = (ch, lo, hi) => { const out = []; for (let n = lo; n <= hi; n++) if (ch.q.some(i => ((n - def.key - ch.root - i) % 12 + 12) % 12 === 0)) out.push(n); return out; };
    const contour = [0, 1, 2, 1, -1, 2, 0, -2, 1, 3].map(() => Math.floor(rnd() * 5) - 2);
    for (let b = 0; b < bars; b++) {
      const ch = chords[b], section = (b >> 1) % 4, rh = (section === 2 ? motifB : motifR)[b & 1];
      const cts = chordTones(ch, def.key + 5, def.key + 24);
      let ci = 0;
      for (let s = 0; s < 16; s++) {
        const i = b * 16 + s;
        if (rh[s]) {
          let n;
          if (s % 4 === 0) n = cts.reduce((a, c) => Math.abs(c - prev) < Math.abs(a - prev) ? c : a, cts[0]);
          else {
            const idx = scaleNotes.findIndex(x => x >= prev), mv = contour[ci++ % contour.length];
            n = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, idx + (mv === 0 ? 1 : mv)))];
            if (!cts.includes(n) && cts.some(c => Math.abs(c - n) === 1)) n = cts.reduce((a, c) => Math.abs(c - n) < Math.abs(a - n) ? c : a, cts[0]);
          }
          if (b === bars - 1 && s >= 12) n = cts[0] + (cts[0] < def.key + 10 ? 12 : 0);
          n = Math.max(def.key + 2, Math.min(def.key + 26, n));
          let len = 1; while (s + len < 16 && !rh[s + len] && len < 4) len++;
          lead[i] = [n, len]; prev = n;
        }
        // bajo
        const r = def.key - 24 + ch.root, fifth = r + 7;
        if (def.bass === 'octave' && s % 2 === 0) bass[i] = [s % 4 === 0 ? r : r + 12, 2];
        if (def.bass === 'reggae' && (s % 4 === 0 || s % 8 === 6)) bass[i] = [s % 8 === 6 ? fifth : r, 2];
        if (def.bass === 'gallop' && [0, 3, 4, 6, 8, 11, 12, 14].includes(s)) bass[i] = [s % 8 < 4 ? r : (s > 11 ? fifth : r + 12), 1];
        if (def.bass === 'walk' && s % 4 === 0) bass[i] = [[r, r + ch.q[1], fifth, r + 12 - (s === 12 ? 1 : 0)][s / 4], 3];
        // arpegio suave
        if (s % 2 === 1) { const tones = ch.q.map(q => def.key + ch.root + q); arp[i] = [tones[(s >> 1) % tones.length] + (s > 8 ? 12 : 0), 1]; }
        // batería: k=bombo s=caja h=charles
        const pat = {
          rock:  ['k', 'h', 'h', 'h', 's', 'h', 'k', 'h', 'k', 'h', 'h', 'h', 's', 'h', 'h', 'h'],
          latin: ['k', null, 'h', 'k', 's', null, 'h', 'h', 'k', null, 'h', 'k', 's', 'h', 'h', null],
          rumba: ['k', 'h', 'h', 's', 'h', 'h', 's', 'h', 'k', 'h', 's', 'h', 's', 'h', 'h', 'h'],
          swing: ['k', null, null, 'h', 's', null, 'h', null, 'k', null, null, 'h', 's', null, 'h', null],
          boss:  ['k', 'h', 'k', 'h', 's', 'h', 'k', 'k', 'k', 'h', 'k', 'h', 's', 'h', 's', 's'],
        }[def.drums];
        drum[i] = pat[s];
      }
    }
    return (cache[name] = { bpm: def.bpm, steps, lead, bass, arp, drum, leadType: def.lead });
  }
  let cur = null, curName = null, step = 0, nextTime = 0, timer = null, songGain = null;
  function playNote(type, m, dur, t, v, dest) {
    const o = osc(type), g = ctx.createGain();
    o.frequency.value = mtof(m);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v * 0.8, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
  }
  function drumHit(k, t, dest) {
    if (k === 'k') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.16);
    } else {
      const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; fl.type = k === 's' ? 'bandpass' : 'highpass'; fl.frequency.value = k === 's' ? 1800 : 7000;
      const len = k === 's' ? 0.13 : 0.04;
      g.gain.setValueAtTime(k === 's' ? 0.5 : 0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(fl); fl.connect(g); g.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t + len + 0.01);
    }
  }
  function tick() {
    if (!cur || !ctx) return;
    const sp = 60 / cur.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const i = step % cur.steps, t = nextTime;
      if (cur.lead[i]) playNote(cur.leadType, cur.lead[i][0], cur.lead[i][1] * sp * 0.95, t, 0.22, songGain);
      if (cur.bass[i]) playNote('triangle', cur.bass[i][0], cur.bass[i][1] * sp * 0.9, t, 0.5, songGain);
      if (cur.arp[i]) playNote('pulse12', cur.arp[i][0], sp * 0.8, t, 0.06, songGain);
      if (cur.drum[i]) drumHit(cur.drum[i], t, songGain);
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
