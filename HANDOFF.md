# Handoff: POTA Wire Antenna Geometry Calculator

Context summary for a fresh session. Last updated 2026-10-18 (app **v2.2.1 · build 10**). Read this first, then `README.md` and `docs/DESIGN.md` (the design record, with derivations, rationale and roadmap).

## What this is

A single-file, vanilla-JS browser tool (`index.html`) that turns field-measurable numbers (support heights, distances, compass bearings, wire slack) into 3D wire coordinates for **NEC-2 antenna modeling software** (EZNEC, MMANA-GAL). It does **not** simulate anything; it is a geometry front-end that feeds those tools. It started as a mobile field sketching tool and has also become a much nicer way to enter catenary arcs and counterpoise sets into the (Win 3.1-style) modeling tools.

- Repo: https://github.com/Tamooj/pota-wire-geometry-calc (public, MIT, GitHub Pages at https://tamooj.github.io/pota-wire-geometry-calc/)
- Owner: Tamooj (a ham doing POTA with random-wire antennas on a 9:1 unun)

## Working agreements

- **The shipped runtime artifact stays a single HTML file** (no build step, no runtime dependencies; opens from `file://`). Dev/test tooling may be multiple files. Node.js is not installed; Python 3 is.
- **Work locally on `main` only; commit and push each time** (the user said so for this phase).
- **Bump `APP_BUILD` (and `APP_VERSION` for milestones) in `index.html` on every edit.** It renders bottom-right as `vX.Y.Z · build N` and exists because stale cached copies caused repeated phantom-bug confusion. When the user reports odd behavior, first ask what build number they see.
- Don't credit or reference the q-primer project in docs. Concise answers and direct, recommended choices over option surveys.
- Keep `docs/DESIGN.md` in sync with behavior changes and keep the tests green. Verify UI changes in the browser preview before reporting done.

## EZNEC reference

`docs/EZNEC-notes.md` summarizes the relevant rules from the EZNEC Pro+ v7.0 User Manual (import format, where sources may go, transformers, virtual segments). The manual PDF itself is not in the repo; it is free at https://www.eznec.com/ez70manual.html (US letter: http://eznec.com/misc/EZNEC_Printable_Manual/7.0/EZW70_User_Manual.pdf). Key finding: a source on the end segment of a wire where several wires join (e.g. a counterpoise fan at the feed) is not allowed/accurate; the manual's fix is a source on a wire of >=3 segments, away from the end segment (the app's graded feed section).

## Repo layout

```
index.html                  the whole app (HTML + CSS + JS inline)
README.md                   user-facing intro
docs/DESIGN.md              design record: model, catenary derivation, exports, architecture, roadmap
tests/harness.js            ~70-line hand-rolled suite()/test()/assert framework
tests/unit-geometry.html    unit tests; load real index.html in an iframe, call window.WGC
tests/system-app.html       system tests; drive the real DOM in an iframe
.claude/launch.json         python -m http.server 8420 config for the preview tool
HANDOFF.md                  this file
```

## The v2.0 model (replaces the four per-type tabs)

Everything is one screen with a **scene** of elements:

- A **wire** runs along one azimuth through **supports** (`{d, z}`: horizontal distance from the wire's start, and height). Each **span** between neighbouring supports has its own **slack** (extra wire length): 0 = taut, >0 = catenary (11 points / 10 sub-wires, stepped evenly in horizontal x). A vertical span can't sag.
- A wire **attaches** to the origin or to a support of an earlier wire (this expresses bent V's and chained wires). The attached wire's start height is derived from the attach point (read-only in the UI).
- A **fan** (counterpoise) attaches to a support and makes N straight radials across a spread (360° divides by n, not n-1). `len` is the cut length; horizontal reach is derived from the height drop.
- The **feed** is the start of the *source wire*; the solver shifts the whole model so the feed is `(0,0,z_feed)`.
- Old tabs survive as **presets** (Straight Sloper, Sagging Sloper, Inverted-V, Sagging Inverted-V, Inverted-L, Sloper + Counterpoise) that replace the scene.
- Every length/angle has a **number box + slider**. Stored values are exact (typed values aren't snapped); slider ranges are unit-native and widen to a round-number ceiling when a value exceeds 90% of the default max (recomputed only at panel rebuild, never mid-drag). Unit toggle converts exactly.
- **Wire gauge**: `scene.gauge` default + optional `element.gauge` override (AWG, sliders #10–#24, whole sizes); `solveScene` stamps each sub-wire with `gauge`; EZNEC writes `#n`, MMANA writes radius from `awgRadiusM(n)`. Loss/insulation are not importable into EZNEC so not offered. Segments field not exposed yet.
- **Graded segments** (`scene.taper {on,fine,ratio,div}`, `scene.freq`; default ON): the source wire starts with a 3-segment feed section (source at EZNEC `W#C`), the feed-section segment length is AUTOMATIC (1.25 x wavelength/1000, follows `scene.freq`; `taper.fine` null) or set by hand; segment lengths grow by `ratio` to wavelength/div (never exceeding it; EZNEC's conservative limits are wavelength/1000 min and wavelength/20 max, measured from its Segmentation Check, see EZNEC-notes.md), every wire/radial starting at the feed is graded from the same fine length; catenary nodes placed by arc length via `catenaryCurve()`; spans end exactly on supports. Export: feed section = 1 wire with 3 segs, ramp segments = 1-seg wires, equal runs on taut spans = one multi-seg wire. Metrics strip shows Total segments; warning above EZNEC's 2000-segment limit. With grading off the v2.0 behavior and the per-element **segments** control (`segs`: null/'M'/integer) apply. Gauge, grading and frequency persist across preset loads. (An earlier vertical 'feed stub' was replaced by this; avoid the word 'stub', it means a tuning element.)
- **Exports** (Generic / EZNEC / MMANA) read one merged, ordered sub-wire list. MMANA: X/Y/Z always meters; `R` = wire radius m (#10 AWG); `SEG = -1` bare integer; source `w{k}b` on the chosen source wire's first sub-wire; fixed Segmentation/ground lines copied from MMANA-GAL samples; Frequency field feeds line 3. EZNEC: the real **"Import Wires From ASCII File"** format from the EZNEC manual (Other menu): units line `ft in`/`m mm`, then `x1 y1 z1 x2 y2 z2 #10 ; label` per wire, no segments field (EZNEC auto-segments "conservative"), no sources/connections in the format; coincident ends are listed in `; W1E1 = W2E1` comments (`junctionComments()`). Whether EZNEC auto-connects coincident ends on import is UNVERIFIED — the user is testing this. (The v1.x report-replica export was not an import format; `findConnection()` remains but is unused by exports.)
- **Views**: SVG 3D view (orthographic, drag/wheel/Top-Side-Reset; ground drawn as four lines on Z=0, drop lines, N/E labels), side profile (projected onto the first wire's azimuth), plan view; all with round-number scale labels.
- **Warnings**: sag below ground, radial shorter than its height drop, sag solver failure.
- Pure solver `solveScene(scene)` returns `{elements, points, wires, summary, warnings, firstSub, feed}`. `window.WGC` exposes it and helpers for tests. Render pipeline: `renderInputs()` (panel rebuild) vs `renderOutputs()` (every input event; never touches the panel so a drag can't destroy its own slider).

Format sources for the exports: three real `.maa` samples in `C:\MMANA-GALBasic3\ANT\HF simple\Vertical\` (Inverted L, Sloper GP, Folded_GP1), the MMANA-GAL Basic manual PDF (https://www.tcpsas.com/sezioneIV/MMANA-GAL/docs/MmanaGalBasic.pdf, pp. 4-8), and a real EZNEC export `Cat Chain model r1.txt` in the user's Dropbox (`Amateur Radio\Antenna & Xformer Design\`).

## Testing

129 tests (67 unit + 62 system) at last run, all passing. Serve the repo (`python -m http.server 8420`) and open `tests/unit-geometry.html` / `tests/system-app.html`. Results render on the page and in `window.__TEST_SUMMARY__ = {total, passed, failed}`. Both pages set the iframe `src` from JS with a `?_t=Date.now()` cache-buster. Copy-button tests mock the clipboard (real availability is environment-dependent).

## Tooling gotchas learned the hard way

- A dropped closing brace in `index.html` can break every handler silently; to find it, extract the `<script>` body and `eval` it in a try/catch to get the `SyntaxError`.
- Navigate with a cache-busting query (`?x=` + `Math.random()`); a plain reload may reuse a cached copy.
- The preview tool's click simulation can drag through range sliders and corrupt values; use `javascript_exec` with direct `.click()` and `dispatchEvent(new Event('input', {bubbles:true}))` (then `'change'` for number boxes).
- A `<textarea>`'s `.value` normalizes `\r\n` to `\n`, so real `.maa` CRLF can't be produced through the export box.
- The preview tool reads `.claude/launch.json` from the session's project root; the committed one works as is.

## Roadmap (details in docs/DESIGN.md §5)

1. **Dipoles** (feed somewhere along a wire at a segment end) — the model is already shaped for it; needs source placement UI and verified MMANA wire-end syntax. User: "not today".
2. **Sloped / offset ground plane** — user asked this be logged for a future revision; ground is currently flat Z=0.
3. Native file download (`.maa`, maybe `.ez`) verified against the real apps; segmentation from frequency.
4. Saved scenarios (`localStorage` / JSON).
5. Arc-length-uniform catenary points; free "tail" ends; wire gauge selector (#16 radius 0.0254 in, #22 0.0127 in); coupling warnings.

## Open items / things not verified

- v2.0 exports have been checked by tests and by eye, not yet round-tripped through the real EZNEC/MMANA apps. If the user reports an MMANA import problem, first check the build number, then ask whether they paste rows into the Geometry table or load a whole `.maa`. (An earlier "-1.0 is not a valid format" report was a stale cached build.)
- In v1 the Inverted-V put the apex at the origin; in v2 the feed is always the origin, so inverted-V coordinates differ by a translation.
- Mobile layout: checked at 375px (no horizontal overflow; panel stacks above the views). Touch-drag on the 3D view is implemented via pointer events but not tested on a real phone.
