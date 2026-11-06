export function SampleEstimate() {
  return (
    <section data-testid="sample-estimate" aria-labelledby="sample-estimate-heading" className="flex items-start gap-4 rounded-xl border border-border bg-bg p-3">
      <img
        src="/sample-estimate.png"
        alt="Preview of the example estimate PDF"
        width={1100}
        height={899}
        loading="lazy"
        className="h-24 w-auto shrink-0 rounded-md border border-border bg-white"
      />
      <div className="min-w-0">
        <h2 id="sample-estimate-heading" className="text-sm font-semibold text-fg">Example project estimate</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          One combined preliminary total for an example project. Actual project totals vary. Final price is confirmed after an on-site review.
        </p>
        <a href="/sample-estimate.pdf" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">
          View sample estimate PDF
        </a>
      </div>
    </section>
  );
}
