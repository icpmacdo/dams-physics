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

`academy/` is a second site built on the same solver: five lessons, four of them readings of the sheets above and one an interactive 3D lesson. The original page is unchanged.

- **Seepage in 3D.** A three.js block model of a 24 m embankment, cut at right angles to the crest. The cut face carries the solved field (materials, total head or pressure head, flow net); the dam turns see-through to show the phreatic surface, and flow particles follow the solved flow lines. Each of the five experiments asks for a prediction, then the change, then the explanation, with live readouts beside the control. The lesson ends with a design brief, a five-question quiz and a downloadable report.
- **Reading lessons** embed one sheet of Dams in Section next to a three-question quiz.
- **Lab:** every design option and the reservoir level, a pinned reference design for comparison, and all 36 combinations solved at once with CSV export.
- **Teach:** a design brief encoded in a link (with a check that some design can meet it), presenter mode and teacher notes in the lesson, and a table of student reports with CSV export. There is no server; reports are files the students download.
- **Glossary** and **model notes**.

three.js is bundled, so the site works offline once served; without WebGL the lessons fall back to the 2D section. Pages pass axe WCAG 2 A/AA checks in light and dark themes.

```sh
node tests/test-academy.js   # lesson structure and the 3D lesson's quantitative claims vs the solver
```

## Build

The page is assembled from `src/` (styles, markup, three script files and the solver):

```sh
python3 build.py             # writes docs/index.html and docs/academy/
```

Open `docs/index.html` in a browser. Serve `docs/` over HTTP for the academy (`python3 -m http.server -d docs`, then `/academy/`). three.js r170 is bundled in `academy/vendor/` (MIT), so the site has no CDN dependency; without WebGL the lessons fall back to the 2D section.

All drawings are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values.
