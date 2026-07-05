const STRIPE_API = "https://api.stripe.com/v1";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Published invitations: /i/<slug>/ (+ template assets under the same path)
    if (pathname.startsWith("/i/")) {
      return serveInvite(request, env, url);
    }

    // Couple dashboard: /dash/<slug>?key=<dash_key>
    if (pathname.startsWith("/dash/")) {
      return serveDashboard(request, env, url);
    }

    if (request.method === "POST" && pathname === "/api/create-checkout-session") {
      return createCheckoutSession(request, env, url);
    }
    if (request.method === "POST" && pathname === "/api/stripe-webhook") {
      return handleStripeWebhook(request, env, ctx);
    }
    if (request.method === "POST" && pathname === "/api/orders") {
      return createOrder(request, env, ctx, url);
    }
    if (request.method === "POST" && pathname === "/api/orders/slip") {
      return uploadSlip(request, env, ctx);
    }
    if (request.method === "GET" && pathname === "/api/access") {
      return accessLookup(env, url);
    }
    if (request.method === "POST" && pathname === "/api/guests") {
      return coupleAddGuests(request, env, url);
    }
    if (request.method === "POST" && pathname === "/api/rsvp") {
      return handleRsvp(request, env, ctx);
    }
    if (request.method === "POST" && pathname === "/api/wish") {
      return handleWish(request, env, ctx);
    }
    if (request.method === "GET" && pathname === "/api/wishes") {
      return listWishes(env, url);
    }
    if (request.method === "GET" && pathname === "/api/order") {
      return getOrderStatus(env, url);
    }
    if (request.method === "POST" && pathname === "/api/intake") {
      return handleIntake(request, env, ctx);
    }
    if (pathname.startsWith("/api/admin/")) {
      return handleAdmin(request, env, url);
    }

    // Custom domains: a mapped hostname serves its invitation at the root
    // (/ → invitation, /<invitee-name> → personalized, anything else → assets).
    if (!pathname.startsWith("/api/")) {
      const slug = await domainSlug(env, url.hostname);
      if (slug) {
        const invite = await getInvite(env, slug);
        if (invite && invite.status === "live") {
          return serveInviteCore(env, url, invite, pathname === "" ? "/" : pathname);
        }
      }
    }

    return env.ASSETS.fetch(request);
  },
};

/* ────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────── */

