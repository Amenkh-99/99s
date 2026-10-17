// Contrôleur de la soutenance SENSIA : navigation entre diapositives,
// transitions, chapitres, vue d'ensemble, et pilotage de la scène 3D.
import { Engine, webglAvailable } from '../../js/engine.js';
import { Showroom } from './showroom.js';
import { buildGantt } from './gantt.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ─────────────────────────── Réglages faciles ───────────────────────────
// Mention affichée sur la page de garde (le PowerPoint parle aussi de
// « mini-projet » dans les objectifs SMART : adaptez si besoin).
const PROJECT_KIND = "Projet de fin d'études";

/** Parties du sommaire (6 points du PowerPoint). */
const SECTIONS = [
  { n: 0, short: 'Accueil' },
  { n: 1, short: 'Planificateur', title: 'Planificateur' },
  { n: 2, short: 'Problématique', title: 'Problématique' },
  { n: 3, short: 'Solutions', title: 'Propositions des solutions possibles' },
  { n: 4, short: 'Présentation', title: 'Présentation de SENSIA' },
  { n: 5, short: 'Matériel', title: 'Étude du matériel utilisé' },
  { n: 6, short: 'Conclusion', title: 'Conclusion' },
];

/** Plans de caméra et opacité de la scène 3D, par diapositive. */
const SHOTS = {
  cover: { shot: { az: 0.5, el: 0.12, dist: 2.95, ty: -0.08, shift: 0.2, drift: 0.07, sonar: true }, layer: 1 },
  sommaire: { shot: { az: -0.6, el: 0.22, dist: 3.4, shift: 0.24, drift: 0.05 }, layer: 0.5 },
  side: { shot: { az: -0.95, el: 0.1, dist: 3.0, shift: 0.19, drift: 0.04, sonar: true }, layer: 1 },
  dim: { shot: { az: 0.3, el: 0.2, dist: 3.4, shift: 0, drift: 0.05 }, layer: 0.22 },
  off: { shot: null, layer: 0 },
  viewer: { shot: { az: 0.6, el: 0.2, dist: 3.9, ty: -0.28, shift: 0.17, interactive: true, labels: true, drift: 0.12 }, layer: 1 },
  component: { shot: { subject: 'component', az: 0.25, el: 0.3, dist: 2.8, ty: -0.12, shift: 0.13, interactive: true, drift: 0 }, layer: 1 },
  conclusion: { shot: { az: -0.45, el: 0.15, dist: 2.9, shift: 0.2, leds: 1, drift: 0.06 }, layer: 0.9 },
  finale: { shot: { az: 0, el: 0.06, dist: 3.6, ty: 0.12, shift: 0, leds: 1, sonar: true, drift: 0.05 }, layer: 1 },
};

/** Matériel (diapositive « Étude du matériel utilisé »). Textes repris du PowerPoint. */
const KIT = [
  { group: 'Traitement', items: [
    { key: 'esp32', name: 'ESP32', role: 'Microcontrôleur : lit les capteurs, prend les décisions et commande les sorties.',
      why: ["Choix d'un microcontrôleur performant avec Wi-Fi et Bluetooth intégrés", "Remplacement de l'Arduino pour une meilleure vitesse de calcul et plus de mémoire"], vs: 'Arduino' },
  ] },
  { group: 'Capteurs', items: [
    { key: 'hcsr04', name: 'HC-SR04', role: "Capteur à ultrasons : mesure la distance d'un obstacle.",
      why: ['Détection précise des obstacles par ultrasons', 'Remplacement du capteur infrarouge classique pour une portée plus importante et stable'], vs: 'capteur infrarouge' },
    { key: 'tcs3200', name: 'TCS3200', role: "Capteur de couleur : mesure la lumière réfléchie par l'objet.",
      why: ['Reconnaissance précise des couleurs ambiantes', "Solution plus simple, plus légère et moins coûteuse qu'une caméra complète"], vs: 'caméra' },
    { key: 'ldr', name: 'LDR', role: 'Photorésistance (module LM393) : détecte le niveau de luminosité ambiante.' },
    { key: 'bouton', name: 'Bouton poussoir', role: "Permet à l'utilisateur de demander la lecture de la couleur." },
  ] },
  { group: 'Sorties', items: [
    { key: 'led', name: 'LED', role: "Éclairage d'appoint quand la luminosité devient insuffisante." },
    { key: 'dfplayer', name: 'DFP · DFPlayer Mini', role: 'Lecteur audio : lit les messages vocaux enregistrés sur la carte mémoire.' },
    { key: 'ecouteur', name: 'Écouteur', role: "Diffuse les messages vocaux à l'utilisateur.",
      why: ["Diffusion de messages vocaux clairs pour l'utilisateur", 'Solution préférée au buzzer pour une meilleure compréhension et un meilleur confort'], vs: 'buzzer' },
  ] },
  { group: 'Alimentation et connexions', items: [
    { key: 'batterie', name: 'Batterie 5 V', role: "Alimente l'ensemble du système." },
    { key: 'resistances', name: 'Résistances', role: "Limitent le courant des LED (220 Ω) et forment le diviseur de tension de l'ECHO (1 kΩ / 2 kΩ)." },
    { key: 'fils', name: 'Fils électriques', role: "Relient les modules à l'ESP32 sur la plaque d'essai." },
  ] },
  { group: 'Support', items: [
    { key: 'support', name: 'Support (monture)', role: 'Monture de lunettes qui porte les capteurs et les LED.' },
  ] },
];

