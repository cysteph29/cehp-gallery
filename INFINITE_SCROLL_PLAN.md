# Seamless Infinite Gallery Scroll Plan

## Summary

Use a three-band virtual loop inside `Bend`:

- Keep the existing 14 DOM tiles as the sole canonical set.
- Only after the gate reaches `live`, add two layout-only bands using CSS pseudo-elements.
- Render the same 14 WebGL textures at offsets `-cycleHeight`, `0`, and `+cycleHeight`.
- Start in the middle band and synchronously shift `scrollTop` by exactly one cycle whenever it enters an outer band.

This avoids duplicated textures, duplicated accessible content, late tile-loading work, and unreliable mutation discovery.

### Opening-sequence guarantee

The heading effect, 750ms timer, gate checks, 14-tile entrance, 35ms stagger, 1455ms entrance duration, and scroll-lock release remain unchanged. Loop activation is a trailing live-only operation after the existing transition to `live`; no loop layout or rendering exists during `loading` or `entrance`.

## Ordered implementation plan

### 1. Add a dormant loop option

File: `src/App.tsx`

- Pass a new `loop` option to `Bend`.
- Do not alter the heading effect, `tileEntranceReady`, gallery markup, image count, or existing Bend options.
- The first render still contains exactly the existing 14 `[data-bend-tile]` elements. No duplicate images or extra scroll range exist yet.

### 2. Add live-only loop state

File: `src/components/canvasui/Bend.tsx`

- Extend `BendOptions` with `loop`.
- Track cycle height, loop activation, programmatic-wrap guards, and cumulative user movement separately from native `scrollTop`.
- Keep all current gate and entrance calculations operating exclusively on the existing `tiles` array.

### 3. Activate only after the existing release

File: `src/components/canvasui/Bend.tsx`

- At the end of `revealSettled()`, after the existing state change, unlock, `syncScroll()`, and `start()`, call a new idempotent `enableLoop()`.
- `enableLoop()` measures the existing `.gallery-page`, enables the two layout bands, explicitly calls `refreshTiles()`, and moves the viewport to the equivalent position in the middle band.
- The move happens in the same task as activation, before user input or painting can expose a physical boundary.
- Re-measuring the 14 tiles does not re-upload textures because their raster dimensions have not changed.

### 4. Create scroll extent without duplicating content

File: `src/App.css`

- Add live-only `::before` and `::after` generated blocks on `.canvasui-scroll-content`, each exactly one measured cycle high.
- Activate them through a Bend-owned data attribute and CSS custom property.
- Add `overflow-anchor: none` while looping so browser scroll anchoring cannot counteract explicit recentering.
- No repeated gallery elements enter the DOM. The pseudo-elements provide geometry only; visual repetition happens in WebGL.

### 5. Render three virtual copies

File: `src/components/canvasui/Bend.tsx`

- Leave the current entrance rendering loop unchanged.
- In `live` state only, render each canonical tile at the preceding, central, and following cycle offsets.
- Reuse the same `WebGLTexture`; texture count remains 14.
- Apply the existing culling test independently to each offset, so normally only nearby copies issue draw calls.

### 6. Wrap native scrolling before physical edges

File: `src/components/canvasui/Bend.tsx`

- At the start of `onScroll()`, normalize `scrollTop` into the central safe band by adding or subtracting exact multiples of `cycleHeight`.
- Use direct `scrollTop` assignment, not smooth scrolling.
- Guard the synthetic scroll event and handle deltas larger than one cycle.
- Run `syncScroll()` and rendering only after normalization, ensuring the shader and culling observe the corrected position in the same frame.

### 7. Preserve fold continuity

File: `src/components/canvasui/Bend.tsx`

- Initial loop activation must preserve the existing `topCurrent`, `bottomCurrent`, and targets, so the top fold does not suddenly appear when moving from physical `0` to the middle band.
- Track actual user travel independently of programmatic cycle jumps. Let the top fold ramp over the existing `ease={240}` distance, then latch both edge folds fully on.
- Once latched, wraps do not change fold targets. Smoothing therefore has no discontinuity at a handoff.
- Tilt remains viewport-based and unchanged.
- Tumble naturally stops occurring because wrapping happens well before native boundaries.

### 8. Handle resize and orientation changes

File: `src/components/canvasui/Bend.tsx`

- Once looping, observe the actual `.gallery-page` box in addition to the fixed-size content and canvas.
- Before remeasurement, retain a visible tile/source anchor and its viewport offset.
- Recompute cycle height, refresh tile rects/textures, then reposition the equivalent anchor in the middle band.
- If the viewport is in a spacer rather than over a tile, preserve normalized cycle phase as fallback.
- Update pseudo-band heights before rendering.
- Keep resize texture work at 14 uploads—the same cost as today—not 42.

### 9. Preserve reduced-motion and accessibility behavior

Files: `src/App.tsx`, `src/components/canvasui/Bend.tsx`

