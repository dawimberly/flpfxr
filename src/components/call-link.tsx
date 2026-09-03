import { forwardRef, type ComponentProps, type MouseEvent } from "react";
import { SITE } from "@/lib/site";
import {
  assignDialLocation,
  dialUrlForUserAgent,
  shouldInterceptDialClick,
} from "@/lib/dialer";
import { cn, telHref } from "@/lib/utils";

const HREF = telHref(SITE.phone);

function openDialer(e: MouseEvent<HTMLAnchorElement>) {
  if (!shouldInterceptDialClick(e)) return;
  e.preventDefault();
  const href = dialUrlForUserAgent(HREF, navigator.userAgent);
  assignDialLocation(window, href);
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
        className={cn("cursor-pointer [touch-action:manipulation]", className)}
        onClick={(e) => {
          onClick?.(e);
          openDialer(e);
        }}
      >
        {children}
      </a>
    );
  },
);
