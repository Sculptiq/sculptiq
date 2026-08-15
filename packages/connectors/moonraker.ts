/** Moonraker / Klipper reference connector. Takes no API key in this flow. */

import { guardedFetch } from "./guard";
import type {
  CommandResult,
  ConnectorManifest,
  LinkContext,
  PrinterCommand,
  PrinterConnector,
  PrinterStatus,
  TestResult,
  UploadOptions,
  UploadResult,
} from "./types";

const manifest: ConnectorManifest = {
  kind: "moonraker",
  displayName: "Moonraker (Klipper)",
  transport: "http",
  capabilities: ["test", "upload", "status", "command"],
  authHeader: "X-Api-Key",
  hostPattern: /^https?:\/\/[^/@]+$/,
  maintainer: "sculptiq",
  status: "reference",
};

export const moonraker: PrinterConnector = {
  manifest,

  async testConnection(ctx: LinkContext): Promise<TestResult> {
    const res = await guardedFetch(
      ctx,
      `${ctx.baseHost}/printer/info`,
      { auth: false },
      "identify the printer",
    );
    const j = (await res.json()) as {
      result?: { hostname?: string; software_version?: string };
    };
    return {
      name: j.result?.hostname ?? "Klipper",
      version: j.result?.software_version ?? "",
    };
  },

  async uploadGcode(
    ctx: LinkContext,
    file: Blob,
    opts: UploadOptions,
  ): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file, opts.fileName);
    form.append("root", "gcodes");
    if (opts.autoStart) form.append("print", "true");
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/server/files/upload`,
      { method: "POST", body: form, auth: false },
      "upload the file",
    );
    return { fileName: opts.fileName, started: opts.autoStart };
  },

  async fetchStatus(ctx: LinkContext): Promise<PrinterStatus> {
    const res = await guardedFetch(
      ctx,
      `${ctx.baseHost}/printer/objects/query?print_stats&extruder&heater_bed&display_status`,
      { auth: false },
      "read the printer state",
    );
    const j = (await res.json()) as {
      result?: {
        status?: {
          print_stats?: { state?: string; filename?: string; print_duration?: number };
          extruder?: { temperature?: number; target?: number };
          heater_bed?: { temperature?: number; target?: number };
          display_status?: { progress?: number };
        };
      };
    };
    const st = j.result?.status;
    return {
      state: st?.print_stats?.state ?? "unknown",
      progress: st?.display_status?.progress ?? null,
      nozzleTemp: st?.extruder?.temperature ?? null,
      nozzleTarget: st?.extruder?.target ?? null,
      bedTemp: st?.heater_bed?.temperature ?? null,
      bedTarget: st?.heater_bed?.target ?? null,
      fileName: st?.print_stats?.filename ?? null,
      elapsedSec: st?.print_stats?.print_duration ?? null,
      raw: j,
    };
  },

  async sendCommand(ctx: LinkContext, command: PrinterCommand): Promise<CommandResult> {
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/printer/print/${command}`,
      { method: "POST", auth: false },
      `${command} the print`,
    );
    return { command, accepted: true };
  },
};
