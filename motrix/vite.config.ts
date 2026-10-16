/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// Build relatif ('./') : le dossier dist/ peut être servi depuis n'importe quel
// chemin local par scripts/serve.mjs. Aucune ressource réseau externe.
// Mode « single » : un seul paquet JS, polices et images en data URI, assemblé
// ensuite en un fichier HTML unique par scripts/single-file.mjs.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2022',
    outDir: single ? 'dist-single' : 'dist',
    assetsInlineLimit: single ? 100_000_000 : 0,
    cssCodeSplit: !single,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: single
        ? { main: root('./index.html') }
        : {
            main: root('./index.html'),
            presenter: root('./presenter.html'),
          },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
  };
});
