import { LABELS } from '../content/labels';
import type { World } from '../world/world';

const ICON: Record<string, string> = {
  warn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6v3.6M8 11.4v.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  fault: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

/** Étiquettes HTML ancrées sur des points 3D (texte net, lisible par les lecteurs d'écran). */
export class LabelLayer {
  private readonly els = new Map<string, HTMLElement>();
  private active = new Set<string>();

  constructor(private readonly root: HTMLElement, private readonly world: World) {
    for (const [id, def] of Object.entries(LABELS)) {
      const el = document.createElement('div');
      el.className = `tag tag--${def.dir} tag--${def.kind ?? 'part'}`;
      el.dataset.id = id;
      const icon = def.kind && ICON[def.kind] ? `<span class="tag__icon">${ICON[def.kind]}</span>` : '';
      el.innerHTML = `<span class="tag__dot"></span><span class="tag__line"></span><span class="tag__text">${icon}${def.text}</span>`;
      el.setAttribute('aria-hidden', 'true');
      root.appendChild(el);
      this.els.set(id, el);
    }
  }

  setActive(ids: readonly string[]): void {
    const next = new Set(ids.filter((id) => this.els.has(id)));
    for (const id of this.active) if (!next.has(id)) this.els.get(id)!.classList.remove('is-on');
    for (const id of next) this.els.get(id)!.classList.add('is-on');
    this.active = next;
    // texte lisible par les technologies d'assistance : liste des éléments repérés
    this.root.setAttribute('aria-label', [...next].map((id) => LABELS[id].text).join(', '));
  }

  update(): void {
    for (const id of this.active) {
      const el = this.els.get(id)!;
      const p = this.world.project(id);
      if (!p || !p.visible) {
        el.style.visibility = 'hidden';
        continue;
      }
      el.style.visibility = 'visible';
      el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    }
  }
}
