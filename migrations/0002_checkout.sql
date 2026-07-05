-- Manual ABA/KHQR checkout flow, access codes, invitee-name URLs, custom domains.
-- Order lifecycle becomes:
--   pending_payment → slip_uploaded → paid → intake_received → published

ALTER TABLE orders ADD COLUMN phone TEXT;
ALTER TABLE orders ADD COLUMN wedding_date TEXT;
ALTER TABLE orders ADD COLUMN agreed_at TEXT;
ALTER TABLE orders ADD COLUMN access_code TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_access ON orders(access_code);

-- Payment slip screenshots (small JPEGs, stored base64; move to R2 if they grow).
CREATE TABLE IF NOT EXISTS slips (
  order_id TEXT PRIMARY KEY REFERENCES orders(id),
  mime TEXT NOT NULL,
  data_b64 TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pretty per-invitee URLs: /i/<slug>/<name_slug> (and /<name_slug> on custom domains).
ALTER TABLE guests ADD COLUMN name_slug TEXT;
CREATE INDEX IF NOT EXISTS idx_guests_nameslug ON guests(slug, name_slug);

-- Custom domain → invitation mapping (owner adds the domain to the Worker
-- routes in the Cloudflare dashboard, then maps it here via the admin API).
CREATE TABLE IF NOT EXISTS domains (
  hostname TEXT PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES invites(slug),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
