# OMWI website: notes for Claude Code

Read this before every task. Ifeanyi (the developer) wants work done one step at a time.

## What this repo is

The website of the Ọmụgwọ Maternal Welfare Initiative (OMWI), an NGO in Abuja, Nigeria.
We are rebuilding the site from a new Figma design.

| Folder | What it is | Rule |
| --- | --- | --- |
| `web/` | The NEW site: Astro 7.4.0, static output | All new frontend work goes here |
| `server/` | The existing API: Express 4, Mongoose 8, JWT, Cloudinary, Paystack. Hosted on Render | Change only when a task says so |
| Root `*.html`, `*.css`, `*.js` | The OLD live site | Do not edit. It stays live until launch |

- Work on the `redesign` branch. Never commit to or push `main`.
- Do not commit or push unless Ifeanyi asks. He reviews and commits.

## Working rules

- One step at a time. Do only the task asked, then stop and report: what changed, how you checked it, and what is still open.
- Never invent facts, copy, numbers, names, links, or API/library functions. If you are not sure a function or option exists, check the installed package's types or its official docs. If something is unclear, ask before building.
- Copy comes from the Figma design, or from content Ifeanyi gives you. Do not write new marketing copy. Keep wording plain and human.
- Keep all OMWI work off Ifeanyi's company (Reliance) accounts.
- Secrets: never open, print or commit `.env` files, API keys or passwords.
- After each new page or feature, end the report by reminding Ifeanyi to push: list the files changed and suggest a commit message.

## Engineering standard (build and review)

Senior-level judgment and restraint, for both `web/` and `server/`.

