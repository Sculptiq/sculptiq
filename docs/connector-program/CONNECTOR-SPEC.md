# Sculptiq Printer Connector Specification — v1

A **connector** teaches Sculptiq how to talk to one family of 3D printers or print
servers. This document is the contract. A pull request that violates it is not merged,
regardless of how well the printer works.

---

## 1. Runtime reality (read this first)

Sculptiq Studio runs **in the browser**, on the Cloudflare edge runtime.

That means:

- **No runtime plugin loading.** Connectors are bundled at build time. There is no store,
  no `import()` of user-supplied files. Your connector ships in a Sculptiq release.
- **No raw TCP, no MQTT-over-TLS, no FTPS, no serial.** Only `fetch` to an HTTP(S)
  endpoint the browser is allowed to reach.
- **Mixed content applies.** An `https://` Sculptiq page cannot call a plain `http://`
  LAN host without the user's explicit browser exception. Document this if it applies.
- **CORS applies.** The printer/server must return permissive CORS headers, or the
  contribution must document the required configuration change.

If a printer's protocol is not browser-legal (Bambu Lab is the canonical example), the
acceptable answer is a **local bridge**: a small helper the user runs on their own LAN
that speaks the native protocol and exposes a plain HTTP surface. The connector then
targets the bridge. Do not open a PR that assumes browser TCP.

---

## 2. Anatomy

Each connector is one module under `packages/connectors/`, exporting a manifest and an
implementation:

```
packages/connectors/
  index.ts              # registry — imports every connector
  types.ts              # ConnectorManifest, PrinterConnector, shared types
  guard.ts              # host allowlist enforcement (do not bypass)
  octoprint.ts          # reference
  moonraker.ts          # reference
  prusalink.ts          # reference
  <your-printer>.ts     # your contribution
```

`src/lib/studio/printerLink.ts` is a thin dispatcher over the registry. You should not
need to edit it beyond adding your `LinkKind` value.

---

## 3. The manifest (mandatory)

```ts
export interface ConnectorManifest {
  /** Stable identifier, added to the LinkKind union. lowercase-kebab. */
  kind: LinkKind;
  /** Human label shown in the printer-link UI. */
  displayName: string;
  /** How the connector reaches the device. */
  transport: 'http' | 'https-lan' | 'mqtt-bridge';
  /** Exactly what this connector can do. Unlisted capabilities must throw Unsupported. */
  capabilities: ('test' | 'upload' | 'status' | 'command')[];
  /** The single header the API key may appear in. No other placement is allowed. */
  authHeader: string;
  /** Allowlist for every outbound request. Enforced at runtime by guard.ts. */
  hostPattern: RegExp;
  /** GitHub handle of the maintainer of record. */
  maintainer: string;
  /** Lifecycle status, rendered verbatim in the UI. */
  status: 'reference' | 'community' | 'unmaintained';
}
```

The manifest is not documentation. The UI reads `capabilities` to decide which buttons
to render, `status` to decide whether to show the "community connector, best-effort"
notice, and `hostPattern` is enforced on every request.

---

## 4. The implementation

```ts
export interface PrinterConnector {
  manifest: ConnectorManifest;

  /** Cheapest possible round-trip that proves host + key are valid. */
  testConnection(ctx: LinkContext): Promise<TestResult>;

  /** Upload a G-code file. Optionally start the print. */
  uploadGcode(ctx: LinkContext, file: Blob, opts: UploadOptions): Promise<UploadResult>;

  /** Normalised current state. Must not throw on a printer that is simply idle. */
  fetchStatus(ctx: LinkContext): Promise<PrinterStatus>;

  /** Send a supported control command. */
  sendCommand(ctx: LinkContext, command: PrinterCommand): Promise<CommandResult>;
}
```

`LinkContext` carries the normalised base host and the API key. It is the **only** source
of both. Never read configuration from elsewhere, never accept a second host.

Every function that the manifest does not list in `capabilities` must throw
`new UnsupportedCapabilityError(kind, capability)`. Do not return fake success.