function json(data, status = 200) {
  return Response.json(data, { status });
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function randHex(bytes) {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function slugify(s) {
  return String(s).toLowerCase().normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

// Owner notifications via Telegram. No-op unless both secrets are set.
function notifyTelegram(env, ctx, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const send = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  }).catch((err) => console.log("Telegram notify failed:", err));
  if (ctx) ctx.waitUntil(send);
}

async function getInvite(env, slug) {
  return env.DB.prepare(
    "SELECT slug, template_id, config_json, dash_key, status FROM invites WHERE slug = ?"
  ).bind(slug).first();
}

// Every request runs through the Worker (run_worker_first), so cache the
// hostname → slug mapping per isolate to avoid a D1 query per asset.
const domainCache = new Map();
async function domainSlug(env, hostname) {
  const hit = domainCache.get(hostname);
  if (hit && hit.exp > Date.now()) return hit.slug;
  const row = await env.DB.prepare("SELECT slug FROM domains WHERE hostname = ?")
    .bind(hostname).first();
  const slug = row ? row.slug : null;
  domainCache.set(hostname, { slug, exp: Date.now() + 60_000 });
  return slug;
}

/* ────────────────────────────────────────────────────────────
   Published invitations: /i/<slug>/
   The Worker fetches the template's static HTML, injects the
   couple's config as window.INVITE plus the shared hydrator
   (/invite.js), and proxies the template's relative assets.
   ──────────────────────────────────────────────────────────── */

async function serveInvite(request, env, url) {
  const match = url.pathname.match(/^\/i\/([a-z0-9-]+)(\/.*)?$/);
  if (!match) return new Response("Not found", { status: 404 });
  const [, slug, rest] = match;

  const invite = await getInvite(env, slug);
  if (!invite || invite.status !== "live") {
    return new Response("This invitation is not available.", { status: 404 });
  }

  // /i/slug → /i/slug/ so the template's relative asset URLs resolve here.
  if (!rest) {
    return Response.redirect(`${url.origin}/i/${slug}/${url.search}`, 301);
  }

  return serveInviteCore(env, url, invite, rest);
}

// Shared by /i/<slug>/… and custom domains. `rest` is the path after the
// invitation root: "/" for the page itself, "/<invitee-name>" for a
// personalized page, anything else proxies the template's assets.
async function serveInviteCore(env, url, invite, rest) {
  const slug = invite.slug;
  let guest = null;

  // /<invitee-name>/ → /<invitee-name> so relative assets resolve at the root.
  const slashed = rest.match(/^\/([a-z0-9-]+)\/$/);
  if (slashed) {
    const prefix = url.pathname.startsWith("/i/") ? `/i/${slug}` : "";
    return Response.redirect(`${url.origin}${prefix}/${slashed[1]}${url.search}`, 301);
  }

  // Personalized invitee URL: a single extension-less path segment.
  const nameMatch = rest.match(/^\/([a-z0-9-]+)$/);
  if (rest !== "/" && nameMatch) {
    const row = await env.DB.prepare(
      "SELECT code, name_en, name_km FROM guests WHERE slug = ? AND name_slug = ?"
    ).bind(slug, nameMatch[1]).first();
    if (row) guest = { code: row.code, nameEn: row.name_en, nameKm: row.name_km };
  }

  // Not the page and not a known invitee → template asset proxy, falling
  // back to root assets (e.g. /invite.js on a custom domain).
  if (rest !== "/" && !guest) {
    const res = await env.ASSETS.fetch(new URL(`/templates/${invite.template_id}${rest}`, url));
    if (res.status !== 404) return res;
    return env.ASSETS.fetch(new URL(rest, url));
  }

  const tplRes = await env.ASSETS.fetch(new URL(`/templates/${invite.template_id}/index.html`, url));
  if (!tplRes.ok) return new Response("Template missing", { status: 500 });
  let html = await tplRes.text();

  // ?g=<code> links still work alongside invitee-name URLs.
  const code = url.searchParams.get("g");
  if (!guest && code) {
    const row = await env.DB.prepare(
      "SELECT code, name_en, name_km FROM guests WHERE code = ? AND slug = ?"
    ).bind(code, slug).first();
    if (row) guest = { code: row.code, nameEn: row.name_en, nameKm: row.name_km };
  }

  const payload = { slug, ...JSON.parse(invite.config_json), guest };
  const inject =
    `<script>window.INVITE=${JSON.stringify(payload).replace(/</g, "\\u003c")}</script>` +
    `<script defer src="/invite.js"></script>`;
  html = html.includes("</head>") ? html.replace("</head>", inject + "</head>") : inject + html;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ────────────────────────────────────────────────────────────
   Guest-facing APIs: RSVP + wishes
   ──────────────────────────────────────────────────────────── */

async function handleRsvp(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const slug = String(body.slug || "");
  const name = String(body.name || "").trim().slice(0, 120);
  const attending = body.attending ? 1 : 0;
  const partySize = Math.min(Math.max(parseInt(body.partySize, 10) || 1, 1), 20);
  const message = String(body.message || "").trim().slice(0, 1000);
  const guestCode = body.guestCode ? String(body.guestCode).slice(0, 16) : null;

  if (!name) return json({ error: "Name required" }, 400);
  const invite = await getInvite(env, slug);
  if (!invite) return json({ error: "Unknown invitation" }, 404);

  await env.DB.prepare(
    "INSERT INTO rsvps (slug, guest_code, name, attending, party_size, message) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(slug, guestCode, name, attending, partySize, message || null).run();

  // A heartfelt RSVP message doubles as a public wish on the wall.
  if (message && attending) {
    await env.DB.prepare("INSERT INTO wishes (slug, who, message) VALUES (?, ?, ?)")
      .bind(slug, name, message).run();
  }

  notifyTelegram(env, ctx,
    `💌 RSVP for ${slug}: ${name} ${attending ? `accepts (${partySize})` : "declines"}` +
    (message ? ` — “${message.slice(0, 200)}”` : ""));

  return json({ ok: true });
}

async function handleWish(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const slug = String(body.slug || "");
  const who = String(body.who || "").trim().slice(0, 120);
  const message = String(body.message || "").trim().slice(0, 1000);
  if (!who || !message) return json({ error: "Name and message required" }, 400);

  const invite = await getInvite(env, slug);
  if (!invite) return json({ error: "Unknown invitation" }, 404);

  await env.DB.prepare("INSERT INTO wishes (slug, who, message) VALUES (?, ?, ?)")
    .bind(slug, who, message).run();

  notifyTelegram(env, ctx, `💬 Wish for ${slug} from ${who}: “${message.slice(0, 200)}”`);
  return json({ ok: true });
}

async function listWishes(env, url) {
  const slug = url.searchParams.get("slug") || "";
  const { results } = await env.DB.prepare(
    "SELECT who, message, created_at FROM wishes WHERE slug = ? AND approved = 1 ORDER BY id DESC LIMIT 100"
  ).bind(slug).all();
  return json({ wishes: results });
}

/* ────────────────────────────────────────────────────────────
   Manual ABA/KHQR checkout pipeline
   pending_payment → slip_uploaded → paid (owner verifies)
   → intake_received → published (auto, returns access code)
   ──────────────────────────────────────────────────────────── */

function newAccessCode() {
  // Unambiguous alphabet (no 0/O, 1/I/L) — easy to read over the phone.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = crypto.getRandomValues(new Uint8Array(8));
  return [...buf].map((b) => alphabet[b % alphabet.length]).join("");
}

async function createOrder(request, env, ctx, url) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const templatesRes = await env.ASSETS.fetch(new URL("/templates.json", url));
  const templates = await templatesRes.json();
  const template = templates.find((t) => t.id === body.templateId);
  if (!template) return json({ error: "Unknown template" }, 400);

  const phone = String(body.phone || "").trim().slice(0, 40);
  const email = String(body.email || "").trim().slice(0, 120);
  const weddingDate = String(body.weddingDate || "").trim().slice(0, 40);
  if (!phone && !email) return json({ error: "Phone number or email required" }, 400);
  if (!body.agree) return json({ error: "Please agree to the terms of service" }, 400);

  const orderId = `ord_${randHex(6)}`;
  await env.DB.prepare(
    "INSERT INTO orders (id, email, phone, template_id, wedding_date, agreed_at, status) VALUES (?, ?, ?, ?, ?, datetime('now'), 'pending_payment')"
  ).bind(orderId, email || null, phone || null, template.id, weddingDate || null).run();

  notifyTelegram(env, ctx, `🛍 New order started: ${template.name} — ${phone || email}`);
  return json({ ok: true, orderId, price: template.price, templateName: template.name });
}

async function uploadSlip(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const orderId = String(body.orderId || "");
  const mime = String(body.mime || "");
  const dataB64 = String(body.dataB64 || "");
  if (!mime.startsWith("image/")) return json({ error: "Please upload an image" }, 400);
  if (!dataB64 || dataB64.length > 1_400_000) {
    return json({ error: "Image too large — please upload a screenshot under 1 MB" }, 400);
  }

  const order = await env.DB.prepare("SELECT id, status, template_id, phone, email FROM orders WHERE id = ?")
    .bind(orderId).first();
  if (!order) return json({ error: "Order not found" }, 404);
  if (!["pending_payment", "slip_uploaded"].includes(order.status)) {
    return json({ error: "This order's payment is already confirmed" }, 400);
  }

  await env.DB.prepare(
    "INSERT OR REPLACE INTO slips (order_id, mime, data_b64, uploaded_at) VALUES (?, ?, ?, datetime('now'))"
  ).bind(orderId, mime, dataB64).run();
  await env.DB.prepare("UPDATE orders SET status = 'slip_uploaded' WHERE id = ?").bind(orderId).run();

  notifyTelegram(env, ctx,
    `🧾 Payment slip uploaded for ${orderId} (${order.template_id}) by ${order.phone || order.email}.\n` +
    `Verify: curl -X POST <host>/api/admin/verify-payment -H "X-Admin-Key: …" -d '{"orderId":"${orderId}"}'`);
  return json({ ok: true });
}

// Publishes an order's invitation from its intake data (+ overrides) and
// issues the customer access code. Used by intake auto-publish and admin.
async function publishOrder(env, order, overrides, origin) {
  const intake = order.intake_json ? JSON.parse(order.intake_json) : {};
  const config = { ...intake, ...(overrides || {}) };
  delete config.contact;
  delete config.notes;
  if (!config.dateDisplay && config.dateISO) {
    const d = new Date(config.dateISO);
    if (!isNaN(d)) {
      config.dateDisplay = `${String(d.getDate()).padStart(2, "0")} · ${String(d.getMonth() + 1).padStart(2, "0")} · ${d.getFullYear()}`;
    }
  }

  let slug = slugify(overrides?.slug || `${config.coupleA}-${config.coupleB}`);
  delete config.slug;
  if (!slug) return { error: "Could not derive a slug" };
  const taken = await getInvite(env, slug);
  if (taken) slug = `${slug}-${randHex(2)}`;

  const dashKey = randHex(12);
  await env.DB.prepare(
    "INSERT INTO invites (slug, order_id, template_id, config_json, dash_key) VALUES (?, ?, ?, ?, ?)"
  ).bind(slug, order.id, order.template_id, JSON.stringify(config), dashKey).run();

  const accessCode = order.access_code || newAccessCode();
  await env.DB.prepare("UPDATE orders SET status = 'published', access_code = ? WHERE id = ?")
    .bind(accessCode, order.id).run();

  return {
    slug,
    accessCode,
    inviteUrl: `${origin}/i/${slug}/`,
    dashboardUrl: `${origin}/dash/${slug}?key=${dashKey}`,
  };
}

// Customer portal lookup: access code → invitation + dashboard links.
async function accessLookup(env, url) {
  const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
  if (!code) return json({ error: "Code required" }, 400);

  const order = await env.DB.prepare(
    "SELECT id, status, template_id, access_code FROM orders WHERE access_code = ?"
  ).bind(code).first();
  if (!order) return json({ found: false });

  const invite = await env.DB.prepare(
    "SELECT slug, dash_key FROM invites WHERE order_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(order.id).first();

  return json({
    found: true,
    status: order.status,
    templateId: order.template_id,
    inviteUrl: invite ? `${url.origin}/i/${invite.slug}/` : null,
    dashboardUrl: invite ? `${url.origin}/dash/${invite.slug}?key=${invite.dash_key}` : null,
  });
}

// Shared guest-list insert (admin API + couple dashboard upload).
// Gives every guest a short code AND a pretty name URL (/i/<slug>/<name-slug>).
async function addGuestList(env, slug, guests, origin) {
  const created = [];
  for (const g of guests) {
    const nameEn = String(g.nameEn || "").trim().slice(0, 120);
    if (!nameEn) continue;
    const nameKm = String(g.nameKm || "").trim().slice(0, 120) || null;

    let nameSlug = slugify(nameEn) || `guest-${randHex(2)}`;
    const clash = await env.DB.prepare(
      "SELECT code FROM guests WHERE slug = ? AND name_slug = ?"
    ).bind(slug, nameSlug).first();
    if (clash) nameSlug = `${nameSlug}-${randHex(1)}`;

    let code;
    for (let attempt = 0; attempt < 3; attempt++) {
      code = randHex(3 + attempt);
      const res = await env.DB.prepare(
        "INSERT OR IGNORE INTO guests (code, slug, name_en, name_km, name_slug) VALUES (?, ?, ?, ?, ?)"
      ).bind(code, slug, nameEn, nameKm, nameSlug).run();
      if (res.meta.changes > 0) break;
      code = null;
    }
    if (!code) continue;
    created.push({ code, nameEn, nameKm, nameSlug, link: `${origin}/i/${slug}/${nameSlug}` });
  }
  return created;
}

// Couples add their own guest list from the dashboard (X-Dash-Key auth).
async function coupleAddGuests(request, env, url) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const slug = String(body.slug || "");
  const invite = await getInvite(env, slug);
  const key = request.headers.get("X-Dash-Key") || "";
  if (!invite || !key || key !== invite.dash_key) return json({ error: "Unauthorized" }, 401);

  const guests = Array.isArray(body.guests) ? body.guests.slice(0, 500) : [];
  if (!guests.length) return json({ error: "guests[] required" }, 400);

  const created = await addGuestList(env, slug, guests, url.origin);
  return json({ ok: true, guests: created });
}

/* ────────────────────────────────────────────────────────────
   Stripe checkout (kept as an optional card-payment path)
   ──────────────────────────────────────────────────────────── */

async function createCheckoutSession(request, env, url) {
  const { templateId } = await request.json();

  const templatesRes = await env.ASSETS.fetch(new URL("/templates.json", url));
  const templates = await templatesRes.json();
  const template = templates.find((t) => t.id === templateId);

  if (!template) {
    return new Response("Unknown template", { status: 400 });
  }

  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": template.stripePriceId,
    "line_items[0][quantity]": "1",
    success_url: `${url.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${url.origin}/cancel.html`,
    "metadata[templateId]": template.id,
  });

  const stripeRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    return new Response(`Stripe error: ${err}`, { status: 502 });
  }

  const session = await stripeRes.json();
  return Response.json({ url: session.url });
}