/** Rôle des repères de la vue 3D (même ordre que showroom.hotspots). */
const PART_ROLES = [
  'Mesure la distance d\'un obstacle',
  'Mesure la lumière réfléchie par l\'objet',
  'Demande la lecture de la couleur',
  'Détecte le niveau de luminosité',
  'Éclairage aux deux extrémités',
  'Traite les données, commande le système',
  'Lit les messages vocaux (carte mémoire)',
  'Alimente le système',
  'Diffusent les messages vocaux',
];

/** Tableau de câblage (repris du schéma Fritzing). `warn` : broche à vérifier. */
const PINS = [
  ['HC-SR04', [['VCC', '5V (alimentation)'], ['TRIG', 'GPIO13'], ['ECHO', 'GPIO32 (via diviseur 1k/2k)'], ['GND', 'GND']]],
  ['TCS3200', [['S0', 'GPIO4'], ['S1', 'GPIO5'], ['S2', 'GPIO18', true], ['S3', 'GPIO19'], ['OUT', 'GPIO21'], ['VCC', '5V (alimentation)'], ['GND', 'GND']]],
  ['Bouton poussoir', [['1 côté', 'GPIO27 (INPUT_PULLUP)'], ['Autre côté', 'GND']]],
  ['LED verte', [['Anode', 'GPIO25 (via 220 Ω)'], ['Cathode', 'GND']]],
  ['LED rouge', [['Anode', 'GPIO26 (via 220 Ω)'], ['Cathode', 'GND']]],
  ['LDR (module LM393)', [['VCC', '3V3'], ['AO', 'GPIO34'], ['DO', 'GPIO22 (optionnel)'], ['GND', 'GND']]],
  ['DFPlayer Mini', [['VCC', '5V (alimentation)'], ['RX', 'GPIO17 (via 1 kΩ)'], ['TX', 'GPIO18 (via 1 kΩ)', true], ['SPK+', '→ Haut-parleur +'], ['SPK−', '→ Haut-parleur −'], ['GND', 'GND']]],
];

// ───────────────────────────── Mise en place ─────────────────────────────
const stage = $('#stage');
const slides = $$('.slide');
const layer = $('#gl-layer');
$('#project-kind').textContent = PROJECT_KIND;
$('#n-tot').textContent = String(slides.length).padStart(2, '0');

let engine = null;
let showroom = null;
if (webglAvailable()) {
  try {
    const q = new URLSearchParams(location.search).get('qualite');
    const forced = { haute: 0, moyenne: 1, basse: 3 }[q];
    engine = new Engine($('#gl'), { tier: forced ?? 0, adaptive: forced === undefined });
    showroom = new Showroom(engine, $('#labels'));
    engine.setActive(showroom);
  } catch (e) {
    console.warn('WebGL indisponible :', e);
    engine = showroom = null;
  }
}
if (!engine) {
  document.documentElement.classList.add('no-webgl');
  $('#fallback').hidden = false;
}

