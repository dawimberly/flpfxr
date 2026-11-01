import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adjustedCrewDays, planningEstimate, projectPlanningEstimate, projectEstimateLeadMessage,
  parseAllowance, formatEstimateRange, TRADE_HOURS, BATH_SETTING_COST, BATH_FIXTURES,
  stoneCoverage, SLAB_SQFT, LICENSED_PLUMBER_VALVE_ALLOWANCE, PRELIMINARY_ESTIMATE_WORDING,
  REMNANT_MAY_BE_AVAILABLE_PER_SQFT,
} from "../lib/public-pricing.ts";
import { DEFAULT_PROJECT_INPUTS, PROJECT_SIZES, PROJECT_SERVICES, presetAreas, projectScope, scopeAreaError, type ProjectInputs } from "../lib/public-estimate-options.ts";
const input = (changes: Partial<ProjectInputs> = {}): ProjectInputs => ({ ...DEFAULT_PROJECT_INPUTS, ...changes });
const line = (changes: Partial<ProjectInputs>, id: string) =>
  projectPlanningEstimate(input(changes))!.lines.find(row => row.id === id)!;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

describe("crew and project-support rules", () => {
  it("rounds base effort up before four-day uplift and adds half a day to every smaller job", () => {
    for (const [base, expected] of [[0,0.5],[0.1,1.5],[1,1.5],[2,2.5],[3,3.5],[3.1,5],[4,5],[5,6],[8,10],[12,15]]) {
      assert.equal(adjustedCrewDays(base), expected);
    }
    for (const invalid of [-1,NaN,Infinity]) assert.throws(() => adjustedCrewDays(invalid));
    assert.equal(planningEstimate({baseCrewDays:4,materialsAtCost:2000}),5250);
  });
  it("applies the $1500 job floor before separately adding size-specific support", () => {
    const s = projectPlanningEstimate(input({service:"flooring",size:"Small",floor:"lvp"}))!;
    assert.equal(s.materials,120*3.85);
    assert.equal(s.adjustedDays,1.5);
    assert.equal(s.support,250);
    close(s.minimumAdjustment,1500-s.materials-s.labor);
    assert.equal(s.total,1750);
    assert.equal(s.low,1800);
    assert.equal(s.high,2200);
    for (const [size,support] of [["Small",250],["Medium",450],["Large",750]] as const) {
      assert.equal(projectPlanningEstimate(input({size}))!.support,support);
    }
  });
});
describe("trade productivity and bathroom completeness", () => {
  it("uses tile and LVP person-hours instead of generic area labor", () => {
    assert.equal(line({service:"flooring",floor:"tile"},"floor").personHours,400*0.35);
    assert.equal(line({service:"flooring",floor:"lvp"},"floor").personHours,400*0.06);
    assert.equal(line({service:"bathroom"},"surround").personHours,80*0.5);
  });
  it("prices two interior finish coats and only half a coat of primer labor", () => {
    close(line({service:"interior-paint"},"paint").personHours,800*0.03*2);
    close(line({service:"interior-paint"},"primer").personHours,800*0.03*0.5);
    assert.equal(line({service:"interior-paint"},"primer").materials,800*0.22);
    assert.ok(!projectPlanningEstimate(input({service:"interior-paint",prime:false}))!.lines.some(l=>l.id==="primer"));
    close(line({service:"exterior-paint"},"paint").personHours,1200*0.04);
  });
  it("prices a second exterior finish coat above the one-coat standard", () => {
    const one=projectPlanningEstimate(input({service:"exterior-paint",exteriorCoats:1}))!;
    const two=projectPlanningEstimate(input({service:"exterior-paint",exteriorCoats:2}))!;
    close(line({service:"exterior-paint",exteriorCoats:1},"paint").personHours,1200*0.04);
    close(line({service:"exterior-paint",exteriorCoats:2},"paint").personHours,1200*0.04*2);
    close(line({service:"exterior-paint",exteriorCoats:2},"paint").materials,1200*0.55*2);
    assert.ok(two.total>one.total);
    assert.equal(formatEstimateRange(one),"$5,300-$6,700");
  });
  it("uses cabinet-box labor and removes selected stone surface labor", () => {
    assert.equal(line({service:"kitchen"},"base-cabinets").personHours,8*1.5);
    for (const counter of ["quartz","granite"] as const) {
      assert.equal(line({service:"kitchen",counter},"counter").personHours,0);
    }
    assert.equal(line({service:"bathroom",shower:"stone"},"surround").personHours,0);
    assert.ok(line({service:"kitchen",counter:"laminate"},"counter").personHours>0);
    assert.equal(TRADE_HOURS.cabinetBox,1.5);
  });
  it("shows a kitchen range by default and keeps stone at or above laminate and ceramic", () => {
    const kitchen=projectPlanningEstimate(input())!;
    assert.equal(kitchen.scope.summary.includes("kitchen"),true);
    assert.equal(formatEstimateRange(kitchen),"$12,300-$15,400");
    assert.equal(stoneCoverage(8,false).remnant,true);
    assert.equal(stoneCoverage(32,true).billableSqft,SLAB_SQFT);
    assert.ok(stoneCoverage(60,true).billableSqft>=SLAB_SQFT*2);
    for (const size of PROJECT_SIZES) {
      for (const counter of ["quartz","granite"] as const) {
        const stone=projectPlanningEstimate(input({service:"kitchen",size,counter}))!;
        const laminate=projectPlanningEstimate(input({service:"kitchen",size,counter:"laminate"}))!;
        assert.ok(stone.total>=laminate.total,`${size} ${counter} below laminate`);
      }
      const slab=projectPlanningEstimate(input({service:"bathroom",size,shower:"stone"}))!;
      const ceramic=projectPlanningEstimate(input({service:"bathroom",size,shower:"ceramic"}))!;
      assert.ok(slab.total>=ceramic.total,`${size} stone below ceramic`);
      assert.equal(slab.remnantStone,false);
    }
  });
  it("includes bathroom demolition, fixtures and each setting-material component", () => {
    const bath=input({service:"bathroom",floor:"tile"});
    const result=projectPlanningEstimate(bath)!;
    const ids=result.lines.map(l=>l.id);
    for (const name of ["thinset","grout","backerBoard","membrane","fixture-allowance","licensed-plumber-valve","demolition"]) assert.ok(ids.includes(name));
    for (const [name,cost] of Object.entries(BATH_SETTING_COST)) close(line(bath,name).materials,160*cost);
    assert.equal(line(bath,"fixture-allowance").materials,BATH_FIXTURES.Medium);
    assert.equal(line(bath,"fixture-allowance").personHours,TRADE_HOURS.fixture*2);
    assert.equal(line(bath,"licensed-plumber-valve").materials,LICENSED_PLUMBER_VALVE_ALLOWANCE);
    assert.equal(line(bath,"licensed-plumber-valve").personHours,0);
    assert.equal(line(bath,"demolition").materials,0);
    assert.equal(line(bath,"demolition").personHours,12);
    assert.equal(line({service:"kitchen",size:"Small"},"demolition").personHours,8);
    assert.doesNotMatch(result.scope.exclusions,/Demolition|waterproofing[^.]*require/);
    assert.doesNotMatch(projectPlanningEstimate(input({service:"kitchen"}))!.scope.exclusions,/Demolition/);
    close(result.materials,3419);
    close(result.baseCrewDays,110.15/16);
    assert.equal(result.adjustedDays,8);
    close(result.total,9069);
    assert.equal(formatEstimateRange(result),"$9,100-$11,300");
  });
  it("adds shipping and specialists only once without markup", () => {
    const a=projectPlanningEstimate(input({service:"bathroom"}))!;
    const b=projectPlanningEstimate(input({service:"bathroom",delivery:300.25,specialist:750.50}))!;
    close(b.total-a.total,1050.75);
    assert.equal(a.materials,b.materials);
    assert.equal(a.labor,b.labor);
  });
  it("returns rounded ranges for all supported project/size combinations", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const result=projectPlanningEstimate(input({service:service.id,size}));
      if(service.id==="custom") { assert.equal(result,null); continue; }
      assert.equal(result!.low,Math.round(result!.total/100)*100);
      assert.equal(result!.high,Math.round(result!.total*1.25/100)*100);
      assert.ok(result!.high>=result!.low);
    }
  });
});
describe("raw allowance validation and limited customer handoff", () => {
  it("accepts optional blanks and valid dollar values, including the cap", () => {
    for(const [s,value] of [["",0],["  ",0],["0",0],[".50",0.5],["12.34",12.34],["50000",50000],["$100",100],["1,000",1000],["$1,000.50",1000.5]] as const) {
      assert.deepEqual(parseAllowance(s),{value,error:null});
    }
    assert.ok(parseAllowance("",true).error);
    assert.ok(parseAllowance("0",true).error);
  });
  it("rejects malformed, negative, nonfinite and excessive raw strings without coercion", () => {
    for(const raw of ["abc","-1","NaN","Infinity","1e3","0x10","$-1","-$5","$50,001","50000.01","1.234","+2","-",".","1..2"]) {
      const parsed=parseAllowance(raw);
      assert.equal(parsed.value,null,raw);
      assert.ok(parsed.error,raw);
    }
  });
  it("rejects invalid programmatic allowance values and option identifiers", () => {
    for(const changes of [{delivery:"3"},{specialist:null},{delivery:NaN},{delivery:-1},{specialist:50001},{exteriorCoats:0},{floor:"__proto__"},{size:"Tiny"}]) {
      assert.throws(()=>projectPlanningEstimate(input(changes as Partial<ProjectInputs>)));
    }
  });
  it("passes only range, type, size and materials with estimate status", () => {
    const message=projectEstimateLeadMessage(input({service:"bathroom",floor:"tile",delivery:300,specialist:750}));
    assert.match(message,/Project: Bathroom remodeling. Size: Medium. Materials: Tile, Ceramic tile surround, Primer and paint/);
    assert.match(message,/\$10,100-\$12,600/);
    assert.match(message,/Preliminary estimate only — not a quote\. Final price is set after Jon sees the space\./);
    assert.equal(message.includes(PRELIMINARY_ESTIMATE_WORDING),true);
    assert.doesNotMatch(message,/crew|hours|days|650|shipping|specialist|demolition|sq ft|allowance/i);
  });
  it("preserves accessibility, blocks invalid navigation and adds no tracking", () => {
    const ui=readFileSync("src/components/public-project-estimator.tsx","utf8");
    const pricing=readFileSync("src/lib/public-pricing.ts","utf8");
    assert.match(ui,/aria-live="polite"/);
    assert.match(ui,/min-h-11/);
    assert.match(ui,/aria-invalid/);
    assert.match(ui,/event.preventDefault/);
    assert.match(ui,/1 coat \(standard\)/);
    assert.match(ui,/Discounted stone remnants may be available — visit our stone yard with Jon to choose\./);
    assert.match(ui,/data-testid="estimate-assumptions"/);
    assert.match(ui,/Quick pick/);
    assert.match(ui,/PRELIMINARY_ESTIMATE_WORDING/);
    assert.match(pricing,/Preliminary estimate only — not a quote\. Final price is set after Jon sees the space\./);
    assert.ok(ui.indexOf("estimate-delivery-line")>ui.indexOf("</details>"));
    assert.doesNotMatch(ui,/fabrication/i);
    assert.doesNotMatch(ui,/Base crew days|CREW_DAY_RATE|adjustedCrewDays|\$650|crew days/);
    assert.doesNotMatch(ui,/gtag|dataLayer|fbq|fetch\(/);
    assert.doesNotMatch(ui.toLowerCase(),new RegExp("waterfall"+" counter"));
  });
});
describe("measured square footage", () => {
  it("keeps today's preset totals when the example areas are omitted or typed in", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const floor = service.id === "bathroom" ? "tile" as const : "lvp" as const;
      const preset = projectPlanningEstimate(input({ service: service.id, size, floor }));
      const filled = presetAreas(service.id, size);
      const explicit = projectPlanningEstimate(input({
        service: service.id, size, floor,
        floorSqft: filled.floor ? Number(filled.floor) : undefined,
        showerSqft: filled.shower ? Number(filled.shower) : undefined,
        counterSqft: filled.counter ? Number(filled.counter) : undefined,
        roomSqft: filled.room ? Number(filled.room) : undefined,
      }));
      if (service.id === "custom") { assert.equal(preset, null); assert.equal(explicit, null); continue; }
      assert.equal(explicit!.total, preset!.total, service.id + " " + size);
      assert.equal(formatEstimateRange(explicit!), formatEstimateRange(preset!));
      for (const key of ["floor", "wall", "trim", "shower", "counters", "backsplash", "base", "wallUnits"] as const) {
        assert.equal(explicit!.scope[key], preset!.scope[key], service.id + " " + size + " " + key);
      }
    }
  });
  it("scales wall, trim and backsplash from the selected example when the floor changes", () => {
    const example = projectScope("kitchen", "Medium")!;
    const custom = projectScope("kitchen", "Medium", { floorSqft: 200 })!;
    assert.equal(custom.floor, 200);
    assert.equal(custom.wall, example.wall * 200 / example.floor);
    assert.equal(custom.trim, example.trim * 200 / example.floor);
    assert.equal(custom.backsplash, example.backsplash * 200 / example.floor);
    assert.equal(custom.counters, example.counters * 200 / example.floor);
    assert.equal(custom.base, example.base);
    assert.match(custom.assumptions, /Medium/);
    assert.match(custom.assumptions, /scaled from the Medium example/);
    const priced = projectPlanningEstimate(input({ service: "kitchen", floorSqft: 200, counterSqft: null }))!;
    assert.notEqual(priced.total, projectPlanningEstimate(input({ service: "kitchen" }))!.total);
    const shower = projectScope("bathroom", "Medium", { floorSqft: 80, showerSqft: 40 })!;
    assert.equal(shower.shower, 40);
    assert.equal(shower.wall, 270);
    const paint = projectPlanningEstimate(input({ service: "interior-paint", roomSqft: 1000 }))!;
    assert.equal(paint.scope.wall, 1000);
    assert.notEqual(paint.total, projectPlanningEstimate(input({ service: "interior-paint" }))!.total);
  });
  it("bills a full slab above 10 sq ft of counter and remnant pricing at or under 10", () => {
    const remnant = projectPlanningEstimate(input({ service: "kitchen", floorSqft: 168, counterSqft: 8 }))!;
    assert.equal(remnant.remnantStone, true);
    assert.ok(remnant.lines.find(row => row.id === "counter")!.materials >= 8 * REMNANT_MAY_BE_AVAILABLE_PER_SQFT);
    const slab = projectPlanningEstimate(input({ service: "kitchen", floorSqft: 168, counterSqft: 11 }))!;
    assert.equal(slab.remnantStone, false);
    assert.ok(slab.lines.find(row => row.id === "counter")!.materials >= SLAB_SQFT * 70);
    assert.equal(slab.lines.find(row => row.id === "counter")!.personHours, 0);
  });
  it("shows a friendly message outside the bathroom and kitchen ranges and does not price them", () => {
    const bath = scopeAreaError("bathroom", { floorSqft: 10 });
    assert.match(bath!, /20/);
    assert.match(bath!, /300/);
    assert.match(bath!, /bathroom floor/);
    assert.equal(projectPlanningEstimate(input({ service: "bathroom", floor: "tile", floorSqft: 10 })), null);
    const kitchen = scopeAreaError("kitchen", { floorSqft: 50 });
    assert.match(kitchen!, /60/);
    assert.match(kitchen!, /600/);
    assert.equal(projectPlanningEstimate(input({ service: "kitchen", floorSqft: 700 })), null);
    assert.equal(scopeAreaError("kitchen", {}), null);
    assert.match(scopeAreaError("flooring", { roomSqft: 10 })!, /20/);
  });
});
type CalibrationJob = { id:string; input:ProjectInputs; actualTotal:number; actualDays:number };
/** TODO Jon: supply the three actual completed jobs requested in the brief; no synthetic "actuals". */
const REAL_JOBS: CalibrationJob[] = [];
it("real completed jobs match price and total effort within +/-20%", {
  skip: REAL_JOBS.length === 0 ? "TODO Jon: three real jobs (type, size, materials, actual total and actual days) were placeholders in the brief" : false,
}, () => {
  assert.ok(REAL_JOBS.length>=3,"At least three completed jobs are required");
  for(const job of REAL_JOBS) {
    const result=projectPlanningEstimate(job.input);
    assert.ok(result,job.id);
    assert.ok(job.actualTotal>0 && job.actualDays>0,job.id);
    assert.ok(Math.abs(result!.total/job.actualTotal-1)<=0.2,job.id+" price calibration");
    assert.ok(Math.abs(result!.adjustedDays/job.actualDays-1)<=0.2,job.id+" effort calibration");
  }
});
