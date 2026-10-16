// Diapositive 4 : schéma synoptique animé (SVG).
// Les flux de données (cyan) et l'alimentation (ambre, pointillés) sont distingués.
// Aucune broche GPIO, tension ou détail de câblage n'est représenté ici.

const CHAINS = [
  { id: 'A', t0: 0, t1: 5, paths: ['p-hc', 'p-esp-df', 'p-df-ear'], nodes: ['hc', 'esp', 'df', 'ear'] },
  { id: 'B', t0: 5, t1: 10.5, paths: ['p-btn', 'p-tcs', 'p-esp-df', 'p-df-ear'], nodes: ['btn', 'tcs', 'esp', 'df', 'ear'] },
  { id: 'C', t0: 10.5, t1: 15, paths: ['p-ldr', 'p-esp-led'], nodes: ['ldr', 'esp', 'led'] },
  { id: 'P', t0: 15, t1: 20, paths: ['pw1', 'pw2', 'pw3'], nodes: ['bat', 'hc', 'btn', 'tcs', 'ldr', 'esp', 'df', 'led'] },
];

export class Synoptic {
  constructor(slide) {
    this.slide = slide;
    this.svg = slide.querySelector('svg');
    this.duration = 20;
    this.loop = true;
    this.cues = [];
    this.showAll = false;
    this.paths = {};
    this.dots = {};
    const NS = 'http://www.w3.org/2000/svg';
    const layer = this.svg.querySelector('#dots');
    this.svg.querySelectorAll('path.flow').forEach((p) => {
      this.paths[p.id] = { el: p, len: p.getTotalLength(), power: p.classList.contains('power') };
      this.dots[p.id] = [0, 1, 2].map(() => {
        const c = document.createElementNS(NS, 'circle');
        c.setAttribute('r', this.paths[p.id].power ? 5 : 6);
        c.setAttribute('class', this.paths[p.id].power ? 'dot power' : 'dot');
        layer.appendChild(c);
        return c;
      });
    });
    this.nodes = {};
    this.svg.querySelectorAll('[data-n]').forEach((g) => (this.nodes[g.dataset.n] = g));
    this.items = [...slide.querySelectorAll('.chain')];
  }

  ensureBuilt() {}
  enter() {}
  exit() {}

  update(t, dt, clock) {
    const active = this.showAll ? null : CHAINS.find((c) => t >= c.t0 && t < c.t1) || CHAINS[CHAINS.length - 1];
    const onPaths = new Set(active ? active.paths : Object.keys(this.paths));
    const onNodes = new Set(active ? active.nodes : Object.keys(this.nodes));
    for (const [id, p] of Object.entries(this.paths)) {
      const on = onPaths.has(id);
      p.el.classList.toggle('on', on);
      const local = active ? Math.max(0, t - active.t0) : clock;
      this.dots[id].forEach((c, i) => {
        const f = (local * (p.power ? 0.35 : 0.5) + i / 3) % 1;
        const pt = p.el.getPointAtLength(f * p.len);
        c.setAttribute('cx', pt.x.toFixed(1));
        c.setAttribute('cy', pt.y.toFixed(1));
        c.style.opacity = on ? Math.min(1, Math.sin(f * Math.PI) * 1.6) : 0;
      });
    }
    for (const [k, g] of Object.entries(this.nodes)) g.classList.toggle('on', onNodes.has(k));
    this.items.forEach((li) => li.classList.toggle('active', !!active && li.dataset.chain === active.id));
  }
}
