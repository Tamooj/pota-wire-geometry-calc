# Wire Antenna Geometry Calculator — Design Doc

**Status:** v2.0.x (EZNEC export is now the real import format) — rewritten around a single wires-and-supports model (replaces the four per-type tabs); multi-wire scenes with a merged export, number boxes beside sliders, unit-native slider ranges, a 3D view. v1.x history is summarized in Section 8. Covered by tests (see [tests/](../tests/)). Reference notes from the EZNEC manual: [EZNEC-notes.md](EZNEC-notes.md).
**Artifact:** [`index.html`](../index.html) (single-file, vanilla JS, no build step)
**Purpose:** Generate EZNEC/MMANA-ready wire coordinates for field-deployable POTA antenna geometries, ahead of time, so geometry doesn't get worked out on-site — and, as it turned out, to make entering catenary arcs and counterpoise sets into those (Win 3.1-style) modeling tools far less painful.

---

## 1. Problem / Requirements

### Context
Ad hoc POTA installations using random-wire antennas fed through 9:1 ununs into a Xiegu G90. Real-world constraints: available trees/supports are never in convenient positions, setup happens under time/comfort pressure (heat, insects), and it's preferable to have a small library of pre-modeled "go-to" geometries rather than improvising in the field. In practice the tool has also become a general front-end for entering wire geometry into EZNEC and MMANA, which is why multi-wire models (an antenna plus its counterpoise) and precise numeric entry matter.

### Functional requirements
1. Produce 3D coordinates (X, Y, Z) for wire endpoints, in a convention directly usable by EZNEC Pro 2+ v7.0 and MMANA wire-entry tables.
2. Model, in one screen and one model, everything the old tabs did: straight and sagging slopers, inverted-V (collinear or bent), inverted-L, and counterpoise fans — and combinations of them (e.g. a sloper plus its counterpoise) exported as a single merged wire list.
3. Support both feet and meters, with correct unit conversion of all stored parameters when toggled (not just display formatting), and slider ranges/steps native to each unit.
4. Provide live visual feedback: a rotatable 3D view, plus side-profile (elevation) and plan-view (compass-oriented, N-up) sketches, all updating with parameter changes.
5. Provide copy-pasteable text exports (generic table, EZNEC "Wires" report, MMANA `.maa` body).
6. Allow both quick slider entry and exact numeric entry for every length and angle.
7. Saved presets/scenarios beyond the built-in starting points (not yet implemented — see Section 5).

### Non-requirements
- Does not model ground system loss, soil conductivity, or near-field ground interaction — output is geometry only, for import into NEC-2 engines that handle the EM solve.
- Does not currently export a native `.nec`, EZNEC `.ez`, or MMANA `.maa` *file* — output is text for manual paste.

---

## 2. Coordinate System & Conventions

- **X = East, Y = North, Z = Up** (standard right-handed, ground-referenced — matches typical EZNEC/MMANA ground-plane convention).
- **The feed is the origin** in X/Y, at its own height in Z: `(0, 0, z_feed)`. The feed is the start of the *source wire* (Section 4). If the source wire is itself attached partway along another wire, the whole model is re-solved shifted so the feed still lands at the origin. This matches how you'd actually stake out a site: the feedpoint is the one fixed, known point and everything else is measured outward from it.
  > Note: in v1 the Inverted-V tab put the *apex* at the origin rather than the feed, contradicting this convention. In v2 the feed is always the origin, so inverted-V coordinates differ from v1 by a translation.
- **Azimuth** is input as compass bearing in degrees from North (0° = N, 90° = E), matching ham convention. Internally converted via `dx = R sin(az)`, `dy = R cos(az)`.
- **Distances along a wire are horizontal** (plan-view) distances, measured from the wire's start — what you pace out on the ground. Wire *length* only enters as slack within a span.
- All internal geometry is performed in the currently selected unit; toggling units converts the *stored parameter values* exactly (no snapping), so switching units mid-edit never corrupts a model. MMANA export is always in meters (`toMeters()`).
- **Ground is Z = 0**, flat. (A sloped or offset ground plane is a roadmap item.)

---

## 3. The Model: Wires, Supports, Spans, Fans

### 3.1 Why one model
The four v1 geometry types turned out to be special cases of the same thing:

| v1 type | In the v2 model |
|---|---|
| Straight sloper | one wire, 2 supports, zero slack |
| Sagging sloper | one wire, 2 supports, slack > 0 |
| Inverted-V | one wire, 3 supports (peak in the middle), slack 0 or > 0 on either side |
| Inverted-L | one wire, 3 supports, first span vertical (both supports at d=0) |
| Bent inverted-V | two wires; the second attached to the first wire's apex support |
| Counterpoise fan | a fan element attached to a support |

