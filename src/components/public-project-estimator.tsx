import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { saveLeadDraft } from "@/lib/site";
import {
  PROJECTS, PROJECT_SIZES, SIZE_LABELS, projectSelection,
  type ProjectService, type ProjectSize,
} from "@/lib/public-project-options";

export function PublicProjectEstimator() {
  const [service, setService] = useState<ProjectService>("bathroom");
  const [size, setSize] = useState<ProjectSize>("medium");
  const selection = projectSelection(service, size);
  const project = PROJECTS[service];
  const handOff = () => {
    saveLeadDraft({
      service, scope: size,
      kitchenScope: service === "kitchen" ? size : "none",
      bathroomScope: service === "bathroom" ? size : "none",
      submissionId: undefined,
      message: selection.message,
    });
  };
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
      <img src={project.image} alt={project.alt} width={800} height={450}
        className="h-40 w-full object-cover sm:h-52" />
      <div className="p-5 md:p-8">
        <fieldset>
          <legend className="text-sm font-semibold text-fg">1. Choose your project</legend>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(Object.keys(PROJECTS) as ProjectService[]).map(id => (
              <button key={id} type="button" aria-pressed={service === id}
                onClick={() => setService(id)}
                className={"min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (service === id ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg")}>
                {PROJECTS[id].label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-fg">2. Choose the scope closest to your plans</legend>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {PROJECT_SIZES.map(value => (
              <button key={value} type="button" aria-pressed={size === value}
                onClick={() => setSize(value)} aria-describedby="estimate-scope"
                className={"min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " + (size === value ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg")}>
                {SIZE_LABELS[value]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Choose by the work you want done, not just the room dimensions.</p>
        </fieldset>
        <section id="estimate-scope" aria-live="polite" aria-atomic="true"
          className="mt-6 rounded-xl border border-primary/40 bg-bg p-5">
          <p className="text-sm font-semibold text-primary">{selection.title}</p>
          <p className="mt-2 text-sm text-fg">{selection.includes}</p>
          <p className="mt-1 text-sm text-muted">{selection.note}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">The Flip Fixer planning range</p>
          <p className="mt-2 font-display text-3xl text-fg tabular-nums sm:text-4xl">{selection.rangeText}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">A planning estimate, not a quote. Final scope, materials, site conditions and any specialist work determine your price.</p>
        </section>
        <Link to="/contact" search={{ service, side: "interior" }} onClick={handOff}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-center font-semibold text-primary-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          Request an on-site estimate
        </Link>
        <p className="mt-2 text-center text-xs text-muted">Your project choices carry into the inquiry. No contact details needed to explore prices.</p>
      </div>
    </div>
  );
}
