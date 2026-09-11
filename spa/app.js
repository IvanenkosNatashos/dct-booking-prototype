/* ═══════════════════════════════════════════════════════════════════
   DCT · Ahead of Schedule — standalone prototype
   One screen, two beats:
     the offer → the card being filed into the itinerary

   Both beats live on the same screen on purpose. The card is the same
   card in both Figma frames — it only rises, tilts and swaps which end
   its text sits at — so the tap on "Add to your plan" morphs the screen
   in place rather than cross-fading into a near-identical one.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const FLOW = ['spa:offer', 'spa:adding'];

  const screen = document.querySelector('.screen');
  let stepIndex = 0;

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

  /* ─────────────── Spoken-word helper (conversation feel) ─────────────── */

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
  const lit = el => el.querySelectorAll('.w').forEach(w => w.classList.add('on'));
  const unlit = el => el.querySelectorAll('.w').forEach(w => w.classList.remove('on'));

  /* ─────────────────────── Step machine ─────────────────────── */

  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const stepDots = document.getElementById('step-dots');
  FLOW.forEach(() => stepDots.appendChild(document.createElement('span')));
  const renderDots = () =>
    [...stepDots.children].forEach((d, i) => d.classList.toggle('on', i === stepIndex));

  /* replay the entrance animations when the screen is re-entered */
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
  function snap(el, fn) {
    el.classList.add('no-anim');
    fn();
    void el.offsetWidth;
    el.classList.remove('no-anim');
  }

  function goStep(i) {
    if (i < 0 || i >= FLOW.length) return;
    clearTimers();
    stepIndex = i;
    STEP[FLOW[i]]();
    renderDots();
  }

  const next = () => goStep(stepIndex + 1);
  const prev = () => goStep(stepIndex - 1);

  document.getElementById('nav-prev').addEventListener('click', prev);
  document.getElementById('nav-next').addEventListener('click', next);
  document.getElementById('nav-restart').addEventListener('click', () => goStep(0));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'r') goStep(0);
  });

  /* ─────────────────── The flow ─────────────────── */

  const spaAdd = document.getElementById('spa-add');
  const spaAdding = document.getElementById('spa-adding');

  sliceGradient(spaAdding, '#ffffff 0%, rgba(255,255,255,0.42) 100%');

  /* the CTA is the whole interaction — press it yourself or watch Wei do it */
  spaAdd.addEventListener('click', () => {
    if (screen.dataset.state !== 'adding') goStep(FLOW.indexOf('spa:adding'));
  });

  /* the pill is a live mic demo: tap to talk, tap again — done */
  document.querySelectorAll('.voice-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      if (pill.dataset.state === 'listening') {
        pill.dataset.state = 'idle';
        pill.classList.add('pill-done');
        setTimeout(() => pill.classList.remove('pill-done'), 600);
      } else {
        pill.dataset.state = 'listening';
      }
    });
    pill.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pill.click(); }
    });
  });

  const STEP = {
    'spa:offer'() {
      // a restart opens on the purple field, the card back at the foot
      snap(screen, () => { screen.dataset.state = 'offer'; });
      unlit(spaAdding);
      restartEntrance(screen);
      at(3000, () => ghostTap(spaAdd));       // Wei takes the suggestion
      at(3400, next);
    },
    'spa:adding'() {
      // release the entrance first — its forwards fill would otherwise pin the
      // note, the CTA and the voice bar visible through the morph
      holdEntrance(screen);
      screen.dataset.state = 'adding';
      unlit(spaAdding);
      // the sentence lights once the card has finished travelling
      at(1000, () => lit(spaAdding));
    },
  };

  /* dev hook for demos/tests (e.g. jump to a step from the console) */
  window.__proto = { goStep, FLOW, step: () => FLOW[stepIndex] };

  renderDots();
  STEP[FLOW[0]]();
})();
