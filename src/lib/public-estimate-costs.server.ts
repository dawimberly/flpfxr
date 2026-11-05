export const CUSTOMER_LIST_DISCOUNT = 0.1;
export const CONTRACTOR_LIST_DISCOUNT = 0.4;
export function priceOffList(list: number, discount: number) {
  return Math.round(list * (1 - discount) * 100) / 100;
}

export const VANITY_LIST_PRICES: Record<string, number> = {
  "VA24": 186,
  "VA27": 288,
  "VA30": 220,
  "VA36": 273,
  "VA42DL": 345,
  "VA48D": 429,
  "VA60D": 499,
  "VA60DD": 463
};

/** Base fillers are Northville MSRP and were not copied into the contractor file. Closet fillers are in that file. */
export const FILLER_STRIPS = [
  { sku: "BF336", name: "3 in × 36 in base filler", list: 24, source: "Northville MSRP" },
  { sku: "BF636", name: "6 in × 36 in base filler", list: 50, source: "Northville MSRP" },
  { sku: "TK8", name: "Toe kick", list: 19, source: "Northville MSRP" },
  { sku: "TF196", name: "Closet filler 1.5 in × 96 in", list: 22, source: "Styles by Design contractor catalog" },
  { sku: "TF396", name: "Closet filler 3 in × 96 in", list: 67, source: "Styles by Design contractor catalog" },
  { sku: "TF696", name: "Closet filler 6 in × 96 in", list: 136, source: "Styles by Design contractor catalog" },
] as const;
export function fillerCostAnalysis() {
  return FILLER_STRIPS.map(row => ({
    ...row,
    contractor: priceOffList(row.list, CONTRACTOR_LIST_DISCOUNT),
    customer: priceOffList(row.list, CUSTOMER_LIST_DISCOUNT),
  }));
}
export const INCLUDED_FILLER_SKU = "BF336";
