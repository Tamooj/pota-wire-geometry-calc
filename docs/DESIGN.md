# Wire Antenna Geometry Calculator — Design Doc

**Status:** v1, functional
**Artifact:** [`index.html`](../index.html) (single-file, vanilla JS, no build step)
**Purpose:** Generate EZNEC/MMANA-ready wire coordinates for field-deployable POTA antenna geometries, ahead of time, so geometry doesn't get worked out on-site.

---

## 1. Problem / Requirements

### Context
Ad hoc POTA installations using random-wire antennas fed through 9:1 ununs into a Xiegu G90. Real-world constraints: available trees/supports are never in convenient positions, setup happens under time/comfort pressure (heat, insects), and it's preferable to have a small library of pre-modeled "go-to" geometries rather than improvising in the field.

### Functional requirements
1. Produce 3D coordinates (X, Y, Z) for wire endpoints, in a convention directly usable by EZNEC Pro 2+ v7.0 and MMANA wire-entry tables.
2. Support multiple wire geometries relevant to random-wire POTA deployment:
   - Straight sloper (single wire, feed low, one support, taut)
   - Inverted-V end-fed (apex over a mast/tree, two legs at independent azimuth/angle down to feed and far ends — not necessarily collinear, since real tree pairs rarely line up)
   - Sagging sloper (same as straight sloper, but modeling actual rope/wire slack as a catenary curve rather than an idealized straight line)
   - Counterpoise fan (N radials, on-ground or elevated, fanned across a configurable arc)
3. Support both feet and meters, with correct unit conversion of all stored parameters when toggled (not just display formatting).
4. Provide live visual feedback: side-profile (elevation) and plan-view (compass-oriented, N-up) sketches that update with parameter changes.
5. Provide a copy-pasteable plain-text export (tab-separated) of all wire segments, for direct entry into modeling software wire tables.
6. Be usable as a durable reference tool — parameters saved as presets/scenarios for repeated real-world configs (not yet implemented — see Section 5).

### Non-requirements (v1)
- Does not model ground system loss, soil conductivity, or near-field ground interaction — output is geometry only, for import into NEC-2 engines that handle the EM solve.
- Does not currently export a native `.nec`, EZNEC `.ez`, or MMANA `.maa` file — output is a generic coordinate table intended for manual paste.
- Sag modeling for inverted-V legs and counterpoise radials is not implemented (both currently assumed taut/straight).

---

## 2. Coordinate System & Conventions

- **X = East, Y = North, Z = Up** (standard right-handed, ground-referenced — matches typical EZNEC/MMANA ground-plane convention).
- **Feedpoint is always the origin** `(0, 0, z_feed)`. Everything else is positioned relative to it. This matches how you'd actually stake out a site: feedpoint is the one fixed, known point; everything else is measured outward from it.
- **Azimuth** is input as compass bearing in degrees from North (0° = N, 90° = E), matching ham convention rather than mathematical convention. Internally converted via:
  ```
  dx = R * sin(azimuth_rad)   // East component
  dy = R * cos(azimuth_rad)   // North component
  ```
- All internal geometry math is performed in whatever unit is currently selected (feet or meters) — there is no hidden canonical unit; toggling units converts the *stored parameter values*, not just display strings, so switching units mid-edit doesn't silently corrupt a model.

---

## 3. Design Reasoning Per Geometry Type

### 3.1 Straight Sloper
Simplest case. Feed height, support height, horizontal distance, azimuth → wire length and elevation angle derived via Pythagorean relation. No sag — treated as taut. This is the correct default for most field slopers since paracord/nylon halyards are usually tensioned enough that catenary droop is a second-order effect relative to overall pattern.

### 3.2 Inverted-V End-Fed
Modeled as three points: apex (mast top) plus two independently-specified legs (azimuth + horizontal distance + end height each). Deliberately **not** constrained to be collinear (i.e., leg 2 azimuth is not forced to `leg1_azimuth + 180`) — real support trees are essentially never positioned to allow a perfectly straight inverted-V, and forcing collinearity would make the tool less useful for actual field conditions. Default value approximates a straight line but is user-editable.

