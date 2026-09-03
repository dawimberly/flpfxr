import { useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { OpToggle } from "@/components/op-toggle";
import { SaveEstimateButton } from "@/components/estimate-log";
import { downloadEstimatePdf, type EstimatePdfKind } from "@/lib/estimate-pdf";
import { useEstimatorStore } from "@/lib/estimator-store";
import type { JobEstimate } from "@/lib/estimator";
import { cn, money, qtyLabel } from "@/lib/utils";

export function DownloadPdfButtons({
  job,
  compact = false,
}: {
  job: JobEstimate;
  compact?: boolean;
}) {
  const client = useEstimatorStore((s) => s.client);
  const [busy, setBusy] = useState<EstimatePdfKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDownload(kind: EstimatePdfKind) {
    setBusy(kind);
    setError(null);
    try {
      await downloadEstimatePdf(job, client, kind);
    } catch {
      setError("Could not build the PDF. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className={cn("flex gap-2", compact ? "min-w-0 shrink-0" : "flex-col")}>
        <Button
          type="button"
          onClick={() => onDownload("contractor")}
          disabled={busy != null}
          size={compact ? "icon" : "default"}
          aria-label="Contractor PDF"
          className={compact ? undefined : "w-full"}
        >
          <FileDown className="size-4" />
          {compact ? null : busy === "contractor" ? "Building…" : "Contractor PDF"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onDownload("customer")}
          disabled={busy != null}
          size={compact ? "icon" : "default"}
          aria-label="Customer copy"
          className={
            compact
              ? undefined
              : "w-full border-ink-foreground/20 bg-ink-foreground/10 text-ink-foreground hover:bg-ink-foreground/15"
          }
        >
          <FileText className="size-4" />
          {compact ? null : busy === "customer" ? "Building PDF…" : "Customer copy"}
        </Button>
      </div>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
    </div>
  );
}

export function EstimateRail({ job, activeRoomId }: { job: JobEstimate; activeRoomId: string }) {
  const laborRate = useEstimatorStore((s) => s.laborRate);
  const opEnabled = useEstimatorStore((s) => s.opEnabled);
  const selectRoom = useEstimatorStore((s) => s.selectRoom);
  const [listMode, setListMode] = useState<"room" | "complete">("complete");
  const active = job.rooms.find((entry) => entry.room.id === activeRoomId) ?? job.rooms[0];
  const shownItems =
    listMode === "complete"
      ? job.completeLineItems
      : (active?.estimate.lineItems ?? []).map((line) => ({
          ...line,
          roomId: active?.room.id ?? "",
          roomLabel: active?.room.label ?? "",
        }));

  return (
    <aside className="min-w-0 max-w-full lg:sticky lg:top-24">
      <div className="rounded-xl bg-ink p-5 text-ink-foreground shadow-border sm:p-6">
        <p className="text-[11px] font-medium tracking-[0.18em] text-ink-foreground/60 uppercase">
          The job
        </p>
        <p className="mt-2 break-all font-display text-4xl font-medium tracking-tight tabular-nums sm:text-5xl">
          {money(job.grandTotal)}
        </p>
        <p className="mt-2 text-sm text-ink-foreground/70">
          {job.rooms.length} {job.rooms.length === 1 ? "room" : "rooms"} · {active?.room.label}{" "}
          {money(active?.estimate.grandTotal ?? 0)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-md bg-ink-foreground/10 px-3 py-3">
            <p className="text-[11px] tracking-wide text-ink-foreground/55 uppercase">Installed</p>
            <p className="mt-1 font-mono text-sm tabular-nums">{money(job.materialsSubtotal)}</p>
          </div>
          <div className="rounded-md bg-ink-foreground/10 px-3 py-3">
            <p className="text-[11px] tracking-wide text-ink-foreground/55 uppercase">
              {opEnabled ? `O&P ${laborRate}%` : "O&P off"}
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums">{money(job.laborSubtotal)}</p>
          </div>
        </div>
        <ul className="mt-5 divide-y divide-ink-foreground/10">
          {job.rooms.map((entry) => {
            const on = entry.room.id === activeRoomId;
            return (
              <li key={entry.room.id}>
                <button
                  type="button"
                  onClick={() => selectRoom(entry.room.id)}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className={cn("truncate text-sm", on ? "text-ink-foreground" : "text-ink-foreground/70")}>
                    {entry.room.label}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular-nums">{money(entry.estimate.grandTotal)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Separator className="my-5 bg-ink-foreground/12" />
        <OpToggle />
        <div className="mt-5 flex flex-col gap-3">
          <SaveEstimateButton />
          <DownloadPdfButtons job={job} />
        </div>
      </div>
      <div className="mt-4 min-w-0 rounded-xl bg-card p-4 shadow-border sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">Line items</p>
          <div className="flex w-fit max-w-full rounded-full bg-surface p-1">
            <button
              type="button"
              onClick={() => setListMode("room")}
              className={cn(
                "h-8 rounded-full px-3 text-xs transition-colors duration-150",
                listMode === "room" ? "bg-ink text-ink-foreground" : "text-muted",
              )}
            >
              This room
            </button>
            <button
              type="button"
              onClick={() => setListMode("complete")}
              className={cn(
                "h-8 rounded-full px-3 text-xs transition-colors duration-150",
                listMode === "complete" ? "bg-ink text-ink-foreground" : "text-muted",
              )}
            >
              Complete list
            </button>
          </div>
        </div>
        {shownItems.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Choose finishes. The number writes itself.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shownItems.map((line, index) => (
              <li key={`${line.roomId}-${line.description}-${index}`} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-fg">{line.description}</p>
                  <p className="font-mono text-xs tabular-nums text-muted">
                    {listMode === "complete" ? `${line.roomLabel} · ` : ""}
                    {qtyLabel(line.quantity, line.unit)} · {money(line.unitCost)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums text-fg">{money(line.lineTotal)}</p>
              </li>
            ))}
          </ul>
        )}
        {job.warnings.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {job.warnings.map((warning) => (
              <li key={warning} className="text-xs text-primary">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
