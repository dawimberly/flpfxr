import { useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_PROJECT_INPUTS, PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS,
  COUNTER_MATERIALS, SHOWER_MATERIALS, projectScope, presetAreas, parseSqft, scopeAreaError,
  type ExteriorCoats, type ProjectInputs, type ScopeAreas,
} from "@/lib/public-estimate-options";
import {
  projectPlanningEstimate, projectEstimateLeadMessage, parseAllowance, formatEstimateRange,
  PRELIMINARY_ESTIMATE_WORDING, SMALL_PIECE_SQFT,
} from "@/lib/public-pricing";
import { saveLeadDraft, type ServiceId } from "@/lib/site";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-bg p-3 text-fg";
const money = (n: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(n);
const serviceId = (id: ProjectInputs["service"]): ServiceId =>
  id === "interior-paint" || id === "exterior-paint" ? "paint" : id === "custom" ? "make-ready" : id;
const STONE_NOTE = "Discounted stone remnants may be available — visit our stone yard with Jon to choose.";

export function PublicProjectEstimator() {
  const [inputs, setInputs] = useState<ProjectInputs>(DEFAULT_PROJECT_INPUTS);
  const [areas, setAreas] = useState(() => presetAreas(DEFAULT_PROJECT_INPUTS.service, DEFAULT_PROJECT_INPUTS.size));
  const [delivery, setDelivery] = useState("");
  const [specialist, setSpecialist] = useState("");
  const floorParsed = parseSqft(areas.floor);
  const showerParsed = parseSqft(areas.shower);
  const counterParsed = parseSqft(areas.counter);
  const roomParsed = parseSqft(areas.room);
  const parseError = floorParsed.error || showerParsed.error || counterParsed.error || roomParsed.error;
  const areaPayload: ScopeAreas = inputs.service === "bathroom"
    ? { floorSqft: floorParsed.value, showerSqft: showerParsed.value }
    : inputs.service === "kitchen"
    ? { floorSqft: floorParsed.value, counterSqft: counterParsed.value }
    : inputs.service === "flooring" || inputs.service === "interior-paint" || inputs.service === "exterior-paint"
    ? { roomSqft: roomParsed.value }
    : {};
  const areaError = parseError ?? scopeAreaError(inputs.service, areaPayload);
  const scope = projectScope(inputs.service, inputs.size, areaPayload);
  const deliveryValue = parseAllowance(scope ? delivery : "");
  const specialistValue = parseAllowance(scope ? specialist : "");
  const valid = !deliveryValue.error && !specialistValue.error && !areaError;
  const current: ProjectInputs | null = valid ? {
    ...inputs, ...areaPayload, delivery: deliveryValue.value!, specialist: specialistValue.value!,
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
  const showStoneNote = inputs.service === "kitchen" || inputs.service === "bathroom";
  const remnantLabel = Boolean(estimate?.remnantStone && scope && scope.shower <= SMALL_PIECE_SQFT);
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project planning estimate</p>
      <h2 className="mt-2 font-display text-2xl text-fg">What are you planning?</h2>
      <label className="mt-6 block text-sm font-semibold text-fg" htmlFor="estimate-service">Project type</label>
      <select id="estimate-service" value={inputs.service} onChange={e => {
        const service = e.target.value as ProjectInputs["service"];
        // Material change drops the previous surface. Stone price is calculated; nothing is typed for it.
        setAreas(presetAreas(service, inputs.size));
        setInputs(prev => ({ ...prev, service, floor: service === "bathroom" ? "tile" : "lvp" }));
      }} className={fieldClass}>
        {PROJECT_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {scope ? <>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-fg">Quick pick</legend>
          <p className="mt-1 text-xs text-muted">Fills the areas below. You can change them.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PROJECT_SIZES.map(size => <button key={size} type="button" aria-pressed={inputs.size === size}
              onClick={() => { patch("size", size); setAreas(presetAreas(inputs.service, size)); }}
              className={`min-h-11 rounded-lg border p-3 text-sm font-semibold ${inputs.size === size ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg"}`}>{size}</button>)}
          </div>
        </fieldset>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {inputs.service === "bathroom" || inputs.service === "kitchen" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-floor-sqft">{inputs.service === "bathroom" ? "Bathroom floor (sq ft)" : "Kitchen floor (sq ft)"}
            <input id="estimate-floor-sqft" type="text" inputMode="decimal" value={areas.floor}
              aria-invalid={Boolean(floorParsed.error) || Boolean(areaError && /floor/i.test(areaError))}
              onChange={e => setAreas(prev => ({ ...prev, floor: e.target.value }))} className={fieldClass} />
          </label> : null}
          {inputs.service === "bathroom" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-shower-sqft">Shower or tub surround (sq ft, optional)
            <input id="estimate-shower-sqft" type="text" inputMode="decimal" value={areas.shower} placeholder="Blank uses the example"
              aria-invalid={Boolean(showerParsed.error) || Boolean(areaError && /surround/i.test(areaError))}
              onChange={e => setAreas(prev => ({ ...prev, shower: e.target.value }))} className={fieldClass} />
          </label> : null}
          {inputs.service === "kitchen" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-counter-sqft">Countertops (sq ft, optional)
            <input id="estimate-counter-sqft" type="text" inputMode="decimal" value={areas.counter} placeholder="Blank uses the example"
              aria-invalid={Boolean(counterParsed.error) || Boolean(areaError && /counter/i.test(areaError))}
              onChange={e => setAreas(prev => ({ ...prev, counter: e.target.value }))} className={fieldClass} />
          </label> : null}
          {inputs.service === "flooring" || inputs.service === "interior-paint" || inputs.service === "exterior-paint" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-room-sqft">{inputs.service === "flooring" ? "Floor area (sq ft)" : "Area to paint (sq ft)"}
            <input id="estimate-room-sqft" type="text" inputMode="decimal" value={areas.room}
              aria-invalid={Boolean(roomParsed.error) || Boolean(areaError && /area/i.test(areaError))}
              onChange={e => setAreas(prev => ({ ...prev, room: e.target.value }))} className={fieldClass} />
          </label> : null}
        </div>
        {areaError ? <p role="alert" data-testid="estimate-area-error" className="mt-3 text-sm text-fg">{areaError}</p> : null}
        <div className="mt-5 rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-fg">Included in this example</h3>
          <p className="mt-2 text-sm text-muted" data-testid="estimate-scope">{scope.summary}</p>
          <p className="mt-2 text-xs text-muted">{scope.exclusions}</p>
          {inputs.service === "bathroom" ? <p className="mt-2 text-xs text-muted">Includes thinset, grout, backer board and waterproofing membrane on tiled surfaces, basic finish demolition, a basic toilet, vanity faucet and shower valve/trim supply, and licensed plumber work for the shower valve.</p> : null}
          {inputs.service === "kitchen" ? <p className="mt-2 text-xs text-muted">Includes basic finish demolition. Stone counters are priced as installed material. A full slab is used unless the counter area is 10 sq ft or less.</p> : null}
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
          {inputs.service === "exterior-paint" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-coats">Finish coats
            <select id="estimate-coats" value={String(inputs.exteriorCoats)} onChange={e => patch("exteriorCoats", Number(e.target.value) as ExteriorCoats)} className={fieldClass}>
              <option value="1">1 coat (standard)</option>
              <option value="2">2 coats</option>
            </select>
          </label> : null}
        </div>
        {showStoneNote ? <p className="mt-4 text-sm text-muted" data-testid="estimate-stone-note">{STONE_NOTE}</p> : null}
        {remnantLabel ? <p className="mt-2 text-sm text-muted">Small-piece remnant pricing, subject to availability.</p> : null}
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
        {current && current.delivery > 0 ? <p className="mt-3 text-sm text-fg" data-testid="estimate-delivery-line">Delivery / shipping allowance: {money(current.delivery)}</p> : null}
        {current && current.specialist > 0 ? <p className="mt-2 text-sm text-fg" data-testid="estimate-specialist-line">Specialist / other allowance: {money(current.specialist)}</p> : null}
        {deliveryValue.error || specialistValue.error ? <p role="alert" className="mt-3 text-sm text-fg">Review the delivery and specialist allowance fields: {deliveryValue.error || specialistValue.error}</p> : null}
        <div className="mt-8 rounded-xl border border-primary/40 bg-bg p-5">
          <h3 className="text-sm font-semibold text-fg">The Flip Fixer planning range</h3>
          <p className="mt-3 break-words font-display text-2xl text-fg sm:text-3xl" data-testid="estimate-total" aria-live="polite" aria-atomic="true">{estimate ? formatEstimateRange(estimate) : (areaError ?? "Enter valid allowances")}</p>
          {estimate ? <p className="mt-2 text-sm text-muted" data-testid="estimate-assumptions">{estimate.scope.assumptions}</p> : null}
          <p className="mt-2 text-sm font-semibold text-fg" data-testid="estimate-disclaimer">{PRELIMINARY_ESTIMATE_WORDING}</p>
          <p className="mt-2 text-sm text-muted">Estimated materials, installation and project support for the example scope. Materials have no markup. The upper end allows for estimating uncertainty.</p>
          {estimate ? <p className="mt-2 text-sm text-muted" data-testid="estimate-support">Project support included: {money(estimate.support)} for protection, routine haul-off/disposal, cleanup and consumables.</p> : null}
          <p className="mt-2 text-xs text-muted">A project minimum applies to labor and materials. Project support is added after that. Delivery, shipping and other specialist work are included only through the allowances entered above. Large or hazardous disposal requires a separate allowance.</p>
        </div>
      </> : <p className="mt-6 text-muted">Tell us about your project so we can assess the work and prepare a preliminary estimate.</p>}
      <p className="mt-5 text-sm font-semibold text-fg">{PRELIMINARY_ESTIMATE_WORDING}</p>
      <p className="mt-2 text-sm text-muted">Based on example quantities and public market pricing where noted. Measurements, selections, site conditions and current supplier costs can change the total.</p>
      <Link to="/contact" search={{ service: serviceId(inputs.service), side: inputs.service === "exterior-paint" ? "exterior" : "interior" }}
        onClick={handOff} aria-disabled={!valid}
        className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg ${valid ? "" : "opacity-60"}`}>Request an on-site estimate</Link>
    </div>
  );
}
