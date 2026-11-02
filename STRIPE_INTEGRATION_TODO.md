# Stripe embedded Checkout — values to replace

This is the $35 job estimate on `/estimate`. Checkout stays in `mode=payment` with the existing `price_data` line item. The form is embedded on theflipfixer.com instead of a redirect to hosted Checkout.

Replace these before the form can take a real card:

| Placeholder | Where | Replace with |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Server env (Vercel) | Secret key from the Styles by Design Stripe account. Unchanged from the previous checkout. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Client env (Vercel, Vite) | Publishable key from the same Stripe account. Must be available at build time. |
| `STRIPE_WEBHOOK_SECRET` | Server env | Signing secret for `https://theflipfixer.com/api/stripe/webhook`. |
| `return_url` host | `src/lib/estimate-next.server.ts` | Already `https://theflipfixer.com/estimate/paid?session_id={CHECKOUT_SESSION_ID}` in production. On a preview host it uses that host's origin. |

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
| `line_items[0]` | Existing `price_data`: USD, quantity 1, unit amount from `DETAILED_ESTIMATE_FEE_CENTS` (default 3500) |
| `metadata` / `client_reference_id` | Lead id, unchanged |
| `payment_method_collection` | Omitted. Payment mode does not send it. |
| `success_url` / `cancel_url` | Omitted. The form uses `return_url`. |

The checkout route responds with JSON `{ "ok": true, "client_secret": "...", "return_url": "..." }`.

The page loads `https://js.stripe.com/dahlia/stripe.js` from a script tag in the estimate page head. It is not bundled. The browser calls `stripe.initCheckoutFormSdk({ clientSecret, appearance })`, then `createForm({ layout: "expanded" })`, mounts that form in `#estimate-checkout-form`, and confirms with `loadActions()`.

Appearance uses the site palette: background `#121416`, primary `#f08330`, text `#f3efe8`, font Outfit, radius `12px`, theme `night`.

Fulfillment is unchanged: `checkout.session.completed` (and async payment succeeded) on `/api/stripe/webhook` emails the PDF.

## Setup

1. Put `STRIPE_SECRET_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` on the Vercel project for Production (and Preview if you want the form there).
2. Redeploy so Vite inlines the publishable key.
3. In the Stripe Dashboard, point a webhook at `https://theflipfixer.com/api/stripe/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
4. Register `theflipfixer.com` as a payment-method domain if you want wallets on the embedded form.

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
