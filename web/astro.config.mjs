// @ts-check
import { defineConfig } from 'astro/config';

// Where `/api` and `/uploads` requests go while you run `npm run dev`.
// Default: the Express API running on your own machine (../server, port 5000).
// To use another API, set API_PROXY_TARGET before `npm run dev`.
// Careful: pointing this at the live API means anything you do in the admin
// while developing changes real data.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  // TODO before launch: set `site` to the live address (needed for canonical
  // URLs and a sitemap). Confirm it in the Vercel project's Domains list.
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  },
});
