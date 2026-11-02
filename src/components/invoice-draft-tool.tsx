import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  createEstimateInvoiceDraft,
  parseUploadedEstimate,
  searchInvoiceLeads,
  type InvoiceLeadMatch,
} from "@/lib/invoice-staff";
import {
  preferredEstimateFile,
  type LineKind,
  type ParsedEstimate,
  type ParsedLine,
} from "@/lib/invoice-parse";

type ReviewLine = ParsedLine & { included: boolean };

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) {
    binary += String.fromCharCode(...bytes.subarray(index, index + size));
  }
  return btoa(binary);
}

export function InvoiceDraftTool() {
  const [parsed, setParsed] = useState<ParsedEstimate | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [deposit, setDeposit] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<InvoiceLeadMatch[]>([]);
  const [lead, setLead] = useState<InvoiceLeadMatch | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{ id: string; status: string; dashboardUrl: string; hostedInvoiceUrl: string | null } | null>(null);

  const loadFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    setDraft(null);
    const names = [...list].map((file) => file.name);
    const chosen = preferredEstimateFile(names);
    const file = [...list].find((item) => item.name === chosen) ?? list[0];
    setBusy("Reading the PDF…");
    try {
      const result = await parseUploadedEstimate({
        data: { filename: file.name, pdfBase64: await fileToBase64(file) },
      });
      const next = result.lines.map((line) => ({ ...line, included: true }));
      if (result.discountCents) {
        next.push({
          id: "discount",
          description: result.discountPercent ? `${result.discountPercent}% discount` : "Discount",
          quantity: 1,
          unit: "LS",
          unitAmountCents: result.discountCents,
          amountCents: result.discountCents,
          kind: "labor",
          option: null,
          included: true,
        });
      }
      setParsed(result);
      setLines(next);
      setDeposit(result.depositPercent === 50);
      if (result.customerName) setQuery(result.customerName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read that PDF.");
    } finally {
      setBusy("");
    }
  };

  const findLeads = async () => {
    setError("");
    setBusy("Searching leads…");
    try {
      setMatches(await searchInvoiceLeads({ data: { query } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search leads.");
    } finally {
      setBusy("");
    }
  };

  const confirm = async () => {
    if (!parsed) return;
    setError("");
    setBusy("Creating a draft…");
    try {
      const result = await createEstimateInvoiceDraft({
        data: {
          estimateNumber: parsed.estimateNumber,
          lines: lines.map((line) => ({
            description: line.description,
            amountCents: Math.round(Number(line.amountCents)),
            kind: line.kind,
            included: line.included,
          })),
          depositPercent: deposit ? 50 : null,
          leadId: lead?.submissionId ?? null,
          stripeCustomerId: stripeCustomerId.trim() || null,
        },
      });
      setDraft(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the draft.");
    } finally {
      setBusy("");
    }
  };

  const includedTotal = lines.filter((line) => line.included).reduce((sum, line) => sum + Number(line.amountCents || 0), 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Staff</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-fg">Draft a Stripe invoice</h1>
        <Link to="/estimator" className="text-sm font-semibold text-primary underline">Back to the estimator</Link>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Upload the contractor copy when you have it. Review the lines, then create a draft. Nothing is emailed.
      </p>
      <label className="mt-6 block text-sm font-semibold text-fg" htmlFor="invoice-pdf">Estimate PDF
        <input
          id="invoice-pdf"
          type="file"
          accept="application/pdf"
          multiple
          className="mt-2 block min-h-11 w-full text-sm"
          onChange={(event) => void loadFiles(event.target.files)}
        />
      </label>
      {busy ? <p className="mt-4 text-sm text-muted">{busy}</p> : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {parsed ? (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl bg-surface p-4 text-sm text-fg shadow-[var(--shadow-border)]">
            <p>Estimate {parsed.estimateNumber ? `#${parsed.estimateNumber}` : "number not found"} · {parsed.copy} copy{parsed.jobLabel ? ` · ${parsed.jobLabel}` : ""}</p>
            <p className="mt-1 text-muted">
              {parsed.customerName ? `PDF name: ${parsed.customerName}. Confirm it against a lead.` : "No usable customer name on the PDF. Match a lead or paste a Stripe customer id."}
            </p>
            {parsed.warnings.map((warning) => <p key={warning} className="mt-1 text-muted">{warning}</p>)}
          </div>
          <div className="overflow-x-auto rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="p-3">Use</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="p-3">
                      <input type="checkbox" checked={line.included} aria-label={`Include ${line.description}`} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, included: event.target.checked } : row))} />
                    </td>
                    <td className="p-3">
                      <input className="min-h-11 w-full rounded-lg border border-border bg-bg px-2" value={line.description} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, description: event.target.value } : row))} />
                      {line.option ? <p className="mt-1 text-xs text-muted">Option {line.option}</p> : null}
                    </td>
                    <td className="p-3 whitespace-nowrap">{line.quantity} {line.unit}</td>
                    <td className="p-3">
                      <input className="min-h-11 w-28 rounded-lg border border-border bg-bg px-2" inputMode="decimal" value={(line.amountCents / 100).toFixed(2)} onChange={(event) => {
                        const cents = Math.round(Number(event.target.value) * 100);
                        if (Number.isFinite(cents)) setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, amountCents: cents } : row));
                      }} />
                    </td>
                    <td className="p-3">
                      <select className="min-h-11 rounded-lg border border-border bg-bg px-2" value={line.kind} onChange={(event) => setLines((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, kind: event.target.value as LineKind } : row))}>
                        <option value="labor">Labor</option>
                        <option value="materials">Materials</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-fg">Included {money(includedTotal)}{deposit ? " before the 50% deposit split" : ""}{lead?.paid ? `. A ${money(lead.feeCents || 3500)} estimate credit will be added because this lead is paid.` : ""}</p>
          <label className="flex min-h-11 items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={deposit} onChange={(event) => setDeposit(event.target.checked)} />
            Create the 50% deposit invoice. The balance stays unbilled.
          </label>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-semibold text-fg" htmlFor="invoice-lead">Lead name, email, or phone
              <input id="invoice-lead" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg px-3" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <Button type="button" className="self-end" onClick={() => void findLeads()}>Find lead</Button>
          </div>
          {matches.length ? (
            <ul className="space-y-2">
              {matches.map((match) => (
                <li key={match.submissionId}>
                  <button type="button" className={`min-h-11 w-full rounded-xl border px-3 text-left text-sm ${lead?.submissionId === match.submissionId ? "border-primary bg-surface" : "border-border bg-bg"}`} onClick={() => setLead(match)}>
                    {match.name} · {match.email || "no email"} · {match.phone} · {match.paid ? "estimate fee paid" : "estimate fee not paid"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="block text-sm font-semibold text-fg" htmlFor="invoice-cus">Or a Stripe customer id
            <input id="invoice-cus" className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg px-3" placeholder="cus_..." value={stripeCustomerId} onChange={(event) => setStripeCustomerId(event.target.value)} />
          </label>
          <Button type="button" onClick={() => void confirm()} disabled={Boolean(busy)}>Create draft invoice</Button>
        </div>
      ) : null}
      {draft ? (
        <div className="mt-6 rounded-2xl bg-surface p-4 text-sm text-fg shadow-[var(--shadow-border)]">
          <p className="font-semibold">Draft {draft.id} · {draft.status}. Not sent.</p>
          <p className="mt-2"><a className="font-semibold text-primary underline" href={draft.dashboardUrl}>Open in Stripe</a></p>
          {draft.hostedInvoiceUrl ? <p className="mt-1"><a className="text-primary underline" href={draft.hostedInvoiceUrl}>Hosted invoice page</a></p> : <p className="mt-1 text-muted">The hosted page is available from the draft in Stripe. This tool does not finalize or send it.</p>}
        </div>
      ) : null}
    </div>
  );
}
