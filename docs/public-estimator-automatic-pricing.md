# Public estimator advertising safety review

## Status

Market-estimate update for the public planner. Stone, the plumber valve and kitchen demolition use the cited public rates below, marked market estimate, not supplier-verified. Advertising readiness still depends on Jon's open inputs. The real-job calibration test stays skipped; no synthetic jobs are represented as actuals.

## Owner rules and calculation

Source for requested rates, minimum and support amounts: owner's 2026-11-01 task brief. Last checked 2026-11-01 against that brief.

- Two-person crew at $650 per crew day internally, assuming eight hours per person (16 person-hours per crew day).
- Sum trade person-hours, divide by 16, round base days up. Add one day per four rounded base days. For a rounded base under four, add 0.5 day of estimating/sourcing, including the smallest jobs.
- This time allowance covers estimating and material runs. Do not add another labor uplift or overhead percentage for those same activities.
- Interior paint assumes two finish coats at 0.03 person-hours/sq ft per coat. Primer adds its material cost plus half a coat of labor. Exterior defaults to one finish coat at 0.04 person-hours/sq ft. The visitor can choose "1 coat (standard)" or "2 coats"; the second coat adds another 0.04 person-hours/sq ft and another coat of exterior paint material. Primer stays half a pass.
- Tile flooring 0.35 person-hours/sq ft; shower surround tile 0.5; LVP 0.06; cabinet install 1.5 per box.
- Kitchen quartz/granite and bathroom stone use installed market rates (material + fabrication + install) and zero crew surface labor. There is no visitor fabrication field. Stone is priced in full slabs of 46 sq ft (at least one, then another whole slab when the area overflows) unless the counter or surround is 10 sq ft or under. Those small pieces use the lower remnant rate and are labeled subject to availability. The UI does not promise a remnant. Preset kitchen counters are 32, 40 and 60 sq ft, so they still bill full slabs. Stone totals are raised if they would otherwise fall below laminate (kitchens) or ceramic (bathrooms) at the same areas.
- Bathroom lines include basic finish demolition, fixture supply, thinset, grout, backer board and membrane on tiled surfaces, and a separate licensed-plumber allowance for the shower valve. Toilet and vanity-faucet labor stay on the crew (two fixture items). The valve adds no crew hours. Disposal is charged only through support, not again through demolition.
- Kitchens include the same provisional basic-finish demolition hours by size. Demolition is not an exclusion.
- Job subtotal = max($1,500, materials + labor). Add support of $250/$450/$750 for Small/Medium/Large after that minimum. This covers protection, routine haul-off/disposal, cleanup and consumables. Large/hazardous disposal needs a separate allowance.
- Add shipping and specialist allowances once with no markup. Blank optional fields add $0. "$100" and "1,000" are accepted. Negatives, nonfinite values and amounts over $50,000 show a visible error and block the range. A counted allowance stays visible even when the entry panel is collapsed.
- Display low = round(total / 100) * 100 and high = round(total * 1.25 / 100) * 100. Both use the same unrounded total; high is uncertainty, not a materials markup. Nearest-$100 rounding can put the displayed low slightly below the underlying total.
- The customer sees the range as "between $X and $Y", never a single total. Assumptions, example scope, and the support amount sit with it, plus this sentence near the range, above the contact button, and in the handoff: "Preliminary estimate only — not a quote. Final price is set after Jon sees the space." Never render crew days, person-hours or daily rate in the estimator or contact message. The default project is a medium quartz kitchen, which shows a range with the medium areas already filled in.
- Small, Medium and Large are quick picks. They fill the area boxes, and the visitor can edit them. Bathroom asks for floor square feet and an optional surround. Kitchen asks for floor square feet and optional counters. Flooring and paint ask for the room or paintable area. Blank optional surround or counters, and any wall, trim or backsplash the form does not ask for, scale from the selected size's preset ratios. Cabinet counts, fixtures, demolition hours and the support amount stay on that size. Vanity size is its own choice. Quick pick sets a 30-inch vanity, or a 60-inch double vanity on Large, and the visitor can change it. Areas outside the planning ranges show a friendly message and no price: bathroom floor 20–300, surround 0–200, kitchen floor 60–600, counters 1–200, flooring 20–2,500, interior paint 50–5,000, exterior paint 100–8,000.
- Contact handoff contains only project type, size, selected materials, range and estimate status. It contains no cost breakdown, allowances, quantities, square footage or internal effort.

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
| Counter material / sq ft | Laminate $28; butcher block $35. Quartz and granite are installed market rates below, not these catalog dollars. |
| Surround material / sq ft | Ceramic $5.50; porcelain $6.25. Stone slab is the installed market rate below. |
| Coatings / sq ft | Interior paint $0.45 per finish coat; primer $0.22; exterior paint $0.55; exterior primer $0.28 |
| Other material | Trim $2.85/linear ft; base box $185; wall box $145; backsplash $8.75/sq ft. Bathroom vanity and one 3-inch filler are 10% off the cabinet list below, not the old $289 / $620 placeholders. |

