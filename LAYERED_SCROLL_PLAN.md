## Implementation plan

### 1. Add transparent rendering to `Bend.tsx`

In `src/components/canvasui/Bend.tsx`:

1. Add `transparent?: boolean` to `BendOptions`.
2. Set `transparent: false` in `DEFAULTS` so existing behavior remains unchanged.
3. Add a `uTransparent` shader uniform.
4. Preserve the current opaque shader output when `transparent` is false.
5. When `transparent` is true:
   - Output the sampled content RGB.
   - Set output alpha to `base.a * alpha * uCover`.
   - Leave pixels outside gallery content fully transparent.
6. Set `uTransparent` during each render from `config.transparent`.

Do not remove or alter the bend, tilt, smoothing, or tumble calculations.

### 2. Separate the two layers in `App.tsx`

Replace the current nested structure with this hierarchy:

```tsx
<main className="stage">
  <header className="title-layer">
    <h1>...</h1>
  </header>

  <Bend className="bend-shell" transparent {...existingBendOptions}>
    <div className="gallery-page">
      <div className="gallery-start-spacer" aria-hidden="true" />
      <section className="gallery-columns">...</section>
      <div className="gallery-end-spacer" aria-hidden="true" />
    </div>
  </Bend>
</main>
```

Requirements:

- The heading must not be a descendant of `Bend`.
- Keep all existing images, ordering, alt text, and two-column splitting unchanged.
- Keep the existing Bend settings, including `tilt={0.5}` and `tumble={0.5}`.
- The Bend component’s internal element remains the only scrolling container. Do not introduce document/body scrolling.

### 3. Measure the heading’s actual lower edge

The first gallery row must begin below the heading at every viewport size, including after font loading.

In `App.tsx`:

1. Add refs to `.stage` and the `<h1>`.
2. Add a `useLayoutEffect`.
3. Measure:

```ts
headingBottom =
  heading.getBoundingClientRect().bottom -
  stage.getBoundingClientRect().top
```

4. Write that value to the stage as:

```ts
stage.style.setProperty('--heading-bottom', `${Math.ceil(headingBottom)}px`)
```

5. Recalculate when:
   - The stage resizes.
   - The heading resizes.
   - `document.fonts.ready` resolves.
6. Use one `ResizeObserver` observing both elements and disconnect it during cleanup.

This removes responsive-positioning guesswork.

### 4. Define the stationary title layer

In `src/App.css`:

- Keep `.stage` at `height: 100svh` and `overflow: hidden`.
- Give it these defaults:

```css
--heading-bottom: 70svh;
--title-gallery-gap: 3rem;
```

- Configure `.title-layer` as:
  - `position: absolute`
  - `inset-block: 0`
  - Horizontally centered
  - `width: min(100%, 1680px)`
  - `z-index: 0`
  - Flex-centered vertically and horizontally
  - `padding: 2rem`
  - `background: #371722`
  - `pointer-events: none`

Although it uses `position: absolute`, it behaves as a fixed viewport layer because `.stage` never scrolls; only Bend’s internal content scrolls.

Move the existing `.hero h1` typography rules to `.title-layer h1`. Remove `.hero` styling.

### 5. Configure the transparent foreground layer

Set `.bend-shell` to:

- `z-index: 1`
- Existing viewport dimensions and `1680px` maximum width
- `background: transparent`

Set all foreground layout wrappers to transparent:

- `.gallery-page`
- `.gallery-columns`
- `.gallery-column`

Do not assign a background to any of those elements. Only `.gallery-image` should retain its opaque `#cbc7ba` background. Consequently, image rectangles cover the heading while gaps between them reveal it.

### 6. Position the gallery on initial load

Use:

```css
.gallery-start-spacer {
  height: calc(var(--heading-bottom) + var(--title-gallery-gap));
  pointer-events: none;
}
```

Remove the top and bottom padding from `.gallery-columns`; retain only horizontal padding:

```css
.gallery-columns {
  padding: 0 2rem;
}
```

This makes the first image begin exactly one configured gap below the measured heading while remaining visible near the bottom of the opening viewport.

At `max-width: 850px`:

- Set `--title-gallery-gap: 2rem`.
- Use `1rem` horizontal gallery padding.
- Retain the existing reduced column gaps.

At `max-width: 520px`:

- Retain the single-column layout.
- Set the title font size to `clamp(2.25rem, 11vw, 3rem)` so the title and the beginning of the gallery can coexist on short mobile viewports.

### 7. Add the final reveal distance

Use:

```css
.gallery-end-spacer {
  height: 80svh;
  pointer-events: none;
}
```

Do not place bottom padding between the gallery and this spacer.

At maximum scroll, this geometry leaves the bottom of the taller column at approximately `20svh`. The final images remain partly visible at the top, while the centered title is exposed again below them.

### 8. Verification

Run `npm run lint` and `npm run build`, then verify at approximately:

- 1440×900
- 768×1024
- 390×844

Acceptance criteria:

- The first image starts below the title plus the configured gap.
- Some of the first image is visible on initial load.
- The title’s viewport coordinates do not change while scrolling.
- The title remains flat while the columns retain bend, tilt, and tumble.
- Images cover the title; transparent gaps reveal it.
- At maximum scroll, the final images occupy only roughly the top 20% of the viewport.
- No opaque Bend canvas hides the title.
- Mobile remains single-column with no initial title/image collision.
