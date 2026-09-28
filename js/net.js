// ============================================================
//  Partidas a dos por Internet: conexión directa entre los dos
//  navegadores (WebRTC con PeerJS), con un código de 4 cifras.
//  El servidor público de PeerJS sólo sirve para encontrarse;
//  después los datos van de un dispositivo al otro.
// ============================================================
(() => {
  'use strict';
  const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  const PREFIX = 'suelta-machin-';
  let peer = null, conn = null, lastIn = 0, pingT = null, joinT = null, tries = 0;

  const N = window.Net = {
    status: 'off', // off, loading, hosting, joining, connected, lost, error
    code: '', err: '', isHost: false,
    onMsg: null, onStatus: null,
    get on() { return this.status === 'connected'; },
    host, join, send, close,
  };
  function set(st, err) { N.status = st; if (err !== undefined) N.err = err; if (N.onStatus) try { N.onStatus(st); } catch (e) { console.warn(e); } }

  let libP = null;
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    if (libP) return libP;
    libP = new Promise((ok, ko) => {
      let i = 0;
      const next = () => {
        if (i >= LIBS.length) { libP = null; ko(new Error('lib')); return; }
        const s = document.createElement('script'); s.src = LIBS[i++]; s.async = true;
        s.onload = () => window.Peer ? ok() : next(); s.onerror = () => { s.remove(); next(); };
        document.head.appendChild(s);
      };
      next();
    });
    return libP;
  }

  function reset() {
    clearInterval(pingT); clearTimeout(joinT); pingT = joinT = null;
    try { if (conn) conn.close(); } catch (e) {}
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = conn = null;
  }
  function close() { if (conn && conn.open) try { conn.send({ t: 'bye' }); } catch (e) {} reset(); N.code = ''; set('off', ''); }

  function wire(c) {
    conn = c;
    c.on('open', () => {
      clearTimeout(joinT); lastIn = Date.now(); set('connected', '');
      // latido: si en 8 s no llega nada damos la conexión por perdida
      pingT = setInterval(() => {
        send({ t: 'ping' });
        if (Date.now() - lastIn > 8000) { reset(); set('lost', 'Se ha perdido la conexión'); }
      }, 1000);
    });
    c.on('data', m => {
      lastIn = Date.now();
      if (!m || typeof m !== 'object' || m.t === 'ping') return;
      if (m.t === 'full') { fail('Esa partida ya tiene dos jugadores'); return; }
      if (m.t === 'bye') { reset(); set('lost', 'Tu rival ha salido de la partida'); return; }
      if (N.onMsg) try { N.onMsg(m); } catch (e) { console.warn(e); }
    });
    c.on('close', () => { if (conn === c && N.status === 'connected') { reset(); set('lost', 'Se ha perdido la conexión'); } });
    c.on('error', () => {});
  }

  function fail(msg) { reset(); set('error', msg); }
  function peerErr(e) {
    const t = e && e.type;
    if (t === 'peer-unavailable') fail('No hay ninguna partida con ese código');
    else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') fail('Sin conexión a Internet');
    else if (t === 'browser-incompatible') fail('Este navegador no permite jugar a dos');
    else if (N.status !== 'connected') fail('No se ha podido conectar');
  }

  function host(retry) {
    if (!retry) tries = 0;
    reset(); N.isHost = true; N.code = ''; set('loading', '');
    loadLib().then(() => {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      peer = new Peer(PREFIX + code, { debug: 0 });
      peer.on('open', () => { N.code = code; set('hosting', ''); });
      peer.on('connection', c => {
        if (conn) { c.on('open', () => { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 300); }); return; }
        wire(c);
      });
      peer.on('error', e => {
        // código ocupado por otra partida: probamos con otro
        if (e && e.type === 'unavailable-id' && tries++ < 5) { host(true); return; }
        peerErr(e);
      });
    }, () => fail('No se ha podido cargar el modo online (¿hay Internet?)'));
  }

  function join(code) {
    reset(); N.isHost = false; N.code = code; set('loading', '');
    loadLib().then(() => {
      peer = new Peer({ debug: 0 });
      peer.on('open', () => {
        set('joining', '');
        wire(peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }));
        joinT = setTimeout(() => { if (N.status !== 'connected') fail('No se ha podido conectar'); }, 15000);
      });
      peer.on('error', peerErr);
    }, () => fail('No se ha podido cargar el modo online (¿hay Internet?)'));
  }

  function send(m) { if (conn && conn.open) try { conn.send(m); } catch (e) {} }
  addEventListener('pagehide', () => { if (conn && conn.open) try { conn.send({ t: 'bye' }); } catch (e) {} });
})();
