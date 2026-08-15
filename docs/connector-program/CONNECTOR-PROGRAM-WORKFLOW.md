# Sculptiq Connector Program — Workflow & Decision Log

> Working document. Captures the full reasoning behind opening `printerLink.ts` to
> community contribution, the decisions taken, and the workflow to execute them.
> Companion to `docs/division-21-licensing/CONTRIBUTOR-PROGRAM.md` (the generalised
> tenancy model) and to the paste-ready repo files in `docs/sculptiq/connector-repo/`.

---

## 1. Starting point

`src/lib/studio/printerLink.ts` (Sculptiq repo) is the most cleanly isolated module in
that codebase: a `LinkKind` enum plus four functions — `testConnection`, `uploadGcode`,
`fetchStatus`, `sendCommand` — each switching on `kind`. Adding a printer is a new
`case`, not a refactor. That is a natural boundary for outside contribution.

---

## 2. Framing — curated contributor model, not a plugin marketplace

**Hard constraint.** Sculptiq runs in a browser on the Cloudflare edge runtime. There is
no runtime module resolution; everything is bundled at build time. "Community
connectors" therefore means *pull requests merged into the repo and shipped in
releases* — never a live store installing arbitrary `.js` at runtime.

That constraint is a feature:

- forces review before code ships,
- keeps a consistent quality bar,
- avoids executing untrusted code that holds printer API keys on a user's LAN.

**Shape:** open the connector spec + the existing implementations to contributors, with
a "how to add a connector" guide and a `CONTRIBUTING.md`. People fork, add a printer,
submit a PR, we review and ship.

---

## 3. Where the value actually is

| Worth it | Not worth it |
|---|---|
| Non-standard REST APIs — Duet, Repetier-Server, MKS | OctoPrint (stable, done) |
| Region-specific boards | Moonraker (stable, done) |
| **Bambu Lab LAN** — currently a dead end (MQTT-over-TLS + FTPS are not browser-legal) | PrusaLink (stable, done) |

Bambu is the seed target: the only entry where a contributor's own itch is stronger
than ours. Someone who owns a Bambu and wants to crack the LAN protocol will do it for
free. The RFC must state up front that the likely accepted answer is a **local bridge**
(a small helper the user runs on their LAN speaking MQTT/FTPS, exposing HTTP to the
browser), not a browser-native miracle — otherwise we get three PRs that rediscover the
TLS wall.

---

## 4. The two real costs

### 4.1 Security review burden

Every connector receives an API key and fetches a host the user typed. A sloppy or
hostile connector could exfiltrate keys or reach addresses it should not.

Mitigation — a lightweight, *enforced* contract:

- connectors may only fetch the normalised base host, no other network calls,
- no `eval`, no dynamic import, no third-party SDK,
- the key is passed only in the documented header.

Review alone is not enough. A ~30-line `fetch` guard wrapping every connector call and
checking the manifest's `hostPattern` turns the contract into a runtime invariant. That
is the only "sandboxing" worth building for v1.

### 4.2 Support expectations

Once connectors are "community," users file Sculptiq bugs when their franken-forked Duet
connector breaks. Policy: connectors ship **as-is, best-effort, version-tagged**, and the
contributor (or a CODEOWNER) is the *maintainer of record*. The manifest's `status`
field (`reference` | `community` | `unmaintained`) makes this visible in the UI, which
kills the expectation problem before it starts.

---

## 5. Decisions taken

