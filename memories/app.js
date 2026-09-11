/* ═══════════════════════════════════════════════════════════════════
   DCT · Video Memories — standalone prototype
   One guided flow, four beats, all on autodelay:
     board → the board read back → generating → your trip highlights

   A flow is a list of STEPS, not screens: a step is "screen" or
   "screen:state". The first two steps sit on one screen, so the frost
   genuinely rises over the collage instead of cross-fading into a
   near-identical frame.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const FLOW = ['vm:board', 'vm:prompt', 'gen', 'high'];

  const screens = {};
  document.querySelectorAll('.screen').forEach(s => { screens[s.dataset.screen] = s; });

  let stepIndex = 0;

  const stepScreen = step => step.split(':')[0];

  /* ─────────────────────── Phone scaling ─────────────────────── */

  const phoneScreens = document.querySelector('.phone-screens');
  const isCompact = () => window.innerWidth <= 560 || window.innerHeight <= 700;

  function fitPhone() {
    const pad = isCompact() ? 0 : 128;          // room for caption + controls
    const sw = (window.innerWidth - (isCompact() ? 0 : 40)) / 390;
    const sh = (window.innerHeight - pad) / 844;
    const s = Math.min(sw, sh, 1.1);
    document.documentElement.style.setProperty('--phone-scale', s.toFixed(4));
  }
  window.addEventListener('resize', fitPhone);
  fitPhone();

  /* ─────────────── Touch cursor + tap ripple (desktop) ─────────────── */

  const cursor = document.getElementById('touch-cursor');
  if (window.matchMedia('(pointer: fine)').matches) {
    let tx = -100, ty = -100, cx = -100, cy = -100;
    document.addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      cursor.classList.add('visible');
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
    document.addEventListener('mousedown', () => cursor.classList.add('down'));
    document.addEventListener('mouseup', () => cursor.classList.remove('down'));
    (function follow() {
      cx += (tx - cx) * 0.3;
      cy += (ty - cy) * 0.3;
      cursor.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      requestAnimationFrame(follow);
    })();
  }

  /* a ripple in phone-space, from a real press or a scripted one */
  function ripple(x, y) {
    const r = document.createElement('span');
    r.className = 'tap-ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    phoneScreens.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }

  document.addEventListener('pointerdown', e => {
    const rect = phoneScreens.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) return;
    const scale = rect.width / 390;
    ripple((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
  });

  /* the companion tapping for you — same ripple, same button press */
  function ghostTap(el) {
    const pr = phoneScreens.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const scale = pr.width / 390;
    ripple((er.left + er.width / 2 - pr.left) / scale,
           (er.top + er.height / 2 - pr.top) / scale);
    el.classList.add('pressed');
    setTimeout(() => el.classList.remove('pressed'), 260);
  }

  /* ─────────────── Spoken-word helpers (conversation feel) ─────────────── */

  function wrapWords(el) {
    [...el.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const w = document.createElement('span');
          w.className = 'qw';
          w.textContent = part;
          frag.appendChild(w);
        });
        node.replaceWith(frag);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        wrapWords(node);
      }
    });
  }

  function speak(el, { interval = 135, delay = 0 } = {}) {
    const out = [];
    el.querySelectorAll('.qw').forEach((w, i) => {
      out.push(setTimeout(() => w.classList.add('on'), delay + i * interval));
    });
    return out;
  }
  const hush = el => el.querySelectorAll('.qw.on').forEach(w => w.classList.remove('on'));

  /* answer words carry their own slice of the shared gradient so per-word
     animation can't break background-clip:text */
  function sliceGradient(el, stops) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    document.fonts.ready.then(() => {
      const total = el.clientWidth;
      el.querySelectorAll('.w').forEach(span => {
        span.style.background = `linear-gradient(90deg, ${stops})`;
        span.style.backgroundSize = `${total}px 100%`;
        span.style.backgroundPosition = `-${span.offsetLeft}px 0`;
        span.style.webkitBackgroundClip = 'text';
        span.style.backgroundClip = 'text';
        span.style.color = 'transparent';
      });
      el.style.background = 'none';
      el.style.color = 'transparent';
    });
  }
  const unlit = el => el.querySelectorAll('.w').forEach(w => w.classList.remove('on'));

  /* ─────────────────────── Step machine ─────────────────────── */

  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const stepDots = document.getElementById('step-dots');
  FLOW.forEach(() => stepDots.appendChild(document.createElement('span')));
  const renderDots = () =>
    [...stepDots.children].forEach((d, i) => d.classList.toggle('on', i === stepIndex));

  /* screens whose entrance animations must replay when they are re-entered */
  function restartEntrance(el) {
    el.classList.remove('entrance-held');
    el.querySelectorAll('[data-in]').forEach(n => {
      n.style.animation = 'none';
      void n.offsetWidth;                    // force reflow, then hand back to CSS
      n.style.animation = '';
    });
  }

  /* Drop the entrance animation so state rules regain control of opacity.
     A forwards fill outranks normal declarations, so it has to be cleared
     rather than out-specified — otherwise nothing can dim or fade these. */
  function holdEntrance(el) {
    el.classList.add('entrance-held');
    el.querySelectorAll('[data-in]').forEach(n => { n.style.animation = 'none'; });
  }

  /* preset a screen's geometry before its reveal, children untransitioned */
  function snap(screen, fn) {
    screen.classList.add('no-anim');
    fn();
    void screen.offsetWidth;
    screen.classList.remove('no-anim');
  }

  function goStep(i) {
    if (i < 0 || i >= FLOW.length) return;
    const prev = FLOW[stepIndex];
    const next = FLOW[i];
    const prevScreen = stepScreen(prev);
    const nextScreen = stepScreen(next);
    const changedScreen =
      prevScreen !== nextScreen || !screens[prevScreen].classList.contains('active');

    clearTimers();
    if (changedScreen) EXIT[prevScreen] && EXIT[prevScreen]();

    stepIndex = i;

    if (changedScreen) {
      screens[prevScreen].classList.remove('active');
      restartEntrance(screens[nextScreen]);
      screens[nextScreen].classList.add('active');
    }

    STEP[next] && STEP[next]();
    renderDots();
  }

  const next = () => goStep(stepIndex + 1);
  function prev() {
    // never step back into an auto-forwarding loader
    let target = stepIndex - 1;
    if (FLOW[target] === 'gen') target -= 1;
    goStep(target);
  }

  document.getElementById('nav-prev').addEventListener('click', prev);
  document.getElementById('nav-next').addEventListener('click', next);
  document.getElementById('nav-restart').addEventListener('click', () => goStep(0));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'r') goStep(0);
  });

  /* ─────────────────── The flow ─────────────────── */

  const vmScreen = screens.vm;
  const vmPrompt = document.getElementById('vm-prompt');
  const vmGen = document.getElementById('vm-gen');
  const genText = document.getElementById('gen-text');

  sliceGradient(vmPrompt, '#000000 0%, rgba(0,0,0,0.55) 100%');
  wrapWords(genText);

  /* pressing generate yourself is the same beat the companion plays */
  vmGen.addEventListener('click', () => {
    if (FLOW[stepIndex] === 'vm:prompt') next();
  });

  /* tap anywhere else to skip the moments that auto-forward */
  vmScreen.addEventListener('click', e => {
    if (e.target.closest('.vm-gen')) return;
    next();
  });
  screens.gen.addEventListener('click', next);

  const STEP = {
    'vm:board'() {
      // a restart opens on the bare board, no frost left over
      snap(vmScreen, () => { vmScreen.dataset.state = 'board'; });
      unlit(vmPrompt);
      restartEntrance(vmScreen);
      at(3200, next);                          // the board settles, then is read back
    },
    'vm:prompt'() {
      // release the entrance's forwards fill so the trip bar can sink away
      holdEntrance(vmScreen);
      vmScreen.dataset.state = 'prompt';       // the frost rises over the board
      unlit(vmPrompt);
      const words = vmPrompt.querySelectorAll('.w');
      // the sentence starts once the frost has most of the board — the words
      // should look like they are settling onto it, not racing it
      at(900, () => {
        words.forEach((w, i) => at(i * 185, () => w.classList.add('on')));
      });
      const spoken = 900 + words.length * 185 + 850;
      at(spoken, () => ghostTap(vmGen));       // the companion presses generate
      at(spoken + 560, next);
    },
    gen() {
      hush(genText);
      timers.push(...speak(genText, { interval: 130, delay: 1000 }));
      at(4800, next);
    },
    high() {
      // nothing scripted: the card landing out of the dark is the whole moment
    },
  };

  /* teardown per screen, so a step change never leaves a half-played state */
  const EXIT = {
    vm() { vmScreen.dataset.state = 'board'; unlit(vmPrompt); },
    gen() { hush(genText); },
    high() {},
  };

  /* dev hook for demos/tests (e.g. jump to a step from the console) */
  window.__proto = { goStep, FLOW, step: () => FLOW[stepIndex] };

  renderDots();
  STEP[FLOW[0]]();
})();
