# Public estimator advertising safety review

## Status

Implementation for review only. Do not merge or deploy this branch. Advertising readiness is NOT established until real-job calibration and Jon's open pricing inputs below are resolved. The brief contained three placeholder calibration rows, not completed-job data. The real-job test is visibly skipped; no synthetic jobs are represented as actuals.

## Owner rules and calculation

Source for requested rates, minimum and support amounts: owner's 2026-11-01 task brief. Last checked 2026-11-01 against that brief.

- Two-person crew at $650 per crew day internally, assuming eight hours per person (16 person-hours per crew day).
- Sum trade person-hours, divide by 16, round base days up. Add one day per four rounded base days. For a rounded base under four, add 0.5 day of estimating/sourcing, including the smallest jobs.
- This time allowance covers estimating and material runs. Do not add another labor uplift or overhead percentage for those same activities.
- Interior paint assumes two finish coats at 0.03 person-hours/sq ft per coat. Primer adds its material cost plus half a coat of labor. Exterior uses the specified 0.04 person-hours/sq ft painting pass plus half a primer pass when selected; coat-system confirmation is an explicit TODO.
- Tile flooring 0.35 person-hours/sq ft; shower surround tile 0.5; LVP 0.06; cabinet install 1.5 per box.
- Kitchen quartz/granite and bathroom stone slabs have zero crew surface-installation labor. A positive fabrication/install allowance must be entered before any price or priced handoff is shown. It covers fabrication/install only, not materials already included.
- Bathroom lines include basic finish demolition, fixture allowance and thinset, grout, backer board and membrane. Disposal is charged only through support, not again through demolition.
- Job subtotal = max($1,500, materials + labor). Add support of $250/$450/$750 for Small/Medium/Large. This covers protection, routine haul-off/disposal, cleanup and consumables. Large/hazardous disposal needs a separate allowance.
- Add shipping, specialist and active fabrication allowances once with no markup. Blank optional shipping/specialist fields mean $0 is added and are described as not yet allowed for. A required fabrication field cannot be blank or zero.
- Display low = round(total / 100) * 100 and high = round(total * 1.25 / 100) * 100. Both use the same unrounded total; high is uncertainty, not a materials markup. Nearest-$100 rounding can put the displayed low slightly below the underlying total.
- The customer sees a range, example scope, support amount, and estimate-not-quote wording. Never render crew days, person-hours or daily rate in the estimator or contact message.
- Contact handoff contains only project type, size, selected materials, range and estimate status. It contains no cost breakdown, allowances, quantities or internal effort.

## Validation and privacy

Raw allowance fields use text + decimal input mode to preserve malformed input rather than letting HTML number fields erase it. Reject non-decimal text, negatives, scientific notation, nonfinite values, more than two decimals and amounts above $50,000 per field. Inline field errors and a visible summary block the total and contact navigation. The calculation also validates numeric programmatic inputs.

No new tracker, pixel, analytics event or lead request was added. Browser smoke intercepts and fails on any lead submission. Existing lead tracking and GA4 code are untouched. Form/message data is not passed to an analytics API by this component.

## Sources and provisional values

Last checked 2026-11-01 against repository history only, NOT current supplier quotes:
https://github.com/dawimberly/flipfixer-estimator/blob/509583fcb2fc5c7d793f0374b6f9eac2a50a35e0/materials/catalog.json

Retained material-only reference costs (not the employee installed-rate catalog):

| Group | Reference costs |
| --- | --- |
| Floor covering / sq ft | LVP $3.85; tile $4.25; engineered hardwood $6.50; carpet $2.50 |
| Counter material / sq ft | Quartz $65; granite $55; laminate $28; butcher block $35 |
| Surround material / sq ft | Ceramic $5.50; porcelain $6.25; stone slab $18 |
| Coatings / sq ft | Interior paint $0.45 per finish coat; primer $0.22; exterior paint $0.55; exterior primer $0.28 |
| Other material | Trim $2.85/linear ft; base box $185; wall box $145; single vanity $289; double vanity $620; backsplash $8.75/sq ft |

New provisional budgeting inputs, source UNKNOWN, last reviewed 2026-11-01. These are placeholders for review, not claimed vendor prices:

| Input | Provisional value |
| --- | --- |
| Thinset / sq ft | $0.75 |
| Grout / sq ft | $0.50 |
| Backer board / sq ft | $1.75 |
| Waterproofing membrane / sq ft | $1.50 |
| Basic fixture supply allowance | $750 small / $1,000 medium / $1,500 large, for toilet, vanity faucet and shower valve/trim |
| Finish demolition effort | 8 / 12 / 16 person-hours by size, no separate disposal charge |
| Fixture installation effort | 1.5 person-hours per item, three fixture items |

