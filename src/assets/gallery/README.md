# Gallery images

Drop your image files directly in this folder. Every image here is picked up
automatically (via `import.meta.glob` in `src/App.tsx`) and split, in
alphabetical order, alternating between the left and right column — no code
changes needed.

Supported formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`

Tips:

- Name files with a numeric prefix (`01-piece.jpg`, `02-piece.jpg`, ...) to
  control the order they appear in.
- Images keep their natural aspect ratio (they aren't cropped), so any size
  or orientation works.
- This file (`README.md`) is ignored — it isn't an image.
