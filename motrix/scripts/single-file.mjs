#!/usr/bin/env node
/**
 * Assemble la présentation en UN SEUL fichier HTML (aucun serveur, aucune
 * connexion) : CSS et JavaScript du build « single » sont insérés dans la page.
 * Usage : npm run build:single  →  dist-single/MOTRIX-presentation.html
 */
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../dist-single/', import.meta.url));
let html = await readFile(join(dir, 'index.html'), 'utf8');

// feuilles de style
for (const m of [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)]) {
  const css = await readFile(join(dir, m[1]), 'utf8');
  html = html.replace(m[0], () => `<style>\n${css}\n</style>`);
}
// script principal (un seul paquet en mode « single »)
const scripts = [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)];
if (scripts.length !== 1) throw new Error(`1 script attendu, ${scripts.length} trouvé(s)`);
html = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, '');
const js = (await readFile(join(dir, scripts[0][1]), 'utf8')).replace(/<\/script/gi, '<\\/script');
html = html.replace(scripts[0][0], '');
// le module s'exécute après l'analyse du document : on le place en fin de page
html = html.replace('</body>', () => `<script type="module">\n${js}\n</script>\n</body>`);

if (/(?:src|href)="\.\/assets\//.test(html)) throw new Error('Une ressource externe subsiste dans la page.');
const out = join(dir, 'MOTRIX-presentation.html');
await writeFile(out, html);
// nettoyage : seul le fichier unique est conservé
for (const f of await readdir(dir)) if (f !== 'MOTRIX-presentation.html') await rm(join(dir, f), { recursive: true });
console.log(`Fichier unique : ${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} Mo)`);