- Reduced motion continues to skip App's typewriter/delay and Bend's entrance exactly as it currently does; loop activation follows the resulting immediate `live` transition.
- Wrapping is an instantaneous equivalence correction, not an animation.
- Screen readers continue to see one Gallery section and 14 images. There are no duplicate labels, alt text, focus targets, or reading-order repetitions.
- The canvas remains `aria-hidden`.

### 10. Verify before accepting

- Record the complete normal opening and compare timing frame-by-frame against baseline.
- Confirm the entrance still contains 14 tiles and completes in `1000 + 13×35 = 1455ms`.
- Test repeated upward/downward wheel, touch, scrollbar drag, keyboard scrolling, and high-delta trackpad input.
- Use slow-motion recording around wraps to check for jumps, blank frames, one-pixel seams, fold changes, and tilt discontinuity.
- Profile loop activation and verify no new raster canvases or WebGL textures are allocated.
- Test desktop, `≤850px`, `≤520px`, orientation changes, DPR 1/2, reduced motion, and WebGL context restoration.

## Verified in code

These findings are based on the two earlier Bend investigations and were rechecked against the current files:

- The heading types at 15ms per character and schedules entrance readiness 750ms later: `src/App.tsx:25-29`, `src/App.tsx:66-145`.
- Initial gallery markup contains exactly 14 tiles: `src/App.tsx:20-23`, `src/App.tsx:183-206`.
- Bend's entrance constants are 96px, 1000ms, and 35ms: `src/components/canvasui/Bend.tsx:208-213`.
- Entrance completion depends on `tiles.length`, currently producing 1455ms for 14 tiles: `src/components/canvasui/Bend.tsx:561-579`, `src/components/canvasui/Bend.tsx:612-617`.
- Scroll is unlocked only in `revealSettled()`: `src/components/canvasui/Bend.tsx:339-359`.
- Bend uses native `scrollTop`; wheel handling only adds tumble at true boundaries: `src/components/canvasui/Bend.tsx:641-658`.
- Tile positions and shader sampling use immediate native `scrollTop`, while smoothing affects fold amounts only: `src/components/canvasui/Bend.tsx:542-543`, `src/components/canvasui/Bend.tsx:587-611`.
- Rendering already culls by absolute content-space tile coordinates: `src/components/canvasui/Bend.tsx:559-579`.
- Tile textures are currently owned per DOM element, so naively rendering 42 tile nodes would allocate 42 textures: `src/components/canvasui/Bend.tsx:403-442`, `src/components/canvasui/Bend.tsx:469-505`.
- No `MutationObserver` exists. The fixed-height observed scroller is not guaranteed to resize when only its `scrollHeight` changes: `src/components/canvasui/Bend.tsx:713-720`.
- Reduced motion still uses WebGL and native scrolling, but skips entrance, smoothing, tilt, and tumble: `src/components/canvasui/Bend.tsx:362-366`, `src/components/canvasui/Bend.tsx:589-606`, `src/components/canvasui/Bend.tsx:646-681`.
- The canonical start/end spacers are part of `.gallery-page`, so the repeated cycle preserves the current breathing space and title reveal: `src/App.css:67-92`.

## Not fully confident about

- CSS generated blocks should contribute to internal `scrollHeight`, but this needs confirmation in current Safari/iOS Safari as well as Chromium.
- High-momentum touch scrolling may react differently to synchronous `scrollTop` corrections. This needs real-device testing.
- Fractional cycle heights could expose a one-pixel seam. Measurements and offsets must use the same CSS-pixel value without independent rounding.
- Resize anchoring while the viewport lies entirely within the long spacer needs visual testing across the 520px breakpoint.
- Virtual repetition requires WebGL. If infinite looping must also work in the existing WebGL-failure DOM fallback, that needs a separate DOM-loop design and explicit product approval.
- Keeping both folds permanently active after the initial 240px travel is the least discontinuous loop behavior, but it is still a visual policy that should be reviewed.

## Considered and rejected

- **Rendering 42 tiles initially:** Changes gate count, entrance stagger/duration, first-render cost, and texture readiness.
- **Appending cloned `[data-bend-tile]` nodes after `live`:** Needs explicit discovery, adds layout/image work, and naively triples GPU texture memory to roughly 100–140MiB on desktop.
- **Relying on the existing `ResizeObserver` or cached image `load` events:** Neither reliably discovers added children under this fixed-height scroller.
- **Using two physical copies:** Provides insufficient buffer for robust bidirectional wrapping and large momentum deltas.
- **Wrapping at native `0` or `max`:** Exposes clamping, fold-target changes, and tumble before correction.
- **Intercepting wheel/touch and maintaining a fully virtual offset:** Replaces native scrolling and materially increases accessibility and input complexity.
- **Recycling rows while scrolling:** Creates continuous DOM/layout churn and substantially complicates texture ownership and resize behavior.
