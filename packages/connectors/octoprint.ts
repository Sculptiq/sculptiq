/** OctoPrint reference connector. See CONNECTOR-SPEC.md. */

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
  kind: "octoprint",
  displayName: "OctoPrint",
  transport: "http",
  capabilities: ["test", "upload", "status", "command"],
  authHeader: "X-Api-Key",
  hostPattern: /^https?:\/\/[^/@]+$/,
  maintainer: "sculptiq",
  status: "reference",
};

export const octoprint: PrinterConnector = {
  manifest,

  async testConnection(ctx: LinkContext): Promise<TestResult> {
    const res = await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/version`,
      {},
      "identify the printer",
    );
    const j = (await res.json()) as { server?: string; text?: string };
    return { name: j.text ?? "OctoPrint", version: j.server ?? "" };
  },

  async uploadGcode(
    ctx: LinkContext,
    file: Blob,
    opts: UploadOptions,
  ): Promise<UploadResult> {
    const form = new FormData();
    form.append("file", file, opts.fileName);
    form.append("select", "true");
    form.append("print", opts.autoStart ? "true" : "false");
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/files/local`,
      { method: "POST", body: form },
      "upload the file",
    );
    return { fileName: opts.fileName, started: opts.autoStart };
  },

  async fetchStatus(ctx: LinkContext): Promise<PrinterStatus> {
    const [pRes, jRes] = await Promise.all([
      guardedFetch(ctx, `${ctx.baseHost}/api/printer`, {}, "read the printer state"),
      guardedFetch(ctx, `${ctx.baseHost}/api/job`, {}, "read the job state"),
    ]);
    const p = (await pRes.json()) as {
      state?: { text?: string };
      temperature?: Record<string, { actual?: number; target?: number }>;
    };
    const j = (await jRes.json()) as {
      progress?: { completion?: number; printTime?: number };
      job?: { file?: { name?: string } };
    };
    return {
      state: p.state?.text ?? "Unknown",
      progress:
        typeof j.progress?.completion === "number" ? j.progress.completion / 100 : null,
      nozzleTemp: p.temperature?.["tool0"]?.actual ?? null,
      nozzleTarget: p.temperature?.["tool0"]?.target ?? null,
      bedTemp: p.temperature?.["bed"]?.actual ?? null,
      bedTarget: p.temperature?.["bed"]?.target ?? null,
      fileName: j.job?.file?.name ?? null,
      elapsedSec: j.progress?.printTime ?? null,
      raw: { printer: p, job: j },
    };
  },

  async sendCommand(ctx: LinkContext, command: PrinterCommand): Promise<CommandResult> {
    const body =
      command === "cancel"
        ? { command: "cancel" }
        : { command: "pause", action: command };
    await guardedFetch(
      ctx,
      `${ctx.baseHost}/api/job`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      `${command} the print`,
    );
    return { command, accepted: true };
  },
};
