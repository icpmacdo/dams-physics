"""The running section: one small drawing of an embankment that gains a layer per chapter.

book/SPEC.md F.1 and src/book.json "mini". The geometry lives here, once, as data: each layer is a
list of SVG elements in a 160 × 48 box. The build writes one <symbol id="mini-L<n>"> per layer into
the page's <svg class="defs"> and draws each chapter's miniature as a stack of <use> elements, so
every chapter's version is the same drawing with more of it shown, and the page carries the
geometry once.

Layers are stacked by depth (Z), not by chapter, so a core added in Chapter 9 sits under the
phreatic line drawn in Chapter 3. Colours are CSS variables, so the drawing follows the theme.
It never shows a foundation layer (SPEC G.4): the ground is a single line.
"""

# the section: upstream toe, crest, downstream toe on a ground line at y = 42 (slopes 1.5H:1V,
# about the 34° of a heap at its angle of repose)
GROUND = 42
UT, UC, DC, DT = (30, 42), (66, 18), (78, 18), (114, 42)
HEAP = 'M30,42 L66,18 L78,18 L114,42 Z'
PHREATIC = 'M60,22 C76,24 92,30 108,38'

INK = 'stroke:var(--ink-2);fill:none;stroke-width:0.9'
THIN = 'stroke:var(--ink-2);fill:none;stroke-width:0.6'


def arrow(x, y0, y1, colour):
    """a short vertical arrow from y0 to y1 with a small head"""
    d = 1 if y1 > y0 else -1
    return ('<path d="M%g,%g V%g" style="stroke:%s;stroke-width:0.9;fill:none"/>'
            '<path d="M%g,%g l-1.6,%g h3.2 z" style="fill:%s"/>') % (x, y0, y1 - d * 1.6, colour, x, y1, -d * 2.2, colour)


GRAIN = 'var(--grain)'
WATER = 'var(--water)'

