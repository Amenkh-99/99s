#!/usr/bin/env node
/**
 * Tests de bout en bout (Playwright) sur le build de production.
 *   node tests/e2e/run.mjs            → tous les contrôles + captures de chaque étape
 *   node tests/e2e/run.mjs --quick    → contrôles sans captures
 *   node tests/e2e/run.mjs --only=9   → captures de la scène 9 uniquement
 * Sous Windows, MOTRIX_E2E_CHANNEL=chrome utilise le Chrome installé.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = fileURLToPath(new URL('./output/', import.meta.url));
const args = new Set(process.argv.slice(2));
const only = [...args].find((a) => a.startsWith('--only='))?.slice(7).split(',').map(Number);
const quick = args.has('--quick');
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}/`;

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, [fileURLToPath(new URL('../../scripts/serve.mjs', import.meta.url)), String(PORT)], { stdio: 'pipe' });
await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes('MOTRIX') && resolve());
  server.stderr.on('data', (d) => reject(new Error(String(d))));
  setTimeout(() => reject(new Error('serveur non démarré')), 8000);
});

const browser = await chromium.launch({
  channel: process.env.MOTRIX_E2E_CHANNEL || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
// Contrôles fonctionnels : petite fenêtre et qualité réduite, car le rendu WebGL
// logiciel (SwiftShader) des machines sans GPU est très lent en 1080p.
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.setItem('motrix.quality', JSON.stringify('low')));
const page = await ctx.newPage();
const frames = (n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
});
page.on('requestfailed', (r) => errors.push(`requête échouée : ${r.url()}`));
const external = [];
page.on('request', (r) => {
  if (!r.url().startsWith(BASE) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url());
});

try {
  await page.goto(`${BASE}?test`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__motrix, null, { timeout: 30000 });
  await sleep(1500);
  check('Démarrage sans erreur', errors.length === 0, errors.join(' | '));

  const counts = await page.evaluate(() => [...document.querySelectorAll('.ov')].map((o) => Number(o.dataset.scene)));
  check('15 scènes présentes', counts.length === 15, `${counts.length}`);

  // ── navigation clavier complète (→) jusqu'à la fin, puis retour (←)
  const total = await page.evaluate(() => {
    // nombre total d'étapes
    return [...document.querySelectorAll('.progress li')].length;
  });
  let steps = 0;
  let prevKey = '';
  for (let i = 0; i < 80; i++) {
    const p = await page.evaluate(() => window.__motrix.position());
    const key = `${p.scene}/${p.step}`;
    if (key === prevKey) break;
    prevKey = key;
    await page.keyboard.press('ArrowRight');
    await sleep(60);
    steps++;
  }
  const end = await page.evaluate(() => window.__motrix.position());
  check('Navigation → jusqu’à la dernière étape', end.scene === 14 && end.step === 1, `${steps} pressions, fin ${end.scene + 1}/${end.step + 1} (scènes : ${total})`);
  for (let i = 0; i < 80; i++) await page.keyboard.press('ArrowLeft');
  const start = await page.evaluate(() => window.__motrix.position());
  check('Navigation ← jusqu’au début', start.scene === 0 && start.step === 0);

  // ── déterminisme : état après un parcours aléatoire = état après saut direct
  const seqOk = await page.evaluate(async () => {
    const m = window.__motrix;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const mismatches = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let trial = 0; trial < 12; trial++) {
      m.goto(Math.floor(rnd() * 15), 0);
      for (let i = 0; i < 6; i++) (rnd() < 0.7 ? m.next : m.prev)();
      await wait(30);
      m.settle();
      const p = m.position();
      const a = m.live();
      m.goto(p.scene, p.step);
      m.settle();
      const b = m.live();
      for (const k of Object.keys(b)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) mismatches.push(`${p.scene + 1}/${p.step + 1}:${k}=${JSON.stringify(a[k])}≠${JSON.stringify(b[k])}`);
    }
    return mismatches;
  });
  check('État déterministe quel que soit le chemin', seqOk.length === 0, seqOk.slice(0, 6).join(', '));

  // ── scénario : le contacteur s'ouvre, le flux aval s'arrête, le moteur ralentit
  await page.evaluate(() => window.__motrix.goto(8, 3));
  await frames(5);
  const before = await page.evaluate(() => window.__motrix.stats().speed);
  await page.keyboard.press('ArrowRight'); // étape 5 : ouverture du contacteur (animée)
  await page.waitForFunction(() => window.__motrix.live().contactor === 0, null, { timeout: 60000 });
  const afterOpen = await page.evaluate(() => ({ s: window.__motrix.stats().speed, live: window.__motrix.live() }));
  await frames(40);
  const later = await page.evaluate(() => window.__motrix.stats().speed);
  const flowCheck = await page.evaluate(() => window.__motrix.flows());
  check('Contacteur ouvert : flux aval arrêté, amont L1/L2 maintenu, L3 absent', flowCheck.downstream.every((f) => f < 0.05) && flowCheck.upstream[0] > 0.5 && flowCheck.upstream[1] > 0.5 && flowCheck.upstream[2] < 0.05, JSON.stringify(flowCheck));
  check(
    'Perte de phase : contacteur ouvert puis décélération réelle',
    afterOpen.live.contactor === 0 && before > 0.85 && afterOpen.s < before && later < afterOpen.s,
    `vitesse ${before.toFixed(2)} → ${afterOpen.s.toFixed(2)} → ${later.toFixed(2)}`,
  );

  // ── mouvement réduit
  await page.keyboard.press('r');
  await sleep(200);
  const rm = await page.evaluate(() => document.documentElement.classList.contains('reduced-motion'));
  await page.keyboard.press('r');
  check('Bascule mouvement réduit (R)', rm);

  // ── stabilité mémoire : deux tours complets, compteurs identiques
  const loop = async () => {
    for (let s = 0; s < 15; s++) {
      await page.evaluate((s) => window.__motrix.goto(s, 0), s);
      await frames(2);
    }
    return page.evaluate(() => window.__motrix.stats());
  };
  const a = await loop();
  const b = await loop();
  check('Ressources GPU stables sur deux tours', a.geometries === b.geometries && a.textures === b.textures && a.programs === b.programs, `géométries ${a.geometries}/${b.geometries}, textures ${a.textures}/${b.textures}, shaders ${a.programs}/${b.programs}`);

  check('Aucune ressource réseau externe', external.length === 0, external.slice(0, 3).join(', '));

  // ── captures de chaque étape, en 1920 × 1080 et qualité standard
  if (!quick) {
    await mkdir(outDir, { recursive: true });
    await page.evaluate(() => localStorage.setItem('motrix.quality', JSON.stringify('high')));
    await ctx.clearCookies();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await ctx.addInitScript(() => localStorage.setItem('motrix.quality', JSON.stringify('high')));
    // 3D rendue à mi-résolution pour des captures réalisables en rendu logiciel
    await page.goto(`${BASE}?test&pr=0.5`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__motrix, null, { timeout: 30000 });
    const stepCounts = await page.evaluate(() => [...document.querySelectorAll('.ov')].map((o) => o.querySelectorAll('[data-only],[data-step],[data-until]').length));
    void stepCounts;
    const scenes = await page.evaluate(() => [...document.querySelectorAll('.progress li')].length);
    for (let s = 0; s < scenes; s++) {
      if (only && !only.includes(s + 1)) continue;
      const n = await page.evaluate((s) => {
        window.__motrix.goto(s, 0);
        return document.querySelectorAll('.hud__steps .pip').length;
      }, s);
      for (let k = 0; k < n; k++) {
        await page.evaluate(([s, k]) => window.__motrix.goto(s, k), [s, k]);
        await frames(2);
        await sleep(900);
        await frames(1);
        const file = `${outDir}s${String(s + 1).padStart(2, '0')}-${k + 1}.png`;
        await page.screenshot({ path: file, timeout: 120000 });
      }
    }
    console.log(`Captures : ${outDir}`);
  }
  check('Aucune erreur console pendant les tests', errors.length === 0, errors.slice(0, 5).join(' | '));
} catch (err) {
  check('Exécution des tests', false, String(err));
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} contrôles réussis`);
void here;
process.exit(failed.length ? 1 : 0);
