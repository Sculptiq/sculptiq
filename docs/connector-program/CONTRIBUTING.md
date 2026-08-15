# Contributing to Sculptiq Connectors

Thanks for wanting to teach Sculptiq about another printer. This page is the short
version; the binding rules are in [CONNECTOR-SPEC.md](./CONNECTOR-SPEC.md).

---

## What we accept

**Connectors.** One module per printer family under `packages/connectors/`, adding a new
`LinkKind`. New printer = new file, not a refactor of existing ones.

We are actively looking for: **Bambu Lab LAN**, Duet / RepRapFirmware, Repetier-Server,
MKS boards. We are *not* looking for cosmetic changes to the OctoPrint, Moonraker or
PrusaLink reference connectors — those are stable and well covered.

## What we do not accept

- Runtime plugin loaders, connector stores, or anything that loads code at runtime.
  Sculptiq bundles at build time on the Cloudflare edge runtime; there is no module
  resolution at runtime, and executing untrusted code that holds printer API keys on a
  user's LAN is not a trade we will make.
- Connectors that assume raw TCP, MQTT-over-TLS, FTPS or serial from the browser.
  If the protocol is not browser-legal, propose a **local bridge** instead (see the spec,
  §1).
- New runtime dependencies, unless agreed in the issue before you write code.

---

## Before you write code

1. **Open an issue** describing the printer, its API, its auth scheme, and whether it
   returns usable CORS headers. This is where we agree the approach — it saves you from
   a rewrite.
2. Confirm you can reach the device from a browser tab at all. If mixed content or CORS
   blocks you, say so in the issue; the answer may be a bridge or a documented device
   configuration step.

---

## Writing the connector

1. Fork, branch as `connector/<printer-name>`.
2. Copy `packages/connectors/octoprint.ts` as your starting shape.
3. Fill in the manifest first. `hostPattern` should be as narrow as the protocol allows —
   it is enforced at runtime, and a loose pattern is a review blocker.
4. Implement only the capabilities you list. Anything undeclared throws
   `UnsupportedCapabilityError`.
5. Route every request through `guard.ts`. Do not call `fetch` directly.
6. Keep the API key in the header named by `manifest.authHeader`. Nowhere else — not in
   URLs, not in bodies, not in log lines, not in error messages.
7. Add unit tests for status normalisation and error mapping.
8. Register your connector in `packages/connectors/index.ts` and add yourself to
   `CODEOWNERS` for your file.

---

## Opening the PR

Your PR must include:

- **Hardware evidence.** A log or screenshot showing `testConnection`, a G-code upload,
  and a status poll against a real printer. We cannot verify hardware we do not own, so
  this is not optional.
- Firmware/server version tested against.
- Any device-side configuration the user must apply (CORS, HTTPS, API key creation).
- Confirmation you have read the security contract in the spec, §5.

Review focuses on the checklist in the spec, §7. Expect questions about the host
allowlist and key handling before questions about the printer.

---

## After the merge — what you are signing up for

You become the **maintainer of record** for that connector. Concretely:

- Your connector ships as `status: 'community'` and the UI tells users it is
  community-maintained, best-effort.
- Defect reports for it are routed to you first.
- If a connector goes unmaintained for two release cycles it is flipped to
  `status: 'unmaintained'` and may be removed later. That is a lifecycle signal, not a
  criticism — you can hand maintenance over at any time by opening an issue.

This policy exists so that Sculptiq can support many printers without pretending to
support all of them equally.

---

## Recognition

Merged connectors are attributed to you. Contributor reputation, badges and bounties for
"wanted" connectors are tracked on the BBUD contributor layer, which uses a
wallet-verified session for identity — GitHub hosts the code, the reputation layer lives
natively there. Participating in the reputation layer is optional; your PR is judged on
its merits either way.

---

## Code of conduct

Be straightforward and be accurate. Do not claim hardware coverage you have not tested.
An honest "untested on firmware X" in the PR description is worth more to us than a
confident PR that breaks in a user's workshop.