# n: (z, [svg elements])
LAYERS = {
    0: (9, ['<path d="M0,42 H160" style="stroke:var(--ink-2);stroke-width:1"/>']),
    1: (1, ['<path d="%s" style="fill:var(--m-fill);stroke:var(--ink-2);stroke-width:0.9;stroke-linejoin:round"/>' % HEAP]),
    2: (5, ['<path d="M2,22 H60 L30,42 H2 Z" style="fill:var(--water-fill)"/>',
            '<path d="M2,22 H60" style="stroke:var(--water);stroke-width:1"/>',
            '<path d="M9,22 V42 H21 Z" style="fill:none;stroke:var(--water);stroke-width:0.8"/>',
            '<path d="M9,28 h4 M9,34 h8 M9,40 h11.4" style="stroke:var(--water);stroke-width:0.5"/>']),
    3: (7, ['<path d="%s" style="stroke:var(--water);stroke-width:1.1;fill:none;stroke-dasharray:3 2"/>' % PHREATIC,
            '<rect x="87" y="9" width="2.4" height="33" style="fill:var(--paper);stroke:var(--ink-2);stroke-width:0.6"/>',
            '<rect x="87.5" y="28.6" width="1.4" height="13.2" style="fill:var(--water)"/>',
            '<path d="M91.5,26.5 h3 l-1.5,2 z" style="fill:var(--water)"/>']),
    4: (8, [arrow(46, 34.5, 37.4, GRAIN), arrow(46, 41.6, 38.6, GRAIN),
            arrow(98, 32.6, 35.4, GRAIN), arrow(98, 41.6, 38.6, GRAIN)]),
    5: (2, ['<path d="%s L114,42 L30,42 L60,22 Z" style="fill:var(--water-tint)"/>' % PHREATIC]),
    6: (8, ['<path d="M53,18 h4 M53,22 h4 M55,18 v4" style="%s"/>' % THIN,
            '<path d="M70,18 v2.6 h4 v-2.6" style="fill:var(--paper);stroke:var(--ink-2);stroke-width:0.8"/>']),
    7: (6, ['<path d="M134,42 V27 H139 L148,42 Z" style="fill:var(--m-conc);stroke:var(--ink-2);stroke-width:0.8"/>',
            arrow(137, 47.6, 43.2, WATER), arrow(142, 47.6, 43.2, WATER)]),
    8: (3, ['<path d="M68,18 L70.5,13.5 H77.5 L80,18 Z" style="fill:var(--m-fill);stroke:var(--ink-2);stroke-width:0.8;stroke-linejoin:round"/>']),
    9: (3, ['<path d="M69,18 H75 L82,42 H62 Z" style="fill:var(--m-clay);stroke:var(--ink-2);stroke-width:0.5"/>',
            '<path d="M75,18 H77.5 L86,42 H82 Z" style="fill:var(--m-filter);stroke:var(--ink-2);stroke-width:0.5"/>']),
    10: (7, ['<path d="M48,34 C66,34.5 88,37 106,40.4 M40,38.6 C62,39.6 88,40.8 110,41.6" style="stroke:var(--water);stroke-width:0.7;fill:none"/>',
             '<path d="M62,23.4 C61.6,30 61,36 60.6,42 M74,25.4 C73.6,31 73.4,36 73.2,42 M88,29.4 C88,34 88.2,38 88.4,42" style="stroke:var(--ink-2);stroke-width:0.5;fill:none"/>']),
    11: (4, ['<path d="M97,42 V39.4 H110.1 L114,42 Z" style="fill:var(--m-drain);stroke:var(--ink-2);stroke-width:0.5"/>']),
    12: (9, ['<path d="M81,18.4 A31,31 0 0 0 113,41.2" style="stroke:var(--accent);stroke-width:1.1;fill:none;stroke-dasharray:2.2 1.6"/>']),
    13: (4, ['<g style="clip-path:url(#mini-clip)"><path d="%s" style="stroke:var(--ink-2);stroke-width:0.25;fill:none;opacity:0.7"/></g>'
             % ' '.join(['M%d,14 V42' % x for x in range(32, 114, 4)] + ['M28,%d H116' % y for y in range(14, 42, 4)])]),
    14: (8, ['<rect x="95.4" y="27" width="1.8" height="11" style="fill:var(--paper);stroke:var(--ink-2);stroke-width:0.5"/>',
             '<rect x="102.4" y="31" width="1.8" height="9" style="fill:var(--paper);stroke:var(--ink-2);stroke-width:0.5"/>',
             '<circle cx="96.3" cy="38.4" r="0.9" style="fill:var(--water)"/><circle cx="103.3" cy="40.2" r="0.9" style="fill:var(--water)"/>',
             '<path d="M118,42 V35.5 H121 L123,38.5 L125,35.5 H128 V42" style="fill:none;stroke:var(--ink-2);stroke-width:0.8"/>']),
}
TOP = max(LAYERS)


# the dam to come, as a faint dashed outline: drawn only at stage 0 (the Prologue), so the bare ground
# line reads as the start of a drawing rather than a stray rule
GHOST = '<path d="%s" style="fill:none;stroke:var(--ink-3);stroke-width:0.7;stroke-dasharray:2 2;opacity:0.7"/>' % HEAP


def symbols():
    """the <symbol> per layer, plus the clip path the grid needs, for the page's <defs>"""
    out = ['<clipPath id="mini-clip"><path d="%s"/></clipPath>' % HEAP,
           '<symbol id="mini-ghost" viewBox="0 0 160 48">%s</symbol>' % GHOST]
    for n in sorted(LAYERS):
        out.append('<symbol id="mini-L%d" viewBox="0 0 160 48">%s</symbol>' % (n, ''.join(LAYERS[n][1])))
    return '\n    '.join(out)


def svg(n, label=None, cls='mini'):
    """the miniature at stage n (layers 0..n), stacked by depth"""
    n = max(0, min(TOP, int(n)))
    order = sorted(range(n + 1), key=lambda k: (LAYERS[k][0], k))
    uses = ''.join('<use href="#mini-L%d" class="mini-l%d%s"/>' % (k, k, ' mini-new' if (k == n and n > 0) else '') for k in order)
    if n == 0:
        uses = '<use href="#mini-ghost" class="mini-ghost"/>' + uses
    a11y = ('role="img" aria-label="%s"' % label.replace('"', '&quot;')) if label else 'aria-hidden="true" focusable="false"'
    return '<svg class="%s" viewBox="0 0 160 48" %s data-mini="%d">%s</svg>' % (cls, a11y, n, uses)
