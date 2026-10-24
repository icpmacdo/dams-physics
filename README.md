# Dams in Section

An interactive course on how dams stand and fail, in nine steps, written for someone with no engineering background. It runs as a single HTML page with no dependencies. Everything builds from one idea: soil is strong because its grains press on each other, and water pressure in the gaps pushes them apart (effective stress).

**Groundwork**
1. **The beach.** Dry sand pours, damp sand stands, saturated sand turns to soup.
2. **Pressure grows with depth.** The hydrostatic paradox, and the push on a dam face.
3. **Water moves through ground.** A permeability race, and Darcy's experiment with a clay plug.
4. **Water pressure steals strength.** A block on a water cushion, the stress column, suction, and a **grain sandbox**: a live 2D discrete-element model where force chains, dilation and liquefaction emerge from the physics.

**The dams**
5. **Hydroelectric vs tailings dams.** A gravity dam with live power and pressure readouts, next to a tailings facility.
6. **Upstream, downstream, centreline.** All three raising methods built stage by stage, with an earthquake button.
7. **Dam zones.** Four dam types drawn to scale, with construction replays and notes on every zone.
8. **Seepage.** Seepage paths, a **seepage lab** backed by a real solver, piping, uplift, and three BC case files (Mount Polley, Bennett, Coquitlam).

**Capstone**
9. **Build your own dam.** Paint zones, choose the foundation and slope, and test it: the seepage solver feeds a limit-equilibrium **slope stability solver**. Four missions, including a Mount Polley-style weak layer.

Every step asks you to predict before it shows you. Dotted terms have hover definitions, and a glossary is at the end. In the claude.ai artifact, a **Why did that happen?** button on each figure sends the figure's live state to Claude, which explains it in plain words.

## Films

Seven narrated films, 6 to 9 minutes each, sit at the end of the steps they retell: *Depth, not size* (Step 2), *The same sand, three ways* (Step 4), *Dams that are never finished* (Step 6), *A wall made of dirt* (Step 7), *The sand that boils* and *The layer nobody found* (Step 8), and *Every dam leaks* (Step 9). They are made in the vibes repo (`engine/concepts/dams/`) and live in `docs/video/` with WebVTT captions and poster frames. Nothing downloads until play. A copy of the page without `docs/video/`, such as the claude.ai artifact, hides the film blocks.

```sh
python3 tools/import_videos.py   # re-import after a re-render: Day cuts, captions (+4.1 s title card), posters
```

## The seepage solver

`src/seepage-solver.js` solves steady 2D saturated–unsaturated seepage, ∇·(K·kr(ψ)·∇h) = 0, on a 1 m finite-volume grid under a 24 m embankment.

- **Nonlinear solve:** Picard iterations, then damped Newton.
- **Linear solves:** direct banded Cholesky / LU, so large permeability contrasts are no problem.
- **Boundaries:** seepage faces and drains are one-way boundaries, handled by an active-set iteration.
- **Flow lines:** traced with Pollock's method.

It has no dependencies and runs both in Node and as a Web Worker.

```sh
node tests/test-figures.js     # every number the figures compute, the markup's defaults, the text pins (tests/pins/)
node tests/test-book.js        # the book: keyed numbers (tests/numbers/), references, anchors, films, the Polley guard
node tests/test-seepage.js     # solver cases + 12 physical sanity checks (incl. custom painted dams)
node tests/test-stability.js   # Bishop/Spencer checks against closed-form and benchmark cases
node tests/test-grains.js      # emergent behaviour of the grain sandbox (about 30 s)
node tests/test-setfig.js      # in headless Chrome: "Set the figure" on every control of every figure, the running head, Contents, Expand
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

The page is assembled from `src/` as a book: `src/book.json` lists the front matter, the Prologue, four parts of thirteen chapters, the Epilogue and the back matter, each in its own file under `src/book/`. `build.py` (with `tools/bookbuild.py`) puts them into the shell `src/body.html`, numbers the figures, tables, films, examples, equations and questions, resolves `data-ref` cross-references, writes the contents, the chapter openers and the back matter, and refuses to build on a dangling reference, a duplicate id, a typed figure number or a Mount Polley spoiler before Chapter 13. Parts marked `data-stub` are planned but unwritten and never reach the page. The `styles-*.css` and `app-*.js` files are concatenated in the order listed in `build.py`. `book/SPEC.md` is the authoring spec. `OUT=dir python3 build.py` builds somewhere else; `DRAFT=1` lets references to planned ids build as "?".

```sh
python3 build.py             # writes docs/index.html and docs/academy/ (and build/ for the tests)
```

Open `docs/index.html` in a browser. Serve `docs/` over HTTP for the academy (`python3 -m http.server -d docs`, then `/academy/`). three.js r170 is bundled in `academy/vendor/` (MIT), so the site has no CDN dependency; without WebGL the lessons fall back to the 2D section.

All drawings are simplified. Permeabilities, slopes and zone dimensions are typical textbook values, not design values.