async function handleStripeWebhook(request, env, ctx) {
  const signatureHeader = request.headers.get("Stripe-Signature") ?? "";
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = session.customer_details?.email ?? null;
    const templateId = session.metadata?.templateId ?? "unknown";

    await env.DB.prepare(
      "INSERT OR IGNORE INTO orders (id, email, template_id, amount_total, currency) VALUES (?, ?, ?, ?, ?)"
    ).bind(session.id, email, templateId, session.amount_total ?? null, session.currency ?? null).run();

    notifyTelegram(env, ctx, `🛒 New order: ${templateId} — ${email ?? "no email"}\nOrder id: ${session.id}`);
  }

  return new Response("ok", { status: 200 });
}

// Lets success.html/intake.html confirm the order exists before showing the form.
async function getOrderStatus(env, url) {
  const id = url.searchParams.get("session_id") || "";
  const order = await env.DB.prepare(
    "SELECT id, template_id, status FROM orders WHERE id = ?"
  ).bind(id).first();
  if (!order) return json({ found: false });
  return json({ found: true, templateId: order.template_id, status: order.status });
}

async function handleIntake(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

  const orderId = String(body.orderId || "");
  const order = await env.DB.prepare(
    "SELECT id, status, template_id, access_code, intake_json FROM orders WHERE id = ?"
  ).bind(orderId).first();
  if (!order) return json({ error: "Order not found — payment may still be processing. Try again in a minute." }, 404);
  if (order.status === "pending_payment" || order.status === "slip_uploaded") {
    return json({ error: "Your payment hasn't been confirmed yet — we verify slips within a few hours. Please try again soon." }, 403);
  }

  const intake = {
    coupleA: String(body.coupleA || "").trim().slice(0, 80),
    coupleB: String(body.coupleB || "").trim().slice(0, 80),
    coupleAKm: String(body.coupleAKm || "").trim().slice(0, 80),
    coupleBKm: String(body.coupleBKm || "").trim().slice(0, 80),
    dateISO: String(body.dateISO || "").trim().slice(0, 40),
    venueName: String(body.venueName || "").trim().slice(0, 120),
    venueAddress: String(body.venueAddress || "").trim().slice(0, 300),
    mapsUrl: String(body.mapsUrl || "").trim().slice(0, 500),
    hashtag: String(body.hashtag || "").trim().slice(0, 80),
    contact: String(body.contact || "").trim().slice(0, 120),
    notes: String(body.notes || "").trim().slice(0, 2000),
  };
  if (!intake.coupleA || !intake.coupleB || !intake.dateISO) {
    return json({ error: "Both names and the wedding date are required" }, 400);
  }

  await env.DB.prepare("UPDATE orders SET intake_json = ?, status = 'intake_received' WHERE id = ?")
    .bind(JSON.stringify(intake), orderId).run();

  // Already published (details resubmitted): update the live config in place.
  const existing = await env.DB.prepare(
    "SELECT slug, dash_key, config_json FROM invites WHERE order_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(orderId).first();

  const origin = new URL(request.url).origin;
  let result;
  if (existing) {
    const prev = JSON.parse(existing.config_json);
    const config = { ...prev, ...intake };
    delete config.contact;
    delete config.notes;
    await env.DB.prepare("UPDATE invites SET config_json = ? WHERE slug = ?")
      .bind(JSON.stringify(config), existing.slug).run();
    await env.DB.prepare("UPDATE orders SET status = 'published' WHERE id = ?").bind(orderId).run();
    result = {
      slug: existing.slug,
      accessCode: order.access_code,
      inviteUrl: `${origin}/i/${existing.slug}/`,
      dashboardUrl: `${origin}/dash/${existing.slug}?key=${existing.dash_key}`,
    };
  } else {
    // First submission: publish immediately — the couple gets their live
    // link and access code without waiting on the owner.
    result = await publishOrder(env, { ...order, intake_json: JSON.stringify(intake) }, null, origin);
    if (result.error) return json({ error: result.error }, 400);
  }

  notifyTelegram(env, ctx,
    `📝 Intake for ${orderId}: ${intake.coupleA} & ${intake.coupleB} — ${intake.dateISO}\n` +
    `${intake.venueName}\nLive: ${result.inviteUrl}`);

  return json({ ok: true, ...result });
}

/* ────────────────────────────────────────────────────────────
   Admin API (X-Admin-Key: env.ADMIN_KEY)
   ──────────────────────────────────────────────────────────── */

async function handleAdmin(request, env, url) {
  if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (request.method === "GET" && url.pathname === "/api/admin/orders") {
    const { results } = await env.DB.prepare(
      "SELECT id, email, template_id, status, intake_json, created_at FROM orders ORDER BY created_at DESC LIMIT 100"
    ).all();
    return json({ orders: results });
  }

  if (request.method === "GET" && url.pathname === "/api/admin/invites") {
    const { results } = await env.DB.prepare(
      "SELECT slug, template_id, status, dash_key, created_at FROM invites ORDER BY created_at DESC LIMIT 100"
    ).all();
    return json({ invites: results });
  }

  // Confirm a manually verified ABA/KHQR payment: { orderId }
  if (request.method === "POST" && url.pathname === "/api/admin/verify-payment") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const order = await env.DB.prepare("SELECT id, status FROM orders WHERE id = ?")
      .bind(String(body.orderId || "")).first();
    if (!order) return json({ error: "Order not found" }, 404);
    if (!["pending_payment", "slip_uploaded"].includes(order.status)) {
      return json({ error: `Order is already '${order.status}'` }, 400);
    }
    await env.DB.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").bind(order.id).run();
    return json({ ok: true, orderId: order.id, status: "paid" });
  }

  // View an uploaded payment slip: /api/admin/slip?orderId=…
  if (request.method === "GET" && url.pathname === "/api/admin/slip") {
    const slip = await env.DB.prepare("SELECT mime, data_b64 FROM slips WHERE order_id = ?")
      .bind(url.searchParams.get("orderId") || "").first();
    if (!slip) return json({ error: "No slip uploaded" }, 404);
    const bin = Uint8Array.from(atob(slip.data_b64), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { "Content-Type": slip.mime } });
  }

  // Publish an order as a live invitation. Config = intake fields + overrides.
  if (request.method === "POST" && url.pathname === "/api/admin/publish") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

    const order = await env.DB.prepare(
      "SELECT id, template_id, intake_json, access_code FROM orders WHERE id = ?"
    ).bind(String(body.orderId || "")).first();
    if (!order) return json({ error: "Order not found" }, 404);

    const result = await publishOrder(env, order, { ...(body.config || {}), slug: body.slug }, url.origin);
    if (result.error) return json({ error: result.error }, 400);
    return json({ ok: true, ...result });
  }

  // Bulk-add personalized guest links: { slug, guests: [{ nameEn, nameKm? }] }
  if (request.method === "POST" && url.pathname === "/api/admin/guests") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }

    const slug = String(body.slug || "");
    const invite = await getInvite(env, slug);
    if (!invite) return json({ error: "Unknown invitation" }, 404);
    const guests = Array.isArray(body.guests) ? body.guests.slice(0, 500) : [];
    if (!guests.length) return json({ error: "guests[] required" }, 400);

    const created = await addGuestList(env, slug, guests, url.origin);
    return json({ ok: true, guests: created });
  }

  // Map a custom domain to an invitation: { hostname, slug }
  if (request.method === "POST" && url.pathname === "/api/admin/domains") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const hostname = String(body.hostname || "").trim().toLowerCase();
    const slug = String(body.slug || "");
    if (!hostname || !(await getInvite(env, slug))) return json({ error: "hostname and valid slug required" }, 400);
    await env.DB.prepare("INSERT OR REPLACE INTO domains (hostname, slug) VALUES (?, ?)")
      .bind(hostname, slug).run();
    return json({ ok: true, hostname, slug });
  }
  if (request.method === "GET" && url.pathname === "/api/admin/domains") {
    const { results } = await env.DB.prepare("SELECT hostname, slug, created_at FROM domains").all();
    return json({ domains: results });
  }

  return json({ error: "Not found" }, 404);
}

