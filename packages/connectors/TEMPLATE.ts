/**
 * Copy-me skeleton for a new connector. NOT registered in index.ts.
 *
 * 1. Copy this file to `packages/connectors/<your-kind>.ts`.
 * 2. Add `"<your-kind>"` to the `LinkKind` union in `types.ts` and to `registry` in `index.ts`.
 * 3. Fill in the manifest, then implement exactly the capabilities you declare.
 *    Anything you do not declare must keep throwing `UnsupportedCapabilityError`.
 * 4. Every request goes through `guardedFetch` — never call `fetch` directly, and never
 *    place the API key yourself; the guard puts it in `manifest.authHeader`.
 *
 * Contract: docs/connector-program/CONNECTOR-SPEC.md
 */

// import { guardedFetch } from "./guard";
import {
  UnsupportedCapabilityError,
  type CommandResult,
  type ConnectorManifest,
  type LinkContext,
  type PrinterCommand,
  type PrinterConnector,
  type PrinterStatus,
  type TestResult,
  type UploadOptions,
  type UploadResult,

} from "./types";

const manifest: ConnectorManifest = {
  // TODO: must also exist in the LinkKind union. lowercase-kebab.
  kind: "octoprint",
  // TODO: shown in the printer-link UI, e.g. "Duet (RepRapFirmware)".
  displayName: "TODO",
  // TODO: "http" | "https-lan" | "mqtt-bridge".
  transport: "http",
  // TODO: declare only what you actually implement below.
  capabilities: [],
  // TODO: the single header the key may appear in, e.g. "X-Api-Key".
  authHeader: "X-Api-Key",
  // TODO: as narrow as the protocol allows.
  hostPattern: /^https?:\/\/[^/]+$/,
  // TODO: your GitHub handle — maintainer of record.
  maintainer: "TODO",
  status: "community",
};

export const template: PrinterConnector = {
  manifest,

  async testConnection(_ctx: LinkContext): Promise<TestResult> {
    throw new UnsupportedCapabilityError(manifest.kind, "test");
  },

  async uploadGcode(
    _ctx: LinkContext,
    _file: Blob,
    _opts: UploadOptions,
  ): Promise<UploadResult> {
    throw new UnsupportedCapabilityError(manifest.kind, "upload");
  },

  async fetchStatus(_ctx: LinkContext): Promise<PrinterStatus> {
    throw new UnsupportedCapabilityError(manifest.kind, "status");
  },

  async sendCommand(_ctx: LinkContext, _command: PrinterCommand): Promise<CommandResult> {
    throw new UnsupportedCapabilityError(manifest.kind, "command");
  },
};
