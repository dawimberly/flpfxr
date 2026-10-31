import { describe, expect, it } from "vitest";
import { adjustedCrewDays, planningEstimate } from "@/lib/public-pricing";

describe("public estimator crew day allowance", () => {
  it("does not add a day before four full base days", () => {
    expect(adjustedCrewDays(1)).toBe(1);
    expect(adjustedCrewDays(2)).toBe(2);
    expect(adjustedCrewDays(3)).toBe(3);
  });
  it("adds one day for every four base days", () => {
    expect(adjustedCrewDays(4)).toBe(5);
    expect(adjustedCrewDays(5)).toBe(6);
    expect(adjustedCrewDays(8)).toBe(10);
    expect(adjustedCrewDays(12)).toBe(15);
  });
  it("prices a two-person crew and passes materials at cost", () => {
    expect(planningEstimate({baseCrewDays: 4, materialsAtCost: 2000})).toBe(5250);
    expect(planningEstimate({baseCrewDays: 8, materialsAtCost: 2000, otherProjectCosts: 500})).toBe(9000);
  });
  it("rejects invalid amounts", () => {
    expect(() => planningEstimate({baseCrewDays: -1, materialsAtCost: 0})).toThrow();
  });
  it("rounds partial working days up before allowance", () => {
    expect(adjustedCrewDays(3.5)).toBe(5);
    expect(adjustedCrewDays(-1)).toBe(0);
  });
});
