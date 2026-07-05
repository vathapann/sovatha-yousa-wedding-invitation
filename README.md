# Wedding Invitation Marketplace

A Cloudflare Worker that sells and **hosts** digital wedding invitations. Couples buy a
template, submit their details, and receive a live personalized link — the source is
never handed over (see `marketplace/LICENSE.md`).

## Architecture

- **`src/worker.js`** — the whole backend: storefront assets, Stripe checkout + webhook,
  invitation serving, RSVP/wishes APIs, couple dashboard, admin API.
- **`marketplace/`** — deployed static assets: storefront, 7 templates under
  `templates/`, the shared hydrator `invite.js`, `intake.html`.
- **D1** (`DB` binding) — orders, invites, guests, rsvps, wishes (`migrations/`).

### How an invitation is served

`/i/<slug>/` looks up the couple's config in D1, injects it into the template's HTML as
`window.INVITE`, and loads `/invite.js`, which personalizes names/dates/venue, greets the
guest (`?g=<code>` links), and injects the RSVP form + wishes wall, KHQR gift section,
add-to-calendar and share buttons. Template assets are proxied from the same path, so one
Worker serves every couple — no per-couple deploys. Plain previews at
`/templates/<id>/` are untouched (no `window.INVITE` → hydrator does nothing).

## Customer journey & order lifecycle

1. **Buy** — storefront → `checkout.html` (phone/email, wedding date, agree to
   `terms.html` + `privacy.html`) → order created (**`pending_payment`**).
2. **Pay** — `pay.html`: scan the ABA/KHQR code (put your image at
   `marketplace/assets/payment-khqr.png`), pay, upload the slip screenshot
   (**`slip_uploaded`**; you get a Telegram ping with the order id).
3. **You verify** the slip (below) → **`paid`** — the pay page auto-unlocks the intake.
4. **Customize** — `intake.html`: names, date, venue → the invitation **publishes
   itself instantly** (**`published`**) and shows the couple their invite link,
   dashboard link, and an **access code** they can reuse at `my.html`.
5. **Guests** — the couple uploads their guest list (Excel/CSV) on their own dashboard;
   every guest gets a personal URL like `/i/vibol-srey/sok-dara`.

### Admin commands

```sh
# See orders / view a payment slip
curl -s https://<host>/api/admin/orders -H "X-Admin-Key: $ADMIN_KEY"
open "https://<host>/api/admin/slip?orderId=ord_…"   # needs the header; use curl -o slip.jpg

# Confirm a payment after checking the slip against your ABA account
curl -s -X POST https://<host>/api/admin/verify-payment \
  -H "X-Admin-Key: $ADMIN_KEY" -H 'Content-Type: application/json' -d '{"orderId":"ord_…"}'

# Re-publish with overrides (e.g. KHQR gift section), or publish manually
curl -s -X POST https://<host>/api/admin/publish \
  -H "X-Admin-Key: $ADMIN_KEY" -H 'Content-Type: application/json' \
  -d '{"orderId":"ord_…","config":{"khqrImage":"/assets/khqr/vibol-srey.png","khqrName":"VIBOL"}}'

# Map a custom domain to an invitation (after adding the domain to the
# Worker's routes/custom domains in the Cloudflare dashboard)
curl -s -X POST https://<host>/api/admin/domains \
  -H "X-Admin-Key: $ADMIN_KEY" -H 'Content-Type: application/json' \
  -d '{"hostname":"vibol-srey.com","slug":"vibol-srey"}'
```

Custom domains serve the invitation at their root (`vibol-srey.com/sok-dara` for
guests). `run_worker_first` in `wrangler.jsonc` makes this possible — don't remove it.

### Config fields (`invites.config_json`)

`coupleA`, `coupleB`, `coupleAKm`, `coupleBKm`, `dateISO`, `dateDisplay` (auto-derived),
`venueName`, `venueAddress`, `mapsUrl`, `hashtag`, `rsvpBy`, `albumUrl` (classic-elegance),
`khqrImage`, `khqrName`. Anything set at publish time overrides the intake.

## Couple dashboard

`/dash/<slug>?key=<dash_key>` — live headcount, RSVP list with CSV export, wishes wall,
guest links with copy buttons and printable QR codes, plus a QR of the invite link.

## Setup

```sh
npm install

# One-time: create the database, paste its id into wrangler.jsonc, run migrations
npx wrangler d1 create wedding-invites
npx wrangler d1 migrations apply DB --remote

# Secrets
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # from the Stripe webhook endpoint
npx wrangler secret put ADMIN_KEY               # any long random string
npx wrangler secret put TELEGRAM_BOT_TOKEN      # optional: order/RSVP notifications
npx wrangler secret put TELEGRAM_CHAT_ID        # optional: your chat id
```

Also replace the `price_REPLACE_ME_*` ids in `marketplace/templates.json` with real
Stripe Price ids, and point a Stripe webhook (event `checkout.session.completed`) at
`https://<host>/api/stripe-webhook`.

### Local development

```sh
npx wrangler d1 migrations apply DB --local
echo 'ADMIN_KEY=local-test-admin' > .dev.vars
npx wrangler dev
```

Then walk the real flow in the browser — no Stripe needed:
storefront → Buy → checkout → pay (upload any screenshot as the slip) →
verify it with the admin curl → intake → the success screen shows the live
invite URL, dashboard URL, and access code.

## Still manual / next up

- **Payment KHQR image** — add your real KHQR at `marketplace/assets/payment-khqr.png`
  and put your account name in `pay.html` (currently a placeholder).
- **classic-elegance names** — its bilingual copy is hardcoded (`data-en`/`data-km`);
  edit per couple after purchase. The other 6 templates hydrate fully from config.
- **Photos** — collect via Telegram and commit to the template dir (or add R2 later).
- **Guest photo wall** — uploader is prototyped in classic-elegance; needs an R2 bucket
  and an `/api/upload` route (planned: shared wedding-day photo sharing).
- **Pricing tiers** — storefront still lists a flat $49; adjust `templates.json` and the
  pricing section when tiers/custom-domain add-ons are decided.
- **Customer editor page** — later: a self-serve edit page on top of the config system
  (same fields as intake, authenticated by access code).
- **Stripe** — kept as an optional card path (`/api/create-checkout-session`); price ids
  are still placeholders and the storefront no longer uses it.
