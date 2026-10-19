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

| Part | Host | Settings |
| --- | --- | --- |
| This site (`web/`) | Vercel, a **new** project | Root Directory `web`, Node.js 22.x. Vercel detects Astro; a static site needs no adapter. Preview from the `redesign` branch. |
| API (`../server`) | Render (existing) | Root Directory `server`, Build Command `npm install`, Start Command `npm start` |
| Domain `omwinitiative.org` | GoDaddy (registrar and email) | DNS records only, see below |

Never deploy this site to `ngo-xi-dusky.vercel.app`: that project is the old live site.
Who owns the new Vercel project, and on which plan, is still to be agreed with OMWI.

### Connecting the GoDaddy domain

1. In the new Vercel project: Settings → Domains → add `omwinitiative.org`, `www.omwinitiative.org`
   and `admin.omwinitiative.org` (the admin area; a subdomain costs nothing extra).
2. Vercel then shows the exact DNS records to create. In GoDaddy (My Products → the domain → DNS),
   add those records exactly as shown (an A record for the root, a CNAME for `www`, a CNAME for
   `admin`), replacing the records that point at the old site.
3. Keep GoDaddy's nameservers, and do not touch the MX or other email records, so
   `info@omwinitiative.org` keeps working.
4. Wait until Vercel shows both domains as valid (DNS can take up to a few hours).

### Launch checklist

Before merging `redesign` into `main`:

- [x] Render: Settings shows Build Command `npm install` in `server/` (checked 19 Oct 2026).
      (`server/node_modules` is no longer in git, so Render must install the packages itself.)
- [ ] The API upgrades and the admin are built and tested (roadmap steps 5 and 7).
- [ ] `site` is set to `https://omwinitiative.org` in `astro.config.mjs`.
- [ ] Privacy Policy: every `[bracketed]` line in `src/pages/privacy-policy.astro` replaced with
      wording approved by OMWI, and its `noindex` removed.
- [ ] The new Vercel project's preview has been checked page by page.

On launch day:

- [ ] Point the GoDaddy DNS at the new Vercel project (above).
- [ ] Render environment: `CORS_ORIGIN` includes `https://omwinitiative.org` and
      `https://www.omwinitiative.org`; `PAYSTACK_CALLBACK_URL` points at the new Thank you page.
- [ ] Paystack dashboard: callback and webhook URLs updated to the new domain.
- [ ] In `server/`, once the old site no longer takes bank-transfer records, copy the old donations
      into the new list (uses the live `server/.env`; safe to run twice):
      `node scripts/import-donations.js --confirm`. Imported Paystack donors start hidden from the
      Contributors page; the admin switches on the ones who agree.
- [ ] Make a test donation, send a test contact message, and sign in to the admin.

After launch, delete the old site:

- [ ] Root `*.html`, `*.css`, `*.js`, `images/`, the root `vercel.json`, `frontend-config.js`
      and `API.txt`; rewrite the root `README.md` for the new setup.
- [ ] In `server/src/server.js`, the `SERVE_STATIC_FRONTEND` option (it serves the old root files).
- [ ] The old Vercel project (`ngo-xi-dusky`), once nothing points at it.