**When building**
- Choose the simplest design that fully meets the requirement. If two designs are both correct, pick the simpler one.
- Reuse what exists (`lib/api.ts`, `BaseLayout`, the components, the Express auth middleware, Mongoose models) before adding anything parallel.
- No speculative features, flags, config or "for later" extensibility. No manager / factory / adapter / wrapper layers.
- Do not create a helper or component that is used once unless it clearly makes the code easier to read.
- Keep the number of files and moving parts low; do not split code too finely.
- Comments only for what is not obvious: a business rule, a security constraint, a lifecycle rule, a subtle decision. Never restate the code.
- Handle the failure cases that matter (API down, empty data, invalid input, unauthorised user). Validate on the server; never trust the client.
- `server/` changes: give a short design note first (model changes, endpoints, auth), then build the whole flow end to end, with focused tests. The server has no tests yet: agree the test setup with Ifeanyi before the first API change (Node's built-in `node --test` needs no new package; the database to test against is the open question).

**Before reporting, review your own work as a blocking reviewer**
- Is it correct (business rules, edge cases, state)? Is it secure (server-side checks, auth scope, secrets, user input)?
- Is it under-designed, about right, or over-engineered? Could it have been done more directly? Remove what is not needed.
- Do the checks or tests prove the important behaviour, not just the happy path?
- Say so plainly in the report, including anything you are unsure about.

**Report format** (keep it short): what was built, files changed, model/API changes, assumptions, how it was checked or tested, known gaps and follow-ups.

## Design source of truth: Figma

- File "OMWI Website Redesign", fileKey `e9bcBTFQKsINiEDsvf850Z`.
- Before using the Figma MCP, run its `whoami`. It must be **emmanuelmaduip@gmail.com**. If it shows a relianceinfosystems.com account, stop and tell Ifeanyi.
- Pages: Foundations `1:2`, Components `1:3`, Hi-fi designs `1:4`, Admin `1:5`.
- Each page on Hi-fi designs has Desktop (1440), Tablet (768) and Mobile (390) frames. Example: Home Desktop `91:6522`, Tablet `91:7024`, Mobile `91:7517`; About Desktop `93:1503`.
- Components (page `1:3`):
  - Header `37:97` (Device Desktop/Tablet/Mobile × Menu Closed/Open), Nav dropdown `37:98`, Mobile menu `37:103`, Footer `37:264`
  - Logo/Colour `2:14`, Logo/On dark `2:2`, Logo/Mark `36:65`
  - Button `2:35` (Primary, Secondary, Outline, On dark × Default, Hover, Focus, Disabled), Icon button `36:119`, Link `44:135`, Eyebrow `36:94`, Section heading `44:164`
  - Page banner `37:165`, Hero slider `86:467`, Gallery strip `86:626`, Donation call-out `37:313`
  - Cards: Feature `44:199`, Post `108:436`, Team `108:467`, Step `108:488`, Contact `108:496`, Donor `108:505`; Photo `44:124`; FAQ item `44:252`
  - Forms: Input `45:187`, Checkbox `45:212`, Chip `45:201`, Amount chip `45:194`, Category tabs `84:365`; Loader `118:693`
  - Icons: Phosphor, Regular weight
- Build from `get_design_context` output, adapted to this project. Do not copy absolute positioning. Use the design's SVG assets (logo, icons) as they are; do not redraw them.
- Admin page (`1:5`): the custom admin is the row of sections named `Admin · …` at the top. Screens: Sign in, Forgot password, Check your email, Set a new password, Dashboard, Donations, Donation details, Record a bank transfer, Blog posts, Edit post, Gallery, Messages, Message, Settings (Account settings), Page not found, plus `Admin · Menus and dialogs` (tablet/mobile menus, delete dialogs). Each section's note explains behaviour and API needs.
- One admin account (no staff roles), password reset by email link, Contributors names shown automatically (the admin can hide one).
- The WordPress-style screens lower on the Admin page are archived. Do not build from them.

## Code rules (`web/`)

- **Tokens:** `web/src/styles/tokens.css` mirrors the Figma variables exactly (`plum/500` is `--plum-500`, `bg/page` is `--bg-page`). Use the semantic tokens (`--bg-*`, `--text-*`, `--border-*`, `--space-*`, `--radius-*`, `--layout-*`). No hex values or one-off numbers in components. If the design uses a value with no token, ask before adding one.
- **Text:** use the classes in `web/src/styles/typography.css` (`.t-display`, `.t-h1` to `.t-h4`, `.t-body-large`, `.t-body`, `.t-body-small`, `.t-eyebrow`, `.t-button`, `.t-stat`). They match the Figma text styles.
- **Breakpoints:** mobile first; tablet from 768px, desktop from 1200px with a fluid side margin max(40px, (width − 1200px)/2); always check 1280 and 1366 as well as 1440, 768 and 390.
- **Pages** use `web/src/layouts/BaseLayout.astro` with a real `title` and `description`. Shared parts go in `web/src/components/`.
- **API calls** go through `web/src/lib/api.ts` (`/api/...`).
- **Radius:** cards 8 (`--radius-card`), buttons and fields 12 (`--radius-button`).
- **JavaScript:** keep it small. Plain `<script>` tags in Astro components; no UI framework unless agreed.
- **Accessibility (required):**
  - Semantic HTML; every control works with a keyboard; visible focus.
  - Menus: a real `<button>` with `aria-expanded` and `aria-controls`; Escape closes; dropdowns open on click and keyboard, not hover only.
  - Images: alt text that describes the picture; decorative images get `alt=""`.
  - Contrast: text under 19px needs at least 4.5:1, 19px and above at least 3:1. White on brand green (#408C4C) is 4.14:1, so use it only at 19px and above.
  - Respect `prefers-reduced-motion`.

## Commands (run inside `web/`)

- `npm install`, `npm run dev` (http://localhost:4321), `npm run build`, `npm run preview`.
- Needs Node 22.22.0 or newer.
- `server/node_modules` is no longer in git (removed 19 Oct 2026; Render installs packages itself). Do not run `npm install` in `server/` unless a task needs the API running locally.
- `npm run dev` forwards `/api` to `http://localhost:5000` by default. Do not point `API_PROXY_TARGET` at the live API when testing admin actions.

## Checking your work

- `npm run build` passes with no new errors or warnings.
- Compare with Figma at 1440, 768 and 390 wide: layout, spacing, type, colours, and states (hover, focus, open/closed).
- Test with the keyboard only, and check nothing scrolls sideways.
- In your report, say what you checked and what you could not check.

## Roadmap (context)

1. Access to services: done
2. Frontend approach (Astro): done
3. Project setup and design tokens: done (commit `3b07533`)
4. Header, footer, logo, buttons: done (commit `a02fab7`)
5. API upgrades: store donations, Paystack verify and webhook, public contributors list, blog fields, contact endpoint, gallery, remove public sign-up
6. Rebuild the 15 public pages (in progress, Home first; Ifeanyi asked to build pages before the API work)
7. Admin: redesigned in Figma (18 Oct 2026); build after the API upgrades
8. Preview and launch
