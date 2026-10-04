# Dams in Section

An interactive, animated explainer of how dams work, drawn as engineering cross-sections. It runs as a single HTML page with no dependencies.

- **Hydroelectric vs tailings dams.** A gravity dam with a live power and water-pressure readout, next to a tailings facility where coarse sand settles on the beach and fines drift to the pond.
- **Upstream, downstream, centreline.** All three raising methods built stage by stage from the same starter dam, with fill volumes, crest drift and an earthquake button.
- **Dam zones.** Zoned earth–rockfill, concrete-face rockfill, concrete gravity and cycloned-sand tailings dams, drawn to scale. Each has a construction replay, an exploded view and notes on every zone.
- **Seepage.** The main seepage paths, an animation of piping erosion, uplift under a gravity dam, and a **seepage lab** backed by a real solver.

## The seepage solver

`src/seepage-solver.js` solves steady 2D saturated–unsaturated seepage, ∇·(K·kr(ψ)·∇h) = 0, on a 1 m finite-volume grid under a 24 m embankment.

- **Nonlinear solve:** Picard iterations, then damped Newton.
- **Linear solves:** direct banded Cholesky / LU, so large permeability contrasts are no problem.
- **Boundaries:** seepage faces and drains are one-way boundaries, handled by an active-set iteration.
- **Flow lines:** traced with Pollock's method.

It has no dependencies and runs both in Node and as a Web Worker.

```sh
node tests/test-seepage.js   # 38 cases + 7 physical sanity checks
```

## Build

The page is assembled from `src/` (styles, markup, three script files and the solver):

```sh
python3 build.py             # writes docs/index.html (standalone page)
```

Open `docs/index.html` in a browser.

All drawings are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values.
