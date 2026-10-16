#!/usr/bin/env node
/** Vérifie le fichier unique ouvert directement (file://), sans serveur. */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';

const file = fileURLToPath(new URL('../../dist-single/MOTRIX-presentation.html', import.meta.url));
const shot = process.argv[2];
const browser = await chromium.launch({
  channel: process.env.MOTRIX_E2E_CHANNEL || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
const requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('request', (r) => !r.url().startsWith('file:') && !r.url().startsWith('data:') && !r.url().startsWith('blob:') && requests.push(r.url()));
await page.goto(`${pathToFileURL(file).href}?test&pr=0.5`);
await page.waitForFunction(() => !!window.__motrix, null, { timeout: 60000 });
const frames = (n) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
await frames(3);
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
const pos = await page.evaluate(() => window.__motrix.position());
const fonts = await page.evaluate(() => document.fonts.check('600 64px "Barlow Condensed"'));
const logo = await page.evaluate(() => document.querySelector('.plate__logo')?.getAttribute('src')?.slice(0, 22));
await page.evaluate(() => window.__motrix.goto(0, 0));
await frames(2);
await new Promise((r) => setTimeout(r, 1200));
if (shot) await page.screenshot({ path: shot, timeout: 120000 });
console.log(JSON.stringify({ position: pos, fonts, logo, errors, externalRequests: requests }));
await browser.close();
process.exit(errors.length || requests.length || pos.scene < 2 || !fonts ? 1 : 0);
