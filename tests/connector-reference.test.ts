import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getConnector,
  listConnectors,
  LinkError,
  UnsupportedCapabilityError,
  type LinkContext,
  type LinkKind,
  type PrinterConnector,
} from "../packages/connectors/index";

const KEY = "SECRET-KEY-123";

function ctxFor(kind: LinkKind, c: PrinterConnector): LinkContext {
  return { kind, baseHost: "http://printer.local", key: KEY, manifest: c.manifest };
}

function stubJson(payloads: unknown[]) {
  let i = 0;
  const fn = vi.fn(async () => {
    const body = payloads[Math.min(i++, payloads.length - 1)];
    return new Response(JSON.stringify(body ?? {}), { status: 200 });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("registry", () => {
  it("exposes all four kinds", () => {
    expect(listConnectors()).toHaveLength(4);
    for (const kind of ["octoprint", "moonraker", "prusalink", "bambu"] as LinkKind[]) {
      expect(getConnector(kind).manifest.kind).toBe(kind);
    }
  });

  it("throws for an unknown kind", () => {
    expect(() => getConnector("nope" as LinkKind)).toThrowError(LinkError);
  });
});

describe("octoprint", () => {
  const c = getConnector("octoprint");
  const ctx = ctxFor("octoprint", c);

  it("normalises status and converts progress to 0..1", async () => {
    stubJson([
      {
        state: { text: "Printing" },
        temperature: { tool0: { actual: 210.2, target: 215 }, bed: { actual: 59, target: 60 } },
      },
      {
        progress: { completion: 42.5, printTime: 1200 },
        job: { file: { name: "vase.gcode" } },
      },
    ]);
    const s = await c.fetchStatus(ctx);
    expect(s.state).toBe("Printing");
    expect(s.progress).toBeCloseTo(0.425);
    expect(s.nozzleTemp).toBe(210.2);
    expect(s.bedTarget).toBe(60);
    expect(s.fileName).toBe("vase.gcode");
    expect(s.elapsedSec).toBe(1200);
  });

  it("tolerates an idle printer with an empty job", async () => {
    stubJson([{ state: { text: "Operational" } }, {}]);
    const s = await c.fetchStatus(ctx);
    expect(s.state).toBe("Operational");
    expect(s.progress).toBeNull();
    expect(s.fileName).toBeNull();
  });

  it("uploads with select/print and honours autoStart", async () => {
    const f = stubJson([{}]);
    await c.uploadGcode(ctx, new Blob(["G28"]), { fileName: "a.gcode", autoStart: true });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://printer.local/api/files/local");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("print")).toBe("true");
    expect(form.get("select")).toBe("true");
  });

  it("sends pause/resume/cancel in OctoPrint's shape", async () => {
    const f = stubJson([{}, {}, {}]);
    await c.sendCommand(ctx, "pause");
    await c.sendCommand(ctx, "resume");
    await c.sendCommand(ctx, "cancel");
    const bodies = f.mock.calls.map((call) =>
      JSON.parse((call[1] as RequestInit).body as string),
    );
    expect(bodies[0]).toEqual({ command: "pause", action: "pause" });
    expect(bodies[1]).toEqual({ command: "pause", action: "resume" });
    expect(bodies[2]).toEqual({ command: "cancel" });
  });
});

describe("moonraker", () => {
  const c = getConnector("moonraker");
  const ctx = ctxFor("moonraker", c);

  it("normalises status", async () => {
    stubJson([
      {
        result: {
          status: {
            print_stats: { state: "printing", filename: "b.gcode", print_duration: 90 },
            extruder: { temperature: 200, target: 205 },
            heater_bed: { temperature: 60, target: 60 },
            display_status: { progress: 0.33 },
          },
        },
      },
    ]);
    const s = await c.fetchStatus(ctx);
    expect(s.state).toBe("printing");
    expect(s.progress).toBeCloseTo(0.33);
    expect(s.elapsedSec).toBe(90);
  });

  it("tolerates an empty payload", async () => {
    stubJson([{}]);
    const s = await c.fetchStatus(ctx);
    expect(s.state).toBe("unknown");
    expect(s.nozzleTemp).toBeNull();
  });

  it("never sends the API key", async () => {
    const f = stubJson([{ result: {} }]);
    await c.testConnection(ctx);
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("X-Api-Key")).toBeNull();
  });

  it("uploads to gcodes root", async () => {
    const f = stubJson([{}]);
    await c.uploadGcode(ctx, new Blob(["G28"]), { fileName: "c.gcode", autoStart: false });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://printer.local/server/files/upload");
    const form = init.body as FormData;
    expect(form.get("root")).toBe("gcodes");
    expect(form.get("print")).toBeNull();
  });
});

describe("prusalink", () => {
  const c = getConnector("prusalink");
  const ctx = ctxFor("prusalink", c);

  it("normalises status and converts progress", async () => {
    stubJson([
      {
        printer: { state: "PRINTING", temp_nozzle: 220, target_nozzle: 220, temp_bed: 60, target_bed: 60 },
        job: { progress: 75, time_printing: 300, file: { name: "d.gcode" } },
      },
    ]);
    const s = await c.fetchStatus(ctx);
    expect(s.state).toBe("PRINTING");
    expect(s.progress).toBeCloseTo(0.75);
    expect(s.fileName).toBe("d.gcode");
  });

  it("tolerates an idle printer", async () => {
    stubJson([{ printer: { state: "IDLE" } }]);
    const s = await c.fetchStatus(ctx);
    expect(s.progress).toBeNull();
  });

  it("PUTs the upload with the print-after-upload header", async () => {
    const f = stubJson([{}]);
    await c.uploadGcode(ctx, new Blob(["G28"]), { fileName: "e f.gcode", autoStart: true });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://printer.local/api/v1/files/usb/e%20f.gcode");
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("Print-After-Upload")).toBe("1");
  });

  it("DELETEs to cancel", async () => {
    const f = stubJson([{}]);
    await c.sendCommand(ctx, "cancel");
    expect((f.mock.calls[0]?.[1] as RequestInit).method).toBe("DELETE");
  });
});

describe("bambu", () => {
  const c = getConnector("bambu");
  const ctx = ctxFor("bambu", c);

  it("declares no capabilities", () => {
    expect(c.manifest.capabilities).toEqual([]);
  });

  it("throws on every method", async () => {
    await expect(c.testConnection(ctx)).rejects.toBeInstanceOf(LinkError);
    await expect(
      c.uploadGcode(ctx, new Blob([""]), { fileName: "x", autoStart: false }),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    await expect(c.fetchStatus(ctx)).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    await expect(c.sendCommand(ctx, "pause")).rejects.toBeInstanceOf(
      UnsupportedCapabilityError,
    );
  });
});

describe("every reference connector goes through the guard", () => {
  const kinds: LinkKind[] = ["octoprint", "moonraker", "prusalink"];

  it("surfaces a redirect as redirect_blocked", async () => {
    for (const kind of kinds) {
      const c = getConnector(kind);
      vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302 })));
      await expect(c.fetchStatus(ctxFor(kind, c))).rejects.toMatchObject({
        code: "redirect_blocked",
      });
      vi.unstubAllGlobals();
    }
  });

  it("never puts the key in a URL", async () => {
    for (const kind of kinds) {
      const c = getConnector(kind);
      const f = stubJson([{}, {}]);
      await c.fetchStatus(ctxFor(kind, c)).catch(() => undefined);
      for (const call of f.mock.calls) {
        expect(String(call[0])).not.toContain(KEY);
      }
      vi.unstubAllGlobals();
    }
  });
});