// Mise à l'échelle de la scène 16:9 (1600 × 900 unités)
let scale = 1;
function fit() {
  const vp = $('#viewport');
  const cs = getComputedStyle(vp);
  const w = vp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const h = vp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  scale = Math.max(0.1, Math.min(w / 1600, h / 900));
  stage.style.setProperty('--s', scale.toFixed(4));
  if (engine) engine.resize(1600, 900, scale);
}
window.addEventListener('resize', fit);
document.addEventListener('fullscreenchange', () => setTimeout(fit, 60));

// ─────────────────────────── Chapitres et sommaire ───────────────────────────
const firstOf = (sec) => slides.findIndex((s) => +s.dataset.sec === sec);
const chapters = $('#chapters');
SECTIONS.slice(1).forEach((sec) => {
  const b = document.createElement('button');
  b.className = 'chap';
  b.dataset.sec = sec.n;
  b.innerHTML = `<i>${String(sec.n).padStart(2, '0')}</i><span>${sec.short}</span><u></u>`;
  b.addEventListener('click', () => go(firstOf(sec.n)));
  chapters.appendChild(b);
});
const toc = $('#toc');
SECTIONS.slice(1).forEach((sec) => {
  const li = document.createElement('li');
  li.innerHTML = `<button><i>${sec.n}</i><span>${sec.title.replace('SENSIA', '<b>SENSIA</b>')}</span><svg><use href="#i-arrow"/></svg></button>`;
  li.style.setProperty('--k', sec.n);
  li.querySelector('button').addEventListener('click', () => go(firstOf(sec.n)));
  toc.appendChild(li);
});

// Vue d'ensemble (grille des diapositives)
const ovGrid = $('#ov-grid');
slides.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'ov-card';
  const sec = SECTIONS[+s.dataset.sec];
  b.innerHTML = `<i>${String(i + 1).padStart(2, '0')}</i><small>${sec.n ? sec.short : 'Accueil'}</small><b>${s.dataset.title}</b>`;
  b.addEventListener('click', () => {
    toggleOverview(false);
    go(i);
  });
  ovGrid.appendChild(b);
});
function toggleOverview(on = $('#overview').hidden) {
  $('#overview').hidden = !on;
  if (on) $$('.ov-card', ovGrid)[index]?.focus();
}
$('#overview-btn').addEventListener('click', () => toggleOverview());
$('#ov-close').addEventListener('click', () => toggleOverview(false));

// ─────────────────────────────── Navigation ───────────────────────────────
let index = -1;
let layerTarget = 1;
let layerOpacity = 0;
const entered = new Set();

function go(i, { instant = false } = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === index) return;
  const dir = i > index ? 1 : -1;
  const prev = slides[index];
  if (prev) {
    prev.classList.remove('active');
    prev.classList.add('leaving');
    prev.style.setProperty('--dir', dir);
    setTimeout(() => prev.classList.remove('leaving'), instant ? 0 : 650);
  }
  index = i;
  const s = slides[i];
  s.style.setProperty('--dir', dir);
  s.classList.add('active');
  stage.dataset.slide = i + 1;

  // scène 3D : plan + opacité du calque
  const cfg = SHOTS[s.dataset.shot] || SHOTS.dim;
  layerTarget = engine ? cfg.layer : 0;
  if (showroom && cfg.shot) {
    showroom.setShot(cfg.shot);
    if (s.dataset.shot === 'viewer') applyViewerState();
    if (s.dataset.shot === 'component') showroom.showComponent(currentKit);
  }
  stage.classList.toggle('interactive-3d', !!cfg.shot?.interactive);
  stage.dataset.layer = cfg.layer >= 0.5 ? 'on' : 'off';

  // en-tête, compteur, progression
  const sec = +s.dataset.sec;
  $$('.chap', chapters).forEach((c) => {
    const n = +c.dataset.sec;
    c.classList.toggle('on', n === sec);
    c.classList.toggle('done', n < sec);
  });
  $('#n-cur').textContent = String(i + 1).padStart(2, '0');
  $('#slide-name').textContent = s.dataset.title;
  $('#progress').style.width = ((i / (slides.length - 1)) * 100).toFixed(2) + '%';
  $('#prev').disabled = i === 0;
  $('#next').disabled = i === slides.length - 1;
  $$('.ov-card', ovGrid).forEach((c, k) => c.classList.toggle('on', k === i));
  try {
    history.replaceState(null, '', '#' + (i + 1));
  } catch (e) {
    /* contexte sans historique */
  }
  onEnter(s, !entered.has(i));
  entered.add(i);
}