### 3.2 Scene structure
```
scene = { elements:[...], feedEl:<wire id>, seq, wireN, fanN }

wire: { id, kind:'wire', name, attach:null | {el,idx}, az, gauge:null|AWG,
        supports:[{d,z}, ...],   // >= 2; supports[0].d == 0
        slack:[...] }            // one per span (between neighbouring supports)

fan:  { id, kind:'fan', name, attach:{el,idx}, gauge:null|AWG, n, len, zEnd, centerAz, spread }
scene.gauge = default AWG size (10)
scene.taper = { on, fine, ratio, div }   // graded segmentation (below)
scene.freq  = design frequency, MHz
wire/fan .segs = null (auto) | 'M' | integer   // segments per exported wire
```
- A **wire** runs along a single azimuth through its **supports**. Each support has a horizontal distance from the wire's start and a height. (Distances are kept non-decreasing; negative distances are deliberately not forbidden by the data model, to leave room for dipoles — Section 5.)
- Each **span** between neighbouring supports has its own **slack**: extra wire length beyond the straight chord. Zero slack means a taut straight wire. Positive slack means a catenary sagging between those two supports. This is per span, not per wire and not per support, so a peak in the middle with a sagging arc to an anchor on each side is just three supports with slack on both spans.
- A vertical span (both supports at the same distance) is always taut — it has nothing to sag.
- **Attach**: `null` means the wire starts at the origin. `{el, idx}` means it starts at support `idx` of an earlier wire, at that support's height (the attached wire's own `supports[0].z` is ignored by the solver and mirrored back into state for display). Attach references only point at *earlier* elements, so positions resolve in one pass with no cycles. This is how a bent V, or a counterpoise that must share the main antenna's feed point, is expressed.
- A **fan** is a generator of N straight radials from its attach point, evenly spread across an arc. It deliberately has no supports or sag (the accuracy loss is minimal for counterpoises). `len` is the radial's *cut length*; its horizontal reach follows from the height drop between the attach point and the radial end (`sqrt(len² − dz²)`), so the wire you cut equals the wire modeled.
- **Wire gauge**: `scene.gauge` is the default AWG size (#10); any wire or fan can override it with its own `gauge` (a fan's radials share one). Both are sliders (and number boxes) from **#10 to #24**, clamped and rounded to whole sizes. `solveScene` stamps every sub-wire with its resolved `gauge`, which is all the exporters read. Diameter is `0.005 * 92^((36-n)/39)` inches (#10 = 0.1019 in, #22 = 0.0253 in).
- **Graded segments** (`scene.taper`, on by default). Instead of dividing the radiator evenly, the model is built from segments that grow smoothly from the feed:
  - The **source wire** starts with one **feed section**: a single wire of **3 equal short segments** (`fine`, default 0.1 ft / 0.03 m each). The source belongs at its center (EZNEC `W#C`), so its neighbours are straight and equal (the manual's rule), and it is away from the multi-wire junction at the feed.
  - Segments then grow by `ratio` (default 1.5) per step up to the **longest segment, wavelength / div** at the design frequency (`div` default 20, `scene.freq`).
  - Everything that starts at the feed point is graded outward from the same fine length: the source wire, any other wire with no attach point or attached to support 1 of the source wire, and **every counterpoise radial of a fan attached there**. Other wires and spans (after the first span, or attached elsewhere) use equal segments of about the longest length.
  - Each span ends exactly on its support: `taperedLengths()` builds the length list, absorbing a leftover shorter than half a segment into its neighbour.
  - **Export shape:** the feed section is one 3-segment wire; each ramp segment is a 1-segment wire; on a taut span a run of equal segments is one multi-segment wire; on a sagging span every node is a wire end so the curve is followed. A 90 ft radiator at 14 MHz comes to a few dozen wires. The metrics strip shows **Total segments** and a warning appears above **EZNEC's limit of 2000 segments**.
  - **Catenary nodes by arc length:** `catenaryCurve()` gives the closed-form arc length `arc(x) = a·sinh((x−xv)/a) − a·sinh(−xv/a)`, inverted as `x = xv + a·asinh((s + s0)/a)` with `s0 = a·sinh(−xv/a)`, so nodes sit at chosen distances along the actual wire (and the span still ends exactly on its supports). This also provides the arc-length-uniform waypoints from the old roadmap.
  - With grading off, the model is as in v2.0 (one wire per straight span, 10 sub-wires per sag span) and the per-element Segments setting applies; with grading on, segment counts come from the grading and that control is disabled.
  - Why: the EZNEC manual says an insertion object on the end segment of a wire must have only one wire connecting to it, and recommends a wire of 3+ segments with the object away from the end; neighbouring segments should also be similar in length (see [EZNEC-notes.md](EZNEC-notes.md)). A quarter-wave counterpoise radial meeting a tiny feed segment would be as abrupt as the radial is long, hence the radials are graded too.
  - (An earlier v2.1 build used a separate vertical "feed stub" wire. It was replaced because the right-angle bend and separate part were unnecessary; "stub" also has a specific meaning in antenna work.)
- **Segments** (`element.segs`): per wire/fan, `null` = Auto (field omitted in the EZNEC import, so EZNEC uses its "conservative" criterion), `'M'` = EZNEC's minimum recommended, or an integer applied to **every exported sub-wire** of that element (a sagging span is 10 sub-wires). MMANA writes the integer as its `SEG`, otherwise `-1` (tapering).
- **Feed / source**: one wire is the source wire (default: the first). The MMANA source goes at the beginning of that wire's first sub-wire. Feeding mid-wire (dipoles) is not offered yet.
- `sanitizeScene()` repairs invariants after any edit: at least 2 supports, slack array length, `supports[0].d = 0`, attach references valid and pointing backwards, a valid feed wire. Removing a wire detaches dependants (they fall back to the origin, fans re-attach to the first wire); inserting/removing supports renumbers attach indexes.

### 3.3 Catenary between two supports
The most mathematically involved piece; documenting the derivation here since it's not obvious from the code alone.

**Inputs (per sagging span):** horizontal span `l`, height difference `h = z₂ − z₁`, and *actual* wire length `s = chord + slack`, where `chord = sqrt(l² + h²)`.

**Governing relation** (catenary between two points of unequal height, arc length constraint):
```
s² - h² = 4a² sinh²(l / 2a)
```
Solved numerically for the catenary parameter `a` via bisection (`solveCatenaryA`; no closed form). Verified against numerical arc-length integration during development — bisection converges reliably because the LHS is monotonic in `a` over the valid domain (diverges as `a→0`, approaches `l²` as `a→∞`). The bisection's upper bound is doubled until it actually brackets the root (a fixed bound fails as slack → 0 and `a` grows without bound).

**Vertex (lowest point) location**, relative to the span's start:
```
x_v = (l/2) - a * asinh( h / (2a * sinh(l/2a)) )
```
**Curve**, with the constant chosen so the span starts at its first support:
```
z(x) = a * cosh((x - x_v)/a) + C,     C = -a * cosh(x_v / a)       (z relative to the span start)
```
**Output:** 11 waypoints (10 sub-wires) per sagging span, stepped evenly in **horizontal x**, not arc length. For realistic sag on typical POTA spans, even horizontal stepping gives adequately uniform sub-wire lengths for NEC purposes, and it avoids inverting the arc-length integral. Candidate refinement for steep/short spans (Section 5). Span endpoints are forced exactly onto the supports so adjacent spans share bit-identical junction points (this is what lets `findConnection` chain them).

**Guards:** if slack is so large the curve overflows to non-finite values, the span falls back to taut and a "sag-failed" warning is shown. After solving, any wire whose lowest point is below Z = 0 raises a "dips below ground" warning.

**Why this matters physically:** a two-point straight-line model of a drooping wire misrepresents current-distribution geometry — the actual wire is longer than the chord and takes a different path through space, which affects feedpoint impedance and pattern, especially as sag becomes electrically significant at higher frequencies.

### 3.4 Counterpoise fan
N radials fanned evenly across a total spread angle, centered on a chosen azimuth, all sharing the attach point (so a counterpoise attached to a sloper's feed automatically shares its height and position — no more matching a separate "attach height" by hand). Straight/taut, on-ground (`zEnd = 0`) or elevated.

> **Fixed (v1.1):** at `spread = 360`, dividing by `n−1` made the first and last radial land on the same bearing. A full-circle spread now divides by `n`. Covered by tests in both test pages.

### 3.5 Export formats
Three formats, toggled in the export panel, all generated from the one merged, ordered wire list (elements in order; each wire's sub-wires in order along the wire):

- **Generic** — tab-separated `label X1 Y1 Z1 X2 Y2 Z2`, fixed 2-decimal coordinates in the current unit.
- **EZNEC** — EZNEC's own **"Import Wires From ASCII File"** format (Other menu), per the EZNEC user manual ("Wire Coordinate File" / "Importing Wires"): an optional units line, then one line per wire, `x1 y1 z1 x2 y2 z2 diameter [segments]`. We write `ft in` or `m mm` as the units line, space-delimited coordinates (6 significant figures via `eznecNum()`), the diameter as `#n` per wire (the AWG gauge, accepted by the format), and a trailing `; W{n} label` comment on each wire. The optional eighth (segments) field is deliberately omitted so EZNEC segments each wire with its "conservative" criterion for the frequency you set. Text after `;` is ignored, as is any line starting with `;`. Two comment lines help with the source, which the format cannot carry: one names where to put it (`wire N, end 1`, or `W#C` for the graded feed section), and if three or more wire ends meet at the feed with grading off, a `NOTE:` suggests turning on Graded segments. The optional eighth field carries the segment setting (`#10 5`, `#10 M`). Not part of the format: sources, frequency, ground, connections — those are set inside EZNEC. After importing you choose to add the wires to, or replace, the existing description.
  - Numbers use a period decimal point; the manual says the import file must follow the Windows regional decimal setting, so a comma-decimal locale would need commas (not handled).
  - **Connections:** the format carries coordinates only. Wire ends that coincide are listed as comment lines (`; W1E1 = W2E1 = ...`, via `junctionComments()`; for the export only junctions of 3+ ends or between different wires/radials, since every graded node is a plain join) so you can confirm them in the Wires window. *Whether EZNEC automatically connects coincident ends on import is unverified* — check this with a sloper + counterpoise preset and look at the Conn. columns.
  - Wires of zero length or diameter are rejected by EZNEC.
  - (v1.2–v1.4 emitted a replica of EZNEC's printed "Wires" *report* instead, which is not an import format. `findConnection()` and its tests remain for the `W{n}E{1|2}` helper, now unused by the exports.)
- **MMANA** — a `.maa`-format body (`***Wires***` / `*** Source ***` / `*** Load ***` / `*** Segmentation ***` / `*** G/H/M/R/AzEl/X ***`), reverse-engineered from three real `.maa` samples and the MMANA-GAL Basic manual. Field semantics:
  - `Wires`: `X1,Y1,Z1,X2,Y2,Z2,R,SEG`, joined with `,\t`. X/Y/Z are **always meters**. `R` is wire *radius* in meters, `awgRadiusM(gauge)` per wire, from the same gauge the EZNEC export prints. `SEG` is the wire's segment count when it has one (graded wires always do; otherwise the element's fixed count), else `-1`. The source is `w{k}b`, the beginning of the feed section (unverified against MMANA's placement rules; MMANA also has its own tapering, `SEG = -1`). `SEG` is a segmentation *mode code*, not a count: `-1` = tapering (recommended default); it must be a bare integer.
  - `Source`: `w{k}b` where `k` is the 1-based number of the first sub-wire of the chosen **source wire** (Source selector in the export panel, default: the first wire). Delete or move it in MMANA if merging into a model with its own source.
  - `Load`: always `0`. `Segmentation` / `G/H/M/R/AzEl/X`: fixed constants copied from MMANA-GAL's bundled sample files.
  - **Frequency (MHz)** number input (default 14.0) feeds line 3 of the file.
  > **Caveat — line endings:** real `.maa` files use CRLF, but `<textarea>.value` normalizes `\r\n` to `\n`, so LF is all the export box can hold.

---

## 4. Architecture

- **Single HTML file**, no framework, no build step — vanilla DOM and inline SVG. Chosen because the interaction model is simple (form inputs → recompute → re-render).
- **State:** one `scene` object (Section 3.2). Presets (`PRESETS`) are just functions that build a scene; the old tabs survive as "Start from preset" buttons that replace the scene.
- **Solver:** `solveScene(scene)` is a pure function returning `{ elements, points, wires, summary, warnings, firstSub, feed }`. `points` are labeled rows for the table; `wires` is the merged, ordered sub-wire list everything else consumes; `summary` entries are `[label, rawValue, kind]` (`'length' | 'angle' | 'count' | 'raw'`) formatted at render time; `firstSub[elId]` is the index of an element's first sub-wire (for the MMANA source). It runs `solveRaw` once, and a second time shifted if the feed isn't already at the origin.
- **Render pipeline:** `renderInputs()` rebuilds the parameter panel (preset load, structural edit, unit toggle, or when a typed value needs a different slider range); `renderOutputs()` (table, summary, warnings, export, three views) runs on every input event and never touches the panel, so dragging a slider can't destroy the node being dragged. `syncControls()` pushes state into every other control after cascaded changes (support-order clamping, mirrored attach heights).
- **Number box + slider per field** (`fieldHTML()`): each control carries `data-el`, `data-field`, `data-idx`, `data-role="num"|"rng"`. Typing updates state immediately and moves the slider; `change` (Enter/blur) normalizes the value (clamp ≥ 0, azimuth wraps to 0–360) and, only if that value wants a different slider range, rebuilds the panel. The stored value is whatever was typed — sliders only steer.
- **Slider ranges** (`FIELD_SPECS`, `sliderSpec`): native `[min, max, step]` per unit (e.g. distance: 150 ft / step 1, or 50 m / step 0.5 — not feet-in-disguise). If a value exceeds 90% of the default max, the range becomes `niceCeil(1.5 × value)` (a 1/2/5 × 10ᵏ number) with a proportionally larger round step. Ranges are recomputed only at panel rebuild, never mid-drag. Presets built in meters are rounded to 5 cm.
- **Views:**
  - **3D** (`render3D`): orthographic projection, SVG, drag to rotate / wheel to zoom / Top-Side-Reset buttons. The camera sits at compass bearing `yaw`, elevation `pitch`; screen-right `r = (−cos yaw, sin yaw, 0)`, screen-up `u = (−sin yaw sin pitch, −cos yaw sin pitch, cos pitch)`, so yaw 180 / pitch 90 is a plan view with N up. Draws a **ground square as four lines on Z = 0** (a true square centered under the model's footprint, sized to the larger footprint dimension and a share of the height; deliberately not an opaque fill), N/E labels, dashed drop lines from supports to the ground, and a ring on the feed.
  - **Side profile**: projects onto the vertical plane along the *first wire's* azimuth (title says which). Wires in other directions are foreshortened — the 3D view shows them true. Round-number gridlines and tick labels in the current unit.
  - **Plan**: centered on the model's bounding box, round-number range rings around the feed with labels.
- **Testability hook:** `window.WGC = { az2xy, fmt, solveScene, solveCatenaryA, catenaryPoints, findConnection, eznecNum, mmanaNum, niceCeil, niceTicks, sliderSpec, build*Export, getScene, getUnit, loadPreset }` — additive, no effect on the app. The test pages load the real `index.html` in an iframe, so tests can never drift from shipped code.
- **Version/build indicator:** `APP_VERSION`/`APP_BUILD`, rendered bottom-right as `vX.Y.Z · build N`. **Bump `APP_BUILD` on every edit to `index.html`, no matter how small** — it exists so a glance confirms you're not looking at a stale cached copy, which caused repeated phantom-bug confusion during development. Bump `APP_VERSION` for milestones.
- **Copy button:** tries `navigator.clipboard.writeText`, falls back to `document.execCommand('copy')`, and shows a red "Select text & Ctrl+C" state if both fail (the Clipboard API needs a secure context, so it fails silently on `file://`).

---

## 5. Known Limitations / Roadmap

Roughly in order of likely value:

1. **Dipoles (offset or symmetric)** — a feed somewhere along a wire, at a segment end. The model already allows it in principle (feed is just a marker on a support; the whole scene is shifted so the feed is the origin; supports split spans so every support is a sub-wire endpoint; negative support distances are not forbidden by the data). Needs: a UI for placing the source on any support, source syntax for a wire end/middle in MMANA (`w{k}e` etc. — to be verified against real files before shipping), and a symmetric/offset convenience.
2. **Sloped / offset ground plane** — ground is currently the flat plane Z = 0 (drawn as four lines in the 3D view). Make it more flexible for sites on a slope or a roof: ground elevation/tilt as a scene property, heights measured above local ground, and the 3D ground outline following it. (Logged here deliberately as a future revision.)
3. **Native / verified file export** — `.ez`, `.nec`, or an `.maa` verified to round-trip through MMANA-GAL; offer a Download button (a blob download works in plain HTML). Derive segmentation from frequency instead of fixed defaults.
4. **Saved scenarios** — persist named configurations (`localStorage` and/or JSON export/import) so the "go-to geometries" can be stored and recalled. Beyond the built-in presets.
5. ~~Arc-length catenary waypoints~~ — done as part of graded segments (v2.2).
6. **Free tails** — a straight wire end that continues past the last support (dangling end). Dropped from v2.0 to avoid an under-defined end point; needs a total length and end height.
7. **Segmentation guidance** — gauge (default + per-wire) and segments (auto / minimum / fixed) are selectable. Still to do: a recommended segment count from frequency, and warnings when too coarse. Loss/insulation can't be carried by EZNEC's import format, so they aren't offered. A source-segment check against the manual's rules (equal-length straight neighbours) is also possible.
8. **Counterpoise/main-wire coupling check** — warn if radials pass too close to the main wire.
9. **Multi-select / reorder elements** and a combined "source on any support" picker.

---

## 6. File Reference

- [`index.html`](../index.html) — the tool itself, self-contained, opens in any browser or serves via GitHub Pages.
- [`tests/`](../tests/) — unit and system tests; see Section 7.
- This document — the design record; keep it in sync with `index.html`.
- [`HANDOFF.md`](../HANDOFF.md) — session-transfer summary for a fresh agent.

---

## 7. Testing

No build step, no npm dependency — tests are plain HTML pages you open in a browser.

- **[tests/harness.js](../tests/harness.js)** — ~70-line hand-rolled `suite()`/`test()`/`assert` framework shared by both pages, rendering a pass/fail dashboard.
- **[tests/unit-geometry.html](../tests/unit-geometry.html)** — loads the real `../index.html` in a hidden iframe and calls the exposed `window.WGC` functions with literal scene objects. Covers straight wires, peaks and an L, catenary governing relation (incl. near-zero slack), slack → sag (point/wire counts, exact support heights, both-sides sag with one shared peak, vertical span taut, below-ground warning), attach chaining and bent V, feed-at-origin shifting, fan behaviour (360° fix, true cut length, attach point), `findConnection`, number formatters, and the round-number helpers.
- **[tests/system-app.html](../tests/system-app.html)** — drives the real DOM: presets, slider-drag node survival, number-box entry (exact storage, slider range widening and returning to default, azimuth wrap, clamping, support ordering), unit toggle (exact round trip, native steps, metric presets), adding/inserting/removing wires, supports and fans, the fan through the export pipeline, warnings, the EZNEC/MMANA/generic exports end to end (merged wire list, source selector, meters-always), the 3D ground square and camera buttons, scale labels, and the copy button's fallbacks.

**To run:** serve the repo root with `python -m http.server 8420` and open `http://localhost:8420/tests/unit-geometry.html` and `.../system-app.html` (a plain `file://` open works in most browsers but some restrict script access across iframes). Results render on the page; `window.__TEST_SUMMARY__` holds `{total, passed, failed}`. Both pages set the iframe's `src` from JS with a `?_t=Date.now()` cache-buster — a static `src` was observed to serve a stale copy of the app.

---

## 8. History

- **v1.0** — four tabs (straight sloper, inverted-V, sagging sloper, counterpoise fan), sliders only.
- **v1.1** — fixed the counterpoise 360° spread bug, the slider re-render jank on every drag tick, catenary bisection bracketing near zero slack, unit-toggle snapping; added the first test suite.
- **v1.2 / v1.3** — EZNEC "Wires" report export; MMANA `.maa` export with frequency field.
- **v1.4** — version/build indicator; Copy-button clipboard fallback.
- **v2.2.0 (build 8)** — graded segments replace the short-lived vertical feed stub: a 3-segment feed section at the start of the source wire, smoothly growing segments to wavelength/div, radials graded from the feed too, catenary nodes placed by arc length, total-segment count and a 2000-segment warning, a design frequency that drives the longest segment. Also a per-wire/fan segments setting (auto / minimum / fixed) used when grading is off. Gauge, grading and frequency persist across presets.
- **v2.2** — per-wire wire gauge (default + override, #10–#24 sliders) feeding both exports; angle/count sliders no longer widen when a value is near their maximum (a typed azimuth over ~324° used to stretch its slider to 1000).
- **v2.1** — EZNEC export switched from the report replica to the real ASCII wire-import format (see Section 3.5).
- **v2.0** — this rewrite: one wires-and-supports model replacing the tabs; per-span slack (so any wire can sag, closing the old "sag for inverted-V legs" item); multi-element scenes (a counterpoise attaches to a support instead of being matched by hand) with one merged export and a source selector; number boxes beside every slider; unit-native, value-adaptive slider ranges; 3D view with ground square; round-number scale labels on all views; feed-at-origin convention made true for every geometry; radial `len` now means cut length.
