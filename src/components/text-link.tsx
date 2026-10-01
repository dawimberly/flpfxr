import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { trackSmsClick, type LinkLocation } from "@/lib/google-ads";
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

export const TextLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<"a"> & { linkLocation?: LinkLocation }
>(function TextLink(
  {
    children,
    className,
    onClick,
    href: _href,
    target: _target,
    linkLocation = "other",
    ...props
  },
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
        trackSmsClick(linkLocation);
        onClick?.(e);
        if (!e.defaultPrevented) openMessages(e);
      }}
    >
      {children}
    </a>
  );
});
