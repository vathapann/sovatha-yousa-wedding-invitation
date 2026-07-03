const STRIPE_API = "https://api.stripe.com/v1";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/create-checkout-session") {
      return createCheckoutSession(request, env, url);
    }

    if (request.method === "POST" && url.pathname === "/api/stripe-webhook") {
      return handleStripeWebhook(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

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
    success_url: `${url.origin}/success.html`,
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

async function handleStripeWebhook(request, env) {
  const signatureHeader = request.headers.get("Stripe-Signature") ?? "";
  const rawBody = await request.text();

  const valid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // TODO: trigger fulfillment — e.g. email the couple to collect their
    // names/date/venue, or notify a fulfillment queue. For MVP, purchases
    // are fulfilled manually from the Stripe dashboard + customer email.
    console.log("Paid:", session.customer_details?.email, session.metadata?.templateId);
  }

  return new Response("ok", { status: 200 });
}

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
