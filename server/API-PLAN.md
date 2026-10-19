# API upgrade plan (roadmap step 5)

Status: **approved 19 Oct 2026** (decisions below). Built and tested so far: **Parts A to D**
(19 Oct 2026; `npm test` in `server/`, 53 tests against the test database).

Decided: email service **Resend**; tests run against a **separate free MongoDB Atlas database**
(connection string in `server/.env.test`, never committed); **past Paystack donations are imported
once**; admin at **admin.omwinitiative.org**.
Written 19 Oct 2026 from the current code and the notes on the Figma Admin page (`1:5`).

## In short

The admin screens in Figma need the API to do things it cannot do today:

| The admin needs to… | Today | After this plan |
| --- | --- | --- |
| See every donation | Asks Paystack live each time; nothing is saved | Donations saved in the database once Paystack confirms them |
| Record bank transfers | Yes (separate list) | Yes, in the same list as Paystack gifts |
| Show donors on the Contributors page | No public list | Public list of names; admin can hide one; anonymous donors never shown |
| Read Contact-form messages | Not saved anywhere | Saved, listed, marked as handled, emailed to info@ |
| Write blog posts with categories and drafts | Title, text, images only | Adds category, draft/published, photo description |
| Manage the Gallery | Photos are fixed in the website code | Upload, describe and delete photos |
| Reset a forgotten password | Not possible | Reset link by email |
| Change name, email, password | Not possible | Account settings |
| Keep strangers out | Anyone can create an account; unlimited password guesses | No public sign-up; sign-in pauses after repeated wrong passwords |

The work is split into five parts (A–E below). Each part is tested and can go live on its own.
The old website keeps working throughout, because the API stays backward compatible until launch.

## Decisions needed from Ifeanyi

1. **Email service** (for password resets and new-message alerts). Options:
   - **Resend** (recommended): a simple email service with a free plan that is plenty for this volume.
     Emails come from `@omwinitiative.org`, which needs a few DNS records added in GoDaddy
     (they do not touch the existing email).
   - **Gmail** (`omugwomatwelfareinitiative@gmail.com`) with an app password: no DNS work, but
     emails come from a Gmail address and Google may limit or block automated sending.
2. **Test database.** The server has no tests yet. Proposal: Node's built-in test runner
   (`node --test`, no new package) against a **separate free MongoDB Atlas database** used only
   for tests, never the live one. Alternative: an in-memory MongoDB package (one new dev
   package, which downloads MongoDB the first time).
3. **Existing Paystack donations.** Import the past successful Paystack payments into the new
   donations list once, so the dashboard totals include them? (Recommended: yes.)
4. **Existing user accounts.** Anyone who signed up on the old site has a "user" account.
   After launch nothing uses them. Proposal: leave them in the database, unused; delete later
   if OMWI wants.

## Admin address

Decided 19 Oct 2026: the admin lives at **admin.omwinitiative.org**, not `/admin` on the public site.
It is built in the same `web/` project. A Vercel rewrite that matches the `admin.` host serves the
admin pages there, and the public address does not serve them. The admin pages are also marked
`noindex`. Costs nothing extra: a subdomain is a free DNS record in GoDaddy, and Vercel
allows extra domains on a project. Step-by-step setup is in `web/README.md` (launch checklist).

## How signing in will work

- One admin account (created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, as today).
- Sign in sets a **secure cookie** (HttpOnly, Secure, SameSite=Strict) instead of handing the
  browser a token to store. Scripts on the page cannot read it, so a bug elsewhere cannot leak
  the login. This works because Vercel forwards `/api` to Render, so the API is on the site's
  own domain.
- The cookie lasts 12 hours (`JWT_EXPIRES_IN` already exists). Sign out clears it.
- Until launch, the API also still accepts the old `Authorization: Bearer` token, so the old
  admin pages keep working. The Bearer path is removed after launch.
- Sign-in pauses for 15 minutes after 5 wrong passwords from the same address (kept in memory;
  fine while Render runs one copy of the server).

## Part A: groundwork and security

- Test setup (decision 2) with focused tests for each route added below.
- Stop sending internal error text to the browser (`error: error.message` in every 500
  response today). Log it on the server; send "Something went wrong" instead.
- Image uploads: images only (JPEG, PNG, WebP), 5 MB each. Today any file of any size is accepted.
- Cookie sign-in, sign-out, `GET /api/auth/me` (as above), sign-in pause.
- Account settings:
  - `PATCH /api/admin/account`: name and sign-in email (needs the current password).
  - `PUT /api/admin/account/password`: current password + new password (at least 12 characters).

## Part B: donations

New `Donation` model, one list for every gift:

