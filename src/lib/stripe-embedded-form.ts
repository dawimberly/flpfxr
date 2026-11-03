/** Site colors and type from src/styles.css. Embedded Checkout does not support appearance rules. */
export const STRIPE_FORM_APPEARANCE = {
  theme: "night" as const,
  inputs: "spaced" as const,
  labels: "above" as const,
  variables: {
    colorPrimary: "#f08330",
    colorBackground: "#121416",
    colorText: "#f3efe8",
    colorTextSecondary: "#a8a29a",
    colorDanger: "#e05d4d",
    fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px",
  },
};

type ConfirmEvent = unknown;

type CheckoutForm = {
  mount: (container: HTMLElement) => void;
  unmount?: () => void;
  on: (event: "confirm", handler: (event: ConfirmEvent) => void) => void;
};

type CheckoutSdk = {
  createForm: (options: { layout: "expanded" }) => CheckoutForm;
  loadActions: () => Promise<{
    type: string;
    actions?: { confirm: (options: { formConfirmEvent: ConfirmEvent }) => Promise<unknown> };
  }>;
};

type StripeJs = (publishableKey: string) => {
  initCheckoutFormSdk: (options: {
    clientSecret: string;
    appearance: typeof STRIPE_FORM_APPEARANCE;
  }) => CheckoutSdk;
};

declare global {
  interface Window {
    Stripe?: StripeJs;
  }
}

export function publishableKey(): string {
  const value = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  return typeof value === "string" ? value.trim() : "";
}

/** Mounts the embedded Checkout form loaded from js.stripe.com. Returns an unmount function. */
export async function mountEmbeddedCheckout(args: {
  publishableKey: string;
  clientSecret: string;
  container: HTMLElement;
}): Promise<() => void> {
  const Stripe = window.Stripe;
  if (!Stripe) throw new Error("Stripe.js is not loaded");
  const checkout = Stripe(args.publishableKey).initCheckoutFormSdk({
    clientSecret: args.clientSecret,
    appearance: STRIPE_FORM_APPEARANCE,
  });
  const form = checkout.createForm({ layout: "expanded" });
  form.mount(args.container);
  const loaded = await checkout.loadActions();
  if (loaded.type === "success" && loaded.actions) {
    const actions = loaded.actions;
    form.on("confirm", (event) => {
      void actions.confirm({ formConfirmEvent: event }).catch(() => {
        /* The form shows Stripe's own error. */
      });
    });
  }
  return () => form.unmount?.();
}