Retained or provisional productivity not specified by the owner: wood and carpet 0.08 person-hours/sq ft; trim 0.15 per linear ft; non-stone counter 0.08 per sq ft; backsplash tile 0.5 per sq ft. Tile productivity includes preparation/setting effort; it is not added again for each setting-material line.

## Before and after comparison

Before = main at dec5e14297d71cca22d2004c3c3a3a745d12072a. Same example quantities and standard material choices: LVP except bathroom tile, ceramic bathroom surround, quartz kitchen counter, primer selected. Delivery and other specialist allowances are zero in both columns.

Kitchen after scenarios include an illustrative $1,500 fabrication/install allowance to make the comparison computable; this is NOT a supplier quote or a UI default. The new UI shows no kitchen/quartz price until the visitor supplies the required allowance.

| Project | Size | Before single total | After planning range |
| --- | --- | ---: | ---: |
| Kitchen | Small | $9,573 | $10,800-$13,500 |
| Kitchen | Medium | $11,732 | $13,200-$16,500 |
| Kitchen | Large | $16,149 | $16,600-$20,800 |
| Bathroom | Small | $2,940 | $6,400-$8,000 |
| Bathroom | Medium | $4,603 | $8,800-$11,100 |
| Bathroom | Large | $5,927 | $13,200-$16,500 |
| Flooring | Small | $1,112 | $1,800-$2,200 |
| Flooring | Medium | $2,840 | $3,600-$4,500 |
| Flooring | Large | $6,330 | $6,100-$7,600 |
| Interior paint | Small | $2,151 | $2,200-$2,800 |
| Interior paint | Medium | $7,036 | $4,600-$5,700 |
| Interior paint | Large | $14,072 | $9,000-$11,300 |
| Exterior paint | Small | $4,315 | $2,300-$2,900 |
| Exterior paint | Medium | $10,746 | $5,300-$6,700 |
| Exterior paint | Large | $21,492 | $9,900-$12,400 |
| Custom | Small | On-site assessment | On-site assessment |
| Custom | Medium | On-site assessment | On-site assessment |
| Custom | Large | On-site assessment | On-site assessment |

## Every TODO needing Jon's input

1. Three completed jobs: type, size, exact material selections, actual customer total, actual crew days, delivery/specialist/fabrication costs and included work. Confirm whether recorded days include estimating/sourcing. The calibration test checks underlying computed total and adjusted crew effort independently within +/-20%, not merely whether the actual is inside the displayed range. It requires at least three records when enabled.
2. Current supplier prices, quote dates and source links/receipts for every retained material group above; confirm paint cost basis/coverage per coat, counter/slab raw-material versus installed pricing, cabinet assembly/grade and fixtures included with vanities. No historical values are relabeled current.
3. Actual setting-material product/coverage costs for thinset, grout, backer board and membrane. Confirm whether the entire assumed tiled floor needs backer/membrane, substrate conditions, waste and necessary shower-pan/drain components.
4. Confirm fixture scope and $750/$1,000/$1,500 default supply allowances; installation effort of 1.5 hours per fixture; confirm licensing/subcontractor needs and avoid counting supplier packages twice.
5. Confirm demo scope and 8/12/16 person-hour allowances, routine disposal capacity and separate larger/hazardous disposal cost. The demolition line does not include another dumpster charge.
6. Confirm non-specified productivity: wood, carpet, trim, laminate/butcher-block counter, backsplash and preparation included in tile rates. Confirm the assumed 16 person-hours per crew day.
7. Confirm two interior finish coats and exterior coating system. Exterior currently interprets the owner's 0.04/sq ft as one painting pass, not two finish coats. Extra exterior coats must be priced explicitly after clarification.
8. Calibrate size presets against actual takeoffs and complete scope, especially cabinetry, countertop/surround areas, existing layout, waste, waterproofing details and specialist work. Existing kitchen-demo/appliance/plumbing/electrical/permit/hidden-repair exclusions remain; bathroom includes basic demo but not structural repairs or relocations.
9. Real fabrication/install quotes for quartz/granite and stone slabs; confirm whether shipping is inside those quotes so it is not also entered as delivery. No fabrication default is invented.

## Verification and release control

- Focused unit tests: 14 passed; one real-job calibration test skipped for missing actuals.
- Local Vite development-mode build and generated-server syntax check passed.
- TypeScript check passed after generated route-tree refresh. Existing lead/conversion/auth/roof regression tests: 40 passed.
- Smoke script passed locally at 390 px; checks range, malformed/negative/over-cap allowances, required fabrication, contact navigation blocking, at least 44 px tap targets, horizontal overflow and range-only handoff, without submitting a lead. Screenshots were visually inspected. The script launches Vite directly and cleans up its own process on Windows and Linux.
- Branch-only vercel.json guard disables automatic deployment for fix/public-estimator-ad-safety. Other branches, including main, keep their existing behavior.
- This PR does not merge, deploy or certify these provisional prices ready for advertising.
