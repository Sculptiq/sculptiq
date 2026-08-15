import { describe, expect, it } from "vitest";
import { listConnectors } from "../packages/connectors/index";
import { runConformance } from "../packages/connectors/conformance";

describe("connector conformance", () => {
  for (const connector of listConnectors()) {
    it(`${connector.manifest.kind} satisfies the connector contract`, async () => {
      const results = await runConformance(connector);
      const failed = results
        .filter((r) => !r.ok)
        .map((r) => `${r.name}${r.detail ? ` (${r.detail})` : ""}`);
      expect(failed).toEqual([]);
      expect(results.length).toBeGreaterThan(0);
    });
  }
});
