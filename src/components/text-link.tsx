import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { trackSmsClick } from "@/lib/google-ads";
import { SITE } from "@/lib/site";
import { smsHref } from "@/lib/utils";

function messageHref() {
  return smsHref(SITE.phone);
}

function openMessages(e: MouseEvent<HTMLAnchorElement>) {
  try {
    if (window.top && window.top !== window.self) {
      e.preventDefault();
      window.top.location.href = messageHref();
    }
  } catch {
    // Cross-origin iframe: target="_top" on the anchor still works.
  }
}

export const TextLink = forwardRef<HTMLAnchorElement, ComponentProps<"a">>(
  function TextLink(
    { children, className, onClick, href: _href, target: _target, ...props },
    ref,
  ) {
    return (
      <a
        {...props}
        ref={ref}
        href={messageHref()}
        target="_top"
        className={className}
        onClick={(e) => {
          trackSmsClick();
          onClick?.(e);
          if (!e.defaultPrevented) openMessages(e);
        }}
      >
        {children}
      </a>
    );
  },
);
