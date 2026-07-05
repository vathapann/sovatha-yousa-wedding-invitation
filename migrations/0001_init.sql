-- Core schema: orders (Stripe purchases), invites (published couple sites),
-- guests (personalized links), rsvps, wishes.

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                 -- Stripe checkout session id
  email TEXT,
  template_id TEXT NOT NULL,
  amount_total INTEGER,
  currency TEXT,
  status TEXT NOT NULL DEFAULT 'paid', -- paid | intake_received | published
  intake_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invites (
  slug TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id),
  template_id TEXT NOT NULL,
  config_json TEXT NOT NULL,
  dash_key TEXT NOT NULL,              -- secret for the couple's dashboard
  status TEXT NOT NULL DEFAULT 'live', -- draft | live
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guests (
  code TEXT PRIMARY KEY,               -- short code used in ?g=
  slug TEXT NOT NULL REFERENCES invites(slug),
  name_en TEXT NOT NULL,
  name_km TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guests_slug ON guests(slug);

CREATE TABLE IF NOT EXISTS rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  guest_code TEXT,
  name TEXT NOT NULL,
  attending INTEGER NOT NULL,          -- 1 accept, 0 decline
  party_size INTEGER NOT NULL DEFAULT 1,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rsvps_slug ON rsvps(slug);

CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL,
  who TEXT NOT NULL,
  message TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_wishes_slug ON wishes(slug);
