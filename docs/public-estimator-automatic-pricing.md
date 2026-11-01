# Public automatic planning estimate

The public estimator now derives the example takeoff from service and size. The visitor selects materials and receives one preliminary combined total, clearly labeled "This is an estimate, not a quote."

## Source and calculation

- Material-only reference: dawimberly/flipfixer-estimator, materials/catalog.json at 509583fcb2fc5c7d793f0374b6f9eac2a50a35e0.
- Original pricing/estimator.py uses generic PERSON-hours: 0.08 per square foot, 0.15 per linear foot, 1.5 per item. These are generic defaults, not material-specific productivity measurements.
- Two people x assumed eight-hour workday = 16 person-hours per crew day.
- Aggregate person-hours over the selected example scope, divide by 16, round base days up, add one day per four rounded base days, multiply by the owner's existing $650 crew-day estimate.
- That additional time covers project support such as estimating and material runs. Do not also apply a labor uplift or overhead percentage for the same activities.
- Add reference materials without markup. Add entered delivery/shipping and specialist/other allowances once without markup.
- A blank delivery/specialist field adds $0 and is explicitly identified as not yet allowed for. Unknown shipping is not silently described as included.
- No current installed-unit catalog prices are reused, avoiding charging installation twice.

## Scope assumptions and limits

Size presets are illustrative quantities, not measured customer takeoffs or historically calibrated small/medium/large jobs. See public-estimate-options.ts for exact floor/wall/surround/cabinet/counter quantities. Every example displays its quantities and exclusions. No market comparison or savings claim is made.

Material reference prices are historical, not live supplier quotes. Labor defaults are coarse: changing tile grade changes material costs but not the generic square-foot labor productivity. Eight-hour crew workdays and scope templates are estimating assumptions. They require calibration against actual jobs. These limits prevent treating the output as a full turnkey remodel quote.

Kitchen and bathroom examples retain layout and cover specified finish installation only. Demolition, waterproofing, specialist work, permitting and concealed repairs are excluded unless the visitor adds a separate allowance. Handyman/outdoor/custom jobs go to an on-site assessment without an automatic price. Employee estimator, Ads and conversion behavior are unchanged.

## Verification

Unit tests check independent bathroom arithmetic, owner duration allowance, material changes without markup, size scaling, shipping/specialist additions without markup, invalid inputs, all supported combinations, no displayed daily rates and lead handoff. Browser smoke checks mobile/desktop and the existing contact handoff without submitting a lead. Existing generated-server syntax gate remains enabled.
