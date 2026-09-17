import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEagleViewText } from "./eagleview-parse.ts";

const BAWDEN = `
 Extended Coverage 2D Report
521 5th st N, East Roosevelt, MT 59218
Report Details Report:53990329
Total Area =2,618 sq ft
Total Roof Facets =2
Predominant Pitch = 4/12
Number of Stories <=1
Total Ridges = 74 ft
Total Valleys = 0 ft
Total Rakes = 72 ft
Total Eaves = 147 ft
Eagle View Technologies, Inc.
Ridges = 74 ft
Hips = 0 ft
Valleys = 0 ft
Rakes = 72 ft (4 Rakes)
Eaves = 147 ft
`;

const CAMPOS = `
Premium Report
2002 HARPERS FERRY ST, San Antonio, TX 78245 Report: 67237460
Eagle View Technologies, Inc.
Total Roof Area =2,496 sq ft
Total Roof Facets =7
Predominant Pitch =4/12
Number of Stories >1
Total Ridges/Hips =69 ft
Total Valleys =0 ft
Total Rakes =153 ft
Total Eaves =173 ft
Rakes = 153 ft (12 Rakes)
Hips = 0 ft
`;

const ESCOVAR = `
7412 Linkview Street, San Antonio, TX 78240 Report: 65286650
Eagle View Technologies, Inc.
Total Roof Area =3,620 sq ft
Total Roof Facets =12
Predominant Pitch =7/12
Number of Stories <=1
Total Ridges/Hips =266 ft
Total Valleys =103 ft
Total Rakes =16 ft
Total Eaves =245 ft
Valleys = 103 ft (5 Valleys)
Rakes = 16 ft (2 Rakes)
`;

describe("parseEagleViewText", () => {
  it("reads Bawden squares, 4 rakes, 10% waste", () => {
    const report = parseEagleViewText(BAWDEN);
    assert.ok(report);
    assert.equal(report?.areaSqft, 2618);
    assert.equal(report?.pitch, "4/12");
    assert.equal(report?.rakeCount, 4);
    assert.equal(report?.wastePct, 10);
    assert.equal(report?.summary.total_squares, 26.18);
    assert.equal(report?.summary.squares_with_waste, 28.8);
    assert.equal(report?.summary.steep_squares, 0);
    assert.match(report?.address || "", /521 5th/i);
  });

  it("reads Campos two-story 12-rake 10% waste", () => {
    const report = parseEagleViewText(CAMPOS);
    assert.ok(report);
    assert.equal(report?.storiesOverOne, true);
    assert.equal(report?.rakeCount, 12);
    assert.equal(report?.wastePct, 10);
    assert.equal(report?.summary.total_squares, 24.96);
  });

  it("reads Escovar 7/12 with 5 valleys as 15% and steep squares", () => {
    const report = parseEagleViewText(ESCOVAR);
    assert.ok(report);
    assert.equal(report?.valleyCount, 5);
    assert.equal(report?.rakeCount, 2);
    assert.equal(report?.wastePct, 15);
    assert.equal(report?.summary.steep_squares, 36.2);
    assert.equal(report?.pitch, "7/12");
  });
});
