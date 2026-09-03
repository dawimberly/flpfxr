/** Click-to-call helpers for iOS/Android PWAs and WebViews. */

export function androidDialIntentHref(telHref: string): string {
  const rest = telHref.replace(/^tel:/i, "");
  return `intent:${rest}#Intent;scheme=tel;action=android.intent.action.DIAL;end`;
}

export function isAndroidWebView(userAgent: string): boolean {
  return /Android/i.test(userAgent) && /; wv\)/i.test(userAgent);
}

export function dialUrlForUserAgent(telHref: string, userAgent: string): string {
  if (isAndroidWebView(userAgent)) return androidDialIntentHref(telHref);
  return telHref;
}

export type HrefLocation = { href: string };

export type DialWindow = {
  location: HrefLocation;
  self?: unknown;
  top?: { location: HrefLocation } | null;
};

export function assignDialLocation(win: DialWindow, href: string): void {
  try {
    if (win.top && win.self && win.top !== win.self) {
      win.top.location.href = href;
      return;
    }
  } catch {
    // Cross-origin iframe: fall through to this frame.
  }
  win.location.href = href;
}

export function shouldInterceptDialClick(event: {
  defaultPrevented?: boolean;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): boolean {
  if (event.defaultPrevented) return false;
  if (event.button != null && event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  return true;
}