| # | Question | Decision | Rationale |
|---|---|---|---|
| D1 | Marketplace or curated PRs? | **Curated PRs** | Edge runtime has no runtime module resolution; review is the sandbox |
| D2 | In-repo or standalone npm package? | **In-repo**, `packages/connectors/` | No second consumer today. bbud.farm drives printers via its Pi edge agent, not a browser connector. Extract later if a real second consumer appears |
| D3 | Manifest required? | **Yes, mandatory and machine-readable** | Lets the UI advertise capabilities and support status without coupling to internals; carries the security contract |
| D4 | Sandbox for v1? | **No permission sandbox** — only the manifest-driven `fetch` guard | Cheap, enforceable, sufficient |
| D5 | Seed target | **Bambu Lab LAN** | Only case where contributor motivation exceeds ours |
| D6 | Wallet gating | Connector *code* needs none (GitHub authenticates). The **recognition layer** — reputation, attribution, bounties — is wallet-gated on the CortexDev surface | Same split already shipped on `bbud.dev`: GitHub hosts code, wallet session gates reputation |
| D7 | Ecosystem scope | Generalise the tenancy model beyond Sculptiq | Bug tracker (shipped) → connector program (next) → any partner integration surface. Belongs in Division 21, not as a Sculptiq one-off |
| D8 | Open the repo when? | **Not before** the manifest + fetch guard exist | The first community PR sets the quality bar permanently; reviewing against an unwritten contract means owning every printer's quirks forever |
| D9 | Where does the Bambu local bridge live? | **Its own repo**, released separately (not inside the Sculptiq app repo) | It is a Node/Python LAN daemon speaking MQTT-over-TLS + FTPS — a different runtime, different release cadence, different security surface from a browser-bundled connector. Sculptiq ships only the thin `mqtt-bridge` connector that targets it |
| D10 | Who authors the spec? | **BBUD is the canonical author**; Sculptiq carries a copy | The contributor-program primitive (spec, manifest contract, review policy, recognition ladder) is Division 21 infrastructure reused across partner surfaces. Sculptiq's `docs/connector-program/` is a synced copy; normative changes land in BBUD first, then propagate |
| D11 | GitHub plan & platform role? | **GitHub Free**; GitHub is a *promotion platform* (stars, issues, discoverability, contributor identity), bbud.dev is the *work surface* | Team ($4/user/mo) buys enforced CODEOWNERS reviews + 3,000 Actions minutes, but launch traction is unknown. Free gives unlimited public repos, 2,000 Actions minutes, advisory CODEOWNERS — sufficient for a curated PR model where review happens on bbud.dev anyway. Reassess after launch; upgrade is one click if volume justifies it |

---

## 5b. Ownership & project split

BBUD and Sculptiq are **separate projects with separate databases**. The split is
explicit so that nobody writes `guard.ts` in the wrong repo.

| Layer | Owner | Lives in |
|---|---|---|
| Connector spec, manifest contract, review policy | **BBUD** (canonical) | BBUD docs → copied to `docs/connector-program/` |
| `ConnectorManifest` type, `packages/connectors/`, `guard.ts`, guard tests | **Sculptiq** | Sculptiq app repo |
| Connector implementations (reference + community) | **Sculptiq** repo, contributor-maintained | `packages/connectors/<kind>.ts` |
| Contributor identity, wallet session, reputation, points ledger, bounties | **BBUD** | BBUD database (Cortex Shield rails) |
| Settlement in Sculptiq product benefits (lifetime, Pi edition, tickets) | **Sculptiq** honours, BBUD records | BBUD ledger → Sculptiq entitlement |
| Bambu local bridge | **Separate repo** (D9) | Own release artefacts |

Rule of thumb: **code and runtime enforcement in Sculptiq; identity, program and
recognition data in BBUD.** No Sculptiq table stores contributor reputation; no BBUD
service imports Sculptiq connector code.

---

## 5c. Guard: normative order

`guard.ts` performs these steps, in this exact order, for every outbound connector call.
Any deviation is a rejected PR.

1. **Normalise** the URL (`new URL(input, base)`) — reject non-`http(s)` schemes,
   embedded credentials (`user:pass@`), and any host that differs from the
   `LinkContext` base host.
2. **Allowlist** — the normalised origin must match the connector's `hostPattern`.
   Match on the parsed origin, never on the raw string.
3. **`redirect: 'manual'`** on every request — the guard never lets the platform follow
   a redirect, because a followed redirect escapes the allowlist silently.
4. **Hard fail on any 3xx** — a redirect is an error (`LinkError`, code
   `redirect_blocked`), not something to re-issue against the `Location` header.
5. **No non-`fetch` egress** — `WebSocket`, `EventSource`, `navigator.sendBeacon`,
   `<img>`/`<script>`/`<link>` beacons, and dynamic `import()` are all forbidden inside
   connector modules and are checked in review.

The guard is unit-tested against a deliberately hostile fixture connector that attempts
each of the five violations.

---

## 6. Manifest contract (agreed shape)

```ts
export interface ConnectorManifest {
  kind: LinkKind;
  displayName: string;
  transport: 'http' | 'https-lan' | 'mqtt-bridge';
  capabilities: ('test' | 'upload' | 'status' | 'command')[];
  authHeader: string;        // the only place the key may appear
  hostPattern: RegExp;       // enforced allowlist for fetch targets
  maintainer: string;        // GitHub handle = maintainer of record
  status: 'reference' | 'community' | 'unmaintained';
}
```

`hostPattern` is enforced at runtime by the guard; `status` and `capabilities` are
rendered by the UI; `maintainer` is the support policy in code.

---

## 7. Workflow

### Phase 0 — Preconditions (Sculptiq repo, before opening)

