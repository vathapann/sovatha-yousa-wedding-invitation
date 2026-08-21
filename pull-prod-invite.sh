#!/usr/bin/env bash
# Copy a live invitation from production into the LOCAL dev database, so you can
# preview real content while iterating on a template.
#
# Only the local DB is written — production is read-only here. Photos and music
# keep their absolute production URLs, so they load straight from prod and no
# R2 objects need copying.
#
# Usage:
#   ./pull-prod-invite.sh sovatha-yousa
#   ./pull-prod-invite.sh                  # defaults to sovatha-yousa
#
# Then open:  http://localhost:8787/i/<slug>/
set -euo pipefail

SLUG="${1:-sovatha-yousa}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Reading '$SLUG' from production…"
npx wrangler d1 execute DB --remote --command \
  "SELECT i.slug, i.order_id, i.template_id, i.config_json, i.dash_key, i.status,
          o.email, o.phone, o.access_code, o.intake_json, o.wedding_date
   FROM invites i JOIN orders o ON o.id = i.order_id
   WHERE i.slug = '$SLUG'" > "$TMP/remote.txt" 2>&1

python3 - "$TMP/remote.txt" "$TMP/local.sql" <<'PY'
import sys, json, io

raw = io.open(sys.argv[1], encoding='utf-8').read()
try:
    obj, _ = json.JSONDecoder().raw_decode(raw[raw.index('['):])
    row = obj[0]['results'][0]
except Exception:
    sys.exit("Could not read that invitation from production. Is the slug right?")

def q(v):
    """SQLite string literal, or NULL."""
    if v is None:
        return 'NULL'
    return "'" + str(v).replace("'", "''") + "'"

sql = f"""
INSERT OR REPLACE INTO orders
  (id, email, phone, template_id, wedding_date, agreed_at, status, access_code, intake_json)
VALUES
  ({q(row['order_id'])}, {q(row['email'])}, {q(row['phone'])}, {q(row['template_id'])},
   {q(row['wedding_date'])}, datetime('now'), 'published', {q(row['access_code'])},
   {q(row['intake_json'])});

INSERT OR REPLACE INTO invites
  (slug, order_id, template_id, config_json, dash_key, status)
VALUES
  ({q(row['slug'])}, {q(row['order_id'])}, {q(row['template_id'])},
   {q(row['config_json'])}, {q(row['dash_key'])}, {q(row['status'])});
"""
io.open(sys.argv[2], 'w', encoding='utf-8').write(sql)

cfg = json.loads(row['config_json'])
print(f"  template : {row['template_id']}")
print(f"  gallery  : {len(cfg.get('gallery') or [])} photos")
print(f"  schedule : {len(cfg.get('schedule') or [])} rows")
print(f"  music    : {'yes' if cfg.get('musicUrl') else 'no'}")
print(f"  code     : {row['access_code']}")
PY

echo "Writing into the local dev database…"
npx wrangler d1 execute DB --local --file "$TMP/local.sql" > /dev/null

echo
echo "Done. Preview it at:"
echo "  http://localhost:8787/i/$SLUG/"
echo
echo "Note: this replaces any local invitation already using that slug."
