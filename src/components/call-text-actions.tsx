import { MessageSquare, Phone } from "lucide-react";
import { CallLink } from "@/components/call-link";
import { TextLink } from "@/components/text-link";
import { Button } from "@/components/ui/button";
import type { LinkLocation } from "@/lib/google-ads";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function CallTextActions({
  className,
  stacked = false,
  linkLocation = "other",
}: {
  className?: string;
  stacked?: boolean;
  linkLocation?: LinkLocation;
}) {
  return (
    <div
      className={cn(
        "flex gap-3",
        stacked ? "flex-col" : "flex-col sm:flex-row sm:items-center",
        className,
      )}
    >
      <Button asChild size="lg">
        <CallLink linkLocation={linkLocation}>
          <Phone className="size-4" />
          Call {SITE.phoneDisplay}
        </CallLink>
      </Button>
      <Button asChild size="lg" variant="outline">
        <TextLink linkLocation={linkLocation}>
          <MessageSquare className="size-4" />
          Text {SITE.phoneDisplay}
        </TextLink>
      </Button>
    </div>
  );
}
