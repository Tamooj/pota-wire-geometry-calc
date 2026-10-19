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
- **Wire gauge**: a default AWG size plus a per-wire (or per-counterpoise) override, sliders from #10 to #24; both exports use it.
- **Graded segments** (on by default): the radiator starts with a 3-segment feed section for the source and its segments grow smoothly to about a twentieth of a wavelength, and the counterpoise radials are graded outward from the feed the same way. EZNEC does not accept a source on the end segment of several joined wires (such as a counterpoise at the feed), and abrupt changes in segment length hurt accuracy. The metrics strip shows the total segment count and warns above EZNEC's limit of 2000. With grading off, segments per wire can be left to EZNEC, set to its minimum, or fixed.
- **Your work is kept**: the current model is saved automatically in your browser and comes back when you reload the page, and **Save model / Load model** write and read it as a small JSON file (useful for keeping versions, or moving between browsers).
- **Warnings** when a sag dips below ground or a radial is too short for its
  height drop.
- **Three export formats**, toggled in the export panel:
  - **Generic** - minimal tab-separated table for manual paste
  - **EZNEC** - EZNEC's own wire-import file: save it as a text file, then in
    EZNEC use **File > Import Wires From ASCII File**
  - **MMANA** - a real MMANA-GAL `.maa`-format body, with a Frequency (MHz)
    field and a selector for which wire carries the source
- Runs entirely client-side; nothing is sent anywhere

## Importing into EZNEC 7 and MMANA

**EZNEC 7**

1. Set **FREQ** (top right of the tool) to the frequency you will run in EZNEC.
   The wire import carries no frequency, and the segment lengths the tool
   generates depend on it (EZNEC's Segmentation Check wants each segment between
   wavelength/1000 and wavelength/20). The tool's metrics strip shows the
   **EZNEC-valid band** of the current model, and the comment lines at the top of
   the export repeat it.
2. In the export panel select **EZNEC**, click **Copy**, and paste the text into
   a plain text file somewhere easy to reach from the desktop.
3. In EZNEC 7 choose **File > Import Wires From ASCII File** (older versions and
   the 7.0 manual list it under the Other menu), pick **Replace Existing Wires**,
   then select the file you saved. Your antenna should appear in the Wires window.
4. Set EZNEC to the proper frequency, and set the **Source** location to your
   feedpoint: typically **wire 1, 50% from E1** (`W1C`, the center of the
   3-segment feed section). The comment lines at the top of the export say
   exactly where.
5. Check the connections in the Wires window (the Conn. columns) and run
   EZNEC's Segmentation Check and Average Gain test, as you would for any model.

**MMANA-GAL**

1. In the export panel select **MMANA** and click **Copy**.
2. Paste the text into a file and save it with a **.maa** extension.
3. In MMANA open it the normal way with **File > Open**.

Use **Save model** in the tool to keep your design as a small JSON file you can
load again later (the tool also remembers your last model in the browser).

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
- The EZNEC export follows EZNEC's documented wire-import format and has been
  imported into EZNEC 7 by the author; the MMANA export is reverse-engineered
  from sample files and has had much less testing. The EZNEC import carries
  coordinates only (no sources, frequency or ground) - ends that meet are
  listed in comments so you can check the connections in EZNEC's Wires window.
  See [docs/DESIGN.md §3.5](docs/DESIGN.md#35-export-formats).
- Counterpoise radials are straight (no sag). Graded segment lengths are valid
  for one band at a time (about 25% wide): export again at each frequency.
- Not yet: dipoles (feed along a wire), sloped ground, a named scenario
  library, a native NEC (`.nec`) export - see the roadmap in
  [docs/DESIGN.md](docs/DESIGN.md#5-known-limitations--roadmap).

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
