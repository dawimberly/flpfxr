import { useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_PROJECT_INPUTS, PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS,
  COUNTER_MATERIALS, SHOWER_MATERIALS, projectScope, type ProjectInputs,
} from "@/lib/public-estimate-options";
import { projectPlanningEstimate, projectEstimateLeadMessage, needsFabrication, parseAllowance, formatEstimateRange } from "@/lib/public-pricing";
import { saveLeadDraft, type ServiceId } from "@/lib/site";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-bg p-3 text-fg";
const money = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(n);
const serviceId = (id: ProjectInputs["service"]): ServiceId =>
  id === "interior-paint" || id === "exterior-paint" ? "paint" : id === "custom" ? "make-ready" : id;

export function PublicProjectEstimator() {
  const [inputs, setInputs] = useState<ProjectInputs>(DEFAULT_PROJECT_INPUTS);
  const [delivery, setDelivery] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [fabrication, setFabrication] = useState("");
  const scope = projectScope(inputs.service, inputs.size);
  const requiredFabrication = needsFabrication(inputs);
  const deliveryValue = parseAllowance(scope ? delivery : "");
  const specialistValue = parseAllowance(scope ? specialist : "");
  const fabricationValue = parseAllowance(requiredFabrication ? fabrication : "", requiredFabrication);
  const valid = !deliveryValue.error && !specialistValue.error && !fabricationValue.error;
  const current: ProjectInputs | null = valid ? {
    ...inputs, delivery: deliveryValue.value!, specialist: specialistValue.value!,
    fabrication: requiredFabrication ? fabricationValue.value : null,
  } : null;
  // Invalid input never reaches the calculation or handoff.
  const estimate = current ? projectPlanningEstimate(current) : null;
  const patch = <K extends keyof ProjectInputs>(key: K, value: ProjectInputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }));
  const handOff = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!current) { event.preventDefault(); return; }
    saveLeadDraft({
      service: serviceId(inputs.service), scope: inputs.size.toLowerCase(), submissionId: undefined,
      message: projectEstimateLeadMessage(current),
    });
  };
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project planning estimate</p>
      <h2 className="mt-2 font-display text-2xl text-fg">What are you planning?</h2>
      <label className="mt-6 block text-sm font-semibold text-fg" htmlFor="estimate-service">Project type</label>
      <select id="estimate-service" value={inputs.service} onChange={e => {
        const service = e.target.value as ProjectInputs["service"];
        setInputs(prev => ({ ...prev, service, floor: service === "bathroom" ? "tile" : "lvp" }));
        setFabrication("");
      }} className={fieldClass}>
        {PROJECT_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {scope ? <>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-fg">Project size</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PROJECT_SIZES.map(size => <button key={size} type="button" aria-pressed={inputs.size === size}
              onClick={() => patch("size", size)}
              className={`min-h-11 rounded-lg border p-3 text-sm font-semibold ${inputs.size === size ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg"}`}>{size}</button>)}
          </div>
        </fieldset>
        <div className="mt-5 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-fg">Included in this example</h3>
          <p className="mt-2 text-sm text-muted" data-testid="estimate-scope">{scope.summary}</p>
          <p className="mt-2 text-xs text-muted">{scope.exclusions}</p>
          {inputs.service === "bathroom" ? <p className="mt-2 text-xs text-muted">Includes thinset, grout, backer board, waterproofing membrane, basic finish demolition, and a basic toilet, vanity faucet and shower valve/trim allowance.</p> : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {scope.floor ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-floor">Flooring material
            <select id="estimate-floor" value={inputs.floor} onChange={e => patch("floor", e.target.value as ProjectInputs["floor"])} className={fieldClass}>
              {FLOOR_MATERIALS.filter(m => inputs.service === "bathroom" ? m.id === "tile" || m.id === "lvp" : inputs.service === "kitchen" ? m.id !== "carpet" : true).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "kitchen" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-counter">Countertop material
            <select id="estimate-counter" value={inputs.counter} onChange={e => patch("counter", e.target.value as ProjectInputs["counter"])} className={fieldClass}>
              {COUNTER_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "bathroom" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-shower">Shower surround material
            <select id="estimate-shower" value={inputs.shower} onChange={e => patch("shower", e.target.value as ProjectInputs["shower"])} className={fieldClass}>
              {SHOWER_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {scope.wall ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-paint">Paint preparation
            <select id="estimate-paint" value={inputs.prime ? "prime" : "paint"} onChange={e => patch("prime", e.target.value === "prime")} className={fieldClass}>
              <option value="prime">Primer and paint</option>
              <option value="paint">Paint only on prepared surfaces</option>
            </select>
          </label> : null}
        </div>
        {requiredFabrication ? <div className="mt-5 rounded-xl border border-border p-4">
          <label className="text-sm font-semibold text-fg" htmlFor="estimate-fabrication">Fabrication / installation allowance ($)
            <input id="estimate-fabrication" type="text" inputMode="decimal" required
              aria-invalid={Boolean(fabricationValue.error)} aria-describedby="fabrication-help fabrication-error"
              value={fabrication} onChange={e => setFabrication(e.target.value)} placeholder="Required for selected stone" className={fieldClass} />
          </label>
          <p id="fabrication-help" className="mt-2 text-xs text-muted">Required for the selected stone. Enter fabrication and installation only; material cost is already included and crew installation is not added for that surface. Supplier confirmation required.</p>
          <p id="fabrication-error" role={fabricationValue.error ? "alert" : undefined} className="mt-2 text-sm text-fg">{fabricationValue.error}</p>
        </div> : null}
        <details className="mt-6 rounded-xl border border-border p-4">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-fg">Delivery and additional allowances</summary>
          <p className="mt-3 text-xs text-muted">Add known delivery, shipping, subcontractor or other costs once. Blank optional fields add no allowance. Supplier and specialist costs must be confirmed.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-fg" htmlFor="estimate-delivery">Delivery / shipping allowance ($)
                <input id="estimate-delivery" type="text" inputMode="decimal"
                  aria-invalid={Boolean(deliveryValue.error)} aria-describedby="delivery-error"
                  value={delivery} onChange={e => setDelivery(e.target.value)} placeholder="Optional" className={fieldClass} />
              </label>
              <p id="delivery-error" role={deliveryValue.error ? "alert" : undefined} className="mt-2 text-sm text-fg">{deliveryValue.error}</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-fg" htmlFor="estimate-specialist">Specialist / other allowance ($)
                <input id="estimate-specialist" type="text" inputMode="decimal"
                  aria-invalid={Boolean(specialistValue.error)} aria-describedby="specialist-error"
                  value={specialist} onChange={e => setSpecialist(e.target.value)} placeholder="Optional" className={fieldClass} />
              </label>
              <p id="specialist-error" role={specialistValue.error ? "alert" : undefined} className="mt-2 text-sm text-fg">{specialistValue.error}</p>
            </div>
          </div>
        </details>
        {deliveryValue.error || specialistValue.error ? <p role="alert" className="mt-3 text-sm text-fg">Review the delivery and specialist allowance fields: {deliveryValue.error || specialistValue.error}</p> : null}
        <div className="mt-8 rounded-xl border border-primary/40 bg-bg p-5">
          <h3 className="text-sm font-semibold text-fg">The Flip Fixer planning range</h3>
          <p className="mt-3 break-words font-display text-2xl text-fg sm:text-3xl" data-testid="estimate-total" aria-live="polite" aria-atomic="true">{estimate ? formatEstimateRange(estimate) : "Enter valid allowances"}</p>
          <p className="mt-2 text-sm text-muted">Estimated materials, installation and project support for the example scope. Materials have no markup. The upper end allows for estimating uncertainty.</p>
          {estimate ? <p className="mt-2 text-sm text-muted" data-testid="estimate-support">Project support included: {money(estimate.support)} for protection, routine haul-off/disposal, cleanup and consumables.</p> : null}
          <p className="mt-2 text-xs text-muted">A project minimum applies. Delivery, shipping, fabrication and other specialist work are included only through the allowances entered above. Large or hazardous disposal requires a separate allowance.</p>
        </div>
      </> : <p className="mt-6 text-muted">Tell us about your project so we can assess the work and prepare a preliminary estimate.</p>}
      <p className="mt-5 text-sm font-semibold text-fg">This is an estimate, not a quote.</p>
      <p className="mt-2 text-sm text-muted">Based on example quantities and provisional reference pricing. Measurements, selections, site conditions and current supplier costs can change the total. Final scope and pricing require an on-site assessment.</p>
      <Link to="/contact" search={{ service: serviceId(inputs.service), side: inputs.service === "exterior-paint" ? "exterior" : "interior" }}
        onClick={handOff} aria-disabled={!valid}
        className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg ${valid ? "" : "opacity-60"}`}>Request an on-site estimate</Link>
    </div>
  );
}