$('#prev').addEventListener('click', () => go(index - 1));
$('#next').addEventListener('click', () => go(index + 1));
$$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(+b.dataset.goto - 1)));

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  } catch (e) {
    /* plein écran non disponible */
  }
}
if (!document.fullscreenEnabled) $('#full').disabled = true;
$('#full').addEventListener('click', toggleFullscreen);

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  const ov = !$('#overview').hidden;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': case ' ':
      if (!ov) { go(index + 1); e.preventDefault(); }
      break;
    case 'ArrowLeft': case 'PageUp':
      if (!ov) { go(index - 1); e.preventDefault(); }
      break;
    case 'Home': go(0); break;
    case 'End': go(slides.length - 1); break;
    case 'o': case 'O': toggleOverview(); break;
    case 'Escape': toggleOverview(false); break;
    case 'f': case 'F': toggleFullscreen(); break;
  }
});

// Balayage tactile (hors zones 3D interactives et zones défilantes)
let touch = null;
stage.addEventListener('touchstart', (e) => {
  if (e.touches.length !== 1 || e.target.closest('#gl, .pin-scroll, .code-body, .zoomer, .overview')) return;
  touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
}, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && performance.now() - touch.t < 700) go(index + (dx < 0 ? 1 : -1));
  touch = null;
});

// ───────────────────────── Contenus interactifs ─────────────────────────
let gantt = null;
function onEnter(slide, first) {
  if (slide.querySelector('#gantt')) {
    gantt ??= buildGantt($('#gantt'), $('#gantt-tip'));
    gantt.play();
  }
  if (slide.querySelector('#flow')) startFlow();
}

// Principe de fonctionnement : impulsion qui parcourt la chaîne
let flowTimer = null;
let flowPath = [0, 1, 2, 3];
function startFlow() {
  clearInterval(flowTimer);
  const cards = $$('#flow .stage-card');
  const arrows = $$('#flow .flow-arrow');
  let k = 0;
  const step = () => {
    const cur = flowPath[k % (flowPath.length + 1)];
    cards.forEach((c, i) => c.classList.toggle('lit', i === cur));
    cards.forEach((c, i) => c.classList.toggle('past', flowPath.indexOf(i) >= 0 && flowPath.indexOf(i) < flowPath.indexOf(cur)));
    arrows.forEach((a, i) => a.classList.toggle('lit', cur !== undefined && i === cur - 1));
    k++;
  };
  step();
  flowTimer = setInterval(() => {
    if (!slides[index]?.querySelector('#flow')) return clearInterval(flowTimer);
    step();
  }, 1100);
}
$$('.scn').forEach((b) => b.addEventListener('click', () => {
  $$('.scn').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
  flowPath = b.dataset.path.split(',').map(Number);
  startFlow();
}));

// Vue 3D : commandes
const viewer = { exploded: false, leds: false, sonar: false, rotate: true };
function applyViewerState() {
  if (!showroom) return;
  showroom.setExplode(viewer.exploded ? 1 : 0);
  showroom.setLeds(viewer.leds ? 1 : 0);
  showroom.setSonar(viewer.sonar);
  showroom.setAutoRotate(viewer.rotate);
}
function setExploded(on) {
  viewer.exploded = on;
  $('#v-assembled').setAttribute('aria-pressed', on ? 'false' : 'true');
  $('#v-exploded').setAttribute('aria-pressed', on ? 'true' : 'false');
  if (!on) {
    showroom?.focusHotspot(-1);
    $$('#parts li').forEach((x) => x.classList.remove('pinned'));
  }
  applyViewerState();
}
$('#v-assembled').addEventListener('click', () => setExploded(false));
$('#v-exploded').addEventListener('click', () => setExploded(true));
$('#t-leds').addEventListener('change', (e) => { viewer.leds = e.target.checked; applyViewerState(); });
$('#t-sonar').addEventListener('change', (e) => { viewer.sonar = e.target.checked; applyViewerState(); });
$('#t-rotate').addEventListener('change', (e) => { viewer.rotate = e.target.checked; applyViewerState(); });
$('#t-photo').addEventListener('change', (e) => { $('#proto-photo').hidden = !e.target.checked; });

