#!/usr/bin/env node
/**
 * Enregistre la présentation en vidéo MP4, image par image, avec une horloge
 * virtuelle : chaque image correspond exactement à 1/fps seconde de
 * présentation, quelle que soit la vitesse de l'ordinateur.
 *
 *   npm run build:single
 *   node scripts/record-video.mjs [--fps=24] [--out=chemin.mp4]
 *
 * L'enregistrement se fait scène par scène dans dist-video/segments/ : s'il est
 * interrompu, une nouvelle exécution reprend à la première scène manquante.
 *
 * Prérequis : Playwright (Chromium) et ffmpeg avec libx264.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const FPS = Number(arg('fps', 24));
const PR = arg('pr', '0.667');
const QUALITY = arg('quality', 'high');
// 1280 × 720 (dsf 1) par défaut ; --dsf=1.5 pour du 1920 × 1080 (plus lent)
const DSF = Number(arg('dsf', 1));
const OUT = arg('out', fileURLToPath(new URL('../dist-video/MOTRIX-presentation.mp4', import.meta.url)));
const FILE = fileURLToPath(new URL('../dist-single/MOTRIX-presentation.html', import.meta.url));

/** Durée d'affichage (s) de chaque étape, scène par scène — environ 3 min 30 au total. */
const HOLDS = [
  [6, 4.5], // 1 ouverture (balayage lumineux), sommaire
  [5, 5.5], // 2 planning
  [4.5, 6, 4.5], // 3 problématique
  [4.5, 5, 7], // 4 moteur : éclaté, écorché + champ tournant
  [5.5, 5, 5.5], // 5 objectifs
  [4.5, 4.5, 5.5], // 6 comparaison
  [5.5, 4.5, 4.5], // 7 architecture (montée du banc)
  [4.5, 5, 4.5], // 8 flux de puissance
  [4, 4.5, 5], // 9 chaîne de mesure
  [3.8, 3.8, 3.8, 4, 4], // 10 séquence de protection
  [4.5, 5, 4.5, 4, 5.5, 4.5, 5.5, 6.5], // 11 scénario perte de phase
  [4.5, 5.5], // 12 matrice
  [5.5, 6.5], // 13 schéma de principe
  [5, 5], // 14 logiciels
  [6, 6], // 15 conclusion
];

const total = HOLDS.flat().reduce((a, b) => a + b, 0);
console.log(`Durée prévue : ${Math.floor(total / 60)} min ${Math.round(total % 60)} s, ${FPS} i/s`);

await stat(FILE).catch(() => {
  console.error('Fichier unique absent : lancez d’abord « npm run build:single ».');
  process.exit(1);
});
const SEG_DIR = join(dirname(OUT), 'segments');
await mkdir(SEG_DIR, { recursive: true });

const frameMs = 1000 / FPS;
const t0 = Date.now();
const segPath = (s) => join(SEG_DIR, `scene-${String(s + 1).padStart(2, '0')}.mp4`);
const exists = (p) => stat(p).then(() => true, () => false);

function encoder(file, seconds, fadeIn, fadeOut) {
  const filters = [];
  if (fadeIn) filters.push('fade=t=in:st=0:d=0.8');
  if (fadeOut) filters.push(`fade=t=out:st=${Math.max(0, seconds - 1.2).toFixed(2)}:d=1.2`);
  filters.push('format=yuv420p');
  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-vf', filters.join(','),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-g', String(FPS * 2),
      '-f', 'mp4', file,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  return {
    done: new Promise((res) => ff.on('close', res)),
    write: (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res))),
    end: () => ff.stdin.end(),
  };
}

const browser = await chromium.launch({
  channel: process.env.MOTRIX_E2E_CHANNEL || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'],
});

async function recordScene(s) {
  // nouveau contexte par scène : horloge virtuelle et état neufs
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
      // Les animations et transitions CSS suivent elles aussi l'horloge
      // virtuelle : chacune est mise en pause à sa création puis positionnée.
      for (const a of document.getAnimations()) {
        if (a.__v === undefined) {
          a.__v = t - ms;
          a.pause();
        }
        a.currentTime = t - a.__v;
      }
    };
  }, QUALITY);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // scène 1 : démarrage normal (intro lumineuse) ; sinon on part de la
  // dernière étape de la scène précédente pour enregistrer la vraie transition
  const hash = s === 0 ? '' : `#/${s}/${HOLDS[s - 1].length}`;
  await page.goto(`${pathToFileURL(FILE).href}?video&pr=${PR}${hash}`);
  await page.waitForFunction(() => !!window.__motrix && !!window.__advance, null, { timeout: 60000 });

  // préchauffage non enregistré
  for (let i = 0; i < (s === 0 ? 3 : 24); i++) await page.evaluate((ms) => window.__advance(ms), s === 0 ? 1 : frameMs);

  const seconds = HOLDS[s].reduce((a, b) => a + b, 0);
  const part = `${segPath(s)}.part`;
  const enc = encoder(part, seconds, s === 0, s === HOLDS.length - 1);
  for (let k = 0; k < HOLDS[s].length; k++) {
    if (s > 0 || k > 0) await page.evaluate(() => window.__motrix.next());
    const count = Math.round(HOLDS[s][k] * FPS);
    for (let i = 0; i < count; i++) {
      await page.evaluate((ms) => window.__advance(ms), frameMs);
      await enc.write(await page.screenshot({ type: 'jpeg', quality: 92, timeout: 120000 }));
    }
  }
  enc.end();
  const code = await enc.done;
  await ctx.close();
  if (code !== 0) throw new Error(`ffmpeg a échoué (scène ${s + 1})`);
  await rename(part, segPath(s));
  if (errors.length) console.warn(`Scène ${s + 1} : erreurs de page`, errors.slice(0, 3));
}

for (let s = 0; s < HOLDS.length; s++) {
  if (await exists(segPath(s))) {
    console.log(`Scène ${s + 1}/${HOLDS.length} déjà enregistrée`);
    continue;
  }
  const t = Date.now();
  await recordScene(s);
  console.log(`Scène ${s + 1}/${HOLDS.length} enregistrée (${HOLDS[s].reduce((a, b) => a + b, 0)} s de vidéo) en ${Math.round((Date.now() - t) / 60000)} min`);
}
await browser.close();

// assemblage sans réencodage
const list = join(SEG_DIR, 'liste.txt');
await writeFile(list, HOLDS.map((_, s) => `file '${segPath(s).replace(/'/g, "'\\''")}'`).join('\n') + '\n');
const cat = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', OUT], { stdio: 'inherit' });
const code = await new Promise((res) => cat.on('close', res));
if (code !== 0) process.exit(code ?? 1);
const size = (await stat(OUT)).size / 1024 / 1024;
console.log(`Vidéo : ${OUT} — ${total.toFixed(1)} s, ${size.toFixed(1)} Mo (session : ${Math.round((Date.now() - t0) / 60000)} min)`);
