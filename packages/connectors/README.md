# @connectors — printer connector package

Every network call Sculptiq makes to a printer lives here. The app itself never
talks to a printer directly: `src/lib/studio/printerLink.ts` is a thin dispatcher
over the registry in this folder.

## Layout

| File | Purpose |
| --- | --- |
| `types.ts` | The contract: manifests, `LinkContext`, `PrinterConnector`, error classes. Types only, no runtime behaviour. |
| `guard.ts` | `guardedFetch` — the **only** egress path. Normalise → allowlist → `redirect: 'manual'` → hard fail on 3xx. |
| `index.ts` | Registry (`registry`, `getConnector`, `listConnectors`) and public re-exports. |
| `octoprint.ts`, `moonraker.ts`, `prusalink.ts` | Reference connectors. Read these before writing your own. |
| `bambu.ts` | Declared but not drivable from a browser tab — every capability throws. See `docs/connector-program/ISSUE-bambu-lan.md`. |
| `conformance.ts` | `runConformance(connector)` — the harness your connector must pass. |
| `__fixtures__/hostile.ts` | Hostile inputs the guard is tested against. |

## The one hard rule

**Never call `fetch` directly.** All requests go through `guardedFetch(ctx, url, init, what)`.
The guard injects the API key into `manifest.authHeader` for you — connectors never
place the key themselves, never put it in a URL, and never add a second auth header.
A bare `fetch` in a connector is an automatic PR rejection, and the conformance
harness will fail the build.

## Adding a connector

1. Read `docs/connector-program/CONNECTOR-SPEC.md` (the normative contract) and
   `docs/connector-program/CONTRIBUTING.md` (process, reward attribution).
2. Open a **New connector** issue first so nobody duplicates your work.
3. Create `packages/connectors/<kind>.ts` exporting a `PrinterConnector`:
   - a `ConnectorManifest` declaring exactly the capabilities you implement;
   - undeclared capabilities must throw `UnsupportedCapabilityError`;
   - normalise the printer's payload into `PrinterStatus` — no raw passthrough
     except in the optional `raw` field.
4. Add the kind to the `LinkKind` union in `types.ts` and to `registry` in `index.ts`.
5. Add behaviour tests in `tests/` modelled on `tests/connector-reference.test.ts`.
   The conformance test picks up your connector from the registry automatically.

## Running the tests

```bash
bunx vitest run tests/connector-guard.test.ts        # guard / hostile fixtures
bunx vitest run tests/connector-reference.test.ts    # reference connector behaviour
bunx vitest run tests/connector-conformance.test.ts  # contract conformance (all connectors)
bunx vitest run tests/connector-dispatch.test.ts     # app dispatcher
```

Or everything at once: `bunx vitest run`.

## Constraints

- No new dependencies. These modules ship to the browser and must stay dependency-free.
- No state, no globals, no logging of keys or response bodies.
- Errors are `LinkError` with a `code` from `LinkErrorCode` and a human `hint`.

Code ownership for this folder is defined in `CODEOWNERS`.
