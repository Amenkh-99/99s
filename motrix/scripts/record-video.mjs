#!/usr/bin/env node
/**
 * Enregistre la présentation en vidéo MP4, image par image, avec une horloge
 * virtuelle : chaque image correspond exactement à 1/fps seconde de
 * présentation, quelle que soit la vitesse de l'ordinateur.
 *
 *   npm run build:single
 *   node scripts/record-video.mjs [--fps=24] [--limit=secondes] [--out=chemin.mp4]
 *
 * Prérequis : Playwright (Chromium) et ffmpeg avec libx264.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const FPS = Number(arg('fps', 24));
const LIMIT = Number(arg('limit', 1e9));
const PR = arg('pr', '0.667');
const QUALITY = arg('quality', 'high');
// 1280 × 720 (dsf 1) par défaut ; --dsf=1.5 pour du 1920 × 1080 (plus lent)
const DSF = Number(arg('dsf', 1));
const OUT = arg('out', fileURLToPath(new URL('../dist-video/MOTRIX-presentation.mp4', import.meta.url)));
const FILE = fileURLToPath(new URL('../dist-single/MOTRIX-presentation.html', import.meta.url));

/** Durée d'affichage (s) de chaque étape, scène par scène — environ 3 min 30 au total. */
const HOLDS = [
  [6, 4.5], // 1 ouverture (balayage lumineux), sommaire
  [4.5, 6, 4.5], // 2 problématique
  [4.5, 5, 7], // 3 moteur : éclaté, écorché + champ tournant
  [5.5, 5, 5.5], // 4 objectifs
  [5.5, 4.5, 4.5], // 5 architecture (montée du banc)
  [4.5, 5, 4.5], // 6 flux de puissance
  [4, 4.5, 5], // 7 chaîne de mesure
  [3.8, 3.8, 3.8, 4, 4], // 8 séquence de protection
  [4.5, 5, 4.5, 4, 5.5, 4.5, 5.5, 6.5], // 9 scénario perte de phase
  [4.5, 5.5], // 10 matrice
  [5.5, 6.5], // 11 schéma de principe
  [5, 5], // 12 logiciels
  [4.5, 4.5, 5.5], // 13 comparaison
  [5, 5.5], // 14 planning
  [6, 6], // 15 conclusion
];

const total = HOLDS.flat().reduce((a, b) => a + b, 0);
console.log(`Durée prévue : ${Math.floor(total / 60)} min ${Math.round(total % 60)} s, ${FPS} i/s`);

await stat(FILE).catch(() => {
  console.error('Fichier unique absent : lancez d’abord « npm run build:single ».');
  process.exit(1);
});
await mkdir(dirname(OUT), { recursive: true });

// Les images sont envoyées directement à ffmpeg (aucun fichier intermédiaire).
const plannedFrames = Math.round(Math.min(total, LIMIT) * FPS);
const dur = plannedFrames / FPS;
const ffmpeg = spawn(
  'ffmpeg',
  [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `fade=t=in:st=0:d=0.8,fade=t=out:st=${Math.max(0, dur - 1.2).toFixed(2)}:d=1.2,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high',
    '-movflags', '+faststart',
    OUT,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
const ffmpegDone = new Promise((res) => ffmpeg.on('close', res));
const write = (buf) => new Promise((res) => (ffmpeg.stdin.write(buf) ? res() : ffmpeg.stdin.once('drain', res)));

const browser = await chromium.launch({
  channel: process.env.MOTRIX_E2E_CHANNEL || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});
// fenêtre 1280 × 720 ; à ×1,5 on obtient des images 1920 × 1080
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: DSF });
await ctx.addInitScript((quality) => {
  try {
    localStorage.setItem('motrix.quality', JSON.stringify(quality));
    localStorage.setItem('motrix.reducedMotion', 'false');
  } catch {}
  // horloge virtuelle : le temps n'avance qu'avec window.__advance(ms)
  let t = 0;
  const base = Date.now();
  performance.now = () => t;
  Date.now = () => base + t;
  let queue = [];
  let id = 0;
  window.requestAnimationFrame = (cb) => {
    queue.push([++id, cb]);
    return id;
  };
  window.cancelAnimationFrame = (i) => {
    queue = queue.filter(([j]) => j !== i);
  };
  window.__advance = (ms) => {
    t += ms;
    const run = queue;
    queue = [];
    for (const [, cb] of run) cb(t);
  };
}, QUALITY);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${pathToFileURL(FILE).href}?video&pr=${PR}`);
await page.waitForFunction(() => !!window.__motrix && !!window.__advance, null, { timeout: 60000 });

// Les transitions CSS suivent le temps réel : on les ralentit pour qu'elles
// durent le même nombre d'images qu'à vitesse normale.
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');
let rate = 0.2;
await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });

const frameMs = 1000 / FPS;
let n = 0;
const t0 = Date.now();
let lastReport = t0;
let windowStart = Date.now();
let windowFrames = 0;

async function capture(seconds) {
  const count = Math.round(seconds * FPS);
  for (let i = 0; i < count && n < plannedFrames; i++) {
    await page.evaluate((ms) => window.__advance(ms), frameMs);
    await write(await page.screenshot({ type: 'jpeg', quality: 92, timeout: 120000 }));
    n++;
    windowFrames++;
    // ajuste la vitesse des animations CSS au rythme réel de capture
    if (windowFrames === 12) {
      const realPerFrame = (Date.now() - windowStart) / windowFrames;
      const next = Math.min(1, Math.max(0.02, frameMs / realPerFrame));
      if (Math.abs(next - rate) / rate > 0.15) {
        rate = next;
        await cdp.send('Animation.setPlaybackRate', { playbackRate: rate });
      }
      windowStart = Date.now();
      windowFrames = 0;
    }
    if (Date.now() - lastReport > 30000) {
      lastReport = Date.now();
      const done = n / FPS;
      const eta = ((Date.now() - t0) / n) * (plannedFrames - n);
      console.log(`${done.toFixed(1)} s enregistrées — reste ≈ ${Math.round(eta / 60000)} min`);
    }
  }
}

// quelques images de préchauffage (compilation, intro) non enregistrées
for (let i = 0; i < 3; i++) await page.evaluate((ms) => window.__advance(ms), 1);

for (let s = 0; s < HOLDS.length && n < plannedFrames; s++) {
  for (let k = 0; k < HOLDS[s].length && n < plannedFrames; k++) {
    if (s > 0 || k > 0) await page.evaluate(() => window.__motrix.next());
    await capture(HOLDS[s][k]);
  }
}
await browser.close();
if (errors.length) console.warn('Erreurs de page :', errors.slice(0, 3));

ffmpeg.stdin.end();
const code = await ffmpegDone;
if (code !== 0) process.exit(code ?? 1);
const size = (await stat(OUT)).size / 1024 / 1024;
console.log(`Vidéo : ${OUT} — ${n} images, ${(n / FPS).toFixed(1)} s, ${size.toFixed(1)} Mo, en ${Math.round((Date.now() - t0) / 60000)} min`);
