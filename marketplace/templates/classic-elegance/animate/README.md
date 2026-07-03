# Animation modules

Each file here is a **self-contained animation**. To use one, include a single
line in `index.html` (just before `</body>`). Swap the filename to test a
different animation — nothing else in the page changes.

```html
<!-- pick ONE per test scenario -->
<script src="animate/fireflies.js"></script>
```

Every module:

- injects its own CSS and DOM (no shared files, no libraries),
- floats over the whole viewport by default, or mounts inside an element via
  `data-target="#hero"`,
- respects `prefers-reduced-motion`,
- removes any previous instance of itself, so hot-swapping stays clean.

## Available modules

| File            | Effect                                          |
|-----------------|-------------------------------------------------|
| `fireflies.js`  | Twinkling golden bokeh rising from below        |
| `petals.js`     | Cherry-blossom petals drifting down             |
| `mist-rays.js`  | Drifting clouds/mist + soft god-rays            |
| `bird.js`       | Bird(s) that flap and glide across the sky      |
| `waterfall.js`  | Cascade shimmer + rising mist at its base       |
| `full-scene.js` | All of the above at once (the "living picture") |

Every module also accepts `data-target` (mount inside a selector; omit for the
whole viewport) and `data-z` (z-index). Effect-specific options:

- **fireflies.js** — `data-count`, `data-color`, `data-area` (`lower` | `full`)
- **petals.js** — `data-count`, `data-color`, `data-wind` (px bias, +right/-left)
- **mist-rays.js** — `data-intensity` (0.3–1.5), `data-rays` (`1` | `0`)
- **bird.js** — `data-count`, `data-color`
- **waterfall.js** — `data-left`, `data-top`, `data-width`, `data-height` (% box)
- **full-scene.js** — `data-target` only (passed through to every effect)

### Example

```html
<script src="animate/fireflies.js"
        data-target=".hero"
        data-count="24"
        data-color="#ffe9a8"
        data-area="lower"
        data-z="2"></script>
```

## Adding a new module

Copy `fireflies.js` and keep the same shape:

1. Read `data-*` options from `document.currentScript`.
2. Inject a `<style>` once, guarded by a unique id.
3. Build/refresh a single layer element (remove the old one first).
4. Guard motion with the `prefers-reduced-motion` check.

That keeps every animation swappable behind one `<script>` line.
