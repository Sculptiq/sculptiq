# RFC / Wanted: Bambu Lab LAN connector

**Labels:** `connector`, `wanted`, `rfc`, `help wanted`
**Bounty:** Cortex Points, wanted-connector tier (see [CONTRIBUTOR-PROGRAM.md](./CONTRIBUTOR-PROGRAM.md))
**Status:** open — no accepted design yet

---

## What we want

Sculptiq can export G-code and send it straight to OctoPrint, Moonraker (Klipper) and
PrusaLink. Bambu Lab printers are the biggest gap. Today `printerLink.ts` refuses them
explicitly:

> Bambu printers cannot be driven from a browser tab. Bambu LAN mode needs MQTT over TLS
> plus FTPS, which browsers do not allow.

We want that to stop being true.

## Read this before you start

The constraint is real and it is not going away:

- Sculptiq Studio runs **in a browser**, on the Cloudflare edge runtime.
- Only `fetch` to an HTTP(S) endpoint the browser is allowed to reach. **No raw TCP, no
  MQTT-over-TLS, no FTPS, no serial.**
- Mixed content applies: an `https://` page cannot call a plain `http://` LAN host
  without an explicit user exception.
- CORS applies: the device or helper must return permissive headers, or the required
  configuration must be documented.

So: **a browser-native Bambu connector is not possible.** Please do not open a PR that
assumes it is — three people have already rediscovered the TLS wall.

## The expected answer: a local bridge

A small helper the user runs on their own LAN (the Raspberry Pi next to the printer is
the obvious host) that:

1. speaks native Bambu LAN — MQTT over TLS for state and commands, FTPS for file upload,
2. exposes a plain HTTP surface with permissive CORS,
3. is authenticated with a single API key passed in one header.

The connector then targets the bridge, transport `mqtt-bridge`, and is an ordinary
spec-compliant connector like any other.

## Scope of a complete contribution

- [ ] **Design comment in this issue first** — bridge language/runtime, HTTP surface,
      auth scheme, how the user installs it. Agree the approach before writing code.
- [ ] Bridge implementation (packaging location is an open question — see workflow doc §8).
- [ ] `packages/connectors/bambu.ts` implementing the v1
      [spec](./CONNECTOR-SPEC.md): manifest with `transport: 'mqtt-bridge'`,
      `status: 'community'`, a narrow `hostPattern`, `maintainer` set.
- [ ] Declared capabilities only; everything else throws `UnsupportedCapabilityError`.
      A test/upload/status-only first cut is welcome — commands can come later.
- [ ] `fetchStatus` normalised to the shared shape: Celsius, progress `0..1`, seconds.
- [ ] Unit tests for status normalisation and error mapping.
- [ ] **Hardware evidence** — log or screenshot of `testConnection`, a real G-code
      upload and a status poll against an actual Bambu machine.
- [ ] Setup docs: how to install the bridge, what to configure on the printer, what the
      mixed-content story is.

## Non-negotiable

Key only in `manifest.authHeader`. Every request through `guard.ts`. No `eval`, no
dynamic import, no new runtime dependency in the connector without prior approval, no
persistence, no telemetry. The full contract is in
[CONNECTOR-SPEC.md §5](./CONNECTOR-SPEC.md).

## Why you might want to do this

You own a Bambu, you want it wired into Sculptiq, and nobody else is better placed to
crack the LAN protocol. Merged connectors are attributed to your wallet-verified BBUD
profile and earn on the same cumulative Cortex Points ladder as the bug bounty; you
become the maintainer of record for the file.
