# Stripe embedded Checkout — values to replace

This is the $35 job estimate on `/estimate`. Checkout stays in `mode=payment`. When `STRIPE_PRICE_ID` is set, the line item is that catalog price. Otherwise it uses the inline `price_data` $35 line. The form is embedded on theflipfixer.com instead of a redirect to hosted Checkout.

Replace these before the form can take a real card:

| Env var | Where | Replace with |
| --- | --- | --- |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client env (Vercel, Vite) | Publishable key from the same Stripe account as the secret. Must be available at build time. |
| `STRIPE_SECRET_KEY` | Server env (Vercel) | Secret key for that account. |
| `STRIPE_PRICE_ID` | Server env (Vercel) | Catalog price for **Itemized Job Estimate (PDF)**, $35: `price_1UXVMe06qKM9mFyYSupUbGx0`. Leave unset to keep the inline `price_data` line. The price and the secret key must be on the same Stripe account. |
| `STRIPE_WEBHOOK_SECRET` | Server env | Signing secret for the webhook below. |

If either key is missing, the paid button tells the visitor to send a free inquiry or call. The inquiry path does not need Stripe.

## Configured parameters

`POST /v1/checkout/sessions` with `Stripe-Version: 2026-03-25.dahlia`.

| Parameter | Value |
| --- | --- |
| `mode` | `payment` |
| `ui_mode` | `form` |
| `return_url` | `{origin}/estimate/paid?session_id={CHECKOUT_SESSION_ID}` |
| `billing_address_collection` | `auto` |
| `phone_number_collection[enabled]` | `false` |
| `automatic_tax[enabled]` | `false` |
| `submit_type` | `auto` |
| `integration_identifier` | `custom_embedded_web_0001` |
| `line_items[0]` | When `STRIPE_PRICE_ID` is set: `{ price: STRIPE_PRICE_ID, quantity: 1 }`. Otherwise `price_data`: USD, quantity 1, unit amount from `DETAILED_ESTIMATE_FEE_CENTS` (default 3500) |
| `metadata` / `client_reference_id` | Lead id, unchanged |
| `payment_method_collection` | Omitted. Payment mode does not send it. |
| `success_url` / `cancel_url` | Omitted. The form uses `return_url`. |

The checkout route responds with JSON `{ "ok": true, "client_secret": "...", "return_url": "..." }`.

The page loads `https://js.stripe.com/dahlia/stripe.js` from a script tag in the estimate page head. It is not bundled. The browser calls `stripe.initCheckoutFormSdk({ clientSecret, appearance })`, then `createForm({ layout: "expanded" })`, mounts that form in `#estimate-checkout-form`, and confirms with `loadActions()`.

Appearance uses the site palette: background `#121416`, primary `#f08330`, text `#f3efe8`, font Outfit, radius `12px`, theme `night`.

Fulfillment is unchanged. Stripe sends `checkout.session.completed` to `https://theflipfixer.com/api/stripe/webhook`, and that handler emails the PDF. Also subscribe `checkout.session.async_payment_succeeded` on that same endpoint.

## Setup

1. Put these on the Vercel project for Production (and Preview if you want the form there): `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
2. Set `STRIPE_PRICE_ID` to `price_1UXVMe06qKM9mFyYSupUbGx0` only on the Stripe account that owns that price.
3. Redeploy so Vite inlines the publishable key.
4. In the Stripe Dashboard, point a webhook at `https://theflipfixer.com/api/stripe/webhook` for `checkout.session.completed`.
5. Register `theflipfixer.com` as a payment-method domain if you want wallets on the embedded form.

## Test cards

Use a test-mode key. Any future expiry, any CVC, any postal code.

| Scenario | Card |
| --- | --- |
| Payment succeeds | 4242424242424242 |
| Payment requires 3DS authentication | 4000002500003155 |
| Payment is declined | 4000000000009995 |

After a successful test payment, the browser should land on `/estimate/paid?session_id=cs_...` and the webhook should email the estimate.

## Next steps

- Confirm a test payment in the Stripe Dashboard, then the return page and the emailed PDF.
- Turn on live keys only after that test payment succeeds.
- Wallets need the domain registered in test and live mode.

## Links

- https://support.stripe.com
- https://docs.stripe.com/mcp
- https://docs.stripe.com/checkout/form/quickstart
- https://docs.stripe.com/testing#cards
