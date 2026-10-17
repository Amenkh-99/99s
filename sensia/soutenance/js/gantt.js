// Planificateur : diagramme de Gantt (prévu / réel) dessiné en SVG.
// Données reprises du planificateur du projet (périodes 1 à 11).
// « Prévu » : barre violette hachurée (texture = codage secondaire, pas la
// couleur seule) ; « Réel » : barre sarcelle pleine. Palette validée
// (séparation daltonisme, contraste) sur la surface sombre #0b1730.

export const TASKS = [
  { name: 'Choix du mini projet et préparation du cahier des charges', plan: [1, 2], real: [1, 2], pct: 100 },
  { name: 'Validation du cahier des charges et étude bibliographique', plan: [2, 1], real: [2, 2], pct: 100 },
  { name: 'Étude théorique et proposition des solutions possibles', plan: [3, 4], real: [3, 3], pct: 100 },
  { name: 'Choix de la solution et réalisation', plan: [5, 6], real: null, pct: null },
  { name: 'Rédaction du rapport', plan: [3, 8], real: null, pct: null },
  { name: 'Soutenance', plan: [10, 2], real: null, pct: null },
];
const PERIODS = 11;
const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

/**
 * Construit le Gantt dans `host` (élément HTML).
 * Retourne { play() } : relance l'animation d'apparition des barres.
 */
/** Découpe un libellé en lignes d'au plus `max` caractères. */
function wrap(text, max) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    if ((line + ' ' + w).trim().length > max && line) {
      out.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out;
}

export function buildGantt(host, tooltip) {
  // Tableau (colonnes de gauche) + chronologie (droite) dans un seul SVG,
  // pour que les lignes restent parfaitement alignées à toutes les tailles.
  const W = 1500, rowH = 64, top = 58, left = 790, right = 8;
  const H = top + TASKS.length * rowH + 8;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gantt-svg', role: 'img', 'aria-label': 'Diagramme de Gantt du projet' }, host);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 7, height: 7, class: 'g-plan-bg' }, pat);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 7, class: 'g-plan-hatch' }, pat);

  const x0 = left, x1 = W - right;
  const col = (x1 - x0) / PERIODS;
  const X = (p) => x0 + (p - 1) * col;

  // en-têtes du tableau
  const COLS = [
    { x: 0, label: ['Activité'], anchor: 'start' },
    { x: 436, label: ['Début', 'prévu'] },
    { x: 512, label: ['Durée', 'prévue'] },
    { x: 588, label: ['Début', 'réel'] },
    { x: 664, label: ['Durée', 'réelle'] },
    { x: left - 12, label: ['%', 'accompli'], anchor: 'end' },
  ];
  for (const c of COLS) {
    const tx = el('text', { x: c.x, y: top - 34, class: 'g-head', 'text-anchor': c.anchor || 'middle' }, svg);
    c.label.forEach((l, k) => {
      const ts = el('tspan', { x: c.x, dy: k ? 17 : (c.label.length === 1 ? 17 : 0) }, tx);
      ts.textContent = l;
    });
  }
  const ph = el('text', { x: x0 + (x1 - x0) / 2, y: top - 40, class: 'g-head', 'text-anchor': 'middle' }, svg);
  ph.textContent = 'Périodes';

  // grille et en-têtes de périodes
  for (let p = 1; p <= PERIODS; p++) {
    if (p % 2) el('rect', { x: X(p), y: top - 6, width: col, height: H - top - 2, class: 'g-band' }, svg);
    const tx = el('text', { x: X(p) + col / 2, y: top - 16, class: 'g-period' }, svg);
    tx.textContent = p;
  }
  el('line', { x1: x0, y1: top - 6, x2: x1, y2: top - 6, class: 'g-axis' }, svg);

  const bars = [];
  TASKS.forEach((task, i) => {
    const y = top + i * rowH;
    el('line', { x1: 0, y1: y + rowH - 4, x2: x1, y2: y + rowH - 4, class: 'g-row' }, svg);
    // colonne « Activité » (sur deux lignes) puis valeurs du tableau
    const name = el('text', { x: 0, y: y + 22, class: 'g-task' }, svg);
    wrap(task.name, 40).forEach((line, k) => {
      const ts = el('tspan', { x: 0, dy: k ? 20 : 0 }, name);
      ts.textContent = line;
    });
    const vals = [task.plan[0], task.plan[1], task.real ? task.real[0] : '—', task.real ? task.real[1] : '—'];
    vals.forEach((v, k) => {
      const tx = el('text', { x: COLS[k + 1].x, y: y + 32, class: 'g-num' }, svg);
      tx.textContent = v;
    });
    if (task.pct != null) {
      const pc = el('text', { x: left - 12, y: y + 32, class: 'g-pct', 'text-anchor': 'end' }, svg);
      pc.textContent = task.pct + ' %';
    }
    const [ps, pd] = task.plan;
    // barre prévue (hachurée), arrondie de 4 px
    const plan = el('rect', { x: X(ps) + 2, y: y + 6, width: pd * col - 4, height: 20, rx: 4, class: 'g-plan' }, svg);
    bars.push({ elt: plan, w: pd * col - 4, delay: i * 0.08 });
    hover(plan, task, 'plan');
    if (task.real) {
      const [rs, rd] = task.real;
      const real = el('rect', { x: X(rs) + 2, y: y + 30, width: rd * col - 4, height: 20, rx: 4, class: 'g-real' }, svg);
      bars.push({ elt: real, w: rd * col - 4, delay: 0.25 + i * 0.08 });
      hover(real, task, 'real');
      // étiquette directe sur la dernière barre réalisée seulement (sélective)
      if (i === 2) {
        const lab = el('text', { x: X(rs) + rd * col + 8, y: y + 45, class: 'g-direct' }, svg);
        lab.textContent = 'réalisé';
      }
    } else {
      const lab = el('text', { x: X(ps) + 8, y: y + 45, class: 'g-todo' }, svg);
      lab.textContent = 'à venir';
    }
  });

  function hover(rect, task, kind) {
    const show = (ev) => {
      const [s, d] = kind === 'plan' ? task.plan : task.real;
      tooltip.innerHTML = `<b>${task.name}</b><span>${kind === 'plan' ? 'Prévu' : 'Réel'} : période ${s} → ${s + d - 1} (${d} période${d > 1 ? 's' : ''})</span>${task.pct != null ? `<span>Accompli : ${task.pct} %</span>` : '<span>Réalisation à venir</span>'}`;
      tooltip.hidden = false;
      const r = host.getBoundingClientRect();
      const sc = host.offsetWidth / r.width; // échelle CSS de la scène
      tooltip.style.left = (ev.clientX - r.left) * sc + 14 + 'px';
      tooltip.style.top = (ev.clientY - r.top) * sc + 14 + 'px';
      rect.classList.add('hot');
    };
    rect.addEventListener('pointermove', show);
    rect.addEventListener('pointerenter', show);
    rect.addEventListener('pointerleave', () => {
      tooltip.hidden = true;
      rect.classList.remove('hot');
    });
  }

  return {
    /** Animation d'apparition : les barres s'étirent depuis leur début. */
    play() {
      const t0 = performance.now();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const tick = (now) => {
        let running = false;
        for (const b of bars) {
          const u = reduce ? 1 : Math.min(1, Math.max(0, ((now - t0) / 1000 - b.delay) / 0.8));
          const e = 1 - Math.pow(1 - u, 3);
          b.elt.setAttribute('width', Math.max(0.01, b.w * e));
          if (u < 1) running = true;
        }
        if (running) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
  };
}
