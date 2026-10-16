// Point d'entrée : navigation entre diapositives, lecture/pause des
// animations, mise à l'échelle 16:9, commandes clavier et souris.
import * as THREE from 'three';
import { Engine, webglAvailable } from './engine.js';
import { IntroView } from './scenes/intro.js';
import { HeroView } from './scenes/hero.js';
import { ExplodedView } from './scenes/exploded.js';
import { ObstacleView } from './scenes/obstacle.js';
import { DarknessView } from './scenes/darkness.js';
import { ColorView } from './scenes/color.js';
import { Synoptic } from './ui/synoptic.js';
import { ObstacleHud, DarknessHud, ColorHud } from './ui/hud.js';
import { Speech } from './ui/speech.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const AREAS = { full: [1600, 740], right: [1040, 740], none: [0, 0] };
const stage = $('#stage');
const slides = $$('.slide');
const speech = new Speech();

// ---------- Moteur 3D (ou affichage de secours) ----------
let engine = null;
if (webglAvailable()) {
  try {
    // ?qualite=haute | moyenne | basse (sinon : automatique à partir de "haute")
    const q = new URLSearchParams(location.search).get('qualite');
    const forced = { haute: 0, moyenne: 1, basse: 3 }[q];
    engine = new Engine($('#gl'), { tier: forced ?? 0, adaptive: forced === undefined });
  } catch (e) {
    console.warn('WebGL indisponible :', e);
    engine = null;
  }
}
if (!engine) {
  document.documentElement.classList.add('no-webgl');
}

const app = {
  engine,
  labelLayer: $('#labels'),
  subjectiveEl: $('#subjective'),
  speak: (text) => speech.speak(text),
  currentArea: 'full',
};

/** Timeline minimale (sans 3D) : fait défiler les étapes en mode secours. */
class StepTimeline {
  constructor(slide) {
    const ts = $$('.steps li', slide).map((li) => parseFloat(li.dataset.t));
    this.duration = ts.length ? ts[ts.length - 1] + 5 : 10;
    this.loop = !ts.length;
    this.cues = [];
  }
  ensureBuilt() {}
  enter() {}
  exit() {}
  update() {}
}

// ---------- Contrôleurs par diapositive ----------
const controllers = slides.map(() => null);
const viewCache = {};
function makeController(i) {
  const slide = slides[i];
  const key = slide.dataset.view;
  if (key === 'synoptic') return new Synoptic(slide);
  if (!key) return new StepTimeline(slide);
  if (!engine) return new StepTimeline(slide);
  if (viewCache[key]) return viewCache[key];
  let v;
  switch (key) {
    case 'intro': v = new IntroView(app); break;
    case 'hero': v = new HeroView(app); break;
    case 'exploded': v = new ExplodedView(app); break;
    case 'obstacle': v = new ObstacleView(app, new ObstacleHud(slide)); break;
    case 'darkness': v = new DarknessView(app, new DarknessHud(slide)); break;
    case 'color': v = new ColorView(app, new ColorHud(slide)); break;
  }
  viewCache[key] = v;
  return v;
}
function controller(i) {
  if (!controllers[i]) controllers[i] = makeController(i);
  return controllers[i];
}

// ---------- Mise à l'échelle ----------
let scale = 1;
function fit() {
  const vp = $('#viewport');
  const cs = getComputedStyle(vp);
  const w = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = vp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  scale = Math.max(0.1, Math.min(w / 1600, h / 900));
  stage.style.setProperty('--s', scale.toFixed(4));
  resizeEngine();
}
function resizeEngine() {
  if (!engine) return;
  const [w, h] = AREAS[app.currentArea] || AREAS.full;
  if (w) engine.resize(w, h, scale);
}
window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', () => setTimeout(fit, 50));

// ---------- État de lecture ----------
let index = -1;
let t = 0;
let playing = true;
let clock = 0;
let stepEls = [];

const dotsNav = $('#dots-nav');
slides.forEach((s, i) => {
  const b = document.createElement('button');
  b.textContent = i + 1;
  b.title = s.dataset.title;
  b.setAttribute('role', 'tab');
  b.setAttribute('aria-label', `Diapositive ${i + 1} : ${s.dataset.title}`);
  b.addEventListener('click', () => go(i));
  dotsNav.appendChild(b);
});

