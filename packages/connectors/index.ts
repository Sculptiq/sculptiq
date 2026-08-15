/** Connector registry. Every connector ships here, bundled at build time. */

import { bambu } from "./bambu";
import { moonraker } from "./moonraker";
import { octoprint } from "./octoprint";
import { prusalink } from "./prusalink";
import { LinkError, type LinkKind, type PrinterConnector } from "./types";

export const registry: Record<LinkKind, PrinterConnector> = {
  octoprint,
  moonraker,
  prusalink,
  bambu,
};

export function getConnector(kind: LinkKind): PrinterConnector {
  const c = registry[kind];
  if (!c) throw new LinkError(`Unknown printer type "${kind}"`, "unsupported");
  return c;
}

export function listConnectors(): PrinterConnector[] {
  return Object.values(registry);
}

export * from "./types";
export { guardedFetch, normalizeUrl } from "./guard";
