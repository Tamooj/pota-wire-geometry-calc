# POTA Wire Antenna Coordinate Sketcher

A browser-based tool that turns design or field-measurable numbers - pole height,
distances to a tree, compass bearing, wire slack - into ready-to-paste 3D wire
coordinates for **NEC-2 based antenna modeling software** (EZNEC, MMANA).

## What this is (and isn't)

**This tool does not simulate antenna performance.** It doesn't compute gain,
radiation pattern, SWR, or feedpoint impedance - that requires an
electromagnetic solver, which this is not.

What it *does* do: take the geometry of a real-world random-wire install (a
sloper to one tree, an inverted-V between two mismatched trees, a sagging
wire, a counterpoise fan) and turn it into the table of X/Y/Z wire-endpoint coordinates
that EZNEC or MMANA need as input - including the catenary math for a sagging
wire, which is tedious to work out by hand.

**In short: this feeds the modeling tools. You still run the actual
simulation in EZNEC/MMANA yourself.** Think of it as a geometry front-end, not
a replacement for them.

## Why this exists

Ad hoc installations using random-wire antennas, such as POTA (Parks on the Air) 
can take many forms. In the field, available trees and supports are never in
convenient positions, and setup happens under time and comfort pressure (heat,
insects, daylight). It's much better to have a small library of pre-modeled
"go-to" geometries worked out ahead of time than to improvise wire geometry
on-site. This tool exists to make that pre-planning not be a tedious exercise 
involving graph paper and trigonometry. 

## Try it

Download and open [`index.html`](index.html) directly in any browser - no build step, no
dependencies, no server required. Or, if GitHub Pages is enabled for this
repo, use the hosted version at:

```
https://tamooj.github.io/pota-wire-geometry-calc/
```

## Features

- **One screen, one model.** A *wire* runs along a compass bearing through its
  *supports* (a horizontal distance and a height each). The span between two
  neighbouring supports is either taut, or - if you give it some **slack** -
  hangs as a true catenary. That covers, with no mode switch:
  - straight or sagging slopers (two supports),
  - an inverted-V with a peak in the middle, taut or sagging on either side
    (three supports),
  - an inverted-L (first span vertical),
  - bent, non-collinear V's (a second wire attached to the first wire's apex).
- **Counterpoise fans** attach to any support, so a sloper and its counterpoise
  live in one model and export as **one merged wire list** - no more pasting two
  tables together and fixing wire numbers by hand. Radial length is the cut
  length of the wire.
- **Presets** to start from: Straight Sloper, Sagging Sloper, Inverted-V,
  Sagging Inverted-V, Inverted-L, Sloper + Counterpoise.
- **Slider *and* number box** on every field: drag for quick sketching, type for
  exact values. Slider ranges are unit-native and widen automatically when you
  type a larger number (a 100 m wire isn't stuck on a 50 m slider).
- **Feet / meters toggle** converts the stored values exactly (35 ft is 10.668 m
  and back again, with no rounding drift).
- **Live views** - a rotatable **3D view** (drag, wheel, Top/Side/Reset) with a
  ground outline at Z=0, plus side-profile and plan views, all with round-number
  scale labels in the current unit.
- **Warnings** when a sag dips below ground or a radial is too short for its
  height drop.
- **Three export formats**, toggled in the export panel:
  - **Generic** - minimal tab-separated table for manual paste
  - **EZNEC** - approximates the layout of EZNEC Pro/2+'s own "Wires" report,
    including `W{n}E{1|2}` connection strings that chain adjacent wires
  - **MMANA** - a real MMANA-GAL `.maa`-format body, with a Frequency (MHz)
    field and a selector for which wire carries the source
- Runs entirely client-side; nothing is sent anywhere

## Coordinate convention

- **X = East, Y = North, Z = Up** (standard right-handed, ground-referenced -
  matches typical EZNEC/MMANA ground-plane convention)
- **The feedpoint is the origin** `(0, 0, z_feed)` - the start of the source
  wire; everything else is positioned relative to it, matching how you'd
  actually stake out a site
- **Azimuth** is entered as compass bearing in degrees from North (0 = N,
  90 = E), matching ham convention rather than math convention
- **Distances** along a wire are horizontal (plan-view) distances from its start

## Known limitations

- No ground-system loss, soil conductivity, or near-field ground modeling -
  output is geometry only, for import into a NEC-2 engine that handles the EM
  solve. Ground is drawn as the flat plane Z = 0.
- The EZNEC and MMANA export formats approximate those tools' own file/report
  layouts closely, but neither is a byte-verified, directly re-importable
  native deck (not tested against the actual EZNEC/MMANA applications).
  Typically some cut/paste into a text file is needed.
- EZNEC-format connection strings for a point shared by 3+ wires (e.g. a
  counterpoise fan's common attach point) are best-effort - see
  [docs/DESIGN.md §3.5](docs/DESIGN.md#35-export-formats)
- Counterpoise radials are straight (no sag); wire gauge is fixed at #10 AWG;
  EZNEC export uses 2 segments per wire.
- Not yet: dipoles (feed along a wire), sloped ground, saved scenarios, native
  file download - see the roadmap in [docs/DESIGN.md](docs/DESIGN.md#5-known-limitations--roadmap).

See [docs/DESIGN.md](docs/DESIGN.md) for the full design rationale - including
the catenary derivation and the complete roadmap.

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
