import { Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";

export function MobileCallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:hidden">
      <CallLink className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-fg active:scale-[0.96]">
        <Phone className="size-4" />
        Call for a free estimate
      </CallLink>
    </div>
  );
}