/* ────────────────────────────────────────────────────────────
   Couple dashboard: /dash/<slug>?key=<dash_key>
   ──────────────────────────────────────────────────────────── */

async function serveDashboard(request, env, url) {
  const match = url.pathname.match(/^\/dash\/([a-z0-9-]+)(\/rsvps\.csv)?$/);
  if (!match) return new Response("Not found", { status: 404 });
  const [, slug, wantsCsv] = match;

  const invite = await getInvite(env, slug);
  const key = url.searchParams.get("key") || "";
  if (!invite || !key || key !== invite.dash_key) {
    return new Response("Not found", { status: 404 });
  }

  const [{ results: rsvps }, { results: wishes }, { results: guests }] = await Promise.all([
    env.DB.prepare("SELECT name, attending, party_size, message, guest_code, created_at FROM rsvps WHERE slug = ? ORDER BY id DESC").bind(slug).all(),
    env.DB.prepare("SELECT who, message, created_at FROM wishes WHERE slug = ? ORDER BY id DESC LIMIT 200").bind(slug).all(),
    env.DB.prepare("SELECT code, name_en, name_km, name_slug FROM guests WHERE slug = ? ORDER BY name_en").bind(slug).all(),
  ]);

  if (wantsCsv) {
    const csvEsc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = ["name,attending,party_size,message,created_at"];
    for (const r of rsvps) {
      lines.push([csvEsc(r.name), r.attending ? "yes" : "no", r.party_size, csvEsc(r.message), r.created_at].join(","));
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-rsvps.csv"`,
      },
    });
  }

  const config = JSON.parse(invite.config_json);
  const accepted = rsvps.filter((r) => r.attending);
  const declined = rsvps.filter((r) => !r.attending);
  const headcount = accepted.reduce((n, r) => n + (r.party_size || 1), 0);
  const inviteUrl = `${url.origin}/i/${slug}/`;
  const qr = (data, size) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;

  const guestLink = (g) => g.name_slug ? `${inviteUrl}${g.name_slug}` : `${inviteUrl}?g=${g.code}`;
  const guestRows = guests.map((g) => `
      <tr>
        <td>${esc(g.name_en)}${g.name_km ? `<br><span class="km">${esc(g.name_km)}</span>` : ""}</td>
        <td><code>${esc(guestLink(g))}</code></td>
        <td><button onclick="navigator.clipboard.writeText('${esc(guestLink(g))}');this.textContent='✓'">Copy</button>
            <a href="${qr(guestLink(g), 300)}" target="_blank">QR</a></td>
      </tr>`).join("");

  const rsvpRows = rsvps.map((r) => `
      <tr class="${r.attending ? "yes" : "no"}">
        <td>${esc(r.name)}</td>
        <td>${r.attending ? "✅ Accepts" : "🙏 Declines"}</td>
        <td>${r.attending ? r.party_size : "—"}</td>
        <td>${esc(r.message ?? "")}</td>
        <td class="dim">${esc((r.created_at || "").slice(0, 16))}</td>
      </tr>`).join("");

  const wishItems = wishes.map((w) => `
      <div class="wish"><p>${esc(w.message)}</p><div class="who">— ${esc(w.who)}</div></div>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(config.coupleA)} &amp; ${esc(config.coupleB)} — Wedding dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;400;500&family=Noto+Sans+Khmer:wght@400&display=swap" rel="stylesheet">
<style>
  :root{--ink:#37505e;--sub:#728a97;--deep:#7fa8c2;--page:#f3f8fb;--line:#d6e3ec;}
  *{box-sizing:border-box}body{margin:0;font-family:'Jost',sans-serif;background:var(--page);color:var(--ink);}
  .km{font-family:'Noto Sans Khmer',sans-serif;color:var(--sub);font-size:13px;}
  .wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px;}
  h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:34px;margin:0 0 4px;}
  h2{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:24px;margin:40px 0 14px;}
  .sub{color:var(--sub);margin-bottom:26px;}
  .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;}
  .tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;text-align:center;}
  .tile .n{font-family:'Cormorant Garamond',serif;font-size:36px;color:var(--deep);}
  .tile .l{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--sub);}
  .sharebox{display:flex;gap:18px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;flex-wrap:wrap;}
  .sharebox img{border-radius:8px;}
  .sharebox code{word-break:break-all;}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;font-size:14px;}
  th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top;}
  th{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub);background:#fafcfe;}
  tr.no td{opacity:.6;}
  td code{font-size:12px;}
  .dim{color:var(--sub);font-size:12px;white-space:nowrap;}
  button{cursor:pointer;border:1px solid var(--deep);background:#fff;color:var(--deep);border-radius:100px;padding:4px 12px;font-family:inherit;}
  a{color:var(--deep);}
  .wish{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px;}
  .wish p{margin:0 0 6px;}
  .wish .who{color:var(--sub);font-size:13px;}
  .empty{color:var(--sub);font-style:italic;}
  .scroll{overflow-x:auto;}
</style></head><body><div class="wrap">
  <h1>${esc(config.coupleA)} &amp; ${esc(config.coupleB)}</h1>
  <div class="sub">${esc(config.dateDisplay || config.dateISO || "")} · ${esc(config.venueName || "")}</div>

  <div class="tiles">
    <div class="tile"><div class="n">${headcount}</div><div class="l">Guests coming</div></div>
    <div class="tile"><div class="n">${accepted.length}</div><div class="l">Accepted</div></div>
    <div class="tile"><div class="n">${declined.length}</div><div class="l">Declined</div></div>
    <div class="tile"><div class="n">${wishes.length}</div><div class="l">Wishes</div></div>
  </div>

  <h2>Share your invitation</h2>
  <div class="sharebox">
    <img src="${qr(inviteUrl, 140)}" width="140" height="140" alt="QR code">
    <div>
      <div><code>${esc(inviteUrl)}</code></div>
      <p style="margin:10px 0 0"><button onclick="navigator.clipboard.writeText('${esc(inviteUrl)}');this.textContent='Copied ✓'">Copy link</button>
      <a href="${qr(inviteUrl, 600)}" target="_blank">Download large QR</a> — perfect for printed cards.</p>
    </div>
  </div>

  <h2>RSVPs (${rsvps.length}) — <a href="/dash/${esc(slug)}/rsvps.csv?key=${esc(key)}">export CSV</a></h2>
  <div class="scroll">
  ${rsvps.length ? `<table><tr><th>Name</th><th>Reply</th><th>Party</th><th>Message</th><th>When</th></tr>${rsvpRows}</table>` : `<p class="empty">No RSVPs yet — share your link!</p>`}
  </div>

  <h2>Personalized guest links (${guests.length})</h2>
  <div class="sharebox" style="display:block">
    <p style="margin:0 0 10px">Upload your guest list — Excel (.xlsx) or CSV, one guest per row:
      <b>column A</b> = name, <b>column B</b> = Khmer name (optional).
      Each guest gets their own link like <code>${esc(inviteUrl)}sok-dara</code>.</p>
    <input type="file" id="guestFile" accept=".xlsx,.xls,.csv">
    <button id="guestUploadBtn">Upload guest list</button>
    <div id="guestUploadMsg" style="margin-top:8px;color:var(--sub);"></div>
  </div>
  <div class="scroll" style="margin-top:14px">
  ${guests.length ? `<table><tr><th>Guest</th><th>Link</th><th></th></tr>${guestRows}</table>` : `<p class="empty">No personalized links yet — upload your guest list above.</p>`}
  </div>

  <h2>Wishes (${wishes.length})</h2>
  ${wishes.length ? wishItems : `<p class="empty">No wishes yet.</p>`}
</div>
<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
<script>
(function () {
  var slug = ${JSON.stringify(slug)};
  var dashKey = ${JSON.stringify(key)};
  var btn = document.getElementById('guestUploadBtn');
  var msg = document.getElementById('guestUploadMsg');

  btn.addEventListener('click', function () {
    var file = document.getElementById('guestFile').files[0];
    if (!file) { msg.textContent = 'Choose a file first.'; return; }
    btn.disabled = true;
    msg.textContent = 'Reading file…';

    var reader = new FileReader();
    reader.onload = function (e) {
      var rows;
      try {
        var wb = XLSX.read(e.target.result, { type: 'array' });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
      } catch (err) {
        btn.disabled = false;
        msg.textContent = 'Could not read that file — please upload .xlsx or .csv';
        return;
      }
      var guests = rows
        .map(function (r) { return { nameEn: String(r[0] || '').trim(), nameKm: String(r[1] || '').trim() }; })
        .filter(function (g) { return g.nameEn && !/^(name|guest|no\\.?|#)$/i.test(g.nameEn); });
      if (!guests.length) { btn.disabled = false; msg.textContent = 'No names found in column A.'; return; }

      msg.textContent = 'Uploading ' + guests.length + ' guests…';
      fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Dash-Key': dashKey },
        body: JSON.stringify({ slug: slug, guests: guests }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) throw new Error(d.error || 'Upload failed');
          msg.textContent = 'Added ' + d.guests.length + ' guests — reloading…';
          location.reload();
        })
        .catch(function (err) { btn.disabled = false; msg.textContent = err.message; });
    };
    reader.readAsArrayBuffer(file);
  });
})();
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* ────────────────────────────────────────────────────────────
   Stripe signature verification
   ──────────────────────────────────────────────────────────── */

async function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("="))
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const computedSig = [...new Uint8Array(signatureBytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedSig === expectedSig;
}
