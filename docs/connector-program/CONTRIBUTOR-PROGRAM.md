# Division 21 — Contributor Programs (Partner Contribution Layer)

**Pillar:** DECENTRALIZED
**Primary Domain:** `bbud.business`
**Status:** Charter draft

> Generalises the Sculptiq bug-tracker tenancy model into a reusable **contributor
> program** primitive that any Layer 2 partner or Layer 3 white-label client can run on
> BBUD rails.

---

## 1. The pattern being generalised

`bugs.sculptiq.eu` proved a specific shape: a partner gets a branded surface, on shared
BBUD infrastructure, where an outside community performs *reviewed work* and receives
*recognition and rewards* from a single ecosystem pool.

Nothing in that shape is specific to bug reports. The same rails serve any surface where
a partner wants outside contribution under a quality gate:

| Program type | Contribution | Gate | First instance |
|---|---|---|---|
| **Defect program** | Bug reports, reproductions | Triage + verification | Sculptiq Bug Tracker (shipped) |
| **Connector program** | Integration code (printer/hardware/API adapters) | PR review + security contract | Sculptiq Connector Program (next) |
| **Content program** | Docs, translations, guides | Editorial review | Not started |
| **Research program** | Protocol analysis, clinical literature | Peer review | Not started |

Division 21 owns the licensing, pricing, support policy and tenancy of all of them.
The operational division (Div. 2 Cortex Shield for quality surfaces, Div. 13 CortexDev
for code surfaces) owns the runtime.

---

## 2. What the licensee gets

1. **A branded surface** — partner accent colour, logo, tagline applied to a wrapper
   element only; the global theme is never mutated.
2. **Shared reward pool** — one Cortex Points pool, one global cumulative ladder. No
   separate partner economy.
3. **Per-product settlement** — BBUD programs settle in $BBUD; partner programs settle
   in partner benefits (licences, support tickets, hardware editions). Defined per
   product in `reward_terms`.
4. **Identity inheritance** — wallet-derived sessions, RLS-scoped reads, BEAST telemetry.
5. **Support policy in code** — every contribution carries a maintainer of record and a
   lifecycle status the UI renders verbatim.

---

## 3. The three-role contract

| Role | Held by | Responsibility |
|---|---|---|
| **Program owner** | The licensee (Layer 2/3 entity) | Defines scope, wanted targets, reward terms, acceptance |
| **Reviewer / CODEOWNER** | Licensee or delegated BBUD reviewer | Enforces the quality and security contract before merge |
| **Maintainer of record** | The contributor | Owns the contribution's defects after merge; best-effort, version-tagged |

Contributions ship **as-is**. Absent an explicit maintenance agreement, the licensee
inherits no perpetual obligation for third-party contributions — this must appear in the
program's public terms, not only in the master agreement.

---

## 4. Identity split — GitHub authenticates, wallet recognises

For code-bearing programs the split is fixed and non-negotiable:

- **Code** lives on GitHub. GitHub authenticates authorship and hosts review.
- **Recognition** lives natively on BBUD. Wallet-derived session gates the contributor
  profile, reputation, points ladder, badges and bounty settlement.

This is the same split already shipped on `bbud.dev` (CortexDev): the repository is not
the reputation system, and the reputation system does not host code.

A partner surface may therefore be wallet-gated for its *recognition layer* while the
contribution mechanism itself stays wallet-free — which is the correct posture for
partners such as Sculptiq that are not yet wallet-native. Developer-facing audiences are
overwhelmingly wallet-capable already, so a wallet requirement on the dashboard is a
negligible barrier and a strong provenance signal.

---

## 5. Data model direction

`public.bug_products` is the proven instance of the pattern (branding, routing,
`reward_terms`, `show_on_main_board`, product-scoped notification routing).

Two options for the second instance:

| Option | Shape | Trade-off |
|---|---|---|
| **A — sibling table** | `connector_products` mirroring `bug_products` | Fast, isolated, duplicates branding/reward columns |
| **B — generalised table** | `partner_programs` with `program_type` discriminator; `bug_products` becomes a view | Correct long-term, one migration of a live surface |

Recommendation: **B**, executed once the connector program has a confirmed second
partner. Until then A is acceptable if and only if the branding and reward columns are
kept column-for-column identical, so the later merge is mechanical.

Whichever is chosen, the invariants hold:

- one points pool, one ladder,
- branding scoped to a wrapper, never to global tokens,
- product-scoped notification routing (partner reports reach the partner mailbox),
- RLS-scoped reads with wallet-derived identity.

---

## 6. Security contract for code-bearing programs

Programs that accept executable contributions inherit an additional, mandatory contract.
It must be published with the program and enforced in review **and at runtime**:

1. **Declared surface** — every contribution ships a machine-readable manifest declaring
   its capabilities, its transport, and the exact network hosts it may reach.
2. **Runtime enforcement** — the host allowlist in the manifest is enforced by a guard,
   not by reviewer diligence alone.
3. **Credential discipline** — secrets travel only in the documented header/field; never
   logged, never forwarded, never persisted.
4. **No dynamic execution** — no `eval`, no dynamic import, no runtime-fetched code.
5. **No new dependencies** without explicit reviewer approval.
6. **Lifecycle status** — `reference` | `community` | `unmaintained`, rendered in the UI.

Review is the sandbox. A permissions sandbox is explicitly *out of scope* for v1 of any
program: it is expensive, and it substitutes machinery for the judgement that a curated
model already provides.

---

## 7. Reference instance

The Sculptiq Connector Program is the reference implementation of a code-bearing
contributor program. Its decision log, manifest contract and execution workflow are in
`docs/sculptiq/CONNECTOR-PROGRAM-WORKFLOW.md`; the paste-ready repo documents are in
`docs/sculptiq/connector-repo/`.

The Sculptiq Bug Tracker remains the reference implementation of a defect program —
see `docs/features/SCULPTIQ-BUG-TRACKER.md`.

---

## 8. Commercial framing

This turns the Division 21 offer from *"we license the bug tracker"* into
*"we license the contributor layer."* The licensable asset is the combination of:

- branded contribution surface,
- shared reward pool and cumulative ladder,
- wallet-verified contributor identity and reputation,
- enforced quality and security contract,
- support policy that does not leak liability to the licensee.

Pricing follows the existing tiered structure in
`docs/whitelabel-licensing/00_master_framework.md` §5; a contributor program is an
addendum to an existing licence, not a standalone product.