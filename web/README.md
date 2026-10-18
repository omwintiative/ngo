# OMWI website (Astro)

The new OMWI website, built from the Figma file "OMWI Website Redesign".
It is a static Astro site. Donations, blog posts and contributor records come
from the existing Express API in `../server`, which stays where it is.

The old site (the `.html` files in the repo root) keeps running until launch.

## What you need

- Node.js 22.22.0 or newer, on an even-numbered line (22, 24...). Check with `node -v`.
  (Astro 7.4.0, the version used here, requires Node 22.22.0 or newer.)

## Run it on your computer

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:4321.

Other commands:

| Command | What it does |
| --- | --- |
| `npm run build` | Builds the site into `web/dist/` |
| `npm run preview` | Serves the built site so you can check it before deploying |

## How the site talks to the API

All API calls go to `/api/...` on the same site (see `src/lib/api.ts`).

- **On Vercel:** `web/vercel.json` forwards `/api/*` and `/uploads/*` to the API on Render,
  the same way the old site does.
- **On your computer (`npm run dev`):** `astro.config.mjs` forwards them to your local API
  at `http://localhost:5000` (run it from `../server`). To use a different API, set
  `API_PROXY_TARGET` first. If you point it at the live API, anything you do in the admin
  changes real data.

## Folder guide

```
web/
├── astro.config.mjs      Astro settings and the local /api forwarding
├── vercel.json           /api and /uploads forwarding on Vercel
├── public/               Files served as-is (favicon, robots.txt) — added later
└── src/
    ├── styles/
    │   ├── tokens.css      Design tokens copied from the Figma variables. The only place for raw values.
    │   ├── typography.css  One class per Figma text style (.t-display, .t-h1 ... .t-stat)
    │   └── global.css      Base styles shared by every page
    ├── layouts/
    │   └── BaseLayout.astro   Page shell: head, SEO tags, skip link, <main>
    ├── lib/
    │   └── api.ts        One helper for every API call
    └── pages/            One file per page. index.astro is a temporary setup check.
```

## Rules for this codebase

- Use the semantic variables in `tokens.css` (`--bg-*`, `--text-*`, `--border-*`, `--space-*`,
  `--radius-*`). Do not paste hex values into pages.
- `tokens.css` mirrors the Figma variables (collections Primitives, Semantic, Spacing & Radius,
  Breakpoint, Icon tone). If a value changes in Figma, change it here too, with the same name
  (`plum/500` → `--plum-500`, `bg/page` → `--bg-page`).
- Responsive values: Figma's Mobile (390), Tablet (768) and Desktop (1440) modes. The code
  switches at 768px and 1200px.
- Text: use the classes in `typography.css`, which match the Figma text styles.
- Every page uses `BaseLayout` and passes a real `title` and `description`.
- Text contrast: under 19px needs at least 4.5:1, 19px and above at least 3:1.
  White text on the brand green (#408C4C) is 4.14:1, so use it only at 19px and above.
- Respect reduced motion (handled globally in `global.css`).

## Deploying (not set up yet)

Plan: a Vercel project that imports this repo with **Root Directory = `web`**.
Vercel detects Astro, and a static Astro site needs no adapter.
Who owns that Vercel project, and on which plan, is still to be agreed with OMWI.
