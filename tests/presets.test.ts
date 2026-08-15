import { describe, it, expect } from "vitest";
import { presets, presetState } from "../src/lib/studio/presets";
import { defaultState } from "../src/lib/studio/types";
import { buildToolpath } from "../src/lib/studio/toolpath";
import { preflight } from "../src/lib/studio/preflight";

describe("shipped presets are print-ready", () => {
  for (const preset of presets) {
    it(`${preset.id} passes pre-flight with no errors`, () => {
      const state = presetState(preset, defaultState.printer);
      const path = buildToolpath(state);
      const report = preflight(state, path);
      const errors = report.issues.filter((i) => i.level === "error");
      expect(errors.map((e) => e.title)).toEqual([]);
    });
  }
});
