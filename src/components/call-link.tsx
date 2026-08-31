import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { SITE } from "@/lib/site";
import { telHref } from "@/lib/utils";

const HREF = telHref(SITE.phone);

function openDialer(e: MouseEvent<HTMLAnchorElement>) {
  try {
    if (window.top && window.top !== window.self) {
      e.preventDefault();
      window.top.location.href = HREF;
    }
  } catch {
    // Cross-origin iframe: target="_top" on the anchor still works.
  }
}

export const CallLink = forwardRef<HTMLAnchorElement, ComponentProps<"a">>(
  function CallLink(
    { children, className, onClick, href: _href, target: _target, ...props },
    ref,
  ) {
    return (
      <a
        {...props}
        ref={ref}
        href={HREF}
        target="_top"
        className={className}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) openDialer(e);
        }}
      >
        {children}
      </a>
    );
  },
);
