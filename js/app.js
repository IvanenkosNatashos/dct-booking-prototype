/* ═══════════════════════════════════════════════════════════════════
   DCT · Al Hosn Trip — companion prototypes
   Two guided flows, one app:
     booking · voice ask → booking in progress → booked results
     rework  · schedule → focus → voice → searching → results
               → adding → schedule (updated) → schedule (arranged)
   Shell + motion grammar shared with the companion prototype.

   A flow is a list of STEPS, not screens: a step is "screen" or
   "screen:state". Consecutive steps on one screen change its state in
   place, so the card that lifts out of the stack really moves instead
   of cross-fading into a near-identical frame.
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const FLOWS = {
    booking: ['ask', 'loading', 'results'],
    rework: [
      'sched:stack', 'sched:focus', 'voice2', 'search:searching',
      'search:results', 'adding', 'sched:landing', 'sched:stack2',
    ],
  };

  const screens = {};
  document.querySelectorAll('.screen').forEach(s => { screens[s.dataset.screen] = s; });

  let activeFlow = 'booking';
  let FLOW = FLOWS[activeFlow];
  let stepIndex = 0;

  const stepScreen = step => step.split(':')[0];
  const stepState = step => step.split(':')[1] || '';

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
    const timers = [];
    el.querySelectorAll('.qw').forEach((w, i) => {
      timers.push(setTimeout(() => w.classList.add('on'), delay + i * interval));
    });
    return timers;
  }
  const hush = el => el.querySelectorAll('.qw.on').forEach(w => w.classList.remove('on'));

  /* answer words carry their own slice of the shared gradient so per-word
     animation can't break background-clip:text */
  function sliceGradient(el, stops = '#ffffff 0%, rgba(255,255,255,0.2) 100%') {
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

  /* "done talking" — a confirming pop as the pill settles back to idle */
  function pillDone(pill) {
    pill.dataset.state = 'idle';
    pill.classList.add('pill-done');
    setTimeout(() => pill.classList.remove('pill-done'), 600);
  }

  /* ─────────────────────── Step machine ─────────────────────── */

  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const stepDots = document.getElementById('step-dots');
  function buildDots() {
    stepDots.innerHTML = '';
    FLOW.forEach(() => stepDots.appendChild(document.createElement('span')));
  }
  function renderDots() {
    [...stepDots.children].forEach((d, i) => d.classList.toggle('on', i === stepIndex));
  }

  /* screens whose entrance animations must replay when they are re-entered */
  function restartEntrance(el) {
    el.querySelectorAll('[data-in]').forEach(n => {
      n.style.animation = 'none';
      void n.offsetWidth;                    // force reflow, then hand back to CSS
      n.style.animation = '';
    });
  }

  function goStep(i, { replay = true } = {}) {
    if (i < 0 || i >= FLOW.length) return;
    const prev = FLOW[stepIndex];
    const next = FLOW[i];
    const prevScreen = stepScreen(prev);
    const nextScreen = stepScreen(next);
    const changedScreen = prevScreen !== nextScreen || !screens[prevScreen].classList.contains('active');

    clearTimers();
    if (changedScreen) EXIT[prevScreen] && EXIT[prevScreen]();

    // the dissolve that carries the most weight gets extra room
    // (adding → sched is deliberately NOT slow: the card holds one geometry
    // across it, and a fast dissolve is what sells the continuity)
    if (prev === 'loading' && next === 'results') {
      phoneScreens.classList.add('slow-swap');
      setTimeout(() => phoneScreens.classList.remove('slow-swap'), 1300);
    }
    // the card that must appear not to move gets a zoom-free dissolve
    if (nextScreen === 'sched' && prevScreen === 'adding') {
      phoneScreens.classList.add('flat-swap');
      setTimeout(() => phoneScreens.classList.remove('flat-swap'), 800);
    }

    stepIndex = i;
    setHero(next);

    if (changedScreen) {
      screens[prevScreen].classList.remove('active');
      PRE[next] && PRE[next]();
      if (next === 'sched:landing') {
        // arriving mid-story: geometry is preset, furniture persists
        screens.sched.classList.add('no-entrance');
      } else if (replay) {
        screens[nextScreen].classList.remove('no-entrance');
        restartEntrance(screens[nextScreen]);
      }
      screens[nextScreen].classList.add('active');
      positionAllGliders();
    }

    const enter = STEP[next];
    if (enter) enter({ changedScreen });
    renderDots();
  }

  const next = () => goStep(stepIndex + 1);
  function prev() {
    // never step back into an auto-forwarding loader
    let target = stepIndex - 1;
    const skip = ['loading', 'search:searching', 'adding'];
    if (skip.includes(FLOW[target])) target -= 1;
    goStep(target);
  }

  /* preset a screen's geometry before its reveal, children untransitioned */
  function snap(screen, fn) {
    screen.classList.add('no-anim');
    fn();
    void screen.offsetWidth;
    screen.classList.remove('no-anim');
  }

  /* the shared card that rides above the screens through steps 6→8 */
  const hero = document.getElementById('hero-card');
  function setHero(step) {
    const show = step === 'adding' || step === 'sched:landing';
    // the hand-off to the schedule's own card must be a cut, not a fade —
    // the two are pixel-identical at that instant
    hero.classList.toggle('cut', step === 'sched:stack2');
    hero.classList.toggle('on', show);
    hero.classList.toggle('enter', step === 'adding');
    if (step !== 'sched:landing') hero.classList.remove('pop');
  }

  /* ── flow switcher ── */
  const flowTabs = document.getElementById('flow-tabs');
  function positionFlowGlider() {
    const active = flowTabs.querySelector('.flow-tab.active');
    const glider = flowTabs.querySelector('.flow-glider');
    if (!active || !glider) return;
    glider.style.width = `${active.offsetWidth}px`;
    glider.style.translate = `${active.offsetLeft}px 0`;
  }
  flowTabs.addEventListener('click', e => {
    const tab = e.target.closest('.flow-tab');
    if (!tab || tab.classList.contains('active')) return;
    flowTabs.querySelectorAll('.flow-tab').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    positionFlowGlider();
    startFlow(tab.dataset.flow);
  });
  document.fonts.ready.then(positionFlowGlider);
  window.addEventListener('resize', positionFlowGlider);

  function startFlow(name) {
    clearTimers();
    EXIT[stepScreen(FLOW[stepIndex])] && EXIT[stepScreen(FLOW[stepIndex])]();
    screens[stepScreen(FLOW[stepIndex])].classList.remove('active');
    activeFlow = name;
    FLOW = FLOWS[name];
    buildDots();
    stepIndex = -1;                          // force goStep to treat this as new
    const first = FLOW[0];
    stepIndex = 0;
    setHero(first);
    restartEntrance(screens[stepScreen(first)]);
    screens[stepScreen(first)].classList.add('active');
    positionAllGliders();
    STEP[first] && STEP[first]({ changedScreen: true });
    renderDots();
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'confirm') {
      const done = btn.classList.toggle('confirmed');
      btn.textContent = done ? 'Confirmed ✓' : 'Confirm';
      btn.classList.remove('breathe');
    }
  });

  document.getElementById('nav-prev').addEventListener('click', prev);
  document.getElementById('nav-next').addEventListener('click', next);
  document.getElementById('nav-restart').addEventListener('click', () => goStep(0));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'r') goStep(0);
  });

  /* ─────────────────── Day tabs (sliding glider) ─────────────────── */

  function positionGlider(tabs) {
    const active = tabs.querySelector('.day-tab.active');
    const glider = tabs.querySelector('.tab-glider');
    if (!active || !glider) return;
    glider.style.width = `${active.offsetWidth}px`;
    glider.style.translate = `${active.offsetLeft}px 0`;
  }
  const allTabs = document.querySelectorAll('.day-tabs');
  const positionAllGliders = () => allTabs.forEach(positionGlider);
  document.fonts.ready.then(positionAllGliders);
  window.addEventListener('resize', positionAllGliders);

  allTabs.forEach(tabs => {
    tabs.addEventListener('click', e => {
      const tab = e.target.closest('.day-tab');
      if (!tab || tab.classList.contains('active')) return;
      tabs.querySelectorAll('.day-tab').forEach(b => b.classList.remove('active'));
      tab.classList.add('active');
      positionGlider(tabs);
    });
  });

  /* ════════════════ Booking flow · screen sequences ════════════════ */

  const askScreen = screens.ask;
  const askPill = document.getElementById('ask-pill');
  const askAnswer = document.getElementById('ask-answer');
  const loadingReply = document.getElementById('loading-reply');
  const resultsReply = document.getElementById('results-reply');

  sliceGradient(askAnswer);
  wrapWords(loadingReply);
  wrapWords(resultsReply);

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

  /* tap to skip ahead (the pill itself stays interactive) */
  askScreen.addEventListener('click', e => {
    if (e.target.closest('[data-action]') || e.target.closest('.voice-pill')) return;
    next();
  });
  screens.loading.addEventListener('click', next);

  /* ════════════════ Rework flow · screen sequences ════════════════ */

  const sched = screens.sched;
  const v2Answer = document.getElementById('v2-answer');
  const v2Orb = document.getElementById('v2-orb');
  const adText = document.getElementById('ad-text');
  const addHeritage = document.getElementById('add-heritage');

  sliceGradient(v2Answer, '#ffffff 0%, rgba(255,255,255,0.46) 100%');
  sliceGradient(adText, '#ffffff 0%, rgba(255,255,255,0.42) 100%');

  /* tap to skip the moments that would otherwise auto-advance */
  [screens.voice2, screens.adding].forEach(s => s.addEventListener('click', next));

  /* ─────────────────── Step definitions ─────────────────── */

  const STEP = {
    /* ── booking ── */
    ask() {
      askPill.dataset.state = 'idle';
      askPill.classList.remove('pill-done');
      unlit(askAnswer);
      const words = askAnswer.querySelectorAll('.w');
      at(700, () => { askPill.dataset.state = 'listening'; });     // mic opens
      at(1500, () => {                                             // Nana speaks
        words.forEach((w, i) => at(i * 175, () => w.classList.add('on')));
      });
      const spoken = 1500 + words.length * 175 + 1150;
      at(spoken, () => pillDone(askPill));
      at(spoken + 1100, next);
    },
    loading() {
      hush(loadingReply);
      timers.push(...speak(loadingReply, { interval: 130, delay: 480 }));
      at(3400, next);
    },
    results() {
      // the reply was already spoken over the skeletons — keep it lit so the
      // dissolve reads as the same sentence resolving, not a new one
      resultsReply.querySelectorAll('.qw').forEach(w => w.classList.add('on'));
    },

    /* ── rework ── */
    'sched:stack'() {
      // snap, don't slide: on entry or restart the original day is simply there
      snap(sched, () => {
        sched.dataset.state = 'stack';
        sched.dataset.card = 'artisans';
      });
      sched.classList.remove('no-entrance'); // a restart earns its entrance back
      at(2600, next);                        // the day settles, then Nana picks a card
    },
    'sched:focus'() {
      sched.dataset.state = 'focus';         // the 2 PM card lifts out of the stack
      at(2200, next);
    },
    voice2() {
      unlit(v2Answer);
      v2Orb.classList.remove('orb-live');
      const words = v2Answer.querySelectorAll('.w');
      at(600, () => v2Orb.classList.add('orb-live'));              // mic opens
      at(1200, () => {                                             // Nana asks
        words.forEach((w, i) => at(i * 165, () => w.classList.add('on')));
      });
      const spoken = 1200 + words.length * 165 + 1000;
      at(spoken, () => v2Orb.classList.remove('orb-live'));
      at(spoken + 900, next);
    },
    'search:searching'({ changedScreen }) {
      screens.search.dataset.state = 'searching';
      if (changedScreen) { /* skeletons animate from CSS */ }
      at(3200, next);
    },
    'search:results'() {
      screens.search.dataset.state = 'results';
      // the companion adds the first suggestion for you
      at(2100, () => ghostTap(addHeritage));
      at(2700, next);
    },
    adding() {
      unlit(adText);
      at(500, () => lit(adText));
      at(3200, next);
    },
    'sched:landing'() {
      // the day reassembles around the shared card, which never moved — it
      // rides above the dissolve, pops as it lands, and tucks straight into
      // the stack on the pop's settle: one continuous gesture
      sched.dataset.card = 'hosn';
      sched.dataset.state = 'landing';
      at(650, () => hero.classList.add('pop'));
      at(1260, next);                        // pop ends at 1200; tuck follows through
    },
    'sched:stack2'() {
      sched.dataset.state = 'stack';         // …and settles into the day
      sched.dataset.card = 'hosn';
    },
  };

  /* geometry to preset before a screen's reveal (runs pre-activation) */
  const PRE = {
    'sched:landing'() {
      snap(sched, () => {
        sched.dataset.card = 'hosn';
        sched.dataset.state = 'landing';
      });
    },
  };

  /* teardown per screen, so a step change never leaves a half-played state */
  const EXIT = {
    ask() {
      askPill.dataset.state = 'idle';
      askPill.classList.remove('pill-done');
      unlit(askAnswer);
    },
    loading() { hush(loadingReply); },
    results() {
      hush(resultsReply);
      screens.results.querySelectorAll('.confirm-btn').forEach(b => {
        b.classList.remove('confirmed');
        b.textContent = 'Confirm';
      });
    },
    voice2() { unlit(v2Answer); v2Orb.classList.remove('orb-live'); },
    adding() { unlit(adText); },
    sched() { sched.classList.remove('no-entrance'); },
    search() {},
  };

  /* dev hook for demos/tests (e.g. jump to a step from the console) */
  window.__proto = { goStep, startFlow, FLOWS, step: () => FLOW[stepIndex] };

  buildDots();
  renderDots();
  STEP[FLOW[0]]({ changedScreen: true });
})();
