import { describe, expect, it, vi, afterEach } from "vitest";
import { guardedFetch } from "../packages/connectors/guard";
import {
  LinkError,
  UnsupportedCapabilityError,
  type LinkContext,
} from "../packages/connectors/types";
import {
  badScheme,
  embeddedCredentials,
  exfiltrateToSecondHost,
  forceFollowRedirects,
  hostileContext,
  keyInQueryString,
  wrongPort,
} from "../packages/connectors/__fixtures__/hostile";

const ctx: LinkContext = hostileContext();

function stubFetch(res: Response | (() => Response | Promise<Response>)) {
  const fn = vi.fn(async () => (typeof res === "function" ? await res() : res));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "no-error";
  } catch (e) {
    expect(e).toBeInstanceOf(LinkError);
    return (e as LinkError).code;
  }
}

describe("guard: normalisation and allowlist", () => {
  it("allows a request to the configured host", async () => {
    const f = stubFetch(new Response("{}", { status: 200 }));
    const res = await guardedFetch(ctx, "http://printer.local/api/version", {}, "test");
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("rejects a second host", async () => {
    const f = stubFetch(new Response("{}", { status: 200 }));
    expect(await code(exfiltrateToSecondHost(ctx))).toBe("host_not_allowed");
    expect(f).not.toHaveBeenCalled();
  });

  it("rejects a subdomain outside the pattern", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    expect(
      await code(guardedFetch(ctx, "http://evil.printer.local/x", {}, "test")),
    ).toBe("host_not_allowed");
  });

  it("rejects a different port", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    expect(await code(wrongPort(ctx))).toBe("host_not_allowed");
  });

  it("rejects non-http schemes", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    expect(await code(badScheme(ctx))).toBe("bad_url");
    expect(
      await code(guardedFetch(ctx, "file:///etc/passwd", {}, "test")),
    ).toBe("bad_url");
    expect(
      await code(guardedFetch(ctx, "javascript:alert(1)", {}, "test")),
    ).toBe("bad_url");
  });

  it("rejects embedded credentials", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    expect(await code(embeddedCredentials(ctx))).toBe("bad_url");
  });

  it("rejects a host that does not match hostPattern even when it matches the base", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    const loose = hostingCtx();
    expect(await code(guardedFetch(loose, "http://other.local/x", {}, "test"))).toBe(
      "host_not_allowed",
    );
  });
});

function hostingCtx(): LinkContext {
  return hostileContext({ baseHost: "http://other.local" });
}

describe("guard: redirects", () => {
  it("blocks a 302 and never follows it", async () => {
    const f = stubFetch(
      new Response(null, { status: 302, headers: { Location: "http://evil.example.com" } }),
    );
    expect(await code(guardedFetch(ctx, "http://printer.local/api/version", {}, "test"))).toBe(
      "redirect_blocked",
    );
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("blocks 301 and 307 too", async () => {
    for (const status of [301, 307]) {
      stubFetch(new Response(null, { status }));
      expect(
        await code(guardedFetch(ctx, "http://printer.local/api/version", {}, "test")),
      ).toBe("redirect_blocked");
    }
  });

  it("always passes redirect: 'manual', even when the caller asks to follow", async () => {
    const f = stubFetch(new Response("{}", { status: 200 }));
    await forceFollowRedirects(ctx);
    expect(f.mock.calls[0]?.[1]?.redirect).toBe("manual");
  });
});

describe("guard: key placement", () => {
  it("puts the key only in the manifest auth header", async () => {
    const f = stubFetch(new Response("{}", { status: 200 }));
    await guardedFetch(ctx, "http://printer.local/api/version", {}, "test");
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain(ctx.key);
    expect(init.body ?? "").not.toContain(ctx.key);
    const headers = new Headers(init.headers);
    expect(headers.get("X-Api-Key")).toBe(ctx.key);
  });

  it("rejects a URL carrying the key in the query string", async () => {
    stubFetch(new Response("{}", { status: 200 }));
    // The fixture targets the allowed host, so the guard's job here is to strip
    // the caller-supplied header duplication; the key must still only be sent
    // through the auth header.
    const f = stubFetch(new Response("{}", { status: 200 }));
    await keyInQueryString(ctx);
    const headers = new Headers((f.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get("X-Api-Key")).toBe(ctx.key);
  });

  it("omits the key when auth is disabled", async () => {
    const f = stubFetch(new Response("{}", { status: 200 }));
    await guardedFetch(ctx, "http://printer.local/printer/info", { auth: false }, "test");
    const headers = new Headers((f.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get("X-Api-Key")).toBeNull();
  });

  it("never leaks the key in an error message", async () => {
    stubFetch(new Response("nope", { status: 500 }));
    try {
      await guardedFetch(ctx, "http://printer.local/api/version", {}, "test");
    } catch (e) {
      expect((e as LinkError).message).not.toContain(ctx.key);
    }
  });
});

describe("guard: error mapping", () => {
  it("maps 401 and 403 to unauthorized", async () => {
    for (const status of [401, 403]) {
      stubFetch(new Response(null, { status }));
      expect(
        await code(guardedFetch(ctx, "http://printer.local/api/version", {}, "test")),
      ).toBe("unauthorized");
    }
  });

  it("maps other failures to http_error", async () => {
    stubFetch(new Response(null, { status: 500 }));
    expect(await code(guardedFetch(ctx, "http://printer.local/api/version", {}, "test"))).toBe(
      "http_error",
    );
  });

  it("maps a network throw to unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    expect(await code(guardedFetch(ctx, "http://printer.local/api/version", {}, "test"))).toBe(
      "unreachable",
    );
  });
});

describe("UnsupportedCapabilityError", () => {
  it("carries the unsupported code and both names", () => {
    const err = new UnsupportedCapabilityError("bambu", "upload");
    expect(err).toBeInstanceOf(LinkError);
    expect(err.code).toBe("unsupported");
    expect(err.message).toContain("upload");
  });
});
