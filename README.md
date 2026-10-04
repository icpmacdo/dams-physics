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

## Dams Academy

`academy/` is a second site built on the same solver: a teaching app around a **3D interactive seepage lesson**. The original page above is unchanged.

- **Core lesson, Seepage in 3D.** A three.js block model of the dam, cut open across the valley. The cut face carries the solved field (materials, total head or pressure head, flow net), the dam turns see-through to show the 3D phreatic surface, and particles ride the solved flow lines. Ten steps, each run as **predict, then try, then explain**: commit to a prediction, make the one change the step asks for with the control placed inline, watch the readouts change against the step's starting state, then get the explanation and the before/after numbers. The lesson ends with a design challenge, a one-question-at-a-time checkpoint and a completion report.
- **Learn.** Course map with progress, a "continue" card and your stats. Reading lessons embed the matching sheet of the classic page (only that sheet) next to a short check.
- **Lab.** Every control open, pin a design as the reference for live deltas, compare designs, and sweep all 36 combinations with CSV export.
- **Teach.** Assignment builder (the design brief travels in the link, with a check that some design can meet it), presenter mode and teacher notes in every lesson, and a drop zone that turns student reports into a gradebook CSV. No accounts, no server.
- **Glossary** and **model notes** (assumptions, limits, validation).

Works offline once served (three.js is bundled), falls back to the 2D section without WebGL, and passes axe WCAG 2 A/AA checks in light and dark themes.

```sh
node tests/test-academy.js   # lesson structure and every claim in the lesson text vs the solver
```

## Build

The page is assembled from `src/` (styles, markup, three script files and the solver):

```sh
python3 build.py             # writes docs/index.html and docs/academy/
```

Open `docs/index.html` in a browser. Serve `docs/` over HTTP for the academy (`python3 -m http.server -d docs`, then `/academy/`). three.js r170 is bundled in `academy/vendor/` (MIT), so the site has no CDN dependency; without WebGL the lessons fall back to the 2D section.

All drawings are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values.
