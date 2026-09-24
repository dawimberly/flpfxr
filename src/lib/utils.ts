import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function e164Phone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  return digits ? `+${digits}` : "";
}

export function telHref(phone: string) {
  const e164 = e164Phone(phone);
  return e164 ? `tel:${e164}` : "tel:";
}

export function smsHref(phone: string) {
  const e164 = e164Phone(phone);
  return e164 ? `sms:${e164}` : "sms:";
}

export function formatUsdRange(min: number, max: number) {
  const fmt = (n: number) =>
    n >= 1000
      ? `$${Math.round(n / 1000)}k`
      : `$${n.toLocaleString("en-US")}`;
  return `${fmt(min)} – ${fmt(max)}`;
}

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function qtyLabel(value: number, unit: string) {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${unit}`;
}
