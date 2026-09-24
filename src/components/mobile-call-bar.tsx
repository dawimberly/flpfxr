import { Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { SITE } from "@/lib/site";

export function MobileCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
      <div className="grid grid-cols-2 gap-2">
        <CallLink className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-fg active:scale-[0.96]">
          <Phone className="size-4" />
          Call
        </CallLink>
        <Link
          to="/contact"
          className="inline-flex h-12 items-center justify-center rounded-lg border border-primary/70 text-sm font-semibold text-primary active:scale-[0.96]"
        >
          Message
        </Link>
      </div>
    </div>
  );
}
