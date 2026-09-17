import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseXactimateRoof, xactimateRoofPenetrations } from "./xactimate-roof.ts";
import { ROOF_SOLAR_HARDWARE, ROOF_TURTLE } from "./roof-line-items.ts";

const ESCOVAR = `
Insured: Jose Maria Escovar Home: (210) 724-0055
Property: 7412 Linkview St
San Antonio, TX 78240
Price List: TXSA8X_MAY25
Restoration/Service/Remodel
18.  Solar electric panel - Detach & 22.00 EA 0.00 275.68
19.  Solar panel- mounting hardware- 22.00 EA 0.00 29.16
`;

const VENTS = `
Price List: TXSA8X_MAY25
Restoration/Service/Remodel
Roof vent — turtle type  9.00 EA
Roof vent – turbine  2.00 EA
Pipe jack flashing  6.00 EA
`;

describe("parseXactimateRoof", () => {
  it("counts Escovar solar panels", () => {
    const row = parseXactimateRoof(ESCOVAR);
    assert.ok(row);
    assert.equal(row?.solarPanels, 22);
    assert.equal(row?.solarHardware, 22);
    assert.match(row?.insured || "", /Escovar/);
    const extras = xactimateRoofPenetrations(row!);
    assert.equal(extras.find((item) => item.name === ROOF_SOLAR_HARDWARE)?.act, "plus");
    assert.equal(extras.find((item) => item.name === ROOF_SOLAR_HARDWARE)?.quantity, 22);
  });

  it("reads turtle, turbine, and pipe jacks with unicode dashes", () => {
    const row = parseXactimateRoof(VENTS);
    assert.equal(row?.turtleVents, 9);
    assert.equal(row?.turbineVents, 2);
    assert.equal(row?.pipeJacks, 6);
    assert.equal(xactimateRoofPenetrations(row!).find((item) => item.name === ROOF_TURTLE)?.quantity, 9);
  });
});
