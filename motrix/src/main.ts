import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/400-italic.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/overlays.css';

import gsap from 'gsap';
import { SCENES } from './content/scenes';
import { Director, type TransitionMode } from './core/director';
import { DEFAULT_STATE, Navigator, isForwardStep, type NavPosition } from './core/state';
import { openChannel, prefs, type ChannelMessage } from './core/channel';
import { World, type Quality } from './world/world';
import { LabelLayer } from './ui/labels';
import { buildShell, type Shell } from './ui/shell';

declare global {
  interface Window {
    __motrix?: {
      goto: (scene: number, step?: number) => void;
      next: () => void;
      prev: () => void;
      settle: () => void;
      busy: () => boolean;
      timelineTime: () => number;
      flows: () => { upstream: number[]; downstream: number[] };
      tickerTime: () => number;
      position: () => NavPosition;
      stats: () => ReturnType<World['stats']> & { fps: number; quality: Quality; reducedMotion: boolean; speed: number };
      live: () => unknown;
    };
  }
}

async function boot(): Promise<void> {
  const app = document.getElementById('app')!;
  try {
    await Promise.race([
      Promise.all([document.fonts.load('600 64px "Barlow Condensed"'), document.fonts.load('400 24px "Barlow"')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* polices de secours */
  }

  const shell: Shell = buildShell(app, SCENES);
  let world: World;
  try {
    world = new World(shell.canvas);
  } catch (err) {
    shell.fatal(
      "WebGL n'est pas disponible. Dans Chrome, activez « Utiliser l'accélération graphique » (Paramètres → Système), puis rechargez la page.",
    );
    console.error(err);
    return;
  }

  const labels = new LabelLayer(shell.labels, world);
  const director = new Director(world, SCENES, shell.overlays, labels);
  const nav = new Navigator(SCENES.map((s) => s.steps.length));

  // ── préférences (?test : mode de test automatisé, sans dégradation automatique ni intro)
  const params = new URLSearchParams(location.search);
  const testMode = params.has('test');
  if (testMode && params.has('pr')) world.pixelRatioOverride = Number(params.get('pr'));
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = prefs.get<boolean>('reducedMotion', mq.matches);
  let quality: Quality = prefs.get<Quality>('quality', 'high');
  nav.skipped = new Set(prefs.get<number[]>('skipped', []));

  const applyReduced = () => {
    world.reducedMotion = reducedMotion;
    director.reducedMotion = reducedMotion;
    gsap.globalTimeline.timeScale(1);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    shell.setToggle('reduced', reducedMotion);
  };
  const applyQuality = () => {
    world.setQuality(quality);
    shell.setToggle('quality', quality === 'low');
  };
  applyReduced();
  applyQuality();

  // ── mise à l'échelle de la scène 1920 × 1080
  const fit = () => {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    shell.stage.style.transform = `translate(${(window.innerWidth - 1920 * s) / 2}px, ${(window.innerHeight - 1080 * s) / 2}px) scale(${s})`;
    world.resize(s);
  };
  window.addEventListener('resize', fit);
  fit();

  // ── vue présentateur
  const channel = openChannel((m: ChannelMessage) => {
    if (m.type === 'hello') broadcast();
    if (m.type !== 'cmd') return;
    switch (m.action) {
      case 'next':
        return next();
      case 'prev':
        return prev();
      case 'nextScene':
        return go(nav.nextSceneStart(), 'snap');
      case 'prevScene':
        return go(nav.prevSceneStart(), 'snap');
      case 'first':
        return go(nav.first(), 'snap');
      case 'last':
        return go(nav.last(), 'snap');
      case 'goto':
        return go(nav.goto(m.scene, m.step ?? 0), 'snap');
      case 'toggleSkip':
        return toggleSkip(m.scene);
    }
  });
  const broadcast = () => {
    const p = nav.pos;
    channel.post({ type: 'state', scene: p.scene, step: p.step, skipped: [...nav.skipped] });
  };

  // ── navigation
  function go(to: NavPosition | null, mode: TransitionMode): void {
    if (!to) return;
    director.go(to, mode);
    shell.update(to, SCENES, nav);
    history.replaceState(null, '', `#/${to.scene + 1}/${to.step + 1}`);
    broadcast();
  }
  function next(): void {
    const from = { ...nav.pos };
    const to = nav.next();
    if (to) go(to, isForwardStep(from, to, nav) ? 'animate' : 'snap');
  }
  function prev(): void {
    go(nav.prev(), 'snap');
  }
  function toggleSkip(scene: number): void {
    if (nav.skipped.has(scene)) nav.skipped.delete(scene);
    else nav.skipped.add(scene);
    prefs.set('skipped', [...nav.skipped]);
    shell.update(nav.pos, SCENES, nav);
    broadcast();
  }
  director.onCut = () => shell.cut();

  shell.on({
    next,
    prev,
    goto: (s) => go(nav.goto(s, 0), 'snap'),
    toggleSkip,
    fullscreen: () => toggleFullscreen(),
    reduced: () => {
      reducedMotion = !reducedMotion;
      prefs.set('reducedMotion', reducedMotion);
      applyReduced();
      shell.toast(reducedMotion ? 'Mouvement réduit activé' : 'Mouvement réduit désactivé');
    },
    quality: () => {
      quality = quality === 'high' ? 'low' : 'high';
      prefs.set('quality', quality);
      applyQuality();
      shell.toast(quality === 'low' ? 'Qualité réduite : rendu allégé' : 'Qualité standard');
    },
    presenter: () => window.open('./presenter.html', 'motrix-presenter', 'width=1100,height=760'),
  });

  function toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => shell.toast('Plein écran refusé par le navigateur'));
  }

  // ── clavier (compatible télécommandes de présentation : PgUp / PgDn)
  let digits = '';
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (shell.dialogOpen()) {
      if (e.key === 'Escape') shell.closeDialogs();
      return;
    }
    const k = e.key;
    // Espace / Entrée sur un bouton ayant le focus clavier : comportement natif
    if ((k === ' ' || k === 'Enter') && (e.target as HTMLElement).closest('button, input, a')) return;
    let handled = true;
    if (k === 'ArrowRight' || k === ' ' || k === 'PageDown' || k === 'Enter') {
      if (k === 'Enter' && digits) {
        go(nav.goto(Number(digits) - 1, 0), 'snap');
        digits = '';
      } else next();
    } else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') prev();
    else if (k === 'ArrowDown') go(nav.nextSceneStart(), 'snap');
    else if (k === 'ArrowUp') go(nav.prevSceneStart(), 'snap');
    else if (k === 'Home') go(nav.first(), 'snap');
    else if (k === 'End') go(nav.last(), 'snap');
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'g' || k === 'G') shell.openDialog('menu');
    else if (k === 'h' || k === 'H' || k === '?') shell.openDialog('help');
    else if (k === 'n' || k === 'N') shell.toggleNotes();
    else if (k === 'v' || k === 'V') window.open('./presenter.html', 'motrix-presenter', 'width=1100,height=760');
    else if (k === 'r' || k === 'R') shell.trigger('reduced');
    else if (k === 'q' || k === 'Q') shell.trigger('quality');
    else if (k === 'p' || k === 'P') shell.togglePerf();
    else if (k === 'b' || k === 'B' || k === '.') shell.toggleBlack();
    else if (/^[0-9]$/.test(k)) {
      digits = (digits + k).slice(-2);
      shell.toast(`Aller à la scène ${digits} : Entrée`);
    } else handled = false;
    if (handled) e.preventDefault();
  });

  // ── démarrage : position depuis l'URL (#/scène/étape) ou début
  const m = /^#\/(\d+)(?:\/(\d+))?/.exec(location.hash);
  const start = m ? nav.goto(Number(m[1]) - 1, Number(m[2] ?? 1) - 1) : nav.first();
  director.go(start, 'instant');
  shell.update(start, SCENES, nav);
  world.warmup();
  const intro = { p: reducedMotion || testMode || start.scene !== 0 ? 1 : 0 };
  world.lightIntro(intro.p);
  if (intro.p < 1) gsap.to(intro, { p: 1, duration: 3.2, ease: 'power2.inOut', onUpdate: () => world.lightIntro(intro.p) });
  shell.ready();
  broadcast();

  // ── boucle de rendu
  const frameTimes: number[] = [];
  let last = performance.now();
  let fpsAvg = 60;
  let frame = 0;
  let slowChecks = 0;
  let lastCheck = performance.now();
  const startTime = performance.now();
  const loop = (now: number) => {
    const raw = (now - last) / 1000;
    last = now;
    const dt = Math.min(raw, 0.05);
    frameTimes.push(raw * 1000);
    if (frameTimes.length > 120) frameTimes.shift();
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(raw, 1e-3)) * 0.05;

    world.update(dt);
    labels.update();
    shell.live(world.speed, world.live.dim);
    // derrière un panneau quasi opaque, une image sur deux suffit
    frame++;
    if (world.live.dim < 0.85 || frame % 2 === 0) world.render();

    // dégradation automatique si l'ordinateur peine (une seule fois)
    if (now - lastCheck > 2000) {
      lastCheck = now;
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? 16;
      if (!testMode && quality === 'high' && now - startTime > 6000 && !document.hidden && p90 > 26) slowChecks++;
      else slowChecks = 0;
      if (slowChecks >= 3) {
        quality = 'low';
        applyQuality();
        shell.toast('Rendu allégé automatiquement pour préserver la fluidité (touche Q pour revenir)');
        slowChecks = 0;
      }
      shell.perf({ fps: fpsAvg, p90, ...world.stats(), quality });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  window.__motrix = {
    goto: (s, k = 0) => go(nav.goto(s, k), 'instant'),
    next,
    prev,
    settle: () => director.settle(),
    busy: () => director.busy,
    timelineTime: () => director.timelineTime,
    flows: () => world.flowLevels(),
    tickerTime: () => gsap.ticker.time,
    position: () => ({ ...nav.pos }),
    stats: () => ({ ...world.stats(), fps: fpsAvg, quality, reducedMotion, speed: world.speed }),
    live: () => Object.fromEntries(Object.keys(DEFAULT_STATE).map((k) => [k, world.live[k as keyof typeof DEFAULT_STATE]])),
  };
}

void boot();