```
donorName, donorEmail, phone?, amount (naira), currency "NGN",
method: "paystack" | "bank-transfer" | "cash",
status: "pending" | "paid" | "not-completed",
paystackReference? (unique), paidAt?, anonymous, showOnContributors, note? (admin only),
createdBy? (admin, for recorded gifts)
```

Paystack flow (from Paystack's documentation; to be checked again when building):

1. `POST /api/payments/paystack/initialize` (exists): also saves a `pending` Donation with the
   reference, name, phone and "anonymous" choice. The Donate page already sends these fields.
2. Paystack sends the donor back to the Thank you page with `?reference=…`. That page calls
   `GET /api/payments/paystack/verify/:reference`. The server asks Paystack for the payment
   and marks the Donation `paid` only if Paystack says success **and** the amount matches.
3. `POST /api/payments/paystack/webhook`: Paystack also tells the server directly, in case the
   donor closes the tab. The server checks Paystack's signature (HMAC SHA512 of the raw body
   with the secret key) and ignores anything unsigned. Both paths are safe to run twice.
4. Pending donations older than a day show as "Not completed".

Admin routes (all admin only):

- `GET /api/admin/donations`: list with filters and search (CSV export happens in the browser).
- `GET /api/admin/donations/:id`
- `PATCH /api/admin/donations/:id`: Contributors switch and private note. For bank transfers
  and cash, also name, email, amount and date. Paystack amounts and status cannot be edited.
- `POST /api/admin/donations`: record a bank transfer or cash gift.
- `DELETE /api/admin/donations/:id`: bank transfers and cash gifts only.
- `GET /api/admin/summary`: dashboard totals and the newest messages.

Public:

- `GET /api/contributors`: paid, non-anonymous donors the admin has not hidden, newest first,
  as `[{ name, date }]` (the Contributors page shows the name and the month). Never emails or
  amounts (checked against the Figma Contributors page). The page already calls this route.

Existing data: the current bank-transfer records (`ManualContribution`) are copied into
`Donation` once; past Paystack payments are imported once (decision 3). The old routes stay
until launch.

## Part C: messages

- `POST /api/contact` (public; the Contact page already sends name, email, subject, message):
  validates the fields, limits each address to a few messages an hour, and has a hidden spam
  trap field. Saves a `Message` and emails an alert to info@omwinitiative.org (Part E's email setup;
  until then it is only saved).
- Admin: `GET /api/admin/messages`, `GET /api/admin/messages/:id`,
  `PATCH /api/admin/messages/:id` (mark handled), `DELETE /api/admin/messages/:id`.
- Replies are written in the admin's own email app (a mailto link); the API sends nothing.

## Part D: blog and gallery

Blog (`Blog` model gains fields; existing posts keep working):

- `category`: one of Maternal Health, Newborn Care, Menstrual Health, Mental Wellness, OMWI News.
- `status`: `draft` or `published`. Public routes return published posts only; existing posts
  count as published.
- `imageAlt`: a description of the photo.
- Admin list including drafts: `GET /api/admin/blogs`.

Gallery (new `GalleryPhoto` model: Cloudinary URL, description, order):

- Public `GET /api/gallery`. Admin: upload (with description, required), reorder, delete
  (also removes the file from Cloudinary).
- The seven photos the site shows today are uploaded once as the starting set, on launch day
  (`server/scripts/seed-gallery.js`).
- Website side, done with the admin screens (step 7): the Gallery page and the Home photo strip
  load photos from `GET /api/gallery`, with loading skeletons, instead of from
  `web/src/data/gallery.ts`. Until the engine is live there are no photos to load, so the site
  keeps its built-in photos for now.

## Part E: password reset by email (needs decision 1)

- `POST /api/auth/forgot-password`: always answers the same way, so it never reveals which
  emails exist. If the email is the admin's, sends a link that works once and expires after
  1 hour. Only a hash of the link's token is stored.
- `POST /api/auth/reset-password`: token + new password; signs out other sessions.
- The same email setup sends the new-message alerts (Part C).

## At launch

- Remove `POST /api/auth/register` (public sign-up), the old `/api/contributors/dashboard`,
  the old manual-payment routes, the Bearer-token path and `SERVE_STATIC_FRONTEND`.
- Render environment: new variables for the email service and the site address (for reset
  links and allowed origins); update `CORS_ORIGIN` and `PAYSTACK_CALLBACK_URL`.
- Paystack dashboard: set the webhook URL to `https://omwinitiative.org/api/payments/paystack/webhook`.

## Not included

Staff roles (one admin only, per the design), refunds (done in the Paystack dashboard), and
sending replies from the website.
