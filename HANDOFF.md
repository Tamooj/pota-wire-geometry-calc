# Handoff: POTA Wire Antenna Geometry Calculator

Context summary for a fresh session. Written 2026-10-18. Read this first, then `README.md` and `docs/DESIGN.md` (the design record, with derivations and rationale).

## What this is

A single-file, vanilla-JS browser tool (`index.html`) that turns field-measurable numbers (support heights, distances, compass bearings, wire slack) into 3D wire coordinates for **NEC-2 antenna modeling software** (EZNEC, MMANA-GAL). It does **not** simulate anything; it is a geometry front-end that feeds those tools.

- Repo: https://github.com/Tamooj/pota-wire-geometry-calc (public, MIT, GitHub Pages enabled at https://tamooj.github.io/pota-wire-geometry-calc/)
- Owner: Tamooj (a ham doing POTA with random-wire antennas on a 9:1 unun)
- Last pushed commit when this was written: `fc126ee`, app version **v1.4.1 · build 2**

## Hard constraints from the user

- **The shipped runtime artifact must stay a single HTML file** (easy to download and run on phone and desktop). Dev/test tooling may be multiple files.
- **No build step, no runtime dependencies.** Node.js is not installed on the user's machine; Python 3 is.
- **Commit and push only when asked.** Don't credit or reference the q-primer project in docs (the user wrote both with Claude; no credit needed).
- The user prefers concise answers and direct, recommended choices over option surveys.
- **Bump `APP_BUILD` (and `APP_VERSION` for milestones) in `index.html` on every edit.** It renders bottom-right as `vX.Y.Z · build N`. This exists because stale cached copies caused repeated phantom-bug confusion. When the user reports odd behavior, first ask what build number they see.

## Repo layout

```
index.html              the whole app (HTML + CSS + JS inline)
README.md               user-facing intro; leads with "this feeds the modeling tools, it is not a simulator"
docs/DESIGN.md          design record: coordinate conventions, catenary derivation, export formats, architecture, roadmap
tests/harness.js        ~70-line hand-rolled suite()/test()/assert framework
tests/unit-geometry.html    unit tests; loads real index.html in an iframe, calls window.WGC functions
tests/system-app.html       system tests; drives the real DOM in an iframe
.claude/launch.json     python -m http.server config for the preview tool
LICENSE                 MIT
HANDOFF.md              this file
```

## Features (current)

Four geometry tabs, each with independent state: **Straight Sloper**, **Inverted-V End-Fed** (legs deliberately not forced collinear), **Sagging Sloper** (catenary solved by bisection, 11 waypoints / 10 wires), **Counterpoise Fan** (N radials over a spread; at spread=360 it divides by n, not n-1).