New provisional budgeting inputs, source UNKNOWN, last reviewed 2026-11-01. These are placeholders for review, not claimed vendor prices:

| Input | Provisional value |
| --- | --- |
| Thinset / sq ft | $0.75 |
| Grout / sq ft | $0.50 |
| Backer board / sq ft | $1.75 |
| Waterproofing membrane / sq ft | $1.50 |
| Basic fixture supply allowance | $750 small / $1,000 medium / $1,500 large, for toilet, vanity faucet and shower valve/trim product |
| Licensed plumber (valve) | $225 labor only, zero crew hours. market estimate, not supplier-verified. Angi, updated Oct 13, 2026: about $225 for a plumbing repair pro. https://www.angi.com/articles/how-much-should-it-cost-replace-bathroom-tub-valve.htm TODO Jon: confirm this is not already inside the fixture allowance. |
| Finish demolition effort | 8 / 12 / 16 person-hours by size for bathrooms and kitchens, no separate disposal charge. Kitchen hours are provisional, same schedule as bathrooms. |
| Fixture installation effort | 1.5 person-hours per item for the toilet and vanity faucet only |

Installed stone rates are market estimates, not supplier-verified. Customers buy whole slabs. `SLAB_SQFT` is 46 (Angi: slabs around 120-by-55 inches, 120 × 55 / 144 rounded to the nearest square foot). https://www.angi.com/articles/how-much-do-quartz-countertops-cost.htm

| Constant | Value | Source |
| --- | --- | --- |
| Quartz installed / sq ft | $70 | HomeAdvisor, updated Jun 19, 2026: commercial grade $60–$80 per sq ft including materials and labor; midpoint. https://www.homeadvisor.com/cost/cabinets-and-countertops/quartz-countertops/ |
| Granite installed / sq ft | $85 | HomeAdvisor, updated Jun 20, 2026: material $40–$60 per sq ft (midpoint $50) plus "$35 per square foot installed." https://www.homeadvisor.com/cost/cabinets-and-countertops/install-granite-countertops/ |
| Stone slab installed / sq ft | $120 | Archie Remodels: installed slab showers commonly $60–$180 per sq ft; midpoint. TODO Jon: that page is marble slab showers. https://archieremodels.com/marble-shower-cost-what-expect-marble-shower-walls/ |
| Remnant, very small pieces only | $50 / sq ft | HomeAdvisor builder's-grade quartz low end, $50–$60 including materials and labor. Subject to availability. TODO Jon: no public remnant price list was found. https://www.homeadvisor.com/cost/cabinets-and-countertops/quartz-countertops/ |
| Small-piece threshold | 10 sq ft | Angi vanity size 6–10 sq ft. A full slab is billed unless the counter or surround is 10 sq ft or less, which uses remnant pricing. Preset kitchens are 32/40/60 sq ft, so they still bill full slabs. TODO Jon: confirm the small-piece cutoff. https://www.angi.com/articles/how-much-does-it-cost-install-countertops.htm |

