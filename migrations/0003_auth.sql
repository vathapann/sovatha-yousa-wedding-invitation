-- Telegram-OTP login for the customer portal (my.html / edit.html).
-- Adds a linked Telegram chat per order, plus short-lived OTP + throttle tables.

ALTER TABLE orders ADD COLUMN tg_chat_id TEXT;   -- customer's Telegram chat id, once linked
ALTER TABLE orders ADD COLUMN link_token TEXT;   -- one-time token for the t.me deep link

CREATE TABLE IF NOT EXISTS auth_otps (
  order_id   TEXT PRIMARY KEY,   -- one active OTP per order (a new request overwrites)
  code_hash  TEXT NOT NULL,      -- SHA-256(orderId:otp:secret) — never store the plain code
  expires_at INTEGER NOT NULL,   -- epoch seconds
  attempts   INTEGER NOT NULL DEFAULT 0,
  sent_at    INTEGER NOT NULL    -- epoch seconds, for resend throttling
);

CREATE TABLE IF NOT EXISTS auth_throttle (
  key      TEXT PRIMARY KEY,     -- e.g. "start:ip:1.2.3.4" or "otp:ord_abc"
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL      -- epoch seconds when the window resets
);

CREATE INDEX IF NOT EXISTS idx_orders_link_token ON orders(link_token);
