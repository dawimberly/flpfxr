import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { useCallNumber } from "@/lib/call-number";
import { trackPhoneClick } from "@/lib/google-ads";

function openDialer(e: MouseEvent<HTMLAnchorElement>, href: string) {
  try {
    if (window.top && window.top !== window.self) {
      e.preventDefault();
      window.top.location.href = href;
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
    const { href } = useCallNumber();
    return (
      <a
        {...props}
        ref={ref}
        href={href}
        target="_top"
        className={className}
        onClick={(e) => {
          trackPhoneClick();
          onClick?.(e);
          if (!e.defaultPrevented) openDialer(e, href);
        }}
      >
        {children}
      </a>
    );
  },
);

/** The number a CallLink dials — the Google forwarding number for ad visitors. */
export function CallNumber() {
  return <>{useCallNumber().display}</>;
}
