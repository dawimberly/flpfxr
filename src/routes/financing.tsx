import { createFileRoute, notFound } from "@tanstack/react-router";
import { FINANCING_COPY, PUBLICATION_FLAGS } from "@/lib/publication-flags";

export const Route = createFileRoute("/financing")({
  beforeLoad: () => {
    if (!PUBLICATION_FLAGS.financingApproved) throw notFound();
  },
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: () => <p className="mx-auto max-w-3xl px-4 py-16 text-fg">{FINANCING_COPY}</p>,
});