function go(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === index) return;
  const prev = index >= 0 ? controller(index) : null;
  if (prev) prev.exit();
  speech.cancel();
  if (index >= 0) slides[index].classList.remove('active');
  index = i;
  const slide = slides[i];
  slide.classList.add('active');
  app.currentArea = slide.dataset.area || 'none';
  stage.dataset.area = app.currentArea;
  $('#fallback').hidden = !!engine || !slide.dataset.view || slide.dataset.view === 'synoptic';
  if (!engine && slide.dataset.view && slide.dataset.view !== 'synoptic') stage.dataset.area = app.currentArea === 'none' ? 'none' : app.currentArea;

  const c = controller(i);
  c.ensureBuilt();
  resizeEngine();
  c.enter();
  if (engine) engine.setActive(c.scene ? c : null);

  t = 0;
  stepEls = $$('.steps li', slide).map((li) => ({ li, t: parseFloat(li.dataset.t) }));
  $('#slide-num').textContent = String(i + 1).padStart(2, '0');
  $('#slide-title').textContent = slide.dataset.title;
  $$('button', dotsNav).forEach((b, k) => {
    b.setAttribute('aria-selected', k === i ? 'true' : 'false');
    b.classList.toggle('done', k < i);
  });
  $('#btn-prev').disabled = i === 0;
  $('#btn-next').disabled = i === slides.length - 1;
  try {
    history.replaceState(null, '', '#' + (i + 1));
  } catch (e) {
    /* contexte sans historique */
  }
  // fondu d'entrée de la zone 3D
  const area = $('#canvas-area');
  area.classList.remove('enter');
  void area.offsetWidth;
  area.classList.add('enter');
  // mise à jour immédiate (pas de flash d'un état ancien)
  c.update(0, 0, clock);
  renderOnce();
}

function setPlaying(p) {
  playing = p;
  const btn = $('#btn-play');
  btn.querySelector('use').setAttribute('href', p ? '#i-pause' : '#i-play');
  btn.querySelector('span').textContent = p ? 'Pause' : 'Lecture';
  if (p) speech.resume();
  else speech.pause();
}

function restart() {
  speech.cancel();
  t = 0;
  const c = controller(index);
  if (c.reset) c.reset();
  c.update(0, 0, clock);
  setPlaying(true);
}

function seek(time) {
  speech.cancel();
  t = Math.max(0, time - 0.05);
  controller(index).update(t, 0, clock);
  setPlaying(true);
}

function fireCues(c, from, to) {
  for (const cue of c.cues || []) if (cue.t > from && cue.t <= to) cue.fn();
}

function renderOnce() {
  const c = controller(index);
  if (engine && c.scene && app.currentArea !== 'none') {
    engine.render(clock);
    if (c.afterRender) c.afterRender();
  }
}

let last = performance.now() / 1000;
function frame(nowMs) {
  const now = nowMs / 1000;
  const real = Math.min(0.05, Math.max(0, now - last));
  last = now;
  const c = controller(index);
  const dt = playing ? real : 0;
  clock += dt;
  if (playing) {
    const prev = t;
    t += dt;
    if (t >= c.duration) {
      if (c.loop) {
        fireCues(c, prev, c.duration);
        t -= c.duration;
        fireCues(c, -1, t);
      } else {
        t = c.duration;
        fireCues(c, prev, t);
      }
    } else fireCues(c, prev, t);
  }
  c.update(t, dt, clock, real);
  if (engine) engine.adapt(real);
  renderOnce();

  // étapes et progression
  let active = -1;
  stepEls.forEach((s, k) => {
    if (t >= s.t) active = k;
  });
  stepEls.forEach((s, k) => {
    s.li.classList.toggle('active', k === active);
    s.li.classList.toggle('done', k < active);
  });
  $('#anim-progress').style.width = ((t / c.duration) * 100).toFixed(2) + '%';
  requestAnimationFrame(frame);
}

// ---------- Commandes ----------
$('#btn-prev').addEventListener('click', () => go(index - 1));
$('#btn-next').addEventListener('click', () => go(index + 1));
$('#btn-play').addEventListener('click', () => setPlaying(!playing));
$('#btn-restart').addEventListener('click', restart);
$$('.replay').forEach((b) => b.addEventListener('click', restart));

function toggleFullscreen() {
  const d = document;
  try {
    if (!d.fullscreenElement) d.documentElement.requestFullscreen?.().catch(() => {});
    else d.exitFullscreen?.().catch(() => {});
  } catch (e) {
    /* plein écran non disponible */
  }
}
const fullBtn = $('#btn-full');
if (!document.fullscreenEnabled) fullBtn.disabled = true;
fullBtn.addEventListener('click', toggleFullscreen);

const soundBtn = $('#btn-sound');
function setSound(on) {
  speech.enabled = on && speech.supported;
  if (!speech.enabled) speech.cancel();
  soundBtn.setAttribute('aria-pressed', speech.enabled ? 'true' : 'false');
  soundBtn.querySelector('use').setAttribute('href', speech.enabled ? '#i-sound' : '#i-mute');
}
if (!speech.supported) soundBtn.disabled = true;
setSound(speech.supported);
soundBtn.addEventListener('click', () => setSound(!speech.enabled));

window.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input')) return;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': go(index + 1); e.preventDefault(); break;
    case 'ArrowLeft': case 'PageUp': go(index - 1); e.preventDefault(); break;
    case ' ': setPlaying(!playing); e.preventDefault(); break;
    case 'r': case 'R': restart(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 's': case 'S': setSound(!speech.enabled); break;
    case 'Home': go(0); break;
    case 'End': go(slides.length - 1); break;
  }
});

