import { useState, useEffect, useRef, type MouseEvent } from "react";
import { Link } from "@tanstack/react-router";
import {
  PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS,
  COUNTER_MATERIALS, SHOWER_MATERIALS, VANITY_SIZES, projectScope, presetAreas, parseSqft, scopeAreaError,
  vanityForSize, selectedVanity,
  type ExteriorCoats, type ProjectInputs, type ProjectService, type ProjectSize, type ScopeAreas,
} from "@/lib/public-estimate-options";
import {
  projectPlanningEstimate, projectEstimateLeadMessage, formatEstimateRange,
  PRELIMINARY_ESTIMATE_WORDING,
} from "@/lib/public-pricing";
import { SERVICE_AREAS, saveLeadDraft, type ServiceId } from "@/lib/site";
import {
  DEFAULT_ESTIMATE_HEADLINE, ESTIMATE_INTRO, estimateHandoffSearch, estimateLandingUrl,
  estimateTrustLine, headlineFor, inputsFromLanding,
  type EstimateLanding,
} from "@/lib/estimate-landing";
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
const choiceClass = (selected: boolean) =>
  `min-h-11 rounded-lg border px-2 py-2 text-left text-sm font-semibold leading-tight ${selected ? "border-primary bg-primary text-primary-fg" : "border-border bg-bg text-fg"}`;

export function PublicProjectEstimator({
  landing,
  search,
}: {
  landing: EstimateLanding;
  search: Record<string, unknown>;
}) {
  const [explicitService, setExplicitService] = useState(landing.explicitService);
  const [inputs, setInputs] = useState(() => inputsFromLanding(landing));
  const [areas, setAreas] = useState(() => presetAreas(landing.service, landing.size));
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
  const estimate = current ? projectPlanningEstimate(current) : null;
  const summaryRef = useRef<HTMLDivElement>(null);
  const hasScope = Boolean(scope);
  const presets = presetAreas(inputs.service, inputs.size);
  const relevantAreas = inputs.service === "bathroom" ? ["floor", "shower"] as const
    : inputs.service === "kitchen" ? ["floor", "counter"] as const
    : ["room"] as const;
  const customSqft = relevantAreas.some(key => parseSqft(areas[key]).value !== parseSqft(presets[key]).value);
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
  const publish = (service: ProjectService, size: ProjectSize) => {
    setExplicitService(true);
    if (typeof window === "undefined") return;
    const next = estimateLandingUrl(window.location.href, service, size);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== currentUrl) window.history.replaceState(window.history.state, "", next);
  };
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
  const headline = explicitService ? headlineFor(inputs.service) : DEFAULT_ESTIMATE_HEADLINE;
  const handoff = estimateHandoffSearch(search, {
    service: serviceId(inputs.service),
    side: inputs.service === "exterior-paint" ? "exterior" : "interior",
  });
  const trust = estimateTrustLine(SERVICE_AREAS);
  return (
    <div className="mx-auto max-w-3xl px-4 pb-2 pt-3 md:py-20"
      onChangeCapture={trackEstimateStart}
      onClickCapture={event => {
        if ((event.target as HTMLElement).closest("button")) trackEstimateStart();
      }}>
      <div id="estimate-fold">
        <h1 className="font-display text-[1.45rem] font-semibold leading-tight text-fg md:text-5xl">{headline}</h1>
        <p className="mb-2 mt-1.5 text-sm leading-snug text-muted md:mb-8 md:mt-4 md:text-base">{ESTIMATE_INTRO}</p>
        <div className="rounded-2xl bg-surface p-2.5 shadow-[var(--shadow-border)] md:p-8">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-primary md:block">Project planning estimate</p>
          <h2 className="mt-2 hidden font-display text-2xl text-fg md:block">What are you planning?</h2>
          <fieldset className="md:mt-6">
            <legend className="text-sm font-semibold text-fg">Project type</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5 md:mt-2 md:gap-2">
              {PROJECT_SERVICES.map(service => <button key={service.id} type="button" aria-pressed={inputs.service === service.id}
                onClick={() => {
                  setAreas(presetAreas(service.id, inputs.size));
                  setInputs(prev => ({
                    ...prev, service: service.id, floor: service.id === "bathroom" ? "tile" : "lvp",
                    vanity: service.id === "bathroom" ? vanityForSize(inputs.size) : prev.vanity,
                  }));
                  publish(service.id, inputs.size);
                }}
                className={choiceClass(inputs.service === service.id)}>{service.label}</button>)}
            </div>
          </fieldset>
          {scope ? <>
            <fieldset className="mt-2 md:mt-6">
              <legend className="text-sm font-semibold text-fg">Starting point</legend>
              <p className="mt-1 hidden text-xs text-muted md:block">Fills the square footage. Then choose the materials.</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5 md:mt-2 md:gap-2">
                {PROJECT_SIZES.map(size => <button key={size} type="button" aria-pressed={inputs.size === size}
                  onClick={() => {
                    setInputs(prev => ({ ...prev, size, vanity: prev.service === "bathroom" ? vanityForSize(size) : prev.vanity }));
                    setAreas(presetAreas(inputs.service, size));
                    publish(inputs.service, size);
                  }}
                  className={choiceClass(inputs.size === size)}>{size}</button>)}
              </div>
            </fieldset>
            {areaError ? <p role="alert" data-testid="estimate-area-error" className="mt-3 text-sm text-fg">{areaError}</p> : null}
            {estimate && scope ? <div ref={summaryRef} id="estimate-range" className="mt-2 scroll-mb-28 rounded-xl border border-primary/40 bg-bg p-2.5 md:mt-3 md:p-5" data-testid="estimate-summary">
              <p className="text-sm font-semibold text-fg" data-testid="estimate-project">{serviceLabel}</p>
              <p className="mt-0.5 break-words font-display text-xl leading-tight text-fg sm:text-3xl" data-testid="estimate-total" aria-live="polite" aria-atomic="true">{formatEstimateRange(estimate)}</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-fg" data-testid="estimate-disclaimer">{PRELIMINARY_ESTIMATE_WORDING}</p>
            </div> : null}
          </> : <p className="mt-3 text-sm text-muted">Tell us about your project so we can assess the work and prepare a preliminary estimate.</p>}
          <Link to="/contact" search={handoff}
            onClick={handOff} aria-disabled={!valid}
            className={`mt-2 inline-flex min-h-11 w-full scroll-mb-28 items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-fg md:mt-6 md:py-3 ${valid ? "" : "opacity-60"}`}>Request an on-site estimate</Link>
          {trust ? <p className="mt-1.5 text-sm leading-snug text-muted" data-testid="estimate-trust">{trust}</p> : null}
        </div>
      </div>
      {scope ? <div className="mt-4 rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)] md:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
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
        <p className="mt-4 text-sm text-fg" data-testid="estimate-size">{sizeText(inputs.service, scope)}</p>
        <p className="mt-2 text-sm text-fg" data-testid="estimate-materials">{materialText(inputs, scope)}</p>
        <h3 className="mt-4 text-sm font-semibold text-fg">What's included</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-fg" data-testid="estimate-included">
          {includedItems(inputs.service, inputs.floor).map(item => <li key={item}>{item}</li>)}
        </ul>
        <p className="mt-2 text-sm text-muted" data-testid="estimate-exclusions">{EXCLUSIONS}</p>
      </div> : null}
    </div>
  );
}
