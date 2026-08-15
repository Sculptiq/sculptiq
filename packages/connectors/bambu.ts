/**
 * Bambu Lab — declared but not drivable from a browser tab.
 *
 * Bambu LAN mode needs MQTT over TLS plus FTPS. Neither is reachable from page
 * JavaScript, so there is no honest implementation here: every capability throws.
 * The expected answer is a local bridge on the user's LAN exposing plain HTTP;
 * see docs/connector-program/ISSUE-bambu-lan.md.
 */

import {
  LinkError,
  UnsupportedCapabilityError,
  type ConnectorManifest,
  type PrinterConnector,
} from "./types";

const manifest: ConnectorManifest = {
  kind: "bambu",
  displayName: "Bambu Lab (not supported in the browser)",
  transport: "mqtt-bridge",
  capabilities: [],
  authHeader: "X-Api-Key",
  hostPattern: /^https?:\/\/[^/@]+$/,
  maintainer: "sculptiq",
  status: "unmaintained",
};

export const bambu: PrinterConnector = {
  manifest,

  async testConnection(): Promise<never> {
    throw new LinkError(
      "Bambu printers cannot be driven from a browser tab",
      "unsupported",
      "Bambu LAN mode needs MQTT over TLS plus FTPS, which browsers do not allow. Export the G-code and load it through Bambu Studio, the Bambu Handy app, or an SD card.",
    );
  },

  async uploadGcode(): Promise<never> {
    throw new UnsupportedCapabilityError("bambu", "upload");
  },

  async fetchStatus(): Promise<never> {
    throw new UnsupportedCapabilityError("bambu", "status");
  },

  async sendCommand(): Promise<never> {
    throw new UnsupportedCapabilityError("bambu", "command");
  },
};