Retained or provisional productivity not specified by the owner: wood and carpet 0.08 person-hours/sq ft; trim 0.15 per linear ft; non-stone counter 0.08 per sq ft; backsplash tile 0.5 per sq ft. Tile productivity includes preparation/setting effort; it is not added again for each setting-material line.

## Vanity size and filler strips

The Styles by Design contractor catalog stores Northville list prices in `cost_per_unit`. Elegant White Shaker matches the Northville MSRP file. The contractor portal sells those rows at 20% off. Customers are not charged the list price and they are not charged the contractor price. The customer price is 10% off the list, which is 12.5% above the contractor price.

Quick pick uses VA30 ($220 list, $198 customer) for Small and Medium, and VA60DD ($463 list, $416.70 customer) for Large. The visitor can choose 24, 27, 30, 36, 42, 48, 60, or 60-inch double. Install labor stays one cabinet box (1.5 person-hours). A medium tile bathroom with the 30-inch vanity is $9,000–$11,200 before delivery or specialist allowances.

One 3-inch base filler is included in every bathroom at the customer price. A wider gap or a second side is not included. Base fillers and the toe kick are in the Northville MSRP file and were not copied into the contractor catalog. Closet fillers are in that catalog. None of these rates were changed; only the discount applied to the existing list is new.

| Strip | SKU | List | Contractor, 20% off | Customer, 10% off | Source |
| --- | --- | --- | --- | --- | --- |
| 3 in × 36 in base filler (included once) | BF336 | $24.00 | $19.20 | $21.60 | Northville MSRP |
| 6 in × 36 in base filler | BF636 | $50.00 | $40.00 | $45.00 | Northville MSRP |
| Toe kick | TK8 | $19.00 | $15.20 | $17.10 | Northville MSRP |
| Closet filler 1.5 in × 96 in | TF196 | $22.00 | $17.60 | $19.80 | Contractor catalog |
| Closet filler 3 in × 96 in | TF396 | $67.00 | $53.60 | $60.30 | Contractor catalog |
| Closet filler 6 in × 96 in | TF696 | $136.00 | $108.80 | $122.40 | Contractor catalog |

## Before and after comparison

Before = main at 3f92fa7, displayed ranges. Standard choices: LVP except bathroom tile, ceramic bathroom surround, quartz kitchen counter, primer selected, exterior one coat, delivery and specialist zero. Kitchen before-numbers include the $1,500 fabrication allowance the old UI required before it would show a price. After removes that input and prices installed stone in full slabs. Bathroom rows below are that stone update. The selectable vanity, at 10% off list plus one 3-inch filler, moves them to Small $6,600–$8,200, Medium $9,000–$11,200 and Large $12,600–$15,800.

| Project | Size | Before range | After range |
| --- | --- | ---: | ---: |
| Kitchen | Small | $10,800-$13,500 | $10,400-$13,100 |
| Kitchen | Medium | $13,200-$16,500 | $12,300-$15,400 |
| Kitchen | Large | $16,600-$20,800 | $19,000-$23,700 |
| Bathroom | Small | $6,400-$8,000 | $6,700-$8,300 |
| Bathroom | Medium | $8,800-$11,100 | $9,100-$11,300 |
| Bathroom | Large | $13,200-$16,500 | $12,800-$16,000 |
| Flooring | Small | $1,800-$2,200 | $1,800-$2,200 |
| Flooring | Medium | $3,600-$4,500 | $3,600-$4,500 |
| Flooring | Large | $6,100-$7,600 | $6,100-$7,600 |
| Interior paint | Small | $2,200-$2,800 | $2,200-$2,800 |
| Interior paint | Medium | $4,600-$5,700 | $4,600-$5,700 |
| Interior paint | Large | $9,000-$11,300 | $9,000-$11,300 |
| Exterior paint | Small | $2,300-$2,900 | $2,300-$2,900 |
| Exterior paint | Medium | $5,300-$6,700 | $5,300-$6,700 |
| Exterior paint | Large | $9,900-$12,400 | $9,900-$12,400 |
| Custom | Small | On-site assessment | On-site assessment |
| Custom | Medium | On-site assessment | On-site assessment |
| Custom | Large | On-site assessment | On-site assessment |

