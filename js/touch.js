// ============================================================
//  Mando táctil: joystick + botones semitransparentes sobre el juego
//  (sólo aparece en pantallas táctiles). Escribe en window.TOUCH,
//  que el motor lee junto al teclado y el mando físico.
// ============================================================
(() => {
  'use strict';
  const T = window.TOUCH = { active: false };
  // móvil o tablet: el puntero principal es el dedo. En un portátil con pantalla táctil
  // el mando sólo aparece al tocar la pantalla y se esconde al volver al teclado.
  const coarse = matchMedia('(pointer: coarse)').matches;

  // ---- pantalla completa (con prefijo webkit para Safari en iPad) y giro bloqueado en horizontal
  const de = document.documentElement;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const canFs = !!(de.requestFullscreen || de.webkitRequestFullscreen);
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
  const lockLandscape = () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  function enterFs() {
    try {
      const p = de.requestFullscreen ? de.requestFullscreen({ navigationUI: 'hide' }) : de.webkitRequestFullscreen();
      if (p && p.then) p.then(lockLandscape, () => {}); else lockLandscape();
    } catch (e) {}
  }
  function exitFs() { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {} }
  window.toggleFullscreen = () => { if (fsEl()) exitFs(); else enterFs(); };
  // iPhone: Safari no deja poner la página a pantalla completa; hay que añadirla a la pantalla de inicio
  const ios = /iPhone|iPod/.test(navigator.userAgent) || (/iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  T.iosHint = ios && !canFs && !standalone;

  const css = `
  #pad { position: fixed; inset: 0; z-index: 5; pointer-events: none; display: none;
    font-family: "Press Start 2P", "Courier New", monospace; user-select: none; -webkit-user-select: none;
    -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #pad.on { display: block; }
  #pad .zone { position: absolute; left: 0; bottom: 0; width: 45%; height: 70%; pointer-events: auto; touch-action: none; }
  #pad .base { position: absolute; width: 124px; height: 124px; margin: -62px 0 0 -62px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); }
  #pad .knob { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; border-radius: 50%;
    background: rgba(255,255,255,0.30); border: 2px solid rgba(255,255,255,0.5); }
  #pad .btns { position: absolute; right: max(14px, env(safe-area-inset-right)); bottom: 18px; width: 190px; height: 170px; }
  #pad .b, #pad .s { position: absolute; pointer-events: auto; touch-action: none; display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.85); text-shadow: 0 1px 2px #000; border: 2px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.10); }
  #pad .b { width: 66px; height: 66px; border-radius: 50%; font-size: 8px; line-height: 1.4; text-align: center; }
  #pad .b.down, #pad .s.down { background: rgba(255,138,58,0.45); border-color: rgba(255,200,150,0.8); }
  #pad .b[data-a=jump]  { right: 62px; bottom: 0; }
  #pad .b[data-a=punch] { right: 124px; bottom: 52px; }
  #pad .b[data-a=kick]  { right: 0; bottom: 52px; }
  #pad .b[data-a=throw] { right: 62px; bottom: 104px; }
  #pad .top { position: absolute; top: 19%; right: max(8px, env(safe-area-inset-right)); display: flex; flex-direction: column; gap: 8px; opacity: 0.8; }
  #pad .s { position: relative; width: 34px; height: 34px; border-radius: 50%; font-size: 8px; }
  #pad .rot { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; text-align: center;
    background: rgba(12,8,24,0.92); color: #ffd28a; font-size: 12px; line-height: 2; padding: 24px; pointer-events: auto; }
  @media (orientation: portrait) { #pad.on .rot { display: flex; } }
  @media (max-height: 380px) {
    #pad .base { width: 104px; height: 104px; margin: -52px 0 0 -52px; }
    #pad .btns { transform: scale(0.82); transform-origin: right bottom; }
  }`;

  function build() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const pad = document.createElement('div'); pad.id = 'pad';
    pad.innerHTML = `
      <div class="zone"><div class="base"><div class="knob"></div></div></div>
      <div class="btns">
        <div class="b" data-a="jump">SALTO</div><div class="b" data-a="punch">PUÑO</div>
        <div class="b" data-a="kick">PATADA</div><div class="b" data-a="throw">LANZAR</div>
      </div>
      <div class="top"><div class="s" data-a="mute" aria-label="Música"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2l8-1.5v10.2a2.3 2.3 0 1 1-1.6-2.2V4.2L7.6 5.1v7.6a2.3 2.3 0 1 1-1.6-2.2z"/></svg></div><div class="s" data-a="full" aria-label="Pantalla completa"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4"/></svg></div><div class="s" data-a="start" aria-label="Pausa"><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/></svg></div></div>
      <div class="rot">Gira el móvil<br>para jugar ↻</div>`;
    document.body.appendChild(pad);
    return pad;
  }

  function init() {
    const pad = build();
    const zone = pad.querySelector('.zone'), base = pad.querySelector('.base'), knob = pad.querySelector('.knob');
    const show = () => { if (!T.active) { T.active = true; pad.classList.add('on'); } };
    if (coarse) show();
    addEventListener('touchstart', show, { passive: true });
    addEventListener('keydown', () => { if (!coarse && T.active) { T.active = false; pad.classList.remove('on'); } });
    if (!canFs) pad.querySelector('[data-a=full]').remove();
    // el primer toque (al soltar el dedo, que cuenta como gesto del usuario) pone el juego a pantalla completa
    let autoFs = coarse && canFs && !standalone;
    addEventListener('pointerup', e => { if (autoFs && e.pointerType === 'touch') { autoFs = false; if (!fsEl()) enterFs(); } });
    // Los toques en el mando no cuentan como "clic" en el juego, pero sí desbloquean el sonido
    pad.addEventListener('pointerdown', e => { e.stopPropagation(); try { Sound.init(); } catch (err) {} });
    pad.addEventListener('contextmenu', e => e.preventDefault());

    // ---- joystick flotante: nace donde apoyas el dedo en la mitad izquierda
    let stick = null;
    const rest = () => { const r = zone.getBoundingClientRect(); base.style.left = '92px'; base.style.top = (r.height - 92) + 'px'; knob.style.transform = ''; };
    const setDir = (l, r, u, d) => { T.left = l; T.right = r; T.up = u; T.down = d; };
    rest(); addEventListener('resize', () => { if (!stick) rest(); });
    zone.addEventListener('pointerdown', e => {
      if (stick) return;
      const r = zone.getBoundingClientRect();
      stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
      base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px';
      try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    zone.addEventListener('pointermove', e => {
      if (!stick || e.pointerId !== stick.id) return;
      const R = base.offsetWidth / 2;
      let dx = e.clientX - stick.x, dy = e.clientY - stick.y;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx *= R / len; dy *= R / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const nx = dx / R, ny = dy / R;
      setDir(nx < -0.35, nx > 0.35, ny < -0.55, ny > 0.55);
    });
    const endStick = e => { if (stick && e.pointerId === stick.id) { stick = null; setDir(false, false, false, false); rest(); } };
    zone.addEventListener('pointerup', endStick); zone.addEventListener('pointercancel', endStick);

    // ---- botones: multitoque y se puede deslizar el dedo de uno a otro
    const fingers = new Map(); // pointerId -> botón
    const btnAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('#pad .b, #pad .s') : null; };
    // un toque rápido se mantiene al menos ~3 fotogramas para que el juego llegue a verlo
    const since = {};
    const refresh = () => {
      const on = new Set(fingers.values());
      for (const b of pad.querySelectorAll('.b, .s')) {
        const a = b.dataset.a, d = on.has(b);
        b.classList.toggle('down', d);
        if (d) { if (!T[a]) since[a] = performance.now(); T[a] = true; }
        else if (T[a]) {
          const left = 50 - (performance.now() - since[a]);
          if (left <= 0) T[a] = false;
          else setTimeout(() => { if (!b.classList.contains('down')) T[a] = false; }, left);
        }
      }
    };
    for (const b of pad.querySelectorAll('.b, .s')) {
      b.addEventListener('pointerdown', e => {
        fingers.set(e.pointerId, b);
        try { b.releasePointerCapture(e.pointerId); } catch (err) {} // permite deslizar entre botones
        if (navigator.vibrate) try { navigator.vibrate(8); } catch (err) {}
        refresh(); e.preventDefault();
      });
    }
    pad.addEventListener('pointermove', e => {
      if (!fingers.has(e.pointerId)) return;
      const b = btnAt(e.clientX, e.clientY);
      if (b && b.classList.contains('b') && fingers.get(e.pointerId).classList.contains('b') && b !== fingers.get(e.pointerId)) { fingers.set(e.pointerId, b); refresh(); }
    });
    const endBtn = e => { if (fingers.delete(e.pointerId)) refresh(); };
    addEventListener('pointerup', endBtn); addEventListener('pointercancel', endBtn);
    addEventListener('blur', () => { fingers.clear(); refresh(); stick = null; setDir(false, false, false, false); rest(); });
  }

  if (document.body) init(); else addEventListener('DOMContentLoaded', init);
})();
