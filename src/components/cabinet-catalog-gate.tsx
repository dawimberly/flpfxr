import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATALOG_PROJECT_TYPES,
  type CatalogProjectId,
} from "@/lib/catalog-gate";
import { captureAdClickIds } from "@/lib/formsubmit";
import { isValidSubmissionId, leadEmailProblem, parseLeadApiResponse } from "@/lib/lead-delivery";
import { trackContactFormSubmit } from "@/lib/google-ads";
import { CATALOG_BROWSE_NOTE, CATALOG_CTA, DESIGNER_MATERIALS_NOTE } from "@/lib/offer-copy";

function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeCatalogUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.searchParams.get("ref") !== "flipfixer") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function CabinetCatalogGate({
  defaultProject = "kitchen",
  compact = false,
}: {
  defaultProject?: CatalogProjectId;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [projectType, setProjectType] = useState<CatalogProjectId>(defaultProject);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submissionId = useRef<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const phone = String(form.get("phone") ?? "");
    const email = String(form.get("email") ?? "");
    if (name.trim().length < 2) {
      setError("Add your name so we know who to call back.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setError("Add a 10-digit phone so we can call you back.");
      return;
    }
    const emailProblem = leadEmailProblem(email);
    if (emailProblem) {
      setError(emailProblem);
      return;
    }
    if (!submissionId.current || !isValidSubmissionId(submissionId.current)) submissionId.current = newSubmissionId();
    form.set("submissionId", submissionId.current);
    form.set("project_type", projectType);
    for (const [key, value] of Object.entries(captureAdClickIds())) if (value) form.set(key, value);
    setSubmitting(true);
    try {
      const res = await fetch("/api/catalog-signup", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      const parsed = parseLeadApiResponse(res.status, body);
      if (parsed.ok && parsed.discarded) {
        setError("Could not open the catalog. Call or text instead.");
        return;
      }
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      const redirectUrl = safeCatalogUrl(body && typeof body === "object" ? (body as { redirectUrl?: unknown }).redirectUrl : null);
      if (!redirectUrl) {
        setError("We saved your request, but the catalog link was not ready. Call us and we will send it.");
        return;
      }
      trackContactFormSubmit({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
      }, parsed.submissionId || submissionId.current);
      window.location.assign(redirectUrl);
    } catch {
      setError("Could not open the catalog. Call or text instead.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={compact ? "" : "rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)] md:p-8"}>
      <p className="text-sm leading-relaxed text-muted">{DESIGNER_MATERIALS_NOTE} {CATALOG_BROWSE_NOTE}</p>
      <Button type="button" className="mt-4 h-auto min-h-11 w-full whitespace-normal text-center" onClick={() => setOpen(true)}>
        {CATALOG_CTA}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(96vw,32rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>{CATALOG_CTA}</DialogTitle>
            <DialogDescription>
              Leave your name, phone, and email. We save the lead, then open the catalog. {CATALOG_BROWSE_NOTE}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 px-5 pb-6 sm:px-6" onSubmit={onSubmit} noValidate>
            <div className="hidden" aria-hidden="true">
              <label htmlFor="catalog-company">Company</label>
              <input id="catalog-company" name="_honey" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-name">Name *</Label>
              <Input id="catalog-name" name="name" required autoComplete="name" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-phone">Phone *</Label>
              <Input id="catalog-phone" name="phone" type="tel" required autoComplete="tel" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-email">Email *</Label>
              <Input id="catalog-email" name="email" type="email" required autoComplete="email" className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-project">Project type *</Label>
              <select
                id="catalog-project"
                value={projectType}
                onChange={(event) => setProjectType(event.target.value as CatalogProjectId)}
                className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-base text-fg"
              >
                {CATALOG_PROJECT_TYPES.map((row) => (
                  <option key={row.id} value={row.id}>{row.label}</option>
                ))}
              </select>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="h-auto min-h-11 w-full whitespace-normal" disabled={submitting}>
              {submitting ? "Opening…" : "Open the catalog"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
