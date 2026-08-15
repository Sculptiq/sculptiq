/** PrusaLink reference connector. */

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
  kind: "prusalink",
  displayName: "PrusaLink",
  transport: "http",
  capabilities: ["test", "upload", "status", "command"],
  authHeader: "X-Api-Key",
  hostPattern: /^https?:\/\/[^/@]+$/,
  maintainer: "sculptiq",
  status: "reference",
};

export const prusalink: PrinterConnector = {
  manifest,

  async testConnection(ctx: LinkContext): Promise<TestResult> {
    const res = await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/version`,
      {},
      "identify the printer",
    );
    const j = (await res.json()) as { hostname?: string; text?: string; api?: string };
    return { name: j.hostname ?? j.text ?? "PrusaLink", version: j.api ?? "" };
  },

  async uploadGcode(
    ctx: LinkContext,
    file: Blob,
    opts: UploadOptions,
  ): Promise<UploadResult> {
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/v1/files/usb/${encodeURIComponent(opts.fileName)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "text/x.gcode",
          "Print-After-Upload": opts.autoStart ? "1" : "0",
          Overwrite: "1",
        },
        body: file,
      },
      "upload the file",
    );
    return { fileName: opts.fileName, started: opts.autoStart };
  },

  async fetchStatus(ctx: LinkContext): Promise<PrinterStatus> {
    const res = await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/v1/status`,
      {},
      "read the printer state",
    );
    const j = (await res.json()) as {
      printer?: {
        state?: string;
        temp_nozzle?: number;
        target_nozzle?: number;
        temp_bed?: number;
        target_bed?: number;
      };
      job?: { progress?: number; time_printing?: number; file?: { name?: string } };
    };
    return {
      state: j.printer?.state ?? "Unknown",
      progress: typeof j.job?.progress === "number" ? j.job.progress / 100 : null,
      nozzleTemp: j.printer?.temp_nozzle ?? null,
      nozzleTarget: j.printer?.target_nozzle ?? null,
      bedTemp: j.printer?.temp_bed ?? null,
      bedTarget: j.printer?.target_bed ?? null,
      fileName: j.job?.file?.name ?? null,
      elapsedSec: j.job?.time_printing ?? null,
      raw: j,
    };
  },

  async sendCommand(ctx: LinkContext, command: PrinterCommand): Promise<CommandResult> {
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/v1/job`,
      {
        method: command === "cancel" ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: command === "cancel" ? null : JSON.stringify({ action: command }),
      },
      `${command} the print`,
    );
    return { command, accepted: true };
  },
};
