# Sculptiq Connector Program

Opening `src/lib/studio/printerLink.ts` to outside contribution: one module per printer
family, merged through review and shipped in a Sculptiq release. Not a plugin
marketplace — the edge runtime has no runtime module resolution, so review *is* the
sandbox.

| Doc | Contents |
| --- | --- |
| [CONNECTOR-SPEC.md](./CONNECTOR-SPEC.md) | v1 contract: manifest, interface, normalisation, enforced security rules, review checklist, wanted list |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Short version for contributors: what we accept, branch/PR flow, evidence required |
| [CONNECTOR-PROGRAM-WORKFLOW.md](./CONNECTOR-PROGRAM-WORKFLOW.md) | Decision log (D1–D11), the BBUD/Sculptiq ownership split, the normative guard order, and the phased rollout |
| [CONTRIBUTOR-PROGRAM.md](./CONTRIBUTOR-PROGRAM.md) | BBUD Division 21 charter — generalises the bug-tracker tenancy model into a reusable contributor-program primitive |
| [ISSUE-bambu-lan.md](./ISSUE-bambu-lan.md) | Seed RFC issue: *Wanted: Bambu Lab LAN connector* |
| [UPLOAD-CHECKLIST.md](./UPLOAD-CHECKLIST.md) | Exactly which files go to the public repo and which stay private |

## Where this sits in the ecosystem

Same rails as [bugs.sculptiq.eu](https://bugs.sculptiq.eu) (see
[../bug-tracker.md](../bug-tracker.md)): a branded partner surface on shared BBUD
infrastructure, one Cortex Points pool, one cumulative ladder, settlement in Sculptiq
product benefits. The bug tracker is the shipped defect program; the connector program
is the next instance, on the code surface (Div. 13 CortexDev runtime, Div. 21
licensing).

**Ownership split (D9/D10, workflow §5b):** BBUD is the canonical author of the spec and
owns contributor identity, reputation and the points ledger. Sculptiq owns the code —
`ConnectorManifest`, `packages/connectors/`, `guard.ts` and its tests — and honours
settlement in product benefits. The Bambu local bridge, if it materialises, ships from
its own repo.


## Open RFCs

| RFC | Status |
| --- | --- |
| [Wanted: Bambu Lab LAN connector](./ISSUE-bambu-lan.md) | Open — native protocol is not browser-legal; a local bridge in its own repo (D9) is the expected answer |

Next in the wanted list, none filed yet: Duet / RepRapFirmware, Repetier-Server, MKS boards.

## Start here

1. [CONNECTOR-SPEC.md](./CONNECTOR-SPEC.md) — the normative contract.
2. [CONTRIBUTING.md](./CONTRIBUTING.md) — process, evidence, reward attribution.
3. [../../packages/connectors/README.md](../../packages/connectors/README.md) — the code:
   layout, the guard rule, how to run the tests. Copy `TEMPLATE.ts` to start.

## Status

**Phase 0 shipped (2026-08-14).** The manifest, `guard.ts`, the extracted reference
connectors, the registry, the thin dispatcher, the conformance harness and the
manifest-driven UI are all in the codebase, with 58 tests green — see workflow §9 for
the batch-by-batch record. Per D8 the repo is now clear to open. Remaining Phase 1 work:
publish the repo and file the Bambu seed RFC.
