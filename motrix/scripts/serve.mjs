#!/usr/bin/env node
/**
 * Serveur HTTP local minimal pour la soutenance (aucune dépendance, hors ligne).
 * Usage : node scripts/serve.mjs [port]  — sert le dossier dist/ sur http://127.0.0.1:<port>/
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

try {
  await stat(join(root, 'index.html'));
} catch {
  console.error("Le dossier dist/ est introuvable. Lancez d'abord : npm run build");
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end('Accès refusé');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`Le port ${port} est déjà utilisé. Essayez : node scripts/serve.mjs ${port + 1}`);
  else console.error(err);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`MOTRIX : http://127.0.0.1:${port}/`);
  console.log('Laissez cette fenêtre ouverte pendant la présentation. Ctrl+C pour arrêter.');
});
