import { describe, expect, it } from "vitest";
import { recentSizes } from "../src/lib/history";
import { targetMbToBytes } from "../src/lib/fileSize";
import { progressPercent, progressTitle } from "../src/lib/progress";
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

describe("MiB target-size conversion", () => {
  it("uses 1,048,576 bytes for each displayed MB", () => {
    expect(targetMbToBytes(1)).toBe(1_048_576);
    expect(targetMbToBytes(10)).toBe(10_485_760);
    expect(targetMbToBytes(25)).toBe(26_214_400);
    expect(targetMbToBytes(1.5)).toBe(1_572_864);
  });
});

describe("two-pass progress presentation", () => {
  it("labels the active pass and keeps its percentage within that pass", () => {
    expect(progressTitle({ pass: 1 })).toBe("圧縮しています… 1/2");
    expect(progressPercent({ percent: 72 })).toBe(72);
    expect(progressTitle({ pass: 2 })).toBe("圧縮しています… 2/2");
    expect(progressPercent({ percent: 34 })).toBe(34);
  });
});
