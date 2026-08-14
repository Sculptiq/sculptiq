# Sculptiq

> A browser-based parametric design tool and G-code slicer, collapsed into one.
> Real control. Right where you print.

Sculptiq is a generative design studio for 3D-printed vases, vessels, and art
objects. Instead of bouncing between a CAD tool, a slicer, and a printer
dashboard, you sculpt a form, tune real toolpath parameters, preview the
actual G-code path, and send it straight to OctoPrint or Klipper — in one
continuous flow.

## What's in this repo

This is the canonical product repository. It contains:

- **Studio** — the in-browser parametric designer and live G-code engine
- **Landing pages** — multilingual marketing site (EN / IT / DE / FR)
- **Connectors** — printer protocol adapters under `packages/connectors/`
  (OctoPrint, Moonraker/Klipper, PrusaLink, Bambu)
- **Docs** — architecture, roadmap, connector program, and product evolution

## Licensing

| Component          | License                          |
|--------------------|----------------------------------|
| Core product       | © Sculptiq — All Rights Reserved |
| `packages/connectors/` | Apache License 2.0           |

The repository is public for transparency and community review. The core
product is **source-available, not open source**: you may read, fork for
review, and contribute, but you may not resell, redistribute, or host
Sculptiq commercially without a license.

Connector contributions are welcomed and licensed Apache 2.0 — see
`packages/connectors/CONTRIBUTING.md` and the [Connector Program](docs/connector-program/).

Contributors must agree to the CLA before a PR can be merged.

## Get Sculptiq

- **Web studio**: https://sculptiq.eu
- **Lifetime license & Raspberry Pi edition**: see pricing on the site
- **Bug bounty & rewards**: https://bugs.sculptiq.eu

## The 6-step workflow

1. **Shape** — pick a base form (vase, spiral, twisted, organic…)
2. **Pattern** — apply a surface pattern
3. **Floor** — close the base or leave it open
4. **Tune** — layer height, wall speed, ironing, seams, adaptive settings
5. **Preview** — inspect the real G-code toolpath
6. **Connect** — send straight to OctoPrint or Klipper (optional)

## Contributing

We accept contributions to the **connector package** (`packages/connectors/`).
Read `docs/connector-program/` for the spec, the contributing guide, and open
RFCs (we're actively looking for a **Bambu LAN** connector).

Core product changes are not open to external contribution at this time.

## Links

- Website: https://sculptiq.eu
- Bug tracker: https://bugs.sculptiq.eu
- Docs: `docs/`

---

© Sculptiq. Core product: All Rights Reserved. Connectors: Apache 2.0.
