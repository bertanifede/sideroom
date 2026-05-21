import { describe, it, expect } from "vitest";
import { parseDiagFlags } from "@/lib/diagnostics";

describe("parseDiagFlags", () => {
  it("defaults every flag to false for an empty query string", () => {
    expect(parseDiagFlags("")).toEqual({ debug: false, noAnalyser: false });
  });

  it("enables debug when ?debug=1 is present", () => {
    expect(parseDiagFlags("?debug=1")).toEqual({ debug: true, noAnalyser: false });
  });

  it("enables noAnalyser when ?noanalyser=1 is present", () => {
    expect(parseDiagFlags("?debug=1&noanalyser=1")).toEqual({
      debug: true,
      noAnalyser: true,
    });
  });

  it("treats any value other than '1' as false", () => {
    expect(parseDiagFlags("?debug=true")).toEqual({ debug: false, noAnalyser: false });
  });
});
