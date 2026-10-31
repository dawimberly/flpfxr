# Public estimator pricing audit — 2026-10-30

## Inventory
- Employee estimator: `src/data/catalog.json` contains 28 categories and 171 line items with `cost_per_unit` values. Do not assume these are current wholesale costs or public selling prices; some descriptions say "installed".
- Public estimator: `src/components/quote-estimator.tsx` uses `ESTIMATE_TYPES` and preset small/medium/large ranges imported from `src/lib/site`. Confirm the actual export source and scope assumptions before editing.
- PR #43 restores public UI; **do not deploy until pricing is validated**.

## Market research (reference only, not comparable quotes)
- https://ledgerandlumber.com/costs/san-antonio-tx/ : 40 sq ft full bath $15,400–$36,100; 150 sq ft full kitchen $23,100–$46,200 (modeled estimates).
- https://www.texprocontracting.com/blog/bathroom-remodel-cost-san-antonio : full hall bath $12,000–$25,000; primary bath $30,000–$75,000+.
- https://renovcost.com/kitchen-remodel/san-antonio-tx : midrange kitchen $26,300–$38,400 (modeled).
These differ materially in scope and methodology; do not blend them into a fake precise competitor price.

## Required implementation
1. Audit each of 171 items for unit, whether material/labor/installed, duplicates, exclusions, date and supplier quote. Do not overwrite historical prices without an approved source.
2. Define project templates for small/medium/large by service: square footage, demolition, labor hours, material allowance, finish tier, disposal, permits, contingency, overhead and margin. Validate against actual completed Flip Fixer jobs.
3. Compute Flip Fixer customer selling range from approved costs and pricing policy. Keep underlying margin and employee-only catalog confidential.
4. Independently compute comparable retail market ranges for **the same scope**, storing source URLs, retrieval date, methodology and confidence.
5. Public comparison labels: "Typical San Antonio market range" and "The Flip Fixer planning range". No savings claims unless overlap/scope and evidence justify them.
6. Roof, insurance claims and walkthrough services: **do not show price**; direct visitors to inspection/contact as already established.
7. Add tests for scope selection, price boundaries, mobile layout, lead handoff, accessibility and non-leakage of employee data.
8. Do not change Google Ads, analytics, conversion configuration, employee estimator or production deployment without separate approval.

## Inputs needed for final approval
- Jon's current price book, supplier material prices, crew/subcontractor rates, overhead and target margin.
- 3–5 representative completed jobs per major category, ideally with scope and final customer price.
- Confirm whether existing catalog `cost_per_unit` is internal cost or already marked-up installed selling price.

Status: research and audit plan only; **no new public prices approved**.
