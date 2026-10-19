# EZNEC modeling notes (from the EZNEC Pro+ v7.0 User Manual)

Source: the free printable manual, `EZW70_User_Manual.pdf` (US letter), linked from https://www.eznec.com/ez70manual.html. Page numbers below are the manual's printed page numbers. These are paraphrased notes that drive what this app should export; check the manual before relying on a detail.

## Wire import (Other > Import Wires From ASCII File), pp. 171-172
- Optional units line, then one line per wire: `x1 y1 z1 x2 y2 z2 diameter [segments]`. `;` starts a comment. Diameter can be `#n` (AWG). Coordinates only: no sources, loads, ground, frequency or connections.
- **Segments field (8th)**: a number, or `M` (minimum recommended), or blank/other (= "conservative" auto-segmentation).
- Number format must follow the Windows regional decimal setting.

## Where a source may go (pp. 96-98, 107-108)
All insertion objects (sources, loads, transmission lines, transformers, networks) are placed on a *segment* (or a virtual segment) and effectively cut the wire there.
- Position is wire number plus % from end 1, or the shortcuts **`W#E#`** (a wire end) and **`W#C`** (center). EZNEC snaps to the nearest segment center and reports it in the "Actual Pos." columns. Give the wire an **odd** number of segments to hit the exact center (NEC-2/4.2).
- **Accuracy rules (NEC-2 / NEC-4.2)**: the segments next to the object's segment should be the same length and diameter as it, in a straight line. **If the object is on an end segment of a wire, only a single wire should connect to it.** The suggested fix: put it on a wire with **at least three segments, and not on an end segment**. Violations show up in EZNEC's Segmentation Check.
- **Source at a multi-wire junction**: split sources can't be used at a junction of 3+ wires. The manual's recommended alternative is to **insert an additional short wire at the junction and put the source on that wire** (with the three-segment rule above, and optionally Segment Length Tapering). This is exactly the "source connected to multiple wires" complaint with a counterpoise fan attached at the feed.
- One source per segment. Sources on a segment are in parallel with any other insertion object on it.

## Transformers (pp. 121-122)
- Ideal two-port. Each port must sit on a *different* real or virtual segment. Ports cut the wires they sit on; no common-mode current.
- **Rel Z columns are the two port impedances; the turns ratio is the square root of their ratio.** Choose values in the ballpark of the real impedances (the manual warns against e.g. 0.5 and 2, or 5000 and 20000, for a 50 to 200 ohm job). For a 9:1 unun use **50 and 450**, not 1 and 9.
- Normal/Reverse flips one winding's polarity; polarity follows each wire's end 1 to end 2 direction.
- **Virtual segments**: enter `V1`...`V999` as the wire number to connect objects together without a wire; objects on the same virtual segment are in parallel. The manual's tutorial wires a source and a transformer port to `V4` and the other port to the feed wire/virtual segment.

## Counterpoise, low radials and end-fed wires (pp. 85-87, 93-94)
- A counterpoise is just more wires to the solver: it carries current, radiates and couples like any other wire, so it changes pattern and feedpoint impedance. The manual's end-fed discussion explains why it is needed at all: a source has two terminals with equal and opposite current, so a source on the end of a lone wire sees almost an open circuit; the return path (a counterpoise, ground wire or the radio chassis) is part of the real antenna.
- Radials very near ground: ordinary segmentation is fine at heights of at least 0.001 wavelength (and at least the vertical wire's diameter); 0.0001 to 0.001 wavelength needs segment length tapering; the minimum is 0.0001 wavelength. For wires lying on or just above the ground use the **High Accuracy Real** ground type. The same section describes putting the source on a short 3-segment wire (the app's feed section).

## Segmentation Check limits (measured from the running program, EZNEC Segmentation Check, conservative guidelines)
The manual does not print numeric thresholds, so these come from warnings in EZNEC itself (wavelength = 983.57 / f(MHz) ft):
- **Minimum segment length = wavelength / 1000.** Seen: "recommended min. = 0.1405 ft" at 7 MHz (983.57/7/1000) and 0.136 ft at 7.2 MHz.
- **Maximum segment length = wavelength / 20.** Seen: "conservative max. = 3.513 ft" at 14 MHz (983.57/14/20). A 4.511 ft radial segment was flagged.
- Both scale with frequency, so a model graded for one band can violate them on another; the app derives its segment lengths from the design frequency (FREQ).
- The check measures the **straight length of each segment**: three feed-section segments across a sag curve are a chord, a little shorter than the arc (0.09755 ft instead of 0.1 ft was seen on a 24 ft rise), so keep some margin.
- Segmentation Check also covers segment length/diameter ratio and insertion-object placement; their numbers are not known here. From the manual: a source should be on a wire of at least about 0.02 wavelength with 3+ segments, neighbours equal in length and diameter, and the Average Gain test should be run to validate source placement.

## Model limits
- Segment count: the manual says **EZNEC+ allows 2000 segments** and **EZNEC Pro/2+ and Pro/4+ allow 45,000** (Standard and Demo are lower). The app currently warns above 2000 (the user's figure for their installed program).

## What this means for the app (done in v2.2.0 / build 8)
1. **Graded segments**: the source wire starts with a 3-segment feed section (source at `W#C`), segments grow smoothly to wavelength/div, and the counterpoise radials are graded from the feed too. This replaced a short-lived separate vertical stub wire.
2. **Segments** field per wire/fan (auto / minimum `M` / fixed) used when grading is off.
3. Export comments naming where the source goes, and a `NOTE:` when 3+ wires meet at the feed with grading off.

Still open: export comments with the transformer recipe (Rel Z 50 and 450, source and port 1 on one virtual segment, port 2 on the feed section), and a source-segment check against the rules above.
