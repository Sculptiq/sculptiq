# Pull request

## What this changes

<!-- One or two sentences. Link the issue this implements: Closes #___ -->

## Spec reference

<!-- Which section of docs/connector-program/CONNECTOR-SPEC.md does this implement or change? -->

## Checklist

- [ ] Every network call goes through `guardedFetch` — no bare `fetch` anywhere in the diff
- [ ] The API key is only ever placed by the guard, in `manifest.authHeader` (never in a URL, query string, or body)
- [ ] `manifest.capabilities` lists exactly what is implemented; undeclared capabilities throw `UnsupportedCapabilityError`
- [ ] Printer payloads are normalised into `PrinterStatus` (raw data only in the optional `raw` field)
- [ ] Behaviour tests added under `tests/` (see `tests/connector-reference.test.ts`)
- [ ] `bunx vitest run` passes locally, including `tests/connector-conformance.test.ts`
- [ ] No new npm dependencies
- [ ] No unrelated files touched (no reformatting, no drive-by refactors)

## Hardware verification

<!-- Which printer/firmware version did you test against, and which capabilities did you exercise on real hardware? -->

## Reward attribution

BBUD handle: <!-- @yourhandle — used to credit Cortex Points; leave blank to decline -->
