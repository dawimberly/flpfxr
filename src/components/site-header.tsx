import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      className={cn("h-10 w-10 shrink-0", className)}
    />
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-bg/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          to="/"
          className="flex items-center gap-3 text-fg"
          onClick={() => setOpen(false)}
        >
          <LogoMark />
          <span className="leading-none">
            <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-muted">
              The
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
              Flip Fixer
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const active =
              item.to === "/"
                ? pathname === "/"
                : pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium uppercase tracking-wide transition-[color,background-color] duration-150",
                  active
                    ? "text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="icon" className="sm:hidden" aria-label={`Call ${SITE.phoneDisplay}`}>
            <CallLink>
              <Phone className="size-5" />
            </CallLink>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <CallLink>
              <Phone className="size-4" />
              {SITE.phoneDisplay}
            </CallLink>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/contact">Contact</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-bg">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="mt-8 flex flex-col gap-1">
                {NAV.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="rounded-lg px-3 py-3 text-lg font-medium text-fg hover:bg-surface-2"
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <div className="mt-auto flex flex-col gap-3 pt-8">
                <Button asChild size="lg">
                  <Link to="/contact" onClick={() => setOpen(false)}>
                    Contact
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <CallLink>
                    <Phone className="size-4" />
                    Call {SITE.phoneDisplay}
                  </CallLink>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
