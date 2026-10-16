// Interfaces HTML superposées aux scènes 3D (chaînes de traitement, jauges).
// Elles fonctionnent aussi sans WebGL (affichage de secours).

/** Chaîne "capteur → ESP32 → sortie" : allume les nœuds actifs. */
class Pipeline {
  constructor(root) {
    this.nodes = {};
    root.querySelectorAll('[data-node]').forEach((n) => (this.nodes[n.dataset.node] = n));
  }
  set(state) {
    for (const [k, el] of Object.entries(this.nodes)) el.classList.toggle('on', !!state[k]);
  }
}

export class ObstacleHud {
  constructor(slide) {
    this.pipe = new Pipeline(slide.querySelector('.pipe'));
    this.fill = slide.querySelector('[data-gauge-fill]');
    this.mark = slide.querySelector('[data-gauge-mark]');
    this.state = slide.querySelector('[data-gauge-state]');
    this.gauge = slide.querySelector('.gauge');
  }
  setThreshold(f) {
    this.mark.style.left = (f * 100).toFixed(1) + '%';
  }
  update({ dist, below, nodes }) {
    this.pipe.set(nodes);
    if (dist === null) {
      this.fill.style.width = '0%';
      this.state.textContent = 'En attente de mesure';
      this.gauge.classList.remove('alert');
      return;
    }
    this.fill.style.width = (dist * 100).toFixed(1) + '%';
    this.gauge.classList.toggle('alert', below);
    this.state.textContent = below ? 'Sous le seuil → alerte' : 'Au-dessus du seuil';
  }
}

export class DarknessHud {
  constructor(slide) {
    this.pipe = new Pipeline(slide.querySelector('.pipe'));
    this.fill = slide.querySelector('[data-gauge-fill]');
    this.mark = slide.querySelector('[data-gauge-mark]');
    this.state = slide.querySelector('[data-gauge-state]');
    this.gauge = slide.querySelector('.gauge');
    this.msg = slide.querySelector('.hud-msg');
    this.leds = slide.querySelectorAll('.led-pill');
  }
  setThreshold(f) {
    this.mark.style.left = (f * 100).toFixed(1) + '%';
  }
  update({ light, on, nodes }) {
    this.pipe.set(nodes);
    this.fill.style.width = (light * 100).toFixed(1) + '%';
    this.gauge.classList.toggle('alert', on);
    this.state.textContent = on ? 'Insuffisante → LED allumées' : 'Suffisante → LED éteintes';
    this.msg.classList.toggle('show', on);
    this.leds.forEach((l) => l.classList.toggle('on', on));
  }
}

export class ColorHud {
  constructor(slide) {
    this.pipe = new Pipeline(slide.querySelector('.pipe'));
    this.badge = slide.querySelector('.badge-press');
    this.bars = [...slide.querySelectorAll('[data-bar]')];
    this.result = slide.querySelector('[data-result]');
    this.resultBox = slide.querySelector('.result');
    this.panel = slide.querySelector('.rgb');
  }
  update({ pressed, bars, measuring, result, color, nodes }) {
    this.pipe.set(nodes);
    this.badge.classList.toggle('show', pressed);
    this.panel.classList.toggle('on', measuring);
    this.bars.forEach((b, i) => (b.style.height = (bars[i] * 100).toFixed(1) + '%'));
    this.resultBox.classList.toggle('show', !!result);
    this.result.textContent = result || '—';
    this.result.style.color = color;
  }
}
