import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { trackPhoneClick, type LinkLocation } from "@/lib/google-ads";
import { SITE } from "@/lib/site";
import { telHref } from "@/lib/utils";

function dialHref() {
  return telHref(SITE.phone);
}

function openDialer(e: MouseEvent<HTMLAnchorElement>) {
  try {
    if (window.top && window.top !== window.self) {
      e.preventDefault();
      window.top.location.href = dialHref();
    }
  } catch {
    // Cross-origin iframe: target="_top" on the anchor still works.
  }
}

export const CallLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<"a"> & { linkLocation?: LinkLocation }
>(function CallLink(
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
      href={dialHref()}
      target="_top"
      className={className}
      onClick={(e) => {
        trackPhoneClick(linkLocation);
        onClick?.(e);
        if (!e.defaultPrevented) openDialer(e);
      }}
    >
      {children}
    </a>
  );
});
