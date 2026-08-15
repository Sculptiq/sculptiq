import { describe, expect, it } from "vitest";
import { decodeShare, encodeShare, SHARE_MAX_CHARS, shareDropsData } from "../src/lib/studio/share";
import { sweep, SWEEP_MAX_STEPS } from "../src/lib/studio/batchExport";
import { defaultState } from "../src/lib/studio/types";

function baseState() {
  return structuredClone(defaultState);
}

describe("share links", () => {
  it("round-trips a design through the URL encoding", async () => {
    const state = baseState();
    state.printer.lineWidth = 0.72;
    state.pattern.frequency = 17;

    const encoded = await encodeShare(state);
    expect(encoded).toBeTruthy();
    expect(encoded!.length).toBeLessThanOrEqual(SHARE_MAX_CHARS);
    expect(encoded!).toMatch(/^[A-Za-z0-9_-]+$/);

    const decoded = await decodeShare(encoded!);
    expect(decoded).not.toBeNull();
    expect(decoded!.printer.lineWidth).toBeCloseTo(0.72);
    expect(decoded!.pattern.frequency).toBe(17);
  });

  it("returns null for junk instead of throwing", async () => {
    expect(await decodeShare("not-a-real-payload")).toBeNull();
    expect(await decodeShare("")).toBeNull();
  });

  it("flags designs whose image or audio data cannot travel", () => {
    const state = baseState();
    expect(shareDropsData(state)).toBe(false);
    state.pattern.imageMap = new Float32Array([0.1, 0.2]);
    expect(shareDropsData(state)).toBe(true);
  });

  it("drops the heavy image payload from the link", async () => {
    const plain = await encodeShare(baseState());
    const heavy = baseState();
    heavy.pattern.imageMap = new Float32Array(4096).fill(0.5);
    const withImage = await encodeShare(heavy);
    expect(withImage).toBeTruthy();
    // Same size class: the raster never enters the payload.
    expect(Math.abs(withImage!.length - plain!.length)).toBeLessThan(64);
  });
});

describe("parameter sweep", () => {
  it("spreads values evenly from start to end", () => {
    const variants = sweep({
      state: baseState(),
      key: "printer.lineWidth",
      from: 0.4,
      to: 0.8,
      steps: 5,
    });
    expect(variants).toHaveLength(5);
    expect(variants[0]!.value).toBeCloseTo(0.4);
    expect(variants[4]!.value).toBeCloseTo(0.8);
    expect(variants[2]!.state.printer.lineWidth).toBeCloseTo(0.6);
    expect(variants[1]!.label).toContain("lineWidth");
  });

  it("clamps the step count to a sane range", () => {
    const many = sweep({ state: baseState(), key: "printer.flow", from: 90, to: 110, steps: 99 });
    expect(many).toHaveLength(SWEEP_MAX_STEPS);
    const few = sweep({ state: baseState(), key: "printer.flow", from: 90, to: 110, steps: 1 });
    expect(few).toHaveLength(2);
  });

  it("leaves the original state untouched", () => {
    const state = baseState();
    const before = state.printer.flow;
    sweep({ state, key: "printer.flow", from: 80, to: 120, steps: 3 });
    expect(state.printer.flow).toBe(before);
  });
});
