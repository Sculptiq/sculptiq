import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultLinkSettings,
  fetchStatus,
  hasCapability,
  isBrowserSupported,
  LinkError,
  linkManifest,
  listLinkKinds,
  sendCommand,
  testConnection,
  uploadGcode,
  type LinkSettings,
} from "@/lib/studio/printerLink";

function settings(over: Partial<LinkSettings> = {}): LinkSettings {
  return { ...defaultLinkSettings, host: "octopi.local", key: "abc123", ...over };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("printerLink dispatcher", () => {
  it("routes testConnection to the octoprint connector with the api key", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: "OctoPrint", server: "1.9.3" }));
    const info = await testConnection(settings());
    expect(info).toEqual({ name: "OctoPrint", version: "1.9.3" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://octopi.local/api/version");
    expect(new Headers(init.headers).get("X-Api-Key")).toBe("abc123");
    expect(init.redirect).toBe("manual");
  });

  it("passes autoStart through on upload", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 201 }));
    await uploadGcode(settings({ autoStart: true }), "G28\n", "vase.gcode");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://octopi.local/api/files/local");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("print")).toBe("true");
  });

  it("returns a normalised status", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          state: { text: "Printing" },
          temperature: { tool0: { actual: 210, target: 215 }, bed: { actual: 60, target: 60 } },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          progress: { completion: 42, printTime: 120 },
          job: { file: { name: "vase.gcode" } },
        }),
      );

    const st = await fetchStatus(settings());
    expect(st.state).toBe("Printing");
    expect(st.progress).toBeCloseTo(0.42);
    expect(st.nozzleTemp).toBe(210);
    expect(st.bedTarget).toBe(60);
    expect(st.fileName).toBe("vase.gcode");
    expect(st.elapsedSec).toBe(120);
  });

  it("sends a cancel command to the job endpoint", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await sendCommand(settings(), "cancel");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://octopi.local/api/job");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ command: "cancel" });
  });

  it("reports bambu as unsupported and refuses to connect", async () => {
    expect(isBrowserSupported("bambu")).toBe(false);
    expect(isBrowserSupported("octoprint")).toBe(true);

    await expect(testConnection(settings({ kind: "bambu" }))).rejects.toBeInstanceOf(LinkError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty host with bad_url before any request", async () => {
    await expect(testConnection(settings({ host: "  " }))).rejects.toMatchObject({
      code: "bad_url",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("manifest-driven UI helpers", () => {
  it("lists every registry kind with manifest metadata", () => {
    const opts = listLinkKinds();
    expect(opts.map((o) => o.value).sort()).toEqual(
      ["bambu", "moonraker", "octoprint", "prusalink"],
    );

    const moonraker = opts.find((o) => o.value === "moonraker")!;
    expect(moonraker.displayName).toBe("Moonraker (Klipper)");
    expect(moonraker.label).toBe("Moonraker");
    expect(moonraker.status).toBe("reference");
    expect(moonraker.capabilities).toContain("upload");
  });

  it("reports capabilities from the manifest", () => {
    for (const cap of ["test", "upload", "status", "command"] as const) {
      expect(hasCapability("octoprint", cap)).toBe(true);
      expect(hasCapability("bambu", cap)).toBe(false);
    }
    expect(linkManifest("bambu").capabilities).toEqual([]);
    expect(linkManifest("prusalink").status).toBe("reference");
  });
});
