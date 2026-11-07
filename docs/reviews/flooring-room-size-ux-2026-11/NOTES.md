# Kitchen / bath flooring UX (room size vs replace flooring)

## Before (live symptoms)

- “Kitchen floor (sq ft)” blank or `0` invalidated the whole estimate even with flooring excluded.
- A bare “Include flooring” checkbox made the Medium kitchen `$12,000` → `$13,300` jump easy to miss.
- Bathroom room area could reset when toggling flooring (URL publish dropped measurements; remount key included flooring flag).

## After

- Field labeled **Kitchen/Bathroom size (sq ft)** with helper: remodel room size; blank uses the starting point; replace-flooring uses the same area for covering.
- Blank room size allowed; `0` / out-of-range still rejected (no silent zero-size remodel).
- Two-choice control: **Keep existing flooring** (default) / **Replace flooring**; material select only when replacing.
- Room size preserved across toggles (URL + remount key).
- Summary / lead / PDF: “Keeping existing flooring” / “Replacing flooring”; still one combined total only.

## Screenshots

- `flooring-ux-keep-1280.png` — keep existing selected
- `flooring-ux-replace-1280.png` — replace selected + flooring type
- `public-estimator-smoke-1280.png` / `public-estimator-smoke-390.png` — full smoke viewports