### Normalisation rules

- `fetchStatus` must map the printer's native state to the shared `PrinterStatus` shape
  (`state`, `progress`, `temps`, `jobName`, `raw`). Put anything non-standard under `raw`.
- Temperatures are Celsius. Progress is `0..1`. Times are seconds.
- Errors are thrown as `LinkError` with a user-readable `message` and a machine `code`.
  Never surface a raw stack trace or the API key in a message.

---

## 5. Security contract (enforced, not advisory)

1. **One host only.** Every request goes to the normalised base host from `LinkContext`
   and must match `hostPattern`. No telemetry, no analytics, no update checks, no CDN
   fetches, no fallback mirrors.
2. **Key placement.** The API key appears only in `manifest.authHeader`. Not in query
   strings, not in bodies, not in logs, not in error messages.
3. **No dynamic execution.** No `eval`, no `new Function`, no dynamic `import()`, no
   injected `<script>`.
4. **No new dependencies.** Use the platform (`fetch`, `URL`, `TextDecoder`). A new
   dependency requires explicit reviewer approval in the PR before implementation.
5. **No persistence.** Connectors do not write to `localStorage`, `IndexedDB` or cookies.
   State belongs to the caller.
6. **No user-data reads.** A connector receives exactly what is in `LinkContext`.

All outbound requests go through `guard.ts`, which applies this **normative order**:

1. **Normalise** the URL — reject non-`http(s)` schemes, embedded credentials
   (`user:pass@`), and any host differing from the `LinkContext` base host.
2. **Allowlist** — the parsed origin must match `hostPattern` (never match on the raw
   string).
3. **`redirect: 'manual'`** on every request — the platform must never follow a redirect,
   because a followed redirect escapes the allowlist silently.
4. **Hard fail on any 3xx** — a redirect is a `LinkError` with code `redirect_blocked`,
   never re-issued against the `Location` header.
5. **No non-`fetch` egress** — `WebSocket`, `EventSource`, `navigator.sendBeacon`,
   `<img>`/`<script>`/`<link>` beacons and dynamic `import()` are forbidden.

Bypassing the guard — constructing a bare `fetch` or any of the above — is an automatic
rejection. The guard is unit-tested against a hostile fixture connector that attempts
each violation.

---

## 6. Support policy

Connectors ship **as-is, best-effort, version-tagged**. The `maintainer` in the manifest
is the maintainer of record and is the first responder for defects in that connector.
A connector whose maintainer is unreachable for two release cycles is flipped to
`status: 'unmaintained'` and may be removed in a later release. This is not a judgement
of quality; it is how the project avoids owning every printer's quirks forever.

---

## 7. Review checklist

A PR is merged when all of the following hold:

- [ ] Manifest present, accurate, `status: 'community'`, `maintainer` set.
- [ ] `hostPattern` is as narrow as the protocol allows.
- [ ] Every declared capability is implemented; every undeclared one throws.
- [ ] No network call outside the guard; no `eval`; no dynamic import; no new dependency.
- [ ] Key only in `authHeader`; absent from logs and error messages.
- [ ] `fetchStatus` normalises to the shared shape and tolerates an idle printer.
- [ ] Unit tests for status normalisation and error mapping.
- [ ] **Hardware evidence**: log or screenshot of `testConnection`, an upload, and a
      status poll against a real device.
- [ ] `CODEOWNERS` entry added for the new file.

---

## 8. Wanted

Highest-value gaps, in order:

1. **Bambu Lab LAN** — currently unsupported; native protocol is not browser-legal.
   A local-bridge design is the expected answer. See the seed RFC issue.
2. **Duet / RepRapFirmware** — non-standard REST surface.
3. **Repetier-Server**.
4. **MKS boards** and region-specific derivatives.

Not wanted: changes to the OctoPrint, Moonraker or PrusaLink reference connectors beyond
genuine bug fixes. Those paths are stable.