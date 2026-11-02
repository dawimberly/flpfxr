import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_PROJECT_INPUTS, PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS,
  COUNTER_MATERIALS, SHOWER_MATERIALS, VANITY_SIZES, projectScope, presetAreas, parseSqft, scopeAreaError,
  vanityForSize, selectedVanity,
  type ExteriorCoats, type ProjectInputs, type ScopeAreas,
} from "@/lib/public-estimate-options";
import {
  projectPlanningEstimate, projectEstimateLeadMessage, formatEstimateRange,
  PRELIMINARY_ESTIMATE_WORDING,
} from "@/lib/public-pricing";
import { saveLeadDraft, type ServiceId } from "@/lib/site";
import {
  trackEstimateStart, trackEstimateRangeShown, trackEstimateOutOfRange,
  trackEstimateHandoffClick,
} from "@/lib/google-ads";

const fieldClass = "mt-2 min-h-11 w-full rounded-lg border border-border bg-bg p-3 text-fg";
const EXCLUSIONS = "Not included: appliances, layout or plumbing moves, electrical, permits, and hidden damage.";
const serviceId = (id: ProjectInputs["service"]): ServiceId =>
  id === "interior-paint" || id === "exterior-paint" ? "paint" : id === "custom" ? "make-ready" : id;
const sqftText = (n: number) => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};
function sizeText(service: ProjectInputs["service"], scope: NonNullable<ReturnType<typeof projectScope>>) {
  if (service === "bathroom") return `${sqftText(scope.floor)} sq ft floor, ${sqftText(scope.shower)} sq ft shower`;
  if (service === "kitchen") return `${sqftText(scope.floor)} sq ft floor, ${sqftText(scope.counters)} sq ft counters`;
  if (service === "flooring") return `${sqftText(scope.floor)} sq ft`;
  return `${sqftText(scope.wall)} sq ft`;
}
function materialText(inputs: ProjectInputs, scope: NonNullable<ReturnType<typeof projectScope>>) {
  return [
    scope.floor ? FLOOR_MATERIALS.find(m => m.id === inputs.floor)!.label : "",
    inputs.service === "kitchen" ? COUNTER_MATERIALS.find(m => m.id === inputs.counter)!.label : "",
    inputs.service === "bathroom" ? SHOWER_MATERIALS.find(m => m.id === inputs.shower)!.label : "",
    inputs.service === "bathroom" ? selectedVanity(inputs.size, inputs.vanity).label : "",
    inputs.service === "bathroom" ? (inputs.newToilet ? "New toilet" : "Existing toilet") : "",
    scope.wall ? (inputs.prime ? "Primer and paint" : "Paint only") : "",
    inputs.service === "exterior-paint" ? (inputs.exteriorCoats === 2 ? "2 coats" : "1 coat") : "",
  ].filter(Boolean).join(", ");
}
function includedItems(service: ProjectInputs["service"], floor: ProjectInputs["floor"]): string[] {
  if (service === "bathroom") return ["Demolition", floor === "tile" ? "Tile" : "Flooring", "Vanity", "Fixtures", "Install labor"];
  if (service === "kitchen") return ["Demolition", "Cabinets", "Countertops", "Flooring", "Install labor"];
  if (service === "flooring") return ["Flooring", "Install labor"];
  if (service === "interior-paint" || service === "exterior-paint") return ["Paint", "Install labor"];
  return [];
}

