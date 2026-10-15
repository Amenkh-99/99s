import '@fontsource/barlow/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/600.css';
import './styles/tokens.css';
import './styles/presenter.css';
import { SCENES } from './content/scenes';
import { openChannel, type ChannelMessage, type PresenterCommand } from './core/channel';
import { splitNotes } from './ui/shell';

/** Vue présentateur : notes, scène suivante, chronomètre. Pilote la présentation via BroadcastChannel. */
const root = document.getElementById('presenter')!;
root.innerHTML = `
  <header class="pv-head">
    <div><span class="pv-num"></span><h1 class="pv-title"></h1></div>
    <div class="pv-timer"><span class="pv-time" aria-live="off">00:00</span>
      <button class="pv-btn" data-t="toggle">Démarrer</button><button class="pv-btn" data-t="reset">Remettre à zéro</button></div>
  </header>
  <main class="pv-main">
    <section class="pv-notes" aria-label="Notes"></section>
    <aside class="pv-side">
      <p class="pv-step"></p>
      <div class="pv-nav">
        <button class="pv-btn pv-btn--big" data-c="prev">← Précédent</button>
        <button class="pv-btn pv-btn--big pv-btn--primary" data-c="next">Suivant →</button>
      </div>
      <p class="pv-next"></p>
      <h2>Parcours</h2>
      <ol class="pv-list"></ol>
      <p class="pv-status">En attente de la présentation… Ouvrez-la dans un autre onglet ou une autre fenêtre du même navigateur.</p>
    </aside>
  </main>`;

const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
let state = { scene: 0, step: 0, skipped: [] as number[] };
const channel = openChannel((m: ChannelMessage) => {
  if (m.type !== 'state') return;
  state = { scene: m.scene, step: m.step, skipped: m.skipped };
  $('.pv-status').textContent = 'Connecté à la présentation.';
  render();
});
const send = (c: PresenterCommand) => channel.post(c);

function render(): void {
  const s = SCENES[state.scene];
  $('.pv-num').textContent = `Scène ${state.scene + 1} sur ${SCENES.length}`;
  $('.pv-title').textContent = s.title;
  $('.pv-step').textContent = `Étape ${state.step + 1} sur ${s.steps.length}`;
  const parts = splitNotes(s.notes);
  $('.pv-notes').innerHTML = parts.map((p, i) => `<p class="${i === state.step ? 'is-current' : i < state.step ? 'is-past' : ''}">${p}</p>`).join('');
  $('.pv-notes .is-current')?.scrollIntoView({ block: 'nearest' });
  let n = state.scene + 1;
  while (n < SCENES.length && state.skipped.includes(n)) n++;
  $('.pv-next').textContent = state.step < s.steps.length - 1 ? 'Suite : étape suivante de cette scène' : n < SCENES.length ? `Scène suivante : ${SCENES[n].title}` : 'Dernière scène';
  $('.pv-list').innerHTML = SCENES.map(
    (sc, i) => `<li class="${i === state.scene ? 'is-current' : ''}">
      <label><input type="checkbox" data-skip="${i}" ${state.skipped.includes(i) ? '' : 'checked'}><span class="sr-only">Inclure</span></label>
      <button data-goto="${i}">${i + 1}. ${sc.title}</button></li>`,
  ).join('');
}

root.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const c = t.closest<HTMLElement>('[data-c]')?.dataset.c;
  if (c === 'next' || c === 'prev') send({ type: 'cmd', action: c });
  const g = t.closest<HTMLElement>('[data-goto]')?.dataset.goto;
  if (g !== undefined) send({ type: 'cmd', action: 'goto', scene: Number(g) });
  const tm = t.closest<HTMLElement>('[data-t]')?.dataset.t;
  if (tm === 'toggle') toggleTimer();
  if (tm === 'reset') resetTimer();
});
root.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.skip !== undefined) send({ type: 'cmd', action: 'toggleSkip', scene: Number(t.dataset.skip) });
});
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('button, input')) return;
  if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) send({ type: 'cmd', action: 'next' });
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) send({ type: 'cmd', action: 'prev' });
  else return;
  e.preventDefault();
});

// chronomètre
let elapsed = 0;
let startedAt = 0;
let running = false;
function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function toggleTimer(): void {
  if (running) elapsed += performance.now() - startedAt;
  else startedAt = performance.now();
  running = !running;
  $('[data-t="toggle"]').textContent = running ? 'Pause' : 'Reprendre';
}
function resetTimer(): void {
  elapsed = 0;
  startedAt = performance.now();
  $('.pv-time').textContent = '00:00';
}
setInterval(() => {
  const ms = elapsed + (running ? performance.now() - startedAt : 0);
  $('.pv-time').textContent = fmt(ms);
  $('.pv-time').classList.toggle('is-late', ms > 10 * 60 * 1000);
}, 250);

render();
send({ type: 'hello' });
