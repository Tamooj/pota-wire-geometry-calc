# POTA Wire Antenna Geometry Calculator

A browser-based tool that turns field-measurable numbers — support height,
distance to a tree, compass bearing, wire slack — into ready-to-paste 3D wire
coordinates for **NEC-2 based antenna modeling software** (EZNEC, MMANA).

## What this is (and isn't)

**This tool does not simulate antenna performance.** It doesn't compute gain,
radiation pattern, SWR, or feedpoint impedance — that requires an
electromagnetic solver, which this is not.

What it *does* do: take the geometry of a real-world random-wire install (a
sloper to one tree, an inverted-V between two mismatched trees, a sagging
wire, a counterpoise fan) and turn it into the X/Y/Z wire-endpoint coordinates
that EZNEC or MMANA need as input — including the catenary math for a sagging
wire, which is tedious to work out by hand.

**In short: this feeds the modeling tools. You still run the actual
simulation in EZNEC/MMANA yourself.** Think of it as a geometry front-end, not
a replacement for them.

## Why this exists

Ad hoc POTA (Parks on the Air) installations use random-wire antennas fed
through a 9:1 unun. In the field, available trees and supports are never in
convenient positions, and setup happens under time and comfort pressure (heat,
insects, daylight). It's much better to have a small library of pre-modeled
"go-to" geometries worked out ahead of time than to improvise wire geometry
on-site. This tool exists to make that pre-planning fast.

## Try it

Open [`index.html`](index.html) directly in any browser — no build step, no
dependencies, no server required. Or, if GitHub Pages is enabled for this
repo, use the hosted version at:

```
https://tamooj.github.io/pota-wire-geometry-calc/
```

## Features

- **4 geometry types**, each with independent, non-destructive state:
  - **Straight sloper** — single wire, one support, taut
  - **Inverted-V end-fed** — apex over a mast/tree, two independently
    positioned legs (deliberately *not* forced collinear — real tree pairs
    rarely line up)
  - **Sagging sloper** — same as a straight sloper, but modeled as a true
    catenary curve from actual wire length (slack), not an idealized straight
    line
  - **Counterpoise fan** — N radials fanned across a configurable arc,
    on-ground or elevated
- **Feet / meters toggle** — converts stored parameter values on toggle, not
  just display formatting, so switching units mid-edit never corrupts a model
- **Live diagrams** — side-profile (elevation) and plan-view (compass-oriented,
  N-up) sketches that update as you drag parameters
- **Tab-separated export** — copy-paste ready for EZNEC/MMANA wire-entry
  tables
- Runs entirely client-side; nothing is sent anywhere

## Coordinate convention

- **X = East, Y = North, Z = Up** (standard right-handed, ground-referenced —
  matches typical EZNEC/MMANA ground-plane convention)
- **Feedpoint is always the origin** `(0, 0, z_feed)` — everything else is
  positioned relative to it, matching how you'd actually stake out a site
- **Azimuth** is entered as compass bearing in degrees from North (0° = N,
  90° = E), matching ham convention rather than math convention

## Known limitations

- No ground-system loss, soil conductivity, or near-field ground modeling —
  output is geometry only, for import into a NEC-2 engine that handles the EM
  solve
- No native `.nec` / `.ez` / `.maa` export yet — output is a generic
  tab-separated coordinate table for manual paste (see roadmap)
- No sag modeling yet for inverted-V legs or counterpoise radials (only the
  dedicated Sagging Sloper tab models catenary droop)
- Sliders only, no precise numeric entry (a synced number input is on the
  roadmap)

See [docs/DESIGN.md](docs/DESIGN.md) for the full design rationale — including
the catenary derivation, the reasoning behind specific design choices, and the
complete roadmap.

## Testing

Unit and system tests live in [`tests/`](tests/) as plain HTML pages — no
build step or dependencies, matching the tool itself. Open
[`tests/unit-geometry.html`](tests/unit-geometry.html) (pure geometry math) or
[`tests/system-app.html`](tests/system-app.html) (drives the real app's DOM:
tabs, sliders, unit toggle) directly in a browser, or serve the repo root
(`python -m http.server`) and open them at `http://localhost:8000/tests/...`
— serving avoids some browsers' restrictions on script access across `file://`
iframe boundaries. Both pages load the real `index.html`, so tests can't drift
out of sync with what's actually shipped. See
[docs/DESIGN.md §7](docs/DESIGN.md#7-testing) for details.

## Contributing

Issues and PRs welcome — this is meant to be a useful shared tool for other
hams doing POTA/field antenna work, not a one-off personal script.

## License

MIT — see [LICENSE](LICENSE).
