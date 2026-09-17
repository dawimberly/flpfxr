import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseXactimateRoof } from "./xactimate-roof.ts";

const ESCOVAR = `
Insured: Jose Maria Escovar Home: (210) 724-0055
Property: 7412 Linkview St
San Antonio, TX 78240
Price List: TXSA8X_MAY25
Restoration/Service/Remodel
18.  Solar electric panel - Detach & 22.00 EA 0.00 275.68
19.  Solar panel- mounting hardware- 22.00 EA 0.00 29.16
`;

describe("parseXactimateRoof", () => {
  it("counts Escovar solar panels", () => {
    const row = parseXactimateRoof(ESCOVAR);
    assert.ok(row);
    assert.equal(row?.solarPanels, 22);
    assert.equal(row?.solarHardware, 22);
    assert.match(row?.insured || "", /Escovar/);
  });
});