// clic sur une étape → saut dans l'animation
slides.forEach((s) => {
  $$('.steps li', s).forEach((li) => {
    li.tabIndex = 0;
    const jump = () => seek(parseFloat(li.dataset.t));
    li.addEventListener('click', jump);
    li.addEventListener('keydown', (e) => e.key === 'Enter' && jump());
  });
});

// Diapositive 1 : vision réduite
const subjBtn = $('#toggle-subjective');
subjBtn.addEventListener('click', () => {
  const on = subjBtn.getAttribute('aria-pressed') !== 'true';
  subjBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  subjBtn.textContent = on ? 'Vision réduite : affichée' : 'Vision réduite : masquée';
  if (viewCache.intro) viewCache.intro.setSubjective(on);
});
if (!engine) subjBtn.hidden = true;

// Diapositive 3 : éclater / assembler / légende
$$('[data-explode]').forEach((b) =>
  b.addEventListener('click', () => {
    $$('[data-explode]').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    const v = viewCache.exploded;
    if (!v) return;
    v.setMode(b.dataset.explode);
    if (b.dataset.explode === 'auto') restart();
  })
);
$$('#legend li').forEach((li) => {
  li.tabIndex = 0;
  const on = () => viewCache.exploded?.highlight(+li.dataset.i);
  const off = () => viewCache.exploded?.highlight(-1);
  li.addEventListener('mouseenter', on);
  li.addEventListener('focus', on);
  li.addEventListener('mouseleave', off);
  li.addEventListener('blur', off);
  // clic : la caméra vole vers la pièce ; second clic : retour à la vue d'ensemble
  const pick = () => {
    const v = viewCache.exploded;
    if (!v) return;
    const i = +li.dataset.i;
    const next = v.pinned === i ? -1 : i;
    v.focusOn(next);
    $$('#legend li').forEach((x) => x.classList.toggle('pinned', +x.dataset.i === next));
    if (next >= 0) $$('[data-explode]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.explode === 'open' ? 'true' : 'false'));
    $('#overview').hidden = next < 0;
  };
  li.addEventListener('click', pick);
  li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
});
$('#overview').addEventListener('click', () => {
  viewCache.exploded?.focusOn(-1);
  $$('#legend li').forEach((x) => x.classList.remove('pinned'));
  $('#overview').hidden = true;
});

// Diapositive 4 : flux du synoptique
$$('.chain').forEach((li) => {
  li.tabIndex = 0;
  const jump = () => {
    const syn = controllers[slides.indexOf(li.closest('.slide'))];
    if (syn) syn.showAll = false;
    $('#syn-all').setAttribute('aria-pressed', 'false');
    seek(parseFloat(li.dataset.t) + 0.06);
  };
  li.addEventListener('click', jump);
  li.addEventListener('keydown', (e) => e.key === 'Enter' && jump());
});
$('#syn-all').addEventListener('click', (e) => {
  const syn = controllers[slides.indexOf(e.target.closest('.slide'))];
  if (!syn) return;
  syn.showAll = !syn.showAll;
  e.target.setAttribute('aria-pressed', syn.showAll ? 'true' : 'false');
});

// Diapositive 6 : contrôle manuel de la lumière
const manual = $('#manual-light');
const level = $('#light-level');
manual.addEventListener('change', () => {
  level.disabled = !manual.checked;
  viewCache.darkness?.setManual(manual.checked, level.value / 100);
});
level.addEventListener('input', () => viewCache.darkness?.setManual(manual.checked, level.value / 100));

// Diapositive 7 : choix de l'objet
$$('.obj').forEach((b) =>
  b.addEventListener('click', () => {
    $$('.obj').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    viewCache.color?.setObject(b.dataset.obj);
    restart();
  })
);

// Accès de débogage (console) : __sensia.go(n), __sensia.seek(t)
window.__sensia = { app, go: (n) => go(n - 1), seek: (x) => { seek(x + 0.05); }, pause: () => setPlaying(false), play: () => setPlaying(true) };

// ---------- Démarrage ----------
fit();
const start = parseInt((location.hash || '').replace('#', ''), 10);
go(Number.isFinite(start) ? start - 1 : 0);
requestAnimationFrame(frame);

// Préparation des autres scènes en arrière-plan (évite les saccades au changement)
if (engine) {
  const queue = slides.map((_, i) => i);
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
  const next = () => {
    const i = queue.shift();
    if (i === undefined) return;
    const c = controller(i);
    if (c.scene === undefined && c.ensureBuilt && c.build) {
      c.ensureBuilt();
      try {
        engine.renderer.compile(c.scene, c.camera);
      } catch (e) {
        /* compilation anticipée facultative */
      }
    }
    setTimeout(() => idle(next), 250);
  };
  setTimeout(() => idle(next), 800);
}
