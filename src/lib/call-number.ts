import { useSyncExternalStore } from "react";
import { SITE } from "@/lib/site";
import { formatPhoneDisplay, telHref } from "@/lib/utils";

export type CallNumber = { display: string; href: string };

const SITE_NUMBER: CallNumber = {
  display: SITE.phoneDisplay,
  href: telHref(SITE.phone),
};

let current = SITE_NUMBER;
const listeners = new Set<() => void>();

/**
 * gtag `phone_conversion_callback`. Google only calls it for visitors who came
 * from an ad, with a forwarding number that rings SITE.phone and lets Ads count
 * calls of 60s+. Forwarding numbers cannot receive texts, so only Call links
 * read this — Text links stay on SITE.phone.
 */
export function setForwardingNumber(formattedNumber: string, mobileNumber: string) {
  const dial = mobileNumber || formattedNumber;
  if (!dial) return;
  current = {
    display: formattedNumber || formatPhoneDisplay(dial),
    href: telHref(dial),
  };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCallNumber(): CallNumber {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => SITE_NUMBER,
  );
}