const partsList = $('#parts');
const HOTSPOT_NAMES = ['HC-SR04', 'TCS3200', 'Bouton poussoir', 'LDR', 'Deux LED', 'ESP32', 'DFPlayer Mini + carte mémoire', 'Batterie', 'Écouteurs'];
HOTSPOT_NAMES.forEach((name, i) => {
  const li = document.createElement('li');
  li.tabIndex = 0;
  li.innerHTML = `<i>${i + 1}</i><div><b>${name}</b><span>${PART_ROLES[i]}</span></div>`;
  const pick = () => {
    if (!showroom) return;
    const next = showroom.pinned === i ? -1 : i;
    if (next >= 0 && !viewer.exploded) setExploded(true);
    showroom.focusHotspot(next);
    $$('#parts li').forEach((x, k) => x.classList.toggle('pinned', k === next));
  };
  li.addEventListener('click', pick);
  li.addEventListener('keydown', (e) => e.key === 'Enter' && pick());
  partsList.appendChild(li);
});

// Étude du matériel : liste des composants + fiche
let currentKit = 'esp32';
const kit = $('#kit');
const kitIndex = {};
KIT.forEach((grp) => {
  const g = document.createElement('div');
  g.className = 'kit-group';
  g.innerHTML = `<p class="kit-title">${grp.group}</p>`;
  const row = document.createElement('div');
  row.className = 'kit-row';
  grp.items.forEach((it) => {
    kitIndex[it.key] = { ...it, group: grp.group };
    const b = document.createElement('button');
    b.className = 'kit-item';
    b.dataset.key = it.key;
    b.textContent = it.name;
    b.addEventListener('click', () => selectKit(it.key));
    row.appendChild(b);
  });
  g.appendChild(row);
  kit.appendChild(g);
});
function selectKit(key) {
  currentKit = key;
  const it = kitIndex[key];
  $$('.kit-item', kit).forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key ? 'true' : 'false'));
  const card = $('#part-card');
  card.classList.remove('swap');
  void card.offsetWidth;
  card.classList.add('swap');
  $('#pc-group').textContent = it.group;
  $('#pc-name').textContent = it.name;
  $('#pc-role').textContent = it.role;
  $('#pc-why').innerHTML = (it.why || []).map((w) => `<li>${w}</li>`).join('');
  $('#pc-why').hidden = !it.why;
  $('#pc-vs').hidden = !it.vs;
  if (it.vs) $('#pc-vs').innerHTML = `<svg><use href="#i-check"/></svg>Choisi à la place : <b>${it.vs}</b>`;
  if (showroom && slides[index]?.dataset.shot === 'component') showroom.showComponent(key);
}
selectKit(currentKit);

// Schéma de câblage : zoom au clic, déplacement à la souris
const zoomer = $('#zoomer');
const zimg = zoomer.querySelector('img');
let zoomed = false;
let pan = { x: 50, y: 50 };
function setZoom(on, ev) {
  zoomed = on;
  zoomer.classList.toggle('zoomed', on);
  $('#zoom-hint').textContent = on ? 'Déplacez la souris · cliquez pour revenir' : 'Cliquez pour zoomer';
  if (on && ev) panTo(ev);
  if (!on) zimg.style.transformOrigin = '50% 50%';
}
function panTo(ev) {
  const r = zoomer.getBoundingClientRect();
  pan.x = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
  pan.y = Math.max(0, Math.min(100, ((ev.clientY - r.top) / r.height) * 100));
  zimg.style.transformOrigin = `${pan.x}% ${pan.y}%`;
}
zoomer.addEventListener('click', (e) => setZoom(!zoomed, e));
zoomer.addEventListener('pointermove', (e) => zoomed && panTo(e));
zoomer.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (setZoom(!zoomed), e.preventDefault()));

