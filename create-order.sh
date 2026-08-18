#!/usr/bin/env bash
# Create an owner/test order directly in D1, skipping the KHQR payment step.
# The order lands in status 'paid' — same state as right after a slip approval —
# so the normal flow continues from /intake.html?session_id=<orderId>.
#
# Usage:
#   ./create-order.sh                             # classic-elegance, remote DB
#   ./create-order.sh royal-khmer                 # another template
#   ./create-order.sh classic-elegance --local    # local dev DB (wrangler dev)
set -euo pipefail

TEMPLATE_ID="${1:-classic-elegance}"
TARGET="${2:---remote}"
EMAIL="sovathapann@gmail.com"

if ! grep -q "\"id\": \"$TEMPLATE_ID\"" marketplace/templates.json; then
  echo "Unknown template '$TEMPLATE_ID'. Available:"
  grep -o '"id": "[^"]*"' marketplace/templates.json
  exit 1
fi

ORDER_ID="ord_$(openssl rand -hex 6)"

npx wrangler d1 execute DB "$TARGET" --command \
  "INSERT INTO orders (id, email, template_id, agreed_at, status) VALUES ('$ORDER_ID', '$EMAIL', '$TEMPLATE_ID', datetime('now'), 'paid')" \
  > /dev/null

echo "Created paid order: $ORDER_ID  (template: $TEMPLATE_ID, db: ${TARGET#--})"
echo "Next step: /intake.html?session_id=$ORDER_ID"