1. Add `ConnectorManifest` type and export a manifest from every existing connector.
2. Extract `printerLink.ts` into `packages/connectors/` — one module per `LinkKind`,
   `printerLink.ts` becomes a registry that imports them.
3. Implement the `fetch` guard: every connector call goes through a wrapper that
   rejects any URL not matching the connector's `hostPattern`.
4. Unit-test the guard with a deliberately hostile fixture connector.
5. Add `CODEOWNERS` — every connector file owned by its maintainer + a Sculptiq reviewer.
6. Paste `CONNECTOR-SPEC.md` and `CONTRIBUTING.md` from
   `docs/sculptiq/connector-repo/` into the repo.

### Phase 1 — Open

7. Publish the connector folder with the three reference implementations
   (OctoPrint, Moonraker, PrusaLink) marked `status: 'reference'`.
8. File the seed RFC issue: **"Wanted: Bambu Lab LAN connector"**, stating the TLS/FTPS
   constraint and that a local bridge is an acceptable answer.
9. Surface `status: 'community'` in the printer-link UI as a "community connector,
   best-effort" note.

### Phase 2 — Recognition layer

10. Register the connector program as a partner program on the Cortex Shield rails
    (see `docs/division-21-licensing/CONTRIBUTOR-PROGRAM.md`).
11. Attribute merged connectors to the contributor's wallet-verified profile; award
    points on the existing cumulative ladder.
12. Post bounties for named "wanted" connectors, settled in Sculptiq product benefits
    exactly as the bug-tracker ladder settles today.

### Phase 3 — Review loop (steady state)

For every connector PR:

- manifest present and accurate,
- no network call outside `hostPattern`, no `eval`, no dynamic import, no new dependency,
- key only in `authHeader`,
- all four functions implemented or explicitly declared unsupported via `capabilities`,
- maintainer handle set,
- hardware test evidence attached (screenshot or log from a real printer).

---

## 8. Open items

- Whether the Bambu local bridge, if it materialises, ships under the Sculptiq repo or
  as a separate helper release.
- Whether `connector_products` gets its own table or shares a generalised
  `partner_programs` table with `bug_products` (see the Division 21 doc, §5).
- Points value per merged connector tier (reference / community / wanted-bounty).
---

## 9. Phase 0 — shipped (closed 2026-08-14)

Phase 0 is complete. The repo can be opened per D8: the manifest and the guard exist.

| Batch | Delivered |
| --- | --- |
| (a) Foundation | `packages/connectors/types.ts` (manifest, `LinkContext`, `PrinterConnector`, `LinkError`, `UnsupportedCapabilityError`) and `guard.ts` implementing the normative order of §5c. Hostile fixture `__fixtures__/hostile.ts` + `tests/connector-guard.test.ts`. `@connectors` alias wired into `vitest.config.ts` and `tsconfig.json`. |
| (b) Reference connectors | `octoprint.ts`, `moonraker.ts`, `prusalink.ts` extracted from `printerLink.ts` as `status: 'reference'`; `bambu.ts` declared with zero capabilities (every method throws) pending the local bridge; `index.ts` registry + `tests/connector-reference.test.ts`. |
| (c) Dispatcher + ownership | `src/lib/studio/printerLink.ts` rewritten as a thin dispatcher over the registry — no network code left in `src/`. `CODEOWNERS` added (`@Sculptiq` on the security core). `tests/connector-dispatch.test.ts`. |
| (d) Contributor scaffolding | `packages/connectors/conformance.ts` (`runConformance`) + `tests/connector-conformance.test.ts` running it over the whole registry. `packages/connectors/README.md`. `.github/ISSUE_TEMPLATE/new-connector.yml` and `.github/PULL_REQUEST_TEMPLATE.md`, both carrying the BBUD handle field. |
| (e) Manifest-driven UI | `printerLink.ts` exports `listLinkKinds`, `hasCapability`, `linkManifest`. `Step6Connect.tsx` renders the printer list, the action buttons and the community/unmaintained notice from the manifests rather than hardcoded lists — closing Phase 1 item 9 early. |
| (f) Launch readiness | Root `README.md` rewritten as the repo front page with a "Contribute a printer connector" section. `packages/connectors/TEMPLATE.ts` copy-me skeleton (not registered). Open-RFC list in the program README. This section. |

**State at close:** 58 tests green (`bunx vitest run`), typecheck clean, zero bare `fetch`
in the connector path, four connectors in the registry.

**Next:** Phase 1 items 7 and 8 — publish the repo as `github.com/Sculptiq/sculptiq` and
file the Bambu LAN seed RFC from `ISSUE-bambu-lan.md`. Item 9 is already done (batch e).
