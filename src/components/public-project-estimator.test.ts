import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adjustedCrewDays, planningEstimate, projectPlanningEstimate, projectEstimateLeadMessage,
  parseAllowance, formatEstimateRange, TRADE_HOURS, BATH_SETTING_COST, BATH_FIXTURES,
} from "../lib/public-pricing.ts";
import { DEFAULT_PROJECT_INPUTS, PROJECT_SIZES, PROJECT_SERVICES, type ProjectInputs } from "../lib/public-estimate-options.ts";
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
    assert.equal(line({},"surround").personHours,80*0.5);
  });
  it("prices two interior finish coats and only half a coat of primer labor", () => {
    close(line({service:"interior-paint"},"paint").personHours,800*0.03*2);
    close(line({service:"interior-paint"},"primer").personHours,800*0.03*0.5);
    assert.equal(line({service:"interior-paint"},"primer").materials,800*0.22);
    assert.ok(!projectPlanningEstimate(input({service:"interior-paint",prime:false}))!.lines.some(l=>l.id==="primer"));
    close(line({service:"exterior-paint"},"paint").personHours,1200*0.04);
  });
  it("uses cabinet-box labor and removes selected stone surface labor", () => {
    assert.equal(line({service:"kitchen",fabrication:1500},"base-cabinets").personHours,8*1.5);
    for (const counter of ["quartz","granite"] as const) {
      assert.equal(line({service:"kitchen",counter,fabrication:1500},"counter").personHours,0);
    }
    assert.equal(line({shower:"stone",fabrication:1500},"surround").personHours,0);
    assert.ok(line({service:"kitchen",counter:"laminate"},"counter").personHours>0);
    assert.equal(TRADE_HOURS.cabinetBox,1.5);
  });
  it("requires a positive fabrication/install allowance and charges it once", () => {
    for (const fabrication of [null,0]) {
      assert.throws(()=>projectPlanningEstimate(input({service:"kitchen",fabrication})),/required/);
      assert.throws(()=>projectPlanningEstimate(input({shower:"stone",fabrication})),/required/);
    }
    const a=projectPlanningEstimate(input({service:"kitchen",fabrication:1500}))!;
    const b=projectPlanningEstimate(input({service:"kitchen",fabrication:2000}))!;
    close(b.total-a.total,500);
    assert.equal(b.labor,a.labor);
    assert.equal(projectPlanningEstimate(input({fabrication:1500}))!.fabrication,0);
  });
  it("includes bathroom demolition, fixtures and each setting-material component", () => {
    const result=projectPlanningEstimate(input())!;
    const ids=result.lines.map(l=>l.id);
    for (const name of ["thinset","grout","backerBoard","membrane","fixture-allowance","demolition"]) assert.ok(ids.includes(name));
    for (const [name,cost] of Object.entries(BATH_SETTING_COST)) close(line({},name).materials,160*cost);
    assert.equal(line({},"fixture-allowance").materials,BATH_FIXTURES.Medium);
    assert.equal(line({},"demolition").materials,0);
    assert.equal(line({},"demolition").personHours,12);
    assert.doesNotMatch(result.scope.exclusions,/Demolition|waterproofing[^.]*require/);
    close(result.materials,3194);
    close(result.baseCrewDays,111.65/16);
    assert.equal(result.adjustedDays,8);
    close(result.total,8844);
    assert.equal(formatEstimateRange(result),"$8,800-$11,100");
  });
  it("adds shipping and specialists only once without markup", () => {
    const a=projectPlanningEstimate(input())!;
    const b=projectPlanningEstimate(input({delivery:300.25,specialist:750.50}))!;
    close(b.total-a.total,1050.75);
    assert.equal(a.materials,b.materials);
    assert.equal(a.labor,b.labor);
  });
  it("returns rounded ranges for all supported project/size combinations", () => {
    for (const service of PROJECT_SERVICES) for (const size of PROJECT_SIZES) {
      const result=projectPlanningEstimate(input({service:service.id,size,fabrication:1500}));
      if(service.id==="custom") { assert.equal(result,null); continue; }
      assert.equal(result!.low,Math.round(result!.total/100)*100);
      assert.equal(result!.high,Math.round(result!.total*1.25/100)*100);
      assert.ok(result!.high>=result!.low);
    }
  });
});
describe("raw allowance validation and limited customer handoff", () => {
  it("accepts optional blanks and valid dollar values, including the cap", () => {
    for(const [s,value] of [["",0],["  ",0],["0",0],[".50",0.5],["12.34",12.34],["50000",50000]] as const) {
      assert.deepEqual(parseAllowance(s),{value,error:null});
    }
    assert.ok(parseAllowance("",true).error);
    assert.ok(parseAllowance("0",true).error);
  });
  it("rejects malformed, negative, nonfinite and excessive raw strings without coercion", () => {
    for(const raw of ["abc","-1","NaN","Infinity","1e3","0x10","50,000","50000.01","1.234","+2","-",".","1..2"]) {
      const parsed=parseAllowance(raw);
      assert.equal(parsed.value,null,raw);
      assert.ok(parsed.error,raw);
    }
  });
  it("rejects invalid programmatic allowance values and option identifiers", () => {
    for(const changes of [{delivery:"3"},{specialist:null},{delivery:NaN},{delivery:-1},{specialist:50001},{fabrication:Infinity},{floor:"__proto__"},{size:"Tiny"}]) {
      assert.throws(()=>projectPlanningEstimate(input(changes as Partial<ProjectInputs>)));
    }
  });
  it("passes only range, type, size and materials with estimate status", () => {
    const message=projectEstimateLeadMessage(input({delivery:300,specialist:750}));
    assert.match(message,/Project: Bathroom remodeling. Size: Medium. Materials: Tile, Ceramic tile surround, Primer and paint/);
    assert.match(message,/\$9,900-\$12,400/);
    assert.match(message,/estimate, not a quote/);
    assert.doesNotMatch(message,/crew|hours|days|650|shipping|specialist|demolition|sq ft|allowance/i);
  });
  it("preserves accessibility, blocks invalid navigation and adds no tracking", () => {
    const ui=readFileSync("src/components/public-project-estimator.tsx","utf8");
    assert.match(ui,/aria-live="polite"/);
    assert.match(ui,/min-h-11/);
    assert.match(ui,/aria-invalid/);
    assert.match(ui,/event.preventDefault/);
    assert.doesNotMatch(ui,/Base crew days|CREW_DAY_RATE|adjustedCrewDays|\$650|crew days/);
    assert.doesNotMatch(ui,/gtag|dataLayer|fbq|fetch\(/);
    assert.doesNotMatch(ui.toLowerCase(),new RegExp("waterfall"+" counter"));
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
