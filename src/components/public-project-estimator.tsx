import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { adjustedCrewDays, planningEstimate, publicEstimateLeadMessage, CREW_DAY_RATE } from "@/lib/public-pricing";
import { saveLeadDraft, type ServiceId } from "@/lib/site";

const SERVICES = ["Kitchen remodeling", "Bathroom remodeling", "Flooring", "Interior painting", "Exterior painting", "Handyman / make-ready", "Outdoor work"] as const;
const SIZES = ["Small", "Medium", "Large"] as const;
type Size = typeof SIZES[number];
const SIZE_HINTS: Record<Size,string> = {
  Small: "A limited area or simpler project",
  Medium: "A typical room or moderate scope",
  Large: "A larger area or more extensive work",
};
const RATE = CREW_DAY_RATE;
const SERVICE_IDS: Record<(typeof SERVICES)[number], ServiceId> = {
  "Kitchen remodeling": "kitchen",
  "Bathroom remodeling": "bathroom",
  "Flooring": "flooring",
  "Interior painting": "paint",
  "Exterior painting": "paint",
  "Handyman / make-ready": "make-ready",
  "Outdoor work": "outdoor",
};
function currency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function readyToCalculate(...checks: boolean[]): boolean { return checks.every(Boolean); }
export function PublicProjectEstimator() {
  const [service, setService] = useState<(typeof SERVICES)[number]>("Bathroom remodeling");
  const [size, setSize] = useState<Size>("Medium");
  const [days, setDays] = useState("");
  const [materials, setMaterials] = useState("");
  const [other, setOther] = useState("");
  const validDays = days.trim() !== "" && Number.isFinite(Number(days)) && Number(days) > 0;
  const validMaterials = materials.trim() !== "" && Number.isFinite(Number(materials)) && Number(materials) >= 0;
  const validOther = other.trim() === "" || (Number.isFinite(Number(other)) && Number(other) >= 0);
  const crewDays = validDays ? adjustedCrewDays(Number(days)) : 0;
  const estimate = readyToCalculate(validDays, validMaterials, validOther) ? planningEstimate({ baseCrewDays: Number(days), materialsAtCost: Number(materials), otherProjectCosts: Number(other || 0) }) : 0;
  const ready = validDays && validMaterials && validOther;
  const serviceId = SERVICE_IDS[service];
  const handOff = () => {
    saveLeadDraft({
      service: serviceId,
      scope: size.toLowerCase(),
      submissionId: undefined,
      message: ready
        ? publicEstimateLeadMessage({
            service, size, baseCrewDays: Number(days), materialsAtCost: Number(materials), otherProjectCosts: Number(other || 0),
          })
        : "I'd like an on-site estimate for " + service.toLowerCase() + " (" + size.toLowerCase() + " scope). I have not entered project quantities yet.",
    });
  };
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project planning tool</p>
      <h2 className="mt-2 font-display text-2xl text-fg">What are you planning?</h2>
      <label className="mt-6 block text-sm font-semibold text-fg" htmlFor="estimate-service">Project type</label>
      <select id="estimate-service" value={service} onChange={e => setService(e.target.value as typeof service)} className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-fg">
        {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      <p className="mt-6 text-sm font-semibold text-fg">Project size</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {SIZES.map(s => <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={`rounded-lg border p-3 text-sm font-semibold ${size === s ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg"}`}>{s}</button>)}
      </div>
      <p className="mt-2 text-sm text-muted">{SIZE_HINTS[size]}. Size does not determine price without a defined scope.</p>
      <p className="mt-6 text-sm text-muted">For now, enter rough project quantities. We are validating the original price lists before enabling automatic size-based prices.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-fg">Base crew days
          <input type="number" inputMode="decimal" min="0.5" step="0.5" value={days} onChange={e => setDays(e.target.value)} placeholder="e.g. 4" className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-fg" />
        </label>
        <label className="text-sm font-semibold text-fg">Materials at cost ($)
          <input type="number" inputMode="decimal" min="0" step="1" value={materials} onChange={e => setMaterials(e.target.value)} placeholder="e.g. 2500" className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-fg" />
        </label>
        <label className="text-sm font-semibold text-fg">Other costs ($)
          <input type="number" inputMode="decimal" min="0" step="1" value={other} onChange={e => setOther(e.target.value)} placeholder="Optional" className="mt-2 w-full rounded-lg border border-border bg-bg p-3 text-fg" />
        </label>
      </div>
      <p className="mt-3 text-xs text-muted">Crew: two people at $650 per crew day. One additional day for each complete four-day block. Include sourcing, purchasing, subcontractors, disposal and other allowances in the quantities where applicable. No standard material markup.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg p-5">
          <p className="text-sm font-semibold text-fg">Typical San Antonio retail</p>
          <p className="mt-3 text-lg text-muted">Benchmark pending verification</p>
          <p className="mt-2 text-xs text-muted">We will not invent competitor prices or advertise unverified savings.</p>
        </div>
        <div className="rounded-xl border border-primary/40 bg-bg p-5">
          <p className="text-sm font-semibold text-fg">The Flip Fixer estimate</p>
          <p className="mt-3 font-display text-3xl text-fg" aria-live="polite">{ready ? currency(estimate) : "Enter quantities"}</p>
          <p className="mt-2 text-xs text-muted">{ready ? `${crewDays} crew days × ${currency(RATE)} plus entered costs` : "Requires crew days and estimated materials"}</p>
        </div>
      </div>
      <p className="mt-4 text-sm text-muted">Illustrative planning estimate only, not a quote, offer or guaranteed price. Site conditions, selections and actual scope can change the final amount.</p>
      <Link to="/contact" search={{ service: serviceId, side: "interior" }} onClick={handOff} className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg">Request an on-site estimate</Link>
    </div>
  );
}
