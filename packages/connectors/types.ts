/**
 * Shared connector contract — see docs/connector-program/CONNECTOR-SPEC.md §3 and §4.
 * This module is types + error classes only. No network, no state, no dependencies.
 */

export type LinkKind = "octoprint" | "moonraker" | "prusalink" | "bambu";

export type Capability = "test" | "upload" | "status" | "command";

export interface ConnectorManifest {
  /** Stable identifier, part of the LinkKind union. lowercase-kebab. */
  kind: LinkKind;
  /** Human label shown in the printer-link UI. */
  displayName: string;
  /** How the connector reaches the device. */
  transport: "http" | "https-lan" | "mqtt-bridge";
  /** Exactly what this connector can do. Unlisted capabilities must throw Unsupported. */
  capabilities: Capability[];
  /** The single header the API key may appear in. No other placement is allowed. */
  authHeader: string;
  /** Allowlist for every outbound request. Enforced at runtime by guard.ts. */
  hostPattern: RegExp;
  /** GitHub handle of the maintainer of record. */
  maintainer: string;
  /** Lifecycle status, rendered verbatim in the UI. */
  status: "reference" | "community" | "unmaintained";
}

/** The only source of host and key a connector is allowed to read. */
export interface LinkContext {
  kind: LinkKind;
  /** Normalised origin, e.g. "http://octopi.local" — no trailing slash, no path. */
  baseHost: string;
  key: string;
  manifest: ConnectorManifest;
}

export interface PrinterStatus {
  state: string;
  /** 0..1 */
  progress: number | null;
  /** Celsius */
  nozzleTemp: number | null;
  nozzleTarget: number | null;
  bedTemp: number | null;
  bedTarget: number | null;
  fileName: string | null;
  /** Seconds */
  elapsedSec: number | null;
  /** Anything non-standard the printer reported. */
  raw?: unknown;
}

export interface TestResult {
  name: string;
  version: string;
}

export interface UploadOptions {
  fileName: string;
  /** Start the print immediately after upload. */
  autoStart: boolean;
}

export interface UploadResult {
  fileName: string;
  started: boolean;
}

export type PrinterCommand = "pause" | "resume" | "cancel";

export interface CommandResult {
  command: PrinterCommand;
  accepted: boolean;
}

export type LinkErrorCode =
  | "bad_url"
  | "host_not_allowed"
  | "redirect_blocked"
  | "unreachable"
  | "unauthorized"
  | "http_error"
  | "unsupported";

export class LinkError extends Error {
  code: LinkErrorCode;
  hint?: string;
  constructor(message: string, code: LinkErrorCode, hint?: string) {
    super(message);
    this.name = "LinkError";
    this.code = code;
    if (hint !== undefined) this.hint = hint;
  }
}

export class UnsupportedCapabilityError extends LinkError {
  constructor(kind: LinkKind, capability: Capability) {
    super(
      `The ${kind} connector does not support "${capability}"`,
      "unsupported",
    );
    this.name = "UnsupportedCapabilityError";
  }
}

export interface PrinterConnector {
  manifest: ConnectorManifest;
  testConnection(ctx: LinkContext): Promise<TestResult>;
  uploadGcode(ctx: LinkContext, file: Blob, opts: UploadOptions): Promise<UploadResult>;
  fetchStatus(ctx: LinkContext): Promise<PrinterStatus>;
  sendCommand(ctx: LinkContext, command: PrinterCommand): Promise<CommandResult>;
}
