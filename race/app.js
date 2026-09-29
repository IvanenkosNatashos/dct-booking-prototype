/* ═══════════════════════════════════════════════════════════════════
   DCT · Race Week — standalone prototype (EAD Sprint · Khalid)
   A cold user from KSA lands on the Grand Prix page with his family in
   mind. Five beats, on autodelay, every tap also live:
     event page → a name → a mood board → building → the week, planned
   ═══════════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const FLOW = ['race', 'name', 'mood', 'build', 'week'];

  const screens = {};
  document.querySelectorAll('.screen').forEach(s => { screens[s.dataset.screen] = s; });
  let stepIndex = 0;

  /* ─────────────────────── Phone scaling ─────────────────────── */

  const phoneScreens = document.querySelector('.phone-screens');
  const isCompact = () => window.innerWidth <= 560 || window.innerHeight <= 700;
  function fitPhone() {
    const pad = isCompact() ? 0 : 128;
    const sw = (window.innerWidth - (isCompact() ? 0 : 40)) / 390;
    const sh = (window.innerHeight - pad) / 844;
    document.documentElement.style.setProperty('--phone-scale', Math.min(sw, sh, 1.1).toFixed(4));
  }
  window.addEventListener('resize', fitPhone);
  fitPhone();

  /* ─────────────── Touch cursor + tap ripple (desktop) ─────────────── */

  const cursor = document.getElementById('touch-cursor');
  if (window.matchMedia('(pointer: fine)').matches) {
    let tx = -100, ty = -100, cx = -100, cy = -100;
    document.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; cursor.classList.add('visible'); });
    document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));
    document.addEventListener('mousedown', () => cursor.classList.add('down'));
    document.addEventListener('mouseup', () => cursor.classList.remove('down'));
    (function follow() {
      cx += (tx - cx) * 0.3; cy += (ty - cy) * 0.3;
      cursor.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;
      requestAnimationFrame(follow);
    })();
  }
  function ripple(x, y) {
    const r = document.createElement('span');
    r.className = 'tap-ripple'; r.style.left = `${x}px`; r.style.top = `${y}px`;
    phoneScreens.appendChild(r); setTimeout(() => r.remove(), 700);
  }
  document.addEventListener('pointerdown', e => {
    const rect = phoneScreens.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
    const scale = rect.width / 390;
    ripple((e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
  });
  /* the companion tapping for you — same ripple, same button press */
  function ghostTap(el) {
    const pr = phoneScreens.getBoundingClientRect(), er = el.getBoundingClientRect(), s = pr.width / 390;
    ripple((er.left + er.width / 2 - pr.left) / s, (er.top + er.height / 2 - pr.top) / s);
    el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 260);
  }

  /* ─────────────── Spoken-word helper (conversation feel) ─────────────── */

  function sliceGradient(el, stops = '#ffffff 0%, rgba(255,255,255,0.2) 100%') {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const span = document.createElement('span'); span.className = 'w'; span.textContent = word;
      el.appendChild(span); if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    document.fonts.ready.then(() => {
      const total = el.clientWidth;
      el.querySelectorAll('.w').forEach(span => {
        span.style.background = `linear-gradient(90deg, ${stops})`;
        span.style.backgroundSize = `${total}px 100%`;
        span.style.backgroundPosition = `-${span.offsetLeft}px 0`;
        span.style.webkitBackgroundClip = 'text'; span.style.backgroundClip = 'text'; span.style.color = 'transparent';
      });
      el.style.background = 'none'; el.style.color = 'transparent';
    });
  }
  const unlit = el => el.querySelectorAll('.w').forEach(w => w.classList.remove('on'));

  /* "done talking" — a confirming pop as the pill settles back to idle */
  function pillDone(pill) {
    pill.dataset.state = 'idle';
    pill.classList.add('pill-done');
    setTimeout(() => pill.classList.remove('pill-done'), 600);
  }

  /* ─────────────── A slow cinematic glide for the page ─────────────── */

  let glideRaf = null;
  function glideTo(el, to, ms) {
    stopGlide();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.scrollTop = to; return; }
    const from = el.scrollTop, t0 = performance.now();
    const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / ms);
      el.scrollTop = from + (to - from) * ease(p);
      glideRaf = p < 1 ? requestAnimationFrame(tick) : null;
    })(t0);
  }
  function stopGlide() { if (glideRaf) cancelAnimationFrame(glideRaf); glideRaf = null; }

  /* ─────────────────────── Step machine ─────────────────────── */

  let timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const stepDots = document.getElementById('step-dots');
  FLOW.forEach(() => stepDots.appendChild(document.createElement('span')));
  const renderDots = () => [...stepDots.children].forEach((d, i) => d.classList.toggle('on', i === stepIndex));

  function restartEntrance(el) {
    el.classList.remove('entrance-held');
    el.querySelectorAll('[data-in]').forEach(n => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
  }

  function goStep(i) {
    if (i < 0 || i >= FLOW.length) return;
    const prev = FLOW[stepIndex], next = FLOW[i];
    const changed = prev !== next || !screens[prev].classList.contains('active');
    clearTimers();
    if (changed) EXIT[prev] && EXIT[prev]();
    stepIndex = i;
    if (changed) {
      screens[prev].classList.remove('active');
      restartEntrance(screens[next]);
      screens[next].classList.add('active');
    }
    STEP[next] && STEP[next]();
    renderDots();
  }
  const next = () => goStep(stepIndex + 1);
  function prev() {                        // never step back into the auto-forwarding build
    let t = stepIndex - 1;
    if (FLOW[t] === 'build') t -= 1;
    goStep(t);
  }
  document.getElementById('nav-prev').addEventListener('click', prev);
  document.getElementById('nav-next').addEventListener('click', next);
  document.getElementById('nav-restart').addEventListener('click', () => goStep(0));
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev();
    else if (e.key.toLowerCase() === 'r') goStep(0);
  });

  /* ─────────────────── The flow ─────────────────── */

  const raceScroll = document.getElementById('race-scroll');
  const raceBuild = document.getElementById('race-build');
  const nameScreen = screens.name;
  const namePill = document.getElementById('name-pill');
  const nameAnswer = document.getElementById('name-answer');
  const moodScreen = screens.mood;
  const moodCreate = document.getElementById('mood-create');
  const moodTiles = [...moodScreen.querySelectorAll('.mood-tile[data-mood]')];
  const moodTile = m => moodTiles.find(t => t.dataset.mood === m);

  sliceGradient(nameAnswer);

  /* lights-out at Yas Marina: the countdown on the page is real */
  const raceCount = document.getElementById('race-count');
  const LIGHTS_OUT = Date.parse('2026-12-04T17:00:00+04:00');
  function tickCount() {
    let left = Math.max(0, Math.floor((LIGHTS_OUT - Date.now()) / 1000));
    const d = Math.floor(left / 86400); left -= d * 86400;
    const h = Math.floor(left / 3600); left -= h * 3600;
    const m = Math.floor(left / 60), sec = left - m * 60;
    const pad = n => String(n).padStart(2, '0');
    raceCount.querySelector('[data-u="d"]').textContent = pad(d);
    raceCount.querySelector('[data-u="h"]').textContent = pad(h);
    raceCount.querySelector('[data-u="m"]').textContent = pad(m);
    raceCount.querySelector('[data-u="s"]').textContent = pad(sec);
  }
  tickCount();
  setInterval(tickCount, 1000);

  /* where the page rests: the Ask card's foot 24px above the phone's edge */
  const askRest = () => raceScroll.scrollHeight - raceScroll.clientHeight;
  raceScroll.addEventListener('pointerdown', stopGlide);
  raceScroll.addEventListener('wheel', stopGlide, { passive: true });

  /* the CTA is the handoff — press it yourself or watch Khalid do it */
  raceBuild.addEventListener('click', () => { if (FLOW[stepIndex] === 'race') goStep(1); });

  /* the pill is a live mic demo: tap to talk, tap again — done */
  namePill.addEventListener('click', () => {
    if (namePill.dataset.state === 'listening') pillDone(namePill); else namePill.dataset.state = 'listening';
  });
  namePill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); namePill.click(); } });

  /* the mood board: tiles toggle, Create builds */
  moodTiles.forEach(t => t.querySelector('.mood-pick').addEventListener('click', e => { e.stopPropagation(); t.classList.toggle('picked'); }));
  moodCreate.addEventListener('click', () => { if (FLOW[stepIndex] === 'mood') next(); });
  const clearMood = () => moodTiles.forEach(t => t.classList.remove('picked', 'dim'));

  /* tap to skip the moments that auto-forward */
  nameScreen.addEventListener('click', e => {
    if (e.target.closest('[data-action]') || e.target.closest('.voice-pill')) return;
    next();
  });
  screens.build.addEventListener('click', next);

  /* the plan's day tabs: the glider slides, the day's rows arrive */
  const weekScreen = screens.week;
  const weekDays = document.getElementById('week-days');
  function showDay(i) {
    weekScreen.dataset.day = i;
    weekDays.querySelectorAll('.week-day').forEach(b => b.classList.toggle('active', +b.dataset.day === i));
    weekScreen.querySelectorAll('.week-list').forEach(l => {
      const on = +l.dataset.day === i;
      l.hidden = !on;
      l.classList.toggle('arrive', on);
    });
  }
  weekDays.addEventListener('click', e => {
    const b = e.target.closest('.week-day'); if (b) showDay(+b.dataset.day);
  });

  const STEP = {
    race() {
      stopGlide();
      raceScroll.scrollTop = 0;                // a restart opens at the hero
      restartEntrance(screens.race);
      at(2400, () => glideTo(raceScroll, askRest(), 1600));   // …then wanders down to the card
      at(4600, () => ghostTap(raceBuild));     // Khalid builds the week
      at(5000, next);
    },
    name() {
      namePill.dataset.state = 'idle';
      namePill.classList.remove('pill-done');
      unlit(nameAnswer);
      const words = nameAnswer.querySelectorAll('.w');
      at(900, () => { namePill.dataset.state = 'listening'; });   // mic opens…
      at(1600, () => { words.forEach((w, i) => at(i * 165, () => w.classList.add('on'))); });   // …Khalid answers
      const spoken = 1600 + words.length * 165 + 1100;
      at(spoken, () => pillDone(namePill));
      at(spoken + 1000, next);
    },
    mood() {
      clearMood();
      restartEntrance(moodScreen);
      // culture and the race — the two he said he was here for
      at(1900, () => { ghostTap(moodTile('culture').querySelector('.mood-pick')); moodTile('culture').classList.add('picked'); });
      at(2800, () => { ghostTap(moodTile('race').querySelector('.mood-pick')); moodTile('race').classList.add('picked'); });
      at(3400, () => { moodTile('desert').classList.add('dim'); moodTile('art').classList.add('dim'); });
      at(4000, () => ghostTap(moodCreate));
      at(4400, next);
    },
    build() {
      restartEntrance(screens.build);
      at(4200, next);
    },
    week() {
      document.getElementById('week-scroll').scrollTop = 0;
      weekScreen.querySelectorAll('.week-list').forEach(l => l.classList.remove('arrive'));
      showDay(0);                              // a restart opens on Friday
      restartEntrance(weekScreen);
    },
  };

  const EXIT = {
    race() { stopGlide(); },
    name() { namePill.dataset.state = 'idle'; namePill.classList.remove('pill-done'); unlit(nameAnswer); },
    mood() { clearMood(); },
    build() {},
    week() {},
  };

  /* dev hook for demos/tests (e.g. jump to a step from the console) */
  window.__proto = { goStep, FLOW, step: () => FLOW[stepIndex] };

  renderDots();
  STEP[FLOW[0]]();
})();
