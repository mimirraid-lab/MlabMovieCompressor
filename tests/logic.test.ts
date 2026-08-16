import { describe, expect, it } from "vitest";
import { recentSizes } from "../src/lib/history";
import { parseTargetMb } from "../src/lib/validation";

describe("recent target sizes", () => {
  it("keeps the latest four actual entries, newest first and unique", () => {
    expect(recentSizes([5, 5, 10, 5])).toEqual([5, 10]);
    expect(recentSizes([5, 10, 5, 10])).toEqual([10, 5]);
    expect(recentSizes([1, 2, 3, 4, 5])).toEqual([5, 4, 3, 2]);
  });
});

describe("target validation", () => {
  it("accepts positive decimal MB values only", () => {
    expect(parseTargetMb("9.5")).toBe(9.5);
    expect(parseTargetMb("0")).toBeNull();
    expect(parseTargetMb("-1")).toBeNull();
    expect(parseTargetMb("abc")).toBeNull();
  });
});