> Caveat: the side-profile SVG projects points onto a single horizontal axis (signed by dot product with the far-end direction). That projection is a good visual approximation when the legs are near-collinear, but gets visually misleading for a strongly bent V (e.g. legs 90° apart) — the 2D side view is inherently lossy for a genuinely 3D bent shape. The coordinate table and export are unaffected; this is a diagram-only limitation.

### 3.3 Sagging Sloper (catenary)
This is the most mathematically involved piece and the one most likely to need future refinement — documenting the derivation here since it's not obvious from the code alone.

**Inputs:** feed height `z1`, anchor height `z2`, horizontal span `l`, and *actual* wire length `s` (which must exceed the straight-line distance — the excess is the slack that produces sag).

**Governing relation** (catenary between two points of unequal height, arc length constraint):
```
s² - h² = 4a² sinh²(l / 2a)        where h = z2 - z1
```
Solved numerically for the catenary parameter `a` via bisection (no closed form). Verified against numerical arc-length integration during development — bisection converges reliably because the LHS is monotonic in `a` over the valid domain (diverges as `a→0`, approaches `l²` as `a→∞`).

**Vertex (lowest point) location**, relative to the feed end:
```
x_v = (l/2) - a * asinh( h / (2a * sinh(l/2a)) )
```

**Curve equation**, with `C` chosen so `z(0) = z1`:
```
z(x) = a * cosh((x - x_v)/a) + C
C = z1 - a * cosh(x_v / a)
```

**Output:** 11 waypoints (10 segments), stepped evenly in **horizontal x**, not arc length. This is a deliberate simplification — for realistic sag magnitudes on typical POTA spans, even horizontal stepping gives adequately uniform segment lengths for NEC modeling purposes, and it avoids the added complexity of arc-length parametrization (which requires inverting the arc-length integral — solvable but not yet justified by the accuracy gain). **Flagged as a candidate refinement if used for very short/steep verticals where segment non-uniformity would become significant** (see Section 5).

> Numerical note: `solveCatenaryA`'s bisection bounds (`lo = 1e-6*l`, `hi = 1000*l`) are not validated against the root-bracketing precondition before iterating. Near the boundary where slack is very small (wire only slightly longer than the straight-line distance), `a` grows very large and `hi` may not actually bracket the true root — worth a guard/assert if this tool sees heavy use near that edge case.

**Why this matters physically:** a two-point straight-line model of a drooping wire misrepresents current distribution geometry — the actual wire is longer than the chord and takes a different path through space, which affects feedpoint impedance and pattern, especially as sag becomes electrically significant at higher frequencies.

### 3.4 Counterpoise Fan
N radials fanned evenly across a configurable total spread angle, centered on a chosen azimuth, all sharing a single attach point (which may differ in height from the main antenna feedpoint — e.g., a ground stake near the base of a mast). Straight/taut, no sag modeling. Supports both on-ground (`z_end = 0`) and elevated counterpoise configurations.

