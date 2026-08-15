# Repo upload checklist — what goes public, what stays private

Target repo: **`github.com/Sculptiq/sculptiq`** (public).

Licensing is split: root `LICENSE` is BUSL 1.1 (converts to Apache 2.0 on
2030-01-01); `packages/connectors/LICENSE` is Apache 2.0 and governs that
subtree only. Push both files or the split is not in effect.

## Public — push these

### Repo surface

| Path | Why |
| --- | --- |
| `README.md` | Front page: pitch, six steps, dev setup, connector call to action, licence split |
| `LICENSE` | BUSL 1.1 — the core |
| `CODEOWNERS` | `@Sculptiq` owns the security core and the connector docs |
| `.github/ISSUE_TEMPLATE/new-connector.yml` | Connector intake form |
| `.github/PULL_REQUEST_TEMPLATE.md` | Submission checklist (guard rule, tests, no new deps) |

### Connector package

| Path | Why |
| --- | --- |
| `packages/connectors/LICENSE` | Apache 2.0 for the subtree |
| `packages/connectors/README.md` | Layout, how to add a connector, how to run the tests |
| `packages/connectors/types.ts` | The `PrinterConnector` contract |
| `packages/connectors/guard.ts` | `guardedFetch` — the only egress path |
| `packages/connectors/index.ts` | Registry |
| `packages/connectors/conformance.ts` | Contract harness contributors run |
| `packages/connectors/TEMPLATE.ts` | Copy-me skeleton |
| `packages/connectors/octoprint.ts`, `moonraker.ts`, `prusalink.ts`, `bambu.ts` | Reference set |
| `packages/connectors/__fixtures__/hostile.ts` | Hostile fixture backing the guard tests |
| `tests/connector-guard.test.ts` | Guard behaviour |
| `tests/connector-reference.test.ts` | Reference connector behaviour |
| `tests/connector-conformance.test.ts` | Every registry entry satisfies the contract |
| `tests/connector-dispatch.test.ts` | Dispatcher + manifest helpers |

### Connector program docs

| Path | Why |
| --- | --- |
| `docs/connector-program/README.md` | Start here + open RFCs |
| `docs/connector-program/CONNECTOR-SPEC.md` | Normative contract |
| `docs/connector-program/CONTRIBUTING.md` | How to submit |
| `docs/connector-program/CONNECTOR-PROGRAM-WORKFLOW.md` | Decisions D1–D11, ownership split, Phase 0 record |
| `docs/connector-program/CONTRIBUTOR-PROGRAM.md` | Reward programme, Cortex Points |
| `docs/connector-program/ISSUE-bambu-lan.md` | Seed RFC — highest-value gap |
| `docs/connector-program/UPLOAD-CHECKLIST.md` | This file |

### Product docs safe to publish

`docs/README.md`, `docs/architecture.md`, `docs/features.md`,
`docs/project-description.md`, `docs/roadmap.md`, `docs/studio-access.md`,
`docs/cloud-sync.md`, `docs/audio-uploads.md`, `docs/bug-tracker.md`,
`docs/sculptiq-design-language.md`, `docs/evolution/**`,
`docs/validation/**`.

## Private — do NOT push to the public repo

| Path | Why |
| --- | --- |
| `docs/valuation-rcnld.md` | Commercial valuation / rebuild-cost model |
| `docs/bbud/brainybuddies-valuation-v16.md` | BBUD valuation workbook |
| `docs/bbud/cortexdev-CONCEPT.md`, `cortexdev-README.md`, `docs/bbud/README.md` | BBUD ecosystem internals — they belong in the BBUD project, not the Sculptiq product repo |
| `.env`, any `.env.*` | Secrets |
| `docs/deploy/sculptiq-upload.php` | Deployment endpoint for the upload receiver — publishing it hands out the shape of the receiver |
| `.lovable/**` | Internal planning history |

If a BBUD document must be visible to contributors, link out to the BBUD
surface from `CONTRIBUTOR-PROGRAM.md` rather than copying it here — per D10 the
programme material is authored in BBUD and only referenced from Sculptiq.

## Before pushing

```sh
bunx vitest run          # all tests green
rg -n "sb_secret_|SUPABASE_SERVICE|password" --hidden -g '!node_modules' .
```

The second command is a last-look sweep: nothing that matches should be in a
tracked file.
