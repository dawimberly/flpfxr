import { useMemo, useState } from "react";
import { Bookmark, NotebookTabs, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatSavedAt, searchEstimateLog } from "@/lib/estimate-log";
import { useEstimatorStore } from "@/lib/estimator-store";
import { money } from "@/lib/utils";

export function EstimateLogButton({
  compact = false,
  icon = false,
}: {
  compact?: boolean;
  icon?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const count = useEstimatorStore((s) => s.log.length);

  return (
    <>
      <Button
        type="button"
        variant={icon || compact ? "outline" : "ghost"}
        size={icon ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        aria-label="Estimate log"
        className={icon ? "relative" : undefined}
      >
        <NotebookTabs className="size-4" />
        {icon ? null : compact ? "Log" : "Estimate log"}
        {icon && count > 0 ? <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" /> : null}
        {!icon && count > 0 ? <span className="font-mono text-xs tabular-nums">{count}</span> : null}
      </Button>
      <EstimateLogDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SaveEstimateButton({
  compact = false,
  icon = false,
  tone = "rail",
}: {
  compact?: boolean;
  icon?: boolean;
  tone?: "rail" | "light";
}) {
  const currentSavedId = useEstimatorStore((s) => s.currentSavedId);
  const lastSavedAt = useEstimatorStore((s) => s.lastSavedAt);
  const saveToLog = useEstimatorStore((s) => s.saveToLog);
  const [flash, setFlash] = useState<string | null>(null);

  function save(asNew = false) {
    const record = saveToLog(asNew);
    if (!record) return;
    setFlash(asNew ? "Saved as new" : "Saved to log");
    window.setTimeout(() => setFlash(null), 1800);
  }

  if (tone === "light") {
    return (
      <Button
        type="button"
        variant="outline"
        size={icon ? "icon" : "sm"}
        onClick={() => save(false)}
        aria-label="Save to log"
      >
        <Bookmark className="size-4" />
        {icon ? null : currentSavedId ? "Update log" : "Save"}
      </Button>
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant={compact ? "secondary" : "default"} className="w-full" onClick={() => save(false)}>
        <Bookmark className="size-4" />
        {currentSavedId ? "Update log" : "Save to log"}
      </Button>
      {currentSavedId ? (
        <button
          type="button"
          className="w-full text-center text-xs text-ink-foreground/70 hover:text-ink-foreground"
          onClick={() => save(true)}
        >
          Save as new job
        </button>
      ) : null}
      <p className="text-center text-xs text-ink-foreground/55">
        {flash ?? (lastSavedAt ? `Last saved ${formatSavedAt(lastSavedAt)}` : "Save keeps the job in your log")}
      </p>
    </div>
  );
}

function EstimateLogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const log = useEstimatorStore((s) => s.log);
  const currentSavedId = useEstimatorStore((s) => s.currentSavedId);
  const openSaved = useEstimatorStore((s) => s.openSaved);
  const deleteSaved = useEstimatorStore((s) => s.deleteSaved);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const matches = useMemo(() => searchEstimateLog(query, log), [query, log]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="estimate-log-copy">
        <DialogHeader>
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted uppercase">The file</p>
          <DialogTitle>Estimate log</DialogTitle>
          <DialogDescription id="estimate-log-copy">
            Pull up last week's number before you walk back in.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 pb-5 sm:px-6">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search client, street, job name"
              className="pl-10"
              aria-label="Search estimates"
            />
          </div>
          <div className="mt-4 min-h-0 max-h-[52dvh] overflow-y-auto pr-1">
            {matches.length === 0 ? (
              <p className="rounded-lg bg-wash px-4 py-6 text-sm text-muted">
                {log.length === 0
                  ? "Save a job to the log and it will be waiting when you come back."
                  : "Nothing matches that search."}
              </p>
            ) : (
              <ul className="space-y-2">
                {matches.map((item) => {
                  const current = item.id === currentSavedId;
                  return (
                    <li key={item.id} className="rounded-lg bg-surface p-3 shadow-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-fg">{item.summary.property}</p>
                          <p className="truncate text-sm text-muted">{item.summary.customer}</p>
                          {item.summary.address ? (
                            <p className="truncate text-xs text-muted">{item.summary.address}</p>
                          ) : null}
                          <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                            {formatSavedAt(item.savedAt)} · {item.summary.roomCount}{" "}
                            {item.summary.roomCount === 1 ? "room" : "rooms"}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-sm tabular-nums text-fg">
                          {money(item.summary.grandTotal)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            openSaved(item.id);
                            onOpenChange(false);
                          }}
                        >
                          Open
                        </Button>
                        {pendingDelete === item.id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              deleteSaved(item.id);
                              setPendingDelete(null);
                            }}
                          >
                            Delete for good
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${item.summary.property}`}
                            onClick={() => setPendingDelete(item.id)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        )}
                        {current ? <span className="text-xs text-muted">Open now</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