> **Known issue:** at `spread = 360`, the fan-angle formula `spread/(n-1)` causes the first and last radial to land on the same bearing (they're 360° apart, i.e. identical), rather than producing an even N-way star. E.g. `n=4, spread=360` currently produces bearings at 0°/120°/240°/360°(=0°) — an effective 3-way spacing with a duplicated radial, not 4 radials at 90°. The fix is to special-case full-circle spread (`spread % 360 === 0`) and divide by `n` instead of `n-1`. Filed as a follow-up rather than fixed in v1 — see Section 5.

---

## 4. Architecture

- **Single HTML file**, no external JS framework — vanilla DOM manipulation, inline SVG for diagrams. Chosen over React for this tool because the interaction model is simple (form inputs → recompute → re-render) and doesn't benefit from component state management overhead.
- **State model:** one JS object per geometry type (`state.sloper`, `state.invv`, `state.sag`, `state.counterpoise`), holding all parameters for that type independently — switching tabs doesn't lose your work on another tab.
- **Render pipeline:** single `render()` function called after any input change or tab/unit switch. Rebuilds: input field HTML → geometry model (points + wires + summary stats) → coordinate table → plain-text export → both SVG diagrams. Not optimized for performance (full re-render each time) — fine at this scale (≤~15 DOM nodes worth of geometry), would need targeted updates if the tool grows substantially more complex.

  > **Known issue:** because `render()` rebuilds the entire `#wgcInputs` panel HTML on every `input` event, dragging a range slider replaces that slider's own DOM node on every tick of the drag — in some browsers this can interrupt/jank an in-progress drag gesture. Splitting `render()` into a `renderInputs()` (run once, on tab/unit switch) and `renderOutputs()` (table/summary/export/SVGs/labels, run on every input tick) would fix this and is a good first refactor for a v1.1.
- **Geometry builders** (`buildSloper`, `buildInvV`, `buildSag`, `buildCounterpoise`) each return a common shape: `{ points: [...], wires: [...], summary: [...] }` — this common interface is what makes the table/export/SVG renderers type-agnostic. **Any new geometry type should conform to this same return shape** to slot into the existing render pipeline without touching the renderers.
- **Unit conversion:** `convertAllUnits()` walks a per-type list of "length-valued" parameter keys and rescales them on toggle; angle/count parameters are excluded by not being in that list. New parameters added to any type must be added to the appropriate list in this function if they represent a length, or they'll silently fail to convert.

---

## 5. Known Limitations / Candidate Extensions

Roughly in order of likely value for future sessions:

1. **Native format export** — generate actual EZNEC `.ez` or NEC-2 `.nec` deck syntax (GW cards with wire radius/segmentation) rather than a generic paste table. Would remove a manual transcription step.
2. **Counterpoise 360° spread bug** — fix the `spread/(n-1)` vs `spread/n` wraparound issue described in 3.4. Small, isolated fix.
3. **Render performance / slider jank** — split `render()` into input-panel-render and output-render as described in Section 4, so dragging a slider doesn't rebuild its own DOM node on every tick.
4. **Saved presets/scenario library** — persist named configurations (e.g., "Site A — pecan tree sloper", "Site B — inverted V") so the pre-planned "go-to geometries" from the original requirement can actually be stored and recalled, not just computed fresh each session. Given this is now a standalone repo/static page rather than a claude.ai artifact, this belongs as `localStorage`-backed presets (and/or exportable/importable JSON scenario files) rather than the artifact persistent-storage API.
5. **Numeric input alongside sliders** — the CSS already has an (currently unused) `input[type="number"]` style; pairing a synced number field with each range slider would allow precise entry (e.g. dialing in an exact compass bearing) instead of drag-only.
6. **Sag modeling for inverted-V legs and counterpoise radials** — currently only the dedicated "Sagging Sloper" tab models catenary droop; the same math could apply to inverted-V legs (which also sag in practice) and elevated counterpoise runs.
7. **Arc-length-uniform waypoint stepping** for the catenary case, if segment uniformity becomes a real accuracy concern for steep/short spans.
8. **Wire diameter / segmentation guidance** — currently coordinates only; could add a recommended NEC segment count per wire based on frequency (segments should be well under 0.1λ at the highest frequency of interest) and a default wire radius field for direct GW-card generation (ties into item 1).
9. **Ground/counterpoise coupling check** — a sanity warning if counterpoise radials and main wire geometry pass too close to each other (risk of unintended coupling not represented in a simple wire-geometry tool).
10. **Multi-band segment-count validation** — warn if a given wire length modeled with only 1-2 segments would be too coarse at the user's intended operating frequency.

---

## 6. File Reference

- [`index.html`](../index.html) — the tool itself, self-contained, opens in any browser or serves directly via GitHub Pages.
- This document — the design record, so rationale (especially the catenary derivation, the "why not collinear" decision on the inverted-V, and the known issues above) doesn't have to be re-derived from reading code alone. Keep it in sync with `index.html` as the tool evolves.