- Feet/meters toggle converts stored values; slider min/max/step are unit-aware (`lengthFieldSpecs`, `lenRange`, `roundToStep`).
- Side-profile and plan-view SVGs; coordinate table.
- **Three export formats** (toggle in the export panel):
  - **Generic**: tab-separated `label X1 Y1 Z1 X2 Y2 Z2`.
  - **EZNEC**: approximates EZNEC Pro/2+'s "Wires" report text (same header rows, 6-sig-fig variable-precision coordinates, `W{n}E{1|2}` connection strings via `findConnection()`, fixed trailing columns `#10 / 2 segs / 1 0 0 0 1`). Column widths approximate the sample, not byte-exact. Connection strings for 3+-way junctions (counterpoise feed point) are best-effort.
  - **MMANA**: `.maa`-format body. Wire line is `X1,Y1,Z1,X2,Y2,Z2,R,SEG` joined with `,\t`. **X/Y/Z are always meters** regardless of display unit (`toMeters()`). `R` is wire *radius* in meters (`WIRE_RADIUS_IN = 0.0509` is #10 AWG; shared with the EZNEC `#10` label). `SEG` is a segmentation *mode code*, not a count: `-1` = tapering (recommended default), `-2/-3` = partial tapering, `0` = automatic regular, positive = manual count. It must be a bare integer (`-1`, never `-1.0`). Source is `w1b,0.0,1.0` at wire 1's start; Load is `0,1` (none); Segmentation `400,40,2.0,1` and ground/pattern `2,0.0,1,50.0,120,60,0.0` are fixed constants copied from MMANA-GAL's bundled sample files. A **Frequency (MHz)** number input (default 14.0) feeds line 3 of the file.
- Copy button: tries `navigator.clipboard.writeText`, falls back to `document.execCommand('copy')`, shows a red "Select text & Ctrl+C" state if both fail (the Clipboard API needs a secure context, so it fails silently on `file://`).

Format sources: three real `.maa` samples in `C:\MMANA-GALBasic3\ANT\HF simple\Vertical\` (Inverted L, Sloper GP, Folded_GP1), the MMANA-GAL Basic manual PDF (https://www.tcpsas.com/sezioneIV/MMANA-GAL/docs/MmanaGalBasic.pdf, pp. 4-8), and a real EZNEC export `Cat Chain model r1.txt` in the user's Dropbox (`Amateur Radio\Antenna & Xformer Design\`).

## Architecture notes

- `build*(stateSlice)` functions are pure and return `{points, wires, summary}` where summary entries are `[label, rawValue, kind]`. New geometry types must keep this shape.
- `renderInputs()` runs only on tab/unit change/init; `renderOutputs()` runs on every slider input (so a drag never destroys its own slider node).
- `window.WGC = { az2xy, fmt, buildSloper, buildInvV, buildSag, buildCounterpoise, solveCatenaryA, findConnection, eznecNum, mmanaNum }` is exposed purely for tests.
- `eznecNum`/`mmanaNum` snap |v| < 1e-9 to 0 (az2xy's sin/cos leaves values like 1.8e-15).
- A `<textarea>`'s `.value` normalizes `\r\n` to `\n`, so real `.maa` CRLF line endings can't be produced through the export box.

## Testing

35 tests (19 unit + 16 system) at last run, all passing. Tests are plain HTML pages: serve the repo (`python -m http.server 8420`) and open `tests/unit-geometry.html` / `tests/system-app.html`. Results render on the page and in `window.__TEST_SUMMARY__ = {total, passed, failed}`. Both pages set the iframe `src` from JS with a `?_t=Date.now()` cache-buster (a static src served stale copies). Copy-button tests mock the clipboard because real availability is environment-dependent.

## Tooling gotchas learned the hard way

- A dropped closing brace in `index.html` broke every handler silently: the preview console log showed nothing. To find it, fetch the page text, extract the `<script>` body, and `eval` it in a try/catch to get the `SyntaxError`.
- Navigate with a cache-busting query (`?x=` + `Math.random()`); a plain `location.reload()` may reuse a cached copy.
- The preview tool's `preview_click` simulates mouse movement and can drag through range sliders, corrupting their values. Use `eval` with direct `.click()` and `dispatchEvent(new Event('input', {bubbles:true}))` instead.
- `preview_screenshot` sometimes times out; `eval`/`inspect` still work.
- The preview tool reads `.claude/launch.json` from the *session's project root*. In a session rooted at this repo, the committed `.claude/launch.json` works as is (no `--directory` flag needed).
- Python PDF text extraction: `pip install pypdf` (installed for the Python 3.14 on this machine); write output to a file, since console encoding chokes on ligatures.

## Status of open items

- **MMANA import**: the user reported "-1.0 is not a valid format" on import. Root cause was a stale cached build (the `-1.0` bug existed only in an uncommitted intermediate edit). After refreshing, the user said it was "much better." Not formally confirmed against MMANA-GAL beyond that; if it recurs, first check the build number, then ask whether they are pasting rows into MMANA's Geometry table or loading a whole `.maa` file.
- **Counterpoise workflow**: the Counterpoise tab models a ground system meant to attach to another tab's feedpoint (match `zAttach` to that feed height). There is no combined export; the user must merge wire lists by hand in EZNEC/MMANA and keep only one source. A "combine tabs into one export" feature is a natural next step but hasn't been requested.
- **Wire gauge**: fixed at #10 AWG. Computed alternatives: #16 radius 0.0254 in / 0.00064516 m; #22 radius 0.0127 in / 0.00032258 m. The last offer, making gauge a selectable field, was not answered.

## Roadmap ideas (from docs/DESIGN.md §5)

1. Native/verified `.ez` / `.nec` / `.maa` export (verify round-trip against the real apps; derive segmentation from frequency).
2. Saved presets / scenario library (`localStorage` and/or JSON import/export).
3. Numeric entry synced with sliders (the Frequency field is the first real use of the number-input CSS).
4. Sag modeling for inverted-V legs and counterpoise radials.
5. Arc-length-uniform catenary waypoints; wire gauge/segmentation guidance; counterpoise/main-wire coupling warnings.

## Working-style reminders

Make a recommendation rather than listing options. Verify changes in the browser via the preview tool before reporting done. Don't commit or push without being asked. Keep `docs/DESIGN.md` in sync with behavior changes, and keep the tests green.
