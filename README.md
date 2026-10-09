# Dams in Section

An interactive course on how dams stand and fail, written as one chapter of 46 short pages for someone with no engineering background. You read it in order, one page at a time, with Next and Back. Each page takes one idea and has at most one drawing, unlocks only the control that page is about, and says in its text what you should see. Everything builds from one idea: soil is strong because its grains press on each other, and water pressure in the gaps pushes them apart (effective stress).

1. **Water pressure.** Three kinds of sand; pressure grows with depth; only the depth matters; pore pressure.
2. **Water moving through ground.** Head; permeability; the permeability race; Darcy's law; a clay plug takes the whole drop.
3. **Water pressure steals strength.** Friction; the block on a water cushion; effective stress; the stress column; suction, dilation and liquefaction in a live **grain sandbox**.
4. **Inside an embankment dam.** The zones, what each one does, and why a filter works.
5. **Seepage.** Five seepage paths; a dam of one soil, drains, a core and a pervious foundation, each calculated by the **seepage solver**; piping; Bennett Dam.
6. **Will the slope slide?** Slip surfaces and the **slope stability solver**; water in the slope; drains; rapid drawdown; Mount Polley.
7. **Concrete dams.** A gravity dam with live power and pressure readouts; uplift.
8. **Tailings dams.** What tailings are; upstream, downstream and centreline raises, with an earthquake button; static liquefaction; Coquitlam Dam.
9. **Design a dam.** The full design lab with four briefs, the full grain sandbox, and what the checks leave out.

Questions end a page and the answer opens the next one. New terms are in bold where they are first explained, and a glossary at the end links back to those pages. In the claude.ai artifact, a **Why did that happen?** button on each figure sends the figure's live state to Claude, which explains it in plain words.

The original single long page (nine steps) is still built, as `docs/classic.html`, because the Dams Academy reading lessons embed its sheets.

## The seepage solver

`src/seepage-solver.js` solves steady 2D saturated–unsaturated seepage, ∇·(K·kr(ψ)·∇h) = 0, on a 1 m finite-volume grid under a 24 m embankment.

- **Nonlinear solve:** Picard iterations, then damped Newton.
- **Linear solves:** direct banded Cholesky / LU, so large permeability contrasts are no problem.
- **Boundaries:** seepage faces and drains are one-way boundaries, handled by an active-set iteration.
- **Flow lines:** traced with Pollock's method.

It has no dependencies and runs both in Node and as a Web Worker.

```sh
node tests/test-seepage.js     # solver cases + 12 physical sanity checks (incl. custom painted dams)
node tests/test-stability.js   # Bishop/Spencer checks against closed-form and benchmark cases
node tests/test-grains.js      # emergent behaviour of the grain sandbox (about 30 s)
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

The page is assembled from `src/`: `chapter.html` pulls in the pages in `src/chapter/` and the figures in `src/figs/` with `<!-- @include … -->`, and the `styles-*.css` and `app-*.js` files are concatenated in the order listed in `build.py`. Each live figure is built once, out of sight; a page asks for it with a `figslot` that names the figure, its starting state and the controls to show (see `src/app-pager.js`). `body.html` assembles the original long page from the same figures. `OUT=dir python3 build.py` builds somewhere else.

```sh
python3 build.py             # writes docs/index.html, docs/classic.html and docs/academy/
node tests/test-chapter.js   # every page, figure slot, link and glossary term in the chapter
```

Open `docs/index.html` in a browser. Serve `docs/` over HTTP for the academy (`python3 -m http.server -d docs`, then `/academy/`). three.js r170 is bundled in `academy/vendor/` (MIT), so the site has no CDN dependency; without WebGL the lessons fall back to the 2D section.

All drawings are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values.
