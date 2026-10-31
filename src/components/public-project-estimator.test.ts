import { describe, expect, it } from "vitest";
import { adjustedCrewDays } from "./public-project-estimator";

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
  it("rounds partial working days up before allowance", () => {
    expect(adjustedCrewDays(3.5)).toBe(5);
    expect(adjustedCrewDays(-1)).toBe(0);
  });
});