export function PublicProjectEstimator() {
  const [inputs, setInputs] = useState<ProjectInputs>(DEFAULT_PROJECT_INPUTS);
  const [areas, setAreas] = useState(() => presetAreas(DEFAULT_PROJECT_INPUTS.service, DEFAULT_PROJECT_INPUTS.size));
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
  const valid = !areaError;
  const current: ProjectInputs | null = valid ? { ...inputs, ...areaPayload } : null;
  // Invalid input never reaches the calculation or handoff.
  const estimate = current ? projectPlanningEstimate(current) : null;
  const summaryRef = useRef<HTMLDivElement>(null);
  const hasScope = Boolean(scope);
  const presets = presetAreas(inputs.service, inputs.size);
  const relevantAreas = inputs.service === "bathroom" ? ["floor", "shower"] as const
    : inputs.service === "kitchen" ? ["floor", "counter"] as const
    : ["room"] as const;
  const customSqft = relevantAreas.some(key => parseSqft(areas[key]).value !== parseSqft(presets[key]).value);
  // Observe the rendered range, including the default, only once it enters the viewport.
  useEffect(() => {
    const node = summaryRef.current;
    if (!node || !valid || !hasScope) return;
    const record = () => trackEstimateRangeShown(inputs, customSqft);
    if (typeof IntersectionObserver === "undefined") { record(); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { record(); observer.disconnect(); }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [inputs, customSqft, valid, hasScope]);
  useEffect(() => {
    if (areaError) trackEstimateOutOfRange(inputs.service);
  }, [areaError, inputs.service]);
  const patch = <K extends keyof ProjectInputs>(key: K, value: ProjectInputs[K]) =>
    setInputs(prev => ({ ...prev, [key]: value }));
  const handOff = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!current) { event.preventDefault(); return; }
    trackEstimateHandoffClick(inputs);
    saveLeadDraft({
      service: serviceId(inputs.service), scope: inputs.size.toLowerCase(), submissionId: undefined,
      message: projectEstimateLeadMessage(current),
      estimate: {
        estimate_service: inputs.service,
        estimate_size: inputs.size,
        estimate_range: estimate ? formatEstimateRange(estimate) : undefined,
      },
    });
  };
  const serviceLabel = PROJECT_SERVICES.find(service => service.id === inputs.service)!.label;
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8"
      onChangeCapture={trackEstimateStart}
      onClickCapture={event => {
        if ((event.target as HTMLElement).closest("button")) trackEstimateStart();
      }}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Project planning estimate</p>
      <h2 className="mt-2 font-display text-2xl text-fg">What are you planning?</h2>
      <label className="mt-6 block text-sm font-semibold text-fg" htmlFor="estimate-service">Project type</label>
      <select id="estimate-service" value={inputs.service} onChange={e => {
        const service = e.target.value as ProjectInputs["service"];
        setAreas(presetAreas(service, inputs.size));
        setInputs(prev => ({
          ...prev, service, floor: service === "bathroom" ? "tile" : "lvp",
          vanity: service === "bathroom" ? vanityForSize(prev.size) : prev.vanity,
        }));
      }} className={fieldClass}>
        {PROJECT_SERVICES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      {scope ? <>
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-fg">Starting point</legend>
          <p className="mt-1 text-xs text-muted">Fills the square footage. Then choose the materials.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {PROJECT_SIZES.map(size => <button key={size} type="button" aria-pressed={inputs.size === size}
              onClick={() => {
                setInputs(prev => ({ ...prev, size, vanity: prev.service === "bathroom" ? vanityForSize(size) : prev.vanity }));
                setAreas(presetAreas(inputs.service, size));
              }}
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
            <input id="estimate-shower-sqft" type="text" inputMode="decimal" value={areas.shower} placeholder="Optional"
              aria-invalid={Boolean(showerParsed.error) || Boolean(areaError && /surround/i.test(areaError))}
              onChange={e => setAreas(prev => ({ ...prev, shower: e.target.value }))} className={fieldClass} />
          </label> : null}
          {inputs.service === "kitchen" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-counter-sqft">Countertops (sq ft, optional)
            <input id="estimate-counter-sqft" type="text" inputMode="decimal" value={areas.counter} placeholder="Optional"
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {scope.floor ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-floor">Flooring type
            <select id="estimate-floor" value={inputs.floor} onChange={e => patch("floor", e.target.value as ProjectInputs["floor"])} className={fieldClass}>
              {FLOOR_MATERIALS.filter(m => inputs.service === "bathroom" ? m.id === "tile" || m.id === "lvp" : inputs.service === "kitchen" ? m.id !== "carpet" : true).map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "kitchen" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-counter">Countertop type
            <select id="estimate-counter" value={inputs.counter} onChange={e => patch("counter", e.target.value as ProjectInputs["counter"])} className={fieldClass}>
              {COUNTER_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "bathroom" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-vanity">Vanity size
            <select id="estimate-vanity" value={inputs.vanity ?? vanityForSize(inputs.size)} onChange={e => patch("vanity", e.target.value)} className={fieldClass}>
              {VANITY_SIZES.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "bathroom" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-shower">Shower wall
            <select id="estimate-shower" value={inputs.shower} onChange={e => patch("shower", e.target.value as ProjectInputs["shower"])} className={fieldClass}>
              {SHOWER_MATERIALS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label> : null}
          {inputs.service === "bathroom" ? <label className="text-sm font-semibold text-fg" htmlFor="estimate-toilet">New toilet
            <select id="estimate-toilet" value={inputs.newToilet ? "yes" : "no"} onChange={e => patch("newToilet", e.target.value === "yes")} className={fieldClass}>
              <option value="yes">Yes, include a basic toilet</option>
              <option value="no">No, keep the existing toilet</option>
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
        {estimate && scope ? <div ref={summaryRef} className="mt-8 rounded-xl border border-primary/40 bg-bg p-5" data-testid="estimate-summary">
          <p className="text-sm font-semibold text-fg" data-testid="estimate-project">{serviceLabel}</p>
          <p className="mt-2 text-sm text-fg" data-testid="estimate-size">{sizeText(inputs.service, scope)}</p>
          <p className="mt-2 text-sm text-fg" data-testid="estimate-materials">{materialText(inputs, scope)}</p>
          <h3 className="mt-4 text-sm font-semibold text-fg">What's included</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg" data-testid="estimate-included">
            {includedItems(inputs.service, inputs.floor).map(item => <li key={item}>{item}</li>)}
          </ul>
          <p className="mt-4 break-words font-display text-2xl text-fg sm:text-3xl" data-testid="estimate-total" aria-live="polite" aria-atomic="true">{formatEstimateRange(estimate)}</p>
          <p className="mt-2 text-sm font-semibold text-fg" data-testid="estimate-disclaimer">{PRELIMINARY_ESTIMATE_WORDING}</p>
          <p className="mt-2 text-sm text-muted" data-testid="estimate-exclusions">{EXCLUSIONS}</p>
        </div> : null}
      </> : <p className="mt-6 text-muted">Tell us about your project so we can assess the work and prepare a preliminary estimate.</p>}
      <p className="mt-5 text-sm font-semibold text-fg">{PRELIMINARY_ESTIMATE_WORDING}</p>
      <Link to="/contact" search={{ service: serviceId(inputs.service), side: inputs.service === "exterior-paint" ? "exterior" : "interior", origin: "estimate" }}
        onClick={handOff} aria-disabled={!valid}
        className={`mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg ${valid ? "" : "opacity-60"}`}>Request an on-site estimate</Link>
    </div>
  );
}
