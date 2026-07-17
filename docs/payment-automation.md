# Payment automation — accelerating KHQR reconciliation

The store accepts payment via a **static KHQR image + slip upload**, which the owner
verifies manually. This doc tracks the plan to make that faster, in three phases.

Context: the owner is an **individual** (no Ministry-of-Commerce business registration),
so the full **ABA PayWay** online gateway is **not** available — it requires a registered
company + ABA business account. The phases below all work for an individual.

---

## Phase 1 — one-tap approval + payment reference ✅ DONE

Keeps a human in the loop but reduces each verification to a single tap.

**What it does**
- When a customer uploads a slip, the Worker sends the **slip photo** to the owner's
  Telegram with inline **✅ Approve / ❌ Reject** buttons (no more copy-pasting a `curl`).
- Tapping **Approve** sets the order to `paid`; **Reject** sends it back to
  `pending_payment`. Only the configured owner chat (`TELEGRAM_CHAT_ID`) can decide.
- Each order shows a short **payment reference** (`MK-XXXXXX`, derived from the order id)
  on `pay.html`, echoed in the Telegram caption, so a slip is easy to match to an order.

**Where it lives**
- `src/worker.js`:
  - `sendSlipForReview()` — `sendPhoto` with the inline keyboard (called from `uploadSlip`).
  - `handlePaymentDecision()` — handles `callback_query` in `tgWebhook` (auth-checked).
  - `markOrderPaid()` / `rejectOrderPayment()` — shared by the button and the admin API.
  - `paymentRef()` — the `MK-XXXXXX` reference.
- `marketplace/pay.html` — shows the reference to the customer.

**Requirements**: the Telegram bot must be set up and the webhook registered (see the
main setup notes) — the buttons arrive via the same `/api/tg-webhook` endpoint.

---

## Phase 2 — OCR-assist the slip (semi-automatic)

Goal: pre-read the slip so obvious matches can be auto-approved or the amount pre-checked.
Still not cryptographic proof — an **assist**, not authority.

**Steps**
1. **Pick an OCR path.** Options, cheapest first:
   - Client-side OCR in the browser (e.g. Tesseract.js) before upload — zero server cost,
     but heavier page and weaker on Khmer/bank fonts.
   - A server call from the Worker to an OCR API (Google Vision, AWS Textract, or a
     Workers AI image-to-text model). More reliable, small per-slip cost.
2. **Extract fields**: amount, date/time, receiver name/account, and any reference/txn id.
3. **Store + compare.** Add columns to `slips` (or a new `slip_ocr` table): `ocr_amount`,
   `ocr_ref`, `ocr_raw`, `ocr_confidence`. Compare `ocr_amount` to the template price and
   `ocr_ref` to the order's `MK-XXXXXX`.
4. **Surface the result in the Telegram caption**: e.g. `Amount read: $49.00 ✓ (matches)`
   or `⚠️ amount mismatch: read $29.00, expected $49.00`. Keep the Approve/Reject buttons.
5. **Optional auto-approve** when amount matches **and** OCR confidence is high **and** the
   reference matches — otherwise fall back to the manual buttons from Phase 1.

**Caveats**: slip layouts vary by bank app and language; screenshots are forgeable. Never
auto-approve on OCR alone without the amount + reference both matching, and keep a manual
override. This phase mainly removes typing/second-guessing, not the trust problem.

---

## Phase 3 — Bakong dynamic KHQR + auto-verify (fully automatic) 🎯

The real goal: drop the slip entirely. Generate a **dynamic KHQR per order** and poll
**Bakong Open API** to confirm that exact QR was paid, then flip the order to `paid`
automatically. Works for an **individual** Bakong account.

**How it works**
1. **Register** for a Bakong developer token: <https://api-bakong.nbc.gov.kh/register/>
   (or an RBK relay token — see the geo caveat).
2. **Generate a dynamic KHQR per order** with the exact amount + a unique bill number /
   reference (reuse `MK-XXXXXX`), using a KHQR builder (the format is a TLV string + CRC;
   SDKs exist for PHP/Python/Go/JS — port the string builder into the Worker, it's small).
3. **Compute the `md5`** of the QR string and store it on the order
   (`ALTER TABLE orders ADD COLUMN khqr_md5 TEXT;`).
4. **Poll** `check_transaction_by_md5` until Bakong reports the transaction as completed,
   then call `markOrderPaid()`. Poll from:
   - the customer's `pay.html` (client polls a Worker endpoint that proxies the check), or
   - a scheduled Worker (cron trigger) sweeping `slip_uploaded`/`pending_payment` orders.
5. On success, no slip is needed — remove/skip the upload step for KHQR payments.

**⚠️ Critical architecture caveat — Cloudflare Workers run outside Cambodia**
The production `check_transaction` endpoint is **only callable from servers located in
Cambodia**; calls from elsewhere are blocked. Cloudflare Workers are global, so a direct
call will likely be geo-blocked. Options:
- Use an **RBK relay token** (<https://bakongrelay.com/>) which is documented to work
  without the geo restriction — call it from the Worker.
- Or run the verification from a **small proxy on a Cambodia-hosted VPS** (or a Cambodian
  cron box) that the Worker calls.
- Test everything against the **SIT** environment first: <https://sit-api-bakong.nbc.gov.kh/>.

**New pieces to build**
- KHQR string builder + `md5` (Worker util).
- `orders.khqr_md5` column; store at order creation or first visit to `pay.html`.
- `/api/pay/khqr?order=…` → returns the dynamic QR (image or payload) for that order.
- `/api/pay/check?order=…` → proxies `check_transaction_by_md5`; on success → `markOrderPaid`.
- (Optional) a cron-triggered sweep for unattended confirmation.

**Eligibility to confirm**: verify an individual Bakong account can obtain a **production**
developer token (SIT is open; production may need review). If not, the RBK relay path is
the individual-friendly fallback.

---

## References
- Bakong Open API — Implementation Guideline (PDF):
  <https://bakong.nbc.gov.kh/download/KHQR/integration/Bakong%20Open%20API%20Document.pdf>
- Bakong QR Payment Integration (PDF):
  <https://bakong.nbc.gov.kh/download/QR%20Payment%20Integration.pdf>
- KHQR SDK (generate + check_transaction): <https://github.com/bsthen/bakong-khqr>
- Developer token: <https://api-bakong.nbc.gov.kh/register/> · RBK relay: <https://bakongrelay.com/>
- SIT (sandbox): <https://sit-api-bakong.nbc.gov.kh/>
- ABA PayWay (business only, for reference): <https://www.payway.com.kh/>
