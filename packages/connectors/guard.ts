/**
 * The only egress path for connectors. See CONNECTOR-SPEC.md §5.
 *
 * Normative order: normalise -> allowlist -> redirect: 'manual' -> hard fail on 3xx.
 * Bypassing this function with a bare fetch is an automatic PR rejection.
 */

import { LinkError, type LinkContext } from "./types";

/** Remove the API key from any string that is about to reach a user or a log. */
function scrub(text: string, key: string): string {
  if (!key) return text;
  return text.split(key).join("***");
}

function parseBase(ctx: LinkContext): URL {
  try {
    return new URL(ctx.baseHost);
  } catch {
    throw new LinkError("The printer address is not a valid URL", "bad_url");
  }
}

/** Step 1 + 2: normalise the target URL and check it against the manifest allowlist. */
export function normalizeUrl(ctx: LinkContext, url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url, ctx.baseHost);
  } catch {
    throw new LinkError("The request address is not a valid URL", "bad_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new LinkError("Only http and https requests are allowed", "bad_url");
  }
  if (parsed.username || parsed.password) {
    throw new LinkError("Credentials in the address are not allowed", "bad_url");
  }

  const base = parseBase(ctx);
  if (parsed.host !== base.host || parsed.protocol !== base.protocol) {
    throw new LinkError(
      "This connector may only talk to the printer address you configured",
      "host_not_allowed",
    );
  }
  if (!ctx.manifest.hostPattern.test(parsed.origin)) {
    throw new LinkError(
      "The printer address is not allowed by this connector",
      "host_not_allowed",
    );
  }
  return parsed;
}

export interface GuardedInit extends Omit<RequestInit, "redirect"> {
  /** Set to false for endpoints that take no API key (e.g. Moonraker). */
  auth?: boolean;
}

/**
 * Perform a guarded request. The API key is injected here, into
 * `manifest.authHeader` only — connectors never place it themselves.
 */
export async function guardedFetch(
  ctx: LinkContext,
  url: string,
  init: GuardedInit,
  what: string,
): Promise<Response> {
  const target = normalizeUrl(ctx, url);

  const { auth = true, headers, ...rest } = init;
  const merged = new Headers(headers as HeadersInit | undefined);
  merged.delete(ctx.manifest.authHeader);
  if (auth && ctx.key) merged.set(ctx.manifest.authHeader, ctx.key);

  let res: Response;
  try {
    res = await fetch(target.toString(), {
      ...rest,
      headers: merged,
      redirect: "manual",
    });
  } catch (err) {
    throw new LinkError(
      scrub(`Could not reach the printer while trying to ${what}`, ctx.key),
      "unreachable",
      "The browser blocked the request or the host is unreachable. Check the address, make sure you are on the same network, and allow cross-origin access in the printer's web interface (OctoPrint: Settings > API > CORS; Moonraker: cors_domains in moonraker.conf).",
    );
  }

  // Step 4: a redirect escapes the allowlist silently, so it is a hard failure.
  // `redirect: 'manual'` surfaces as an opaqueredirect response in browsers.
  if ((res.status >= 300 && res.status < 400) || res.type === "opaqueredirect") {
    throw new LinkError(
      `The printer redirected the request while trying to ${what}`,
      "redirect_blocked",
      "Redirects are blocked for safety. Point the connector directly at the printer's own address.",
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new LinkError(
      "The printer rejected the API key",
      "unauthorized",
      "Copy a fresh key from the printer's web interface.",
    );
  }
  if (!res.ok) {
    throw new LinkError(
      scrub(`Printer returned ${res.status} while trying to ${what}`, ctx.key),
      "http_error",
    );
  }
  return res;
}
