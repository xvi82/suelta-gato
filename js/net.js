// ============================================================
//  Partidas a dos por Internet: conexión directa entre los dos
//  navegadores (WebRTC con PeerJS), con un código de 4 cifras.
//  El servidor público de PeerJS sólo sirve para encontrarse;
//  después los datos van de un dispositivo al otro.
//  Si la conexión se corta (p. ej. uno sale a WhatsApp a pasar el
//  código), se intenta recuperar sola durante un minuto y medio.
// ============================================================
(() => {
  'use strict';
  const LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
  const PREFIX = 'suelta-machin-';
  const TIMEOUT = 12000, GIVE_UP = 90000;
  let peer = null, conn = null, lastIn = 0, pingT = null, joinT = null, retryT = null, lostAt = 0, tries = 0;

  const N = window.Net = {
    status: 'off', // off, loading, hosting, joining, connected, reconnecting, lost, error
    code: '', err: '', isHost: false,
    onMsg: null, onStatus: null,
    get on() { return this.status === 'connected'; },
    host, join, send, close,
    get _conn() { return conn; }, // depuración
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

  function dropConn() { const c = conn; conn = null; try { if (c) c.close(); } catch (e) {} }
  function reset() {
    clearInterval(pingT); clearTimeout(joinT); clearInterval(retryT); pingT = joinT = retryT = null;
    dropConn();
    try { if (peer) peer.destroy(); } catch (e) {}
    peer = null;
  }
  function close() { if (conn && conn.open) try { conn.send({ t: 'bye' }); } catch (e) {} reset(); N.code = ''; set('off', ''); }
  function fail(msg) { reset(); set('error', msg); }
  function gone(msg) { reset(); set('lost', msg); }

  // --- conexión cortada: se reintenta en segundo plano
  function drop() {
    if (N.status !== 'connected') return;
    dropConn(); lostAt = Date.now(); set('reconnecting', 'Reconectando');
    clearInterval(retryT); retryT = setInterval(retry, 3000); retry();
  }
  function retry() {
    if (N.status !== 'reconnecting' || !peer) return;
    if (Date.now() - lostAt > GIVE_UP) { gone('Se ha perdido la conexión'); return; }
    try { if (peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {}
    // quien se unió vuelve a llamar; el anfitrión espera la llamada
    if (!N.isHost && !peer.disconnected && !(conn && !conn.open && Date.now() - conn.t0 < 6000)) {
      dropConn(); wire(peer.connect(PREFIX + N.code, { reliable: true, serialization: 'json' }));
    }
  }

  function wire(c) {
    conn = c; c.t0 = Date.now();
    c.on('open', () => {
      if (conn !== c) return;
      clearTimeout(joinT); clearInterval(retryT); retryT = null;
      lastIn = Date.now(); set('connected', '');
      // latido: si en un rato no llega nada, la conexión se ha cortado
      clearInterval(pingT);
      pingT = setInterval(() => { send({ t: 'ping' }); if (N.status === 'connected' && Date.now() - lastIn > TIMEOUT) drop(); }, 1000);
    });
    c.on('data', m => {
      if (conn !== c) return;
      lastIn = Date.now();
      if (!m || typeof m !== 'object' || m.t === 'ping') return;
      if (m.t === 'full') { fail('Esa partida ya tiene dos jugadores'); return; }
      if (m.t === 'bye') { gone('Tu rival ha salido de la partida'); return; }
      if (N.onMsg) try { N.onMsg(m); } catch (e) { console.warn(e); }
    });
    c.on('close', () => { if (conn === c) drop(); });
    c.on('error', () => {});
  }

  function peerErr(e) {
    const t = e && e.type;
    if (N.status === 'reconnecting' || N.status === 'connected') return; // se sigue reintentando
    if (t === 'peer-unavailable') fail('No hay ninguna partida con ese código');
    else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') fail('Sin conexión a Internet');
    else if (t === 'browser-incompatible') fail('Este navegador no permite jugar a dos');
    else fail('No se ha podido conectar');
  }
  function watchPeer() {
    // al perder el servidor de encuentro (móvil en segundo plano) se vuelve a registrar
    peer.on('disconnected', () => { setTimeout(() => { try { if (peer && peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {} }, 1000); });
  }

  function host(again) {
    if (!again) tries = 0;
    reset(); N.isHost = true; N.code = ''; set('loading', '');
    loadLib().then(() => {
      const code = String(1000 + Math.floor(Math.random() * 9000));
      peer = new Peer(PREFIX + code, { debug: 0 }); watchPeer();
      peer.on('open', () => { if (!N.code) { N.code = code; set('hosting', ''); } });
      peer.on('connection', c => {
        if (conn && conn.open && N.status === 'connected') { c.on('open', () => { try { c.send({ t: 'full' }); } catch (e) {} setTimeout(() => c.close(), 300); }); return; }
        dropConn(); wire(c);
      });
      peer.on('error', e => {
        // código ocupado por otra partida: probamos con otro
        if (e && e.type === 'unavailable-id' && !N.code && tries++ < 5) { host(true); return; }
        peerErr(e);
      });
    }, () => fail('No se ha podido cargar el modo online (¿hay Internet?)'));
  }

  function join(code) {
    reset(); N.isHost = false; N.code = code; set('loading', '');
    loadLib().then(() => {
      peer = new Peer({ debug: 0 }); watchPeer();
      peer.on('open', () => {
        if (N.status !== 'loading') return;
        set('joining', '');
        wire(peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }));
        joinT = setTimeout(() => { if (N.status === 'joining') fail('No se ha podido conectar'); }, 15000);
      });
      peer.on('error', peerErr);
    }, () => fail('No se ha podido cargar el modo online (¿hay Internet?)'));
  }

  function send(m) { if (conn && conn.open) try { conn.send(m); } catch (e) {} }
  // al volver a la app, comprobar enseguida
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (N.status === 'reconnecting') retry();
    else if (N.status === 'connected' && Date.now() - lastIn > TIMEOUT) drop();
  });
  addEventListener('pagehide', e => { if (!e.persisted && conn && conn.open) try { conn.send({ t: 'bye' }); } catch (x) {} });
})();
