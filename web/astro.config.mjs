// @ts-check
import { defineConfig } from 'astro/config';

// Where `/api` and `/uploads` requests go while you run `npm run dev`.
// Default: the Express API running on your own machine (../server, port 5000).
// To use another API, set API_PROXY_TARGET before `npm run dev`.
// Careful: pointing this at the live API means anything you do in the admin
// while developing changes real data.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000';

// Blog posts live at /blog/<web address>, all served by /blog/post/ (the
// same rewrite as vercel.json, for `npm run dev` and `npm run preview`).
/** @type {import('vite').Connect.NextHandleFunction} */
const postRewrite = (req, _res, next) => {
  if (/^\/blog\/[a-z0-9-]+\/?(\?|$)/.test(req.url) && !/^\/blog\/post\/?(\?|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/blog\/[a-z0-9-]+\/?/, '/blog/post/');
  }
  next();
};

export default defineConfig({
  // TODO before launch: set `site` to the live address (needed for canonical
  // URLs and a sitemap). Confirm it in the Vercel project's Domains list.
  output: 'static',
  vite: {
    plugins: [
      {
        name: 'omwi-blog-post-addresses',
        configureServer(server) {
          server.middlewares.use(postRewrite);
        },
        configurePreviewServer(server) {
          server.middlewares.use(postRewrite);
        },
      },
    ],
    server: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  },
});