The large bathroom range is lower because removing the valve's crew labor drops a crew day, and the $225 plumber allowance does not replace that full day. Exterior two-coat medium is $8,600-$10,800, above the one-coat default. Large quartz kitchens bill two slabs (60 sq ft of counter, 46 sq ft per slab).

## Every TODO needing Jon's input

1. Three completed jobs: type, size, exact material selections, actual customer total, actual crew days, delivery/specialist/fabrication costs and included work. Confirm whether recorded days include estimating/sourcing. The calibration test checks underlying computed total and adjusted crew effort independently within +/-20%, not merely whether the actual is inside the displayed range. It requires at least three records when enabled.
2. Current supplier prices, quote dates and source links/receipts for every retained material group above; confirm paint cost basis/coverage per coat, counter/slab raw-material versus installed pricing, cabinet assembly/grade and fixtures included with vanities. No historical values are relabeled current.
3. Actual setting-material product/coverage costs for thinset, grout, backer board and membrane. Confirm whether the entire assumed tiled floor needs backer/membrane, substrate conditions, waste and necessary shower-pan/drain components.
4. Confirm fixture scope and $750/$1,000/$1,500 default supply allowances; installation effort of 1.5 hours for the toilet and vanity faucet. Confirm the $225 licensed-plumber valve allowance is labor only and is not already inside the fixture supply allowance.
5. Confirm demo scope and 8/12/16 person-hour allowances for both bathrooms and kitchens, routine disposal capacity and separate larger/hazardous disposal cost. The demolition line does not include another dumpster charge. Kitchen hours are provisional copies of the bathroom schedule.
6. Confirm non-specified productivity: wood, carpet, trim, laminate/butcher-block counter, backsplash and preparation included in tile rates. Confirm the assumed 16 person-hours per crew day.
7. Confirm two interior finish coats. Exterior now offers one coat as the standard and two coats as a visitor choice. Confirm that a second exterior coat should add both 0.04 person-hours/sq ft and another material coat, with primer unchanged.
8. Calibrate size presets against actual takeoffs and complete scope, especially cabinetry, countertop/surround areas, existing layout, waste, waterproofing details and specialist work. Kitchen and bathroom both include basic demo. Appliances, plumbing relocation, electrical, permits and concealed repairs stay excluded.
9. Replace the public-market stone rates, the 46 sq ft slab, the 10 sq ft remnant threshold and the $50 remnant rate with stone-yard prices. No remnant is promised. Confirm whether slab showers should keep the separate tile setting stack (they currently do not; the installed rate stands in for surround install).

## Verification and release control

- Focused unit tests: 14 passed; one real-job calibration test skipped for missing actuals.
- Local Vite development-mode build and generated-server syntax check passed.
- TypeScript check passed after generated route-tree refresh. Existing lead/conversion/auth/roof regression tests: 40 passed.
- Smoke checks the default kitchen range, malformed/negative/over-cap allowances, "$100" and "1,000", stone without a fabrication field, two exterior coats above one coat, contact navigation blocking, at least 44 px tap targets, horizontal overflow and range-only handoff, without submitting a lead. The script launches Vite directly and cleans up its own process on Windows and Linux.
- Main keeps automatic Vercel deployment. These market rates are not supplier quotes.