// Tableau des broches + filtre par module
const tbody = $('#pin-table tbody');
PINS.forEach(([mod, rows]) => {
  rows.forEach(([pin, gpio, warn], k) => {
    const tr = document.createElement('tr');
    tr.dataset.mod = mod;
    if (k === 0) tr.classList.add('first');
    tr.innerHTML = `<th scope="row">${k === 0 ? mod : ''}</th><td>${pin}</td><td${warn ? ' class="warn" title="GPIO18 utilisé deux fois"' : ''}>${gpio}${warn ? ' <svg><use href="#i-warn"/></svg>' : ''}</td>`;
    tbody.appendChild(tr);
  });
});
const pf = $('#pin-filter');
['Tous', ...PINS.map((p) => p[0])].forEach((m, i) => {
  const b = document.createElement('button');
  b.textContent = m.replace(' (module LM393)', '');
  b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  b.addEventListener('click', () => {
    $$('button', pf).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $$('tr', tbody).forEach((tr) => (tr.hidden = i !== 0 && tr.dataset.mod !== m));
  });
  pf.appendChild(b);
});

// Extrait de programmation : coloration syntaxique légère + copie
const SRC = $('#sensia-code').textContent;
function highlight(code) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const KW = /\b(const|int|long|float|bool|void|if|return|true|false|HIGH|LOW|OUTPUT|INPUT|INPUT_PULLUP|SERIAL_8N1)\b/g;
  return code.split('\n').map((line) => {
    let comment = '';
    const ci = line.indexOf('//');
    if (ci >= 0) {
      comment = `<span class="c">${esc(line.slice(ci))}</span>`;
      line = line.slice(0, ci);
    }
    let h = esc(line)
      .replace(/(#include)(\s*)(&lt;.*?&gt;)/, '<span class="k">$1</span>$2<span class="s">$3</span>')
      .replace(KW, '<span class="k">$1</span>')
      .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="n">$1</span>')
      .replace(/\b([a-zA-Z_]\w*)(?=\()/g, '<span class="f">$1</span>');
    return `<span class="ln">${h}${comment}</span>`;
  }).join('');
}
$('#code-view').innerHTML = highlight(SRC);
$('#copy-code').addEventListener('click', async () => {
  const lab = $('#copy-code span');
  try {
    await navigator.clipboard.writeText(SRC);
    lab.textContent = 'Copié';
  } catch (e) {
    const range = document.createRange();
    range.selectNodeContents($('#code-view'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    lab.textContent = 'Sélectionné : Ctrl+C';
  }
  setTimeout(() => (lab.textContent = 'Copier'), 2200);
});

// ─────────────────────────── Boucle d'animation ───────────────────────────
let last = performance.now() / 1000;
let clock = 0;
function frame(nowMs) {
  const now = nowMs / 1000;
  const raw = Math.max(0, now - last);
  const real = Math.min(0.05, raw);
  last = now;
  clock += real;
  // fondu du calque 3D (opacité selon la diapositive), sur le temps réel non plafonné
  layerOpacity += (layerTarget - layerOpacity) * (1 - Math.exp(-Math.min(raw, 0.5) * 5));
  if (Math.abs(layerOpacity - layerTarget) < 0.002) layerOpacity = layerTarget;
  layer.style.opacity = layerOpacity.toFixed(3);
  if (engine && layerOpacity > 0.004) {
    // transitions sur le temps réel (borné) : fluides même si la machine est lente
    showroom.update(clock, real, clock, Math.min(raw, 0.25));
    engine.adapt(real);
    engine.render(clock);
  }
  requestAnimationFrame(frame);
}

// Accès de débogage (console) : __deck.go(n)
window.__deck = { go: (n) => go(n - 1), engine, showroom, selectKit };

fit();
const start = parseInt((location.hash || '').slice(1), 10);
go(Number.isFinite(start) ? start - 1 : 0, { instant: true });
requestAnimationFrame(frame);
