import type { Scene } from '../content/scenes';
import type { Navigator, NavPosition } from '../core/state';

const SVG = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5z M14 4v5h5 M8 13h8 M8 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  presenter: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  reduced: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 9v6M15 9v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  quality: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h3V12H4zM10.5 18h3V8h-3zM17 18h3V4h-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5v.4M12 17h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};

type Handler = 'next' | 'prev' | 'fullscreen' | 'reduced' | 'quality' | 'presenter';
export interface ShellHandlers extends Record<Handler, () => void> {
  goto: (scene: number) => void;
  toggleSkip: (scene: number) => void;
}

export interface Shell {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  overlays: HTMLElement[];
  on(h: ShellHandlers): void;
  update(pos: NavPosition, scenes: Scene[], nav: Navigator): void;
  setToggle(name: 'reduced' | 'quality', on: boolean): void;
  trigger(name: Handler): void;
  toast(msg: string): void;
  cut(): void;
  fatal(msg: string): void;
  dialogOpen(): boolean;
  closeDialogs(): void;
  openDialog(name: 'menu' | 'help'): void;
  toggleNotes(): void;
  togglePerf(): void;
  toggleBlack(): void;
  live(speed: number, dim: number): void;
  perf(s: { fps: number; p90: number; calls: number; triangles: number; pixelRatio: number; quality: string; programs: number; geometries: number }): void;
  ready(): void;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Découpe les notes en segments par étape (marqueur « [Étape suivante] »). */
export function splitNotes(notes: string): string[] {
  return notes.split('[Étape suivante]').map((s) => s.trim());
}

export function buildShell(app: HTMLElement, scenes: Scene[]): Shell {
  app.innerHTML = `
    <div class="stage" id="stage">
      <canvas class="gl" aria-hidden="true"></canvas>
      <div class="vignette" aria-hidden="true"></div>
      <div class="dim" aria-hidden="true"></div>
      <div class="labels" role="group" aria-label="Éléments repérés"></div>
      <main class="overlays" aria-live="off"></main>
      <div class="veil" aria-hidden="true"></div>
      <div class="notes" hidden><div class="notes__inner"></div></div>
      <nav class="hud" aria-label="Contrôles de la présentation">
        <div class="hud__where"><span class="hud__num"></span><span class="hud__title"></span></div>
        <ol class="progress" aria-label="Progression"></ol>
        <div class="hud__steps" aria-hidden="true"></div>
        <div class="hud__ctrl">
          <button class="btn" data-act="prev" aria-label="Étape précédente" title="Étape précédente (←)">${SVG.prev}</button>
          <button class="btn btn--primary" data-act="next" aria-label="Étape suivante" title="Étape suivante (→, Espace)">${SVG.next}</button>
          <span class="hud__sep" aria-hidden="true"></span>
          <button class="btn" data-act="menu" aria-label="Plan des scènes" title="Plan des scènes (G)">${SVG.menu}</button>
          <button class="btn" data-act="notes" aria-label="Notes du présentateur" aria-pressed="false" title="Notes (N)">${SVG.notes}</button>
          <button class="btn" data-act="presenter" aria-label="Ouvrir la vue présentateur" title="Vue présentateur (V)">${SVG.presenter}</button>
          <button class="btn" data-act="reduced" aria-label="Mouvement réduit" aria-pressed="false" title="Mouvement réduit (R)">${SVG.reduced}</button>
          <button class="btn" data-act="quality" aria-label="Qualité réduite" aria-pressed="false" title="Qualité réduite (Q)">${SVG.quality}</button>
          <button class="btn" data-act="fullscreen" aria-label="Plein écran" title="Plein écran (F)">${SVG.full}</button>
          <button class="btn" data-act="help" aria-label="Aide clavier" title="Aide (H)">${SVG.help}</button>
        </div>
      </nav>
      <div class="perf" hidden></div>
      <p class="toast" role="status" aria-live="polite"></p>
      <p class="sr-only" id="announce" aria-live="polite"></p>
      <div class="black" hidden></div>
      <dialog class="dlg" data-dlg="menu" aria-labelledby="dlg-menu-title">
        <header><h2 id="dlg-menu-title">Plan de la présentation</h2><button class="btn" data-close aria-label="Fermer">✕</button></header>
        <p class="dlg__hint">Cliquez sur une scène pour y aller. Décochez une scène pour l’ignorer pendant la soutenance (← → la sautent).</p>
        <ol class="menu"></ol>
      </dialog>
      <dialog class="dlg dlg--help" data-dlg="help" aria-labelledby="dlg-help-title">
        <header><h2 id="dlg-help-title">Commandes</h2><button class="btn" data-close aria-label="Fermer">✕</button></header>
        <dl class="keys">
          <div><dt>→ Espace Pg↓</dt><dd>Étape suivante</dd></div>
          <div><dt>← Pg↑</dt><dd>Étape précédente</dd></div>
          <div><dt>↓ ↑</dt><dd>Scène suivante / précédente</dd></div>
          <div><dt>Début Fin</dt><dd>Première / dernière scène</dd></div>
          <div><dt>1–15 puis Entrée</dt><dd>Aller à une scène</dd></div>
          <div><dt>G</dt><dd>Plan des scènes (ignorer une scène)</dd></div>
          <div><dt>N</dt><dd>Notes du présentateur</dd></div>
          <div><dt>V</dt><dd>Vue présentateur (seconde fenêtre)</dd></div>
          <div><dt>F</dt><dd>Plein écran</dd></div>
          <div><dt>R</dt><dd>Mouvement réduit</dd></div>
          <div><dt>Q</dt><dd>Qualité réduite</dd></div>
          <div><dt>B</dt><dd>Écran noir</dd></div>
          <div><dt>P</dt><dd>Indicateurs de performance</dd></div>
        </dl>
      </dialog>
    </div>`;

  const $ = <T extends Element>(sel: string) => app.querySelector<T>(sel)!;
  const stage = $<HTMLElement>('.stage');
  const overlaysRoot = $<HTMLElement>('.overlays');
  const overlays = scenes.map((s, i) => {
    const sec = document.createElement('section');
    sec.className = `ov ov--${s.id}`;
    sec.dataset.scene = String(i);
    sec.setAttribute('aria-label', `Scène ${i + 1} : ${s.title}`);
    sec.innerHTML = s.overlay;
    overlaysRoot.appendChild(sec);
    return sec;
  });

  const progress = $<HTMLOListElement>('.progress');
  scenes.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="progress__seg" data-goto="${i}" aria-label="Scène ${i + 1} : ${s.title}" title="${i + 1}. ${s.title}"><span class="progress__fill"></span></button>`;
    progress.appendChild(li);
  });
  const menu = $<HTMLOListElement>('.menu');
  scenes.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<label class="menu__skip" title="Inclure dans le parcours"><input type="checkbox" data-skip="${i}" checked><span class="sr-only">Inclure la scène ${i + 1}</span></label>
      <button class="menu__go" data-goto="${i}"><span class="menu__num">${pad(i + 1)}</span><span class="menu__title">${s.title}</span><span class="menu__chapter">${s.chapter}</span></button>`;
    menu.appendChild(li);
  });

  let handlers: ShellHandlers | null = null;
  const toastEl = $<HTMLElement>('.toast');
  let toastTimer = 0;
  const notesEl = $<HTMLElement>('.notes');
  const perfEl = $<HTMLElement>('.perf');
  const blackEl = $<HTMLElement>('.black');
  const veil = $<HTMLElement>('.veil');
  const speedEls = () => stage.querySelectorAll<HTMLElement>('[data-live="speed"]');
  let speedNodes: NodeListOf<HTMLElement> | null = null;
  let lastPos: NavPosition = { scene: 0, step: 0 };
  const dimEl = $<HTMLElement>('.dim');
  let lastDim = '';

  const dialogs = [...app.querySelectorAll<HTMLDialogElement>('dialog')];
  const renderNotes = () => {
    const s = scenes[lastPos.scene];
    const parts = splitNotes(s.notes);
    notesEl.querySelector('.notes__inner')!.innerHTML = `<h2>Scène ${lastPos.scene + 1} : ${s.title}</h2>${parts
      .map((p, i) => `<p class="${i === lastPos.step ? 'is-current' : i < lastPos.step ? 'is-past' : ''}">${p}</p>`)
      .join('')}`;
  };

  app.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    // clic souris : on rend le focus pour que Espace / Entrée restent dédiés à la navigation
    if (e.detail > 0) t.closest<HTMLElement>('button')?.blur();
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act && handlers) {
      if (act === 'menu') return shell.openDialog('menu');
      if (act === 'help') return shell.openDialog('help');
      if (act === 'notes') return shell.toggleNotes();
      (handlers[act as Handler] as () => void)();
      return;
    }
    const goto = t.closest<HTMLElement>('[data-goto]')?.dataset.goto;
    if (goto !== undefined && handlers) {
      handlers.goto(Number(goto));
      shell.closeDialogs();
      return;
    }
    if (t.closest('[data-close]')) shell.closeDialogs();
  });
  app.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.skip !== undefined && handlers) handlers.toggleSkip(Number(t.dataset.skip));
  });
  dialogs.forEach((d) => d.addEventListener('click', (e) => e.target === d && d.close()));

  const shell: Shell = {
    stage,
    canvas: $<HTMLCanvasElement>('canvas.gl'),
    labels: $<HTMLElement>('.labels'),
    overlays,
    on(h) {
      handlers = h;
    },
    update(pos, sc, nav) {
      lastPos = pos;
      const s = sc[pos.scene];
      $<HTMLElement>('.hud__num').textContent = `${pad(pos.scene + 1)} / ${sc.length}`;
      $<HTMLElement>('.hud__title').textContent = s.title;
      progress.querySelectorAll('li').forEach((li, i) => {
        li.classList.toggle('is-done', i < pos.scene);
        li.classList.toggle('is-current', i === pos.scene);
        li.classList.toggle('is-skipped', nav.skipped.has(i));
        const fill = li.querySelector<HTMLElement>('.progress__fill')!;
        fill.style.transform = `scaleX(${i < pos.scene ? 1 : i === pos.scene ? (pos.step + 1) / sc[i].steps.length : 0})`;
      });
      $<HTMLElement>('.hud__steps').innerHTML = s.steps
        .map((_, i) => `<span class="pip${i === pos.step ? ' is-current' : i < pos.step ? ' is-done' : ''}"></span>`)
        .join('');
      menu.querySelectorAll<HTMLInputElement>('input[data-skip]').forEach((cb, i) => (cb.checked = !nav.skipped.has(i)));
      menu.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-current', i === pos.scene));
      $<HTMLElement>('#announce').textContent = `Scène ${pos.scene + 1} sur ${sc.length} : ${s.title}. Étape ${pos.step + 1} sur ${s.steps.length}.`;
      if (!notesEl.hidden) renderNotes();
      speedNodes = speedEls();
    },
    setToggle(name, on) {
      const b = app.querySelector<HTMLElement>(`[data-act="${name}"]`);
      b?.setAttribute('aria-pressed', String(on));
    },
    trigger(name) {
      handlers?.[name]();
    },
    toast(msg) {
      toastEl.textContent = msg;
      toastEl.classList.add('is-on');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('is-on'), 2600);
    },
    cut() {
      veil.classList.remove('is-cut');
      void veil.offsetWidth;
      veil.classList.add('is-cut');
    },
    fatal(msg) {
      stage.insertAdjacentHTML('beforeend', `<div class="fatal" role="alert"><h1>MOTRIX</h1><p>${msg}</p></div>`);
      stage.classList.add('is-ready');
    },
    dialogOpen: () => dialogs.some((d) => d.open),
    closeDialogs() {
      dialogs.forEach((d) => d.open && d.close());
    },
    openDialog(name) {
      shell.closeDialogs();
      const d = dialogs.find((x) => x.dataset.dlg === name);
      d?.showModal();
      (d?.querySelector('.is-current .menu__go, [data-close]') as HTMLElement | null)?.focus();
    },
    toggleNotes() {
      notesEl.hidden = !notesEl.hidden;
      app.querySelector('[data-act="notes"]')?.setAttribute('aria-pressed', String(!notesEl.hidden));
      if (!notesEl.hidden) renderNotes();
    },
    togglePerf() {
      perfEl.hidden = !perfEl.hidden;
    },
    toggleBlack() {
      blackEl.hidden = !blackEl.hidden;
    },
    live(speed, dim) {
      const d = dim.toFixed(3);
      if (d !== lastDim) {
        dimEl.style.opacity = d;
        lastDim = d;
      }
      speedNodes?.forEach((n) => (n.style.transform = `scaleX(${speed.toFixed(3)})`));
    },
    perf(s) {
      if (perfEl.hidden) return;
      perfEl.innerHTML = `<b>${s.fps.toFixed(0)} images/s</b>, p90 ${s.p90.toFixed(1)} ms<br>${s.calls} appels de rendu, ${(s.triangles / 1000).toFixed(0)} k triangles<br>résolution ×${s.pixelRatio.toFixed(2)}, ${s.quality === 'high' ? 'qualité standard' : 'qualité réduite'}<br>${s.programs} shaders, ${s.geometries} géométries`;
    },
    ready() {
      stage.classList.add('is-ready');
    },
  };
  return shell;
}
