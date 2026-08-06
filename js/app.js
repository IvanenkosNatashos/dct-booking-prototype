/* ═══════════════════════════════════════════════════════════════════
   DCT · Al Hosn Trip — booking flow prototype
   Guided flow: voice ask → booking in progress → booked results
   Shell + motion grammar shared with the companion prototype.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const FLOW = ['ask', 'loading', 'results'];
  const screens = {};
  document.querySelectorAll('.screen').forEach(s => { screens[s.dataset.screen] = s; });

  let current = 'ask';

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

  /* finger-press ripple inside the phone */
  document.addEventListener('pointerdown', e => {
    const rect = phoneScreens.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top || e.clientY > rect.bottom) return;
    const scale = rect.width / 390;
    const r = document.createElement('span');
    r.className = 'tap-ripple';
    r.style.left = `${(e.clientX - rect.left) / scale}px`;
    r.style.top = `${(e.clientY - rect.top) / scale}px`;
    phoneScreens.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });

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
    const timers = [];
    el.querySelectorAll('.qw').forEach((w, i) => {
      timers.push(setTimeout(() => w.classList.add('on'), delay + i * interval));
    });
    return timers;
  }
  const hush = el => el.querySelectorAll('.qw.on').forEach(w => w.classList.remove('on'));

  /* answer words carry their own slice of the shared gradient so per-word
     animation can't break background-clip:text */
  function sliceGradient(el) {
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
        span.style.background = `linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.2) 100%)`;
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

  /* "done talking" — a confirming pop as the pill settles back to idle */
  function pillDone(pill) {
    pill.dataset.state = 'idle';
    pill.classList.add('pill-done');
    setTimeout(() => pill.classList.remove('pill-done'), 600);
  }

  /* ─────────────────────── Navigation ─────────────────────── */

  const stepDots = document.getElementById('step-dots');
  FLOW.forEach(() => stepDots.appendChild(document.createElement('span')));

  function renderDots() {
    [...stepDots.children].forEach((d, i) =>
      d.classList.toggle('on', FLOW[i] === current));
  }

  function goto(name) {
    if (!screens[name] || name === current) return;
    if (current === 'ask') stopAskSequence();
    if (current === 'loading') stopLoadingSequence();
    if (current === 'results') stopResults();
    // the skeleton → results morph gets a longer dissolve
    if (current === 'loading' && name === 'results') {
      phoneScreens.classList.add('slow-swap');
      setTimeout(() => phoneScreens.classList.remove('slow-swap'), 1300);
    }
    screens[current].classList.remove('active');
    screens[name].classList.add('active');
    current = name;
    renderDots();
    if (name === 'ask') startAskSequence();
    if (name === 'loading') startLoadingSequence();
    if (name === 'results') startResults();
  }

  function next() {
    const i = FLOW.indexOf(current);
    if (i >= FLOW.length - 1) return;
    goto(FLOW[i + 1]);
  }
  function prev() {
    const i = FLOW.indexOf(current);
    if (i <= 0) return;
    // never step back into the auto-forwarding loader
    const target = FLOW[i - 1] === 'loading' ? 'ask' : FLOW[i - 1];
    goto(target);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action.startsWith('goto:')) goto(action.slice(5));
    else if (action === 'confirm') {
      const done = btn.classList.toggle('confirmed');
      btn.textContent = done ? 'Confirmed ✓' : 'Confirm';
      btn.classList.remove('breathe');
    }
  });

  document.getElementById('nav-prev').addEventListener('click', prev);
  document.getElementById('nav-next').addEventListener('click', next);
  document.getElementById('nav-restart').addEventListener('click', () => goto(FLOW[0]));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'r') goto(FLOW[0]);
  });

  /* ────────────── Screen 1 · Nana asks for the booking ────────────── */

  const askScreen = screens.ask;
  const askPill = document.getElementById('ask-pill');
  const askAnswer = document.getElementById('ask-answer');
  let askTimers = [];

  sliceGradient(askAnswer);

  function stopAskSequence() {
    askTimers.forEach(clearTimeout);
    askTimers = [];
    askPill.dataset.state = 'idle';
    askPill.classList.remove('pill-done');
    askAnswer.querySelectorAll('.w').forEach(w => w.classList.remove('on'));
  }

  function startAskSequence() {
    stopAskSequence();
    const words = askAnswer.querySelectorAll('.w');
    const t = (ms, fn) => askTimers.push(setTimeout(fn, ms));

    t(700, () => { askPill.dataset.state = 'listening'; });     // mic opens
    t(1500, () => {                                             // Nana speaks
      words.forEach((w, i) => t(i * 175, () => w.classList.add('on')));
    });
    const spoken = 1500 + words.length * 175 + 1150;
    t(spoken, () => pillDone(askPill));                         // done talking
    t(spoken + 1100, () => goto('loading'));                    // companion gets to work
  }

  /* tap the screen to skip ahead (the pill itself is interactive) */
  askScreen.addEventListener('click', e => {
    if (e.target.closest('[data-action]') || e.target.closest('.voice-pill')) return;
    goto('loading');
  });

  /* pills are a live mic demo: tap to talk, tap again — done */
  document.querySelectorAll('.voice-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (pill.dataset.state === 'listening') pillDone(pill);
      else pill.dataset.state = 'listening';
    });
    pill.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click(); }
    });
  });

  /* ────────────── Screen 2 · companion books, results load ────────────── */

  const loadingReply = document.getElementById('loading-reply');
  let loadingTimers = [];
  wrapWords(loadingReply);

  function stopLoadingSequence() {
    loadingTimers.forEach(clearTimeout);
    loadingTimers = [];
    hush(loadingReply);
  }

  function startLoadingSequence() {
    stopLoadingSequence();
    loadingTimers = speak(loadingReply, { interval: 130, delay: 480 });
    // once the skeletons have done their work, the bookings resolve
    loadingTimers.push(setTimeout(() => goto('results'), 3400));
  }

  /* tap to skip ahead to the booked results */
  screens.loading.addEventListener('click', () => goto('results'));

  /* ────────────── Screen 3 · booked results ────────────── */

  const resultsReply = document.getElementById('results-reply');
  wrapWords(resultsReply);

  function startResults() {
    // the reply was already spoken over the skeletons — keep it lit so the
    // dissolve reads as the same sentence resolving, not a new one
    resultsReply.querySelectorAll('.qw').forEach(w => w.classList.add('on'));
  }
  function stopResults() {
    hush(resultsReply);
    screens.results.querySelectorAll('.confirm-btn').forEach(b => {
      b.classList.remove('confirmed');
      b.textContent = 'Confirm';
    });
  }

  /* dev hook for demos/tests (e.g. jump to a screen from the console) */
  window.__proto = { goto };

  renderDots();
  startAskSequence();
})();
