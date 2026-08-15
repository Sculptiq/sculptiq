/**
 * Connector conformance harness — see docs/connector-program/CONNECTOR-SPEC.md.
 *
 * Framework-agnostic on purpose: it returns a list of check results so it can run
 * inside vitest, inside a script, or in CI. Contributors run this against their own
 * connector before opening a PR; every check must pass.
 *
 * Usage:
 *   const results = await runConformance(myConnector);
 *   const failed = results.filter((r) => !r.ok);
 */

import {
  LinkError,
  UnsupportedCapabilityError,
  type Capability,
  type LinkContext,
  type PrinterConnector,
} from "./types";

export interface ConformanceCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

const CAPABILITIES: Capability[] = ["test", "upload", "status", "command"];
const TRANSPORTS = ["http", "https-lan", "mqtt-bridge"];
const STATUSES = ["reference", "community", "unmaintained"];

const KEY = "CONFORMANCE-KEY-0123456789";
const HOST = "http://printer.local";

type Fetcher = typeof fetch;

function ctxFor(c: PrinterConnector, baseHost = HOST): LinkContext {
  return { kind: c.manifest.kind, baseHost, key: KEY, manifest: c.manifest };
}

function jsonFetch(status = 200): { fn: Fetcher; calls: Array<[string, RequestInit]> } {
  const calls: Array<[string, RequestInit]> = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push([String(input), init ?? {}]);
    return new Response("{}", { status, headers: { "content-type": "application/json" } });
  }) as Fetcher;
  return { fn, calls };
}

/** Call one capability with throwaway arguments. */
function invoke(c: PrinterConnector, cap: Capability, ctx: LinkContext): Promise<unknown> {
  switch (cap) {
    case "test":
      return c.testConnection(ctx);
    case "upload":
      return c.uploadGcode(ctx, new Blob(["G28\n"]), {
        fileName: "conformance.gcode",
        autoStart: false,
      });
    case "status":
      return c.fetchStatus(ctx);
    case "command":
      return c.sendCommand(ctx, "pause");
  }
}

async function withFetch<T>(fn: Fetcher, body: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    return await body();
  } finally {
    globalThis.fetch = original;
  }
}

export async function runConformance(c: PrinterConnector): Promise<ConformanceCheck[]> {
  const out: ConformanceCheck[] = [];
  const push = (name: string, ok: boolean, detail?: string) =>
    out.push(detail === undefined ? { name, ok } : { name, ok, detail });

  const m = c.manifest;

  // ---- manifest ----------------------------------------------------------
  push("manifest.kind is a non-empty lowercase-kebab id", /^[a-z][a-z0-9-]*$/.test(m.kind ?? ""), m.kind);
  push("manifest.displayName is set", typeof m.displayName === "string" && m.displayName.length > 0);
  push("manifest.transport is a known transport", TRANSPORTS.includes(m.transport), m.transport);
  push(
    "manifest.capabilities only contains known capabilities",
    Array.isArray(m.capabilities) && m.capabilities.every((x) => CAPABILITIES.includes(x)),
    JSON.stringify(m.capabilities),
  );
  push(
    "manifest.capabilities has no duplicates",
    Array.isArray(m.capabilities) && new Set(m.capabilities).size === m.capabilities.length,
  );
  push("manifest.authHeader is a single header name", typeof m.authHeader === "string" && /^[A-Za-z0-9-]+$/.test(m.authHeader), m.authHeader);
  push("manifest.hostPattern is a RegExp", m.hostPattern instanceof RegExp);
  push("manifest.maintainer is set", typeof m.maintainer === "string" && m.maintainer.length > 0);
  push("manifest.status is a known lifecycle status", STATUSES.includes(m.status), m.status);

  // ---- shape -------------------------------------------------------------
  for (const fnName of ["testConnection", "uploadGcode", "fetchStatus", "sendCommand"] as const) {
    push(`implements ${fnName}()`, typeof c[fnName] === "function");
  }

  const declared = new Set(m.capabilities ?? []);

  // ---- undeclared capabilities must throw Unsupported --------------------
  for (const cap of CAPABILITIES) {
    if (declared.has(cap)) continue;
    const { fn } = jsonFetch();
    let ok = false;
    let detail = "resolved instead of throwing";
    await withFetch(fn, async () => {
      try {
        await invoke(c, cap, ctxFor(c));
      } catch (err) {
        const isUnsupported =
          err instanceof UnsupportedCapabilityError ||
          (err instanceof LinkError && err.code === "unsupported");
        ok = isUnsupported;
        detail = isUnsupported ? "" : `threw ${(err as Error)?.name}`;
      }
    });
    push(`undeclared capability "${cap}" throws Unsupported`, ok, detail || undefined);
  }

  // ---- every declared capability goes through the guard ------------------
  // A bad base protocol is rejected by normalizeUrl before any request is made.
  // If a connector calls fetch() directly, the stub records a call and this fails.
  for (const cap of declared) {
    const { fn, calls } = jsonFetch();
    let code: string | undefined;
    await withFetch(fn, async () => {
      try {
        await invoke(c, cap, ctxFor(c, "ftp://printer.local"));
      } catch (err) {
        code = err instanceof LinkError ? err.code : (err as Error)?.name;
      }
    });
    push(
      `"${cap}" refuses a non-http base URL without calling fetch`,
      calls.length === 0 && code === "bad_url",
      `calls=${calls.length} code=${code}`,
    );
  }

  // ---- redirects are a hard failure --------------------------------------
  for (const cap of declared) {
    const redirect = (async () => new Response(null, { status: 302 })) as Fetcher;
    let code: string | undefined;
    await withFetch(redirect, async () => {
      try {
        await invoke(c, cap, ctxFor(c));
      } catch (err) {
        code = err instanceof LinkError ? err.code : (err as Error)?.name;
      }
    });
    push(`"${cap}" surfaces a redirect as redirect_blocked`, code === "redirect_blocked", code);
  }

  // ---- the key never leaks into a URL, and lives in one header only ------
  for (const cap of declared) {
    const { fn, calls } = jsonFetch();
    await withFetch(fn, async () => {
      try {
        await invoke(c, cap, ctxFor(c));
      } catch {
        /* payload shape is not what this check is about */
      }
    });
    const inUrl = calls.some(([url]) => url.includes(KEY));
    push(`"${cap}" never puts the key in the URL`, !inUrl);

    const strayHeader = calls.some(([, init]) => {
      const headers = new Headers(init.headers as HeadersInit | undefined);
      for (const [name, value] of headers.entries()) {
        if (value.includes(KEY) && name.toLowerCase() !== m.authHeader.toLowerCase()) return true;
      }
      return false;
    });
    push(`"${cap}" only sends the key in ${m.authHeader}`, !strayHeader);
  }

  return out;
}

/** Convenience for scripts: throws with a readable report when anything fails. */
export async function assertConformance(c: PrinterConnector): Promise<void> {
  const results = await runConformance(c);
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(
      `Connector "${c.manifest.kind}" failed conformance:\n` +
        failed.map((r) => `  - ${r.name}${r.detail ? ` (${r.detail})` : ""}`).join("\n"),
    );
  }
}
