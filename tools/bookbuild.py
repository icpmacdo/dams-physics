"""Assemble the book from src/book.json and src/book/*.html (book/SPEC.md sections A, B, D, F).

build.py calls assemble(root, draft) and gets back the page markup, the data block the scripts
read (#book-data) and the lists of errors and warnings. Nothing here changes a solver, a figure's
code or an element id that the source gives.

What it does, in order (SPEC A.2):
 1. reads and checks src/book.json;
 2. reads each unit file, expands <!-- @include name.html --> lines, drops every element marked
    data-stub (planned but unwritten parts: the page never shows a stub), and checks the root;
 3. inserts the alias anchors that keep the old #anchors working;
 4. assembles front matter, Prologue, part openers and chapters, Epilogue and back matter into
    src/body.html at <!-- @book -->;
 5. moves the answers of end-of-chapter questions to the back;
 6. numbers figures, tables, films, worked examples, equations, questions and sections;
 7. fills the chapter openers, next cards, contents, case-file index, bibliography and errata;
 8. resolves data-ref and data-cite references;
 9. writes film segment times, lengths and transcripts;
10. runs the global checks (duplicate ids, typed numbers, glossary terms, data-n, the Polley guard).
"""
import html as _html
import json
import math
import pathlib
import re

import bookmini
import htmltree as H

KINDS = ('front', 'prologue', 'chapter', 'epilogue', 'back')
NUMBER_WORD = {'fig': 'Fig.', 'table': 'Table', 'ex': 'Example', 'eq': 'Eq.', 'film': 'Film', 'q': 'Question', 'sec': '§'}
PLURAL = {'fig': 'Figs.', 'table': 'Tables', 'ex': 'Examples', 'eq': 'Eqs.', 'film': 'Films', 'q': 'Questions', 'sec': '§§',
          'chapter': 'Chapters', 'part': 'Parts'}
TYPED = re.compile(r'(?:\b(?:Fig\.|Figs\.|Figures?|Example|Eq\.|Equation|Film|Table|Question|Chapter|Step)|§) ?\d')
STEP = re.compile(r'\bSteps? \d')
POLLEY_WORDS = re.compile(r'\b(layer|layers|clay|foundation|undrained|glacial|lacustrine|glaciolacustrine|GLU|seam|slid|slide|sliding|borehole)\b', re.I)
POLLEY_NEVER = re.compile(r'glaciolacustrine|glacial[- ]lake clay|\bGLU\b')
GUARD_BLOCKS = {'p', 'li', 'tr', 'dd', 'dt', 'figcaption', 'h2', 'h3', 'h4', 'blockquote', 'summary'}
STUB_WORDS = re.compile(r'\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX\b|lorem ipsum|\[placeholder\]', re.I)
BIB_GROUPS = [('books', 'Books'), ('papers', 'Papers'), ('reports', 'Reports and investigations'),
              ('standards', 'Standards and guidelines'), ('bc-law', 'British Columbia law and regulators'), ('web', 'On the web')]


def words(s):
    return len(re.findall(r"[0-9A-Za-zÀ-ÿ’'-]+", s))


def fmt_len(sec):
    sec = int(math.floor(sec + 0.5))  # half up, as the tests and the scripts round
    m, s = divmod(sec, 60)
    return ('%d min %d s' % (m, s) if s else '%d min' % m) if m else '%d s' % s


def clock(t):
    """a film time as the player shows it: 191.6 → "3:11" """
    m, sec = divmod(int(t), 60)
    return '%d:%02d' % (m, sec)


def parse_vtt(text):
    cues = []
    for block in re.split(r'\n\s*\n', text):
        m = re.search(r'(\d+):(\d\d):(\d\d\.\d+)\s*-->\s*(\d+):(\d\d):(\d\d\.\d+)', block)
        if not m:
            continue
        t0 = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
        t1 = int(m.group(4)) * 3600 + int(m.group(5)) * 60 + float(m.group(6))
        text = ' '.join(l.strip() for l in block[m.end():].strip().split('\n') if l.strip())
        cues.append((t0, t1, _html.unescape(re.sub(r'<[^>]+>', '', text))))
    return cues


NOTE_BITS = ('sidenote', 'marginnote', 'sn-ref', 'mn-ref', 'margin-toggle')


def starts_sentence(e):
    """True when a generated reference opens a sentence: it is the first words of its block, or the
    prose before it (notes skipped) ends a sentence."""
    node = e
    while node.parent is not None:
        sibs = node.parent.children
        before = ''.join(c.text for c in sibs[:sibs.index(node)]
                         if isinstance(c, H.Text) or (isinstance(c, H.El) and not (c.tag in ('input', 'label') or any(c.hascls(k) for k in NOTE_BITS))))
        if before.strip():
            return bool(re.search(r'[.!?][\u2019\u201d"\')\]]*\s+$', before))
        if node.parent.tag in H.BLOCK:
            return True
        node = node.parent
    return True


def join_and(items):
    items = list(items)
    if len(items) < 2:
        return ''.join(items)
    return ', '.join(items[:-1]) + ' and ' + items[-1]


def frag(markup):
    """parse a fragment and return its top-level nodes"""
    return list(H.parse(markup).children)


class Book:
    def __init__(self, root, draft=False):
        self.root = pathlib.Path(root)
        self.src = self.root / 'src'
        self.draft = draft
        self.errors, self.warnings = [], []
        self._cues = {}

    # ------------------------------------------------------------------ messages
    def error(self, msg, draftable=False):
        (self.warnings if (draftable and self.draft) else self.errors).append(msg)

    def warn(self, msg):
        self.warnings.append(msg)

    # ------------------------------------------------------------------ 1. the manifest
    def load_manifest(self):
        p = self.src / 'book.json'
        try:
            B = json.loads(p.read_text())
        except Exception as e:  # noqa: BLE001
            self.error('src/book.json does not parse: %s' % e)
            return False
        self.B = B
        for k in ('title', 'subtitle', 'edition', 'unitWord', 'spine', 'front', 'prologue', 'parts', 'epilogue', 'back', 'films'):
            if k not in B:
                self.error('src/book.json: missing field "%s"' % k)
        units = []
        for u in B.get('front', []):
            units.append(dict(u, kind='front'))
        units.append(dict(B['prologue'], kind='prologue'))
        n_expected = 1
        for pi, part in enumerate(B.get('parts', [])):
            for k in ('id', 'numeral', 'title', 'prospect', 'chapters'):
                if k not in part:
                    self.error('src/book.json: part %d has no "%s"' % (pi + 1, k))
            for ch in part['chapters']:
                u = dict(ch, kind='chapter', part=part)
                if u.get('n') != n_expected:
                    self.error('src/book.json: chapter %s is out of order (expected %d)' % (u.get('id'), n_expected))
                if u.get('label') != str(n_expected):
                    self.error('src/book.json: chapter %s label must be "%d"' % (u.get('id'), n_expected))
                if u.get('key') != 'ch%02d' % n_expected:
                    self.error('src/book.json: chapter %s key must be "ch%02d"' % (u.get('id'), n_expected))
                for k in ('id', 'slug', 'title', 'file', 'question', 'hook', 'films', 'aliases'):
                    if k not in u:
                        self.error('src/book.json: chapter %s has no "%s"' % (u.get('id'), k))
                n_expected += 1
                units.append(u)
        units.append(dict(B['epilogue'], kind='epilogue'))
        for u in B.get('back', []):
            units.append(dict(u, kind='back'))
        seen = {}
        for u in units:
            if u.get('id') in seen:
                self.error('src/book.json: unit id "%s" is used twice' % u.get('id'))
            seen[u.get('id')] = u
            f = self.root / u.get('file', '')
            if not u.get('file') or not f.is_file():
                self.error('src/book.json: unit %s: file %s does not exist' % (u.get('id'), u.get('file')))
        aliases = [a['id'] for u in units for a in u.get('aliases', [])]
        for a in set(aliases):
            if aliases.count(a) > 1:
                self.error('src/book.json: alias "%s" is given twice' % a)
        # films: every segment names a film in the catalogue and sits inside it
        self.segments = {}
        for u in units:
            for s in u.get('films', []):
                F = B['films'].get(s.get('film'))
                if not F:
                    self.error('src/book.json: %s: unknown film "%s"' % (s.get('id'), s.get('film')))
                    continue
                end = s.get('end') if s.get('end') is not None else F['duration']
                if not (0 <= s.get('start', -1) < end <= F['duration']):
                    self.error('src/book.json: film segment %s (%s–%s s) is not inside %s (%.2f s)' % (s.get('id'), s.get('start'), s.get('end'), s.get('film'), F['duration']))
                if s['id'] in self.segments:
                    self.error('src/book.json: film block id %s is used twice' % s['id'])
                self.segments[s['id']] = dict(s, unit=u, end=end, info=F)
        self.units = units
        self.unit_by_id = {u['id']: u for u in units}
        self.new_ids = {i for u in units for i in u.get('newIds', [])}
        return True

    # ------------------------------------------------------------------ 2. unit files
    def expand(self, text, where, depth=0):
        def sub(m):
            f = self.src / m.group(1)
            if not f.is_file():
                self.error('%s: <!-- @include %s --> names a file that does not exist' % (where, m.group(1)))
                return ''
            return f.read_text()
        for _ in range(4):
            text2 = re.sub(r'<!-- @include ([\w.-]+) -->', sub, text)
            if text2 == text:
                break
            text = text2
        return text

    def load_unit(self, u):
        rel = u['file']
        raw = (self.root / rel).read_text()
        for m in STEP.finditer(raw):
            self.error('%s: "%s" — the book has chapters, not steps; write a data-ref' % (rel, m.group(0)))
        text = self.expand(raw, rel)
        doc = H.parse(text)
        roots = [n for n in doc.children if isinstance(n, H.El)]
        stray = ''.join(n.text for n in doc.children if isinstance(n, H.Text)).strip()
        if len(roots) != 1 or stray:
            self.error('%s: the file must hold exactly one <section> and nothing else' % rel)
        sec = roots[0] if roots else None
        if sec is None or sec.tag != 'section' or u['kind'] not in sec.classes or sec.id != u['id']:
            self.error('%s: the first element must be <section class="%s" id="%s">' % (rel, u['kind'], u['id']))
            return None
        self.check_typed(sec, rel)
        if sec.has('data-stub'):
            return None
        for e in sec.find_all(lambda e: e.has('data-stub')):
            if e.parent is not None:
                e.remove()
        return sec

    def check_typed(self, sec, rel):
        """SPEC D.5: no typed figure, chapter or step numbers in prose, captions or labels"""
        def walk(n, inref):
            for c in n.children:
                if isinstance(c, H.Text):
                    if not inref:
                        for m in TYPED.finditer(c.text):
                            self.error('%s: typed number "%s" in "%s…"; use <a data-ref="…">' % (rel, m.group(0), c.text.strip()[:60]))
                elif isinstance(c, H.El):
                    for a in ('aria-label', 'title', 'alt'):
                        v = c.get(a)
                        if v and TYPED.search(v):
                            self.error('%s: typed number in %s="%s"' % (rel, a, v[:60]))
                    # a Source note names the source's own tables and figures ("Foster et al., Table 3"),
                    # and so does a <cite>: those numbers belong to the source, not to this book
                    walk(c, inref or c.has('data-ref') or c.tag in ('code', 'cite')
                         or (c.hascls('marginnote') and c.get('data-kind') == 'source'))
        walk(sec, False)

    # ------------------------------------------------------------------ the whole thing
    def run(self):
        if not self.load_manifest():
            return None
        B = self.B
        shell = H.parse((self.src / 'body.html').read_text())
        mark = None
        stack = [shell]
        while stack:
            n = stack.pop()
            for c in n.children:
                if isinstance(c, H.Raw) and c.raw.strip() == '<!-- @book -->':
                    mark = c
                elif isinstance(c, H.El):
                    stack.append(c)
        if mark is None:
            self.error('src/body.html has no <!-- @book --> line')
            return None

        # 2–4: load, stub, alias, assemble
        self.present = []
        nodes = []
        first_of_part = {p['chapters'][0]['id']: p for p in B['parts']}
        for u in self.units:
            sec = self.load_unit(u)
            if u['kind'] == 'chapter' and u['id'] in first_of_part:
                nodes += [self.part_opener(first_of_part[u['id']]), H.Text('\n\n')]
            if sec is None:
                if u['kind'] == 'chapter':
                    self.error('%s: a chapter cannot be a stub' % u['file'])
                continue
            u['el'] = sec
            self.present.append(u)
            for a in reversed(u.get('aliases', [])):
                anchor = H.el('a', {'class': 'alias', 'id': a['id'], 'aria-hidden': 'true', 'tabindex': '-1'})
                if a.get('before'):
                    t = sec.find(lambda e: e.id == a['before'])
                    if t is None:
                        self.error('src/book.json: alias %s: no element #%s in %s' % (a['id'], a['before'], u['file']))
                        continue
                    t.before(anchor)
                else:
                    sec.insert(0, anchor)
            label = u.get('label')
            if label:
                sec.set('data-label', label)
            nodes += [sec, H.Text('\n\n')]
        i = mark.parent.children.index(mark)
        parent = mark.parent
        mark.remove()
        parent.insert(i, *nodes)
        self.doc = shell
        defs = shell.find(lambda e: e.tag == 'defs' and e.parent is not None and e.parent.hascls('defs'))
        if defs is None:
            self.error('src/body.html: no <svg class="defs"><defs> for the running-section symbols')
        else:
            defs.append(*frag('\n    ' + bookmini.symbols() + '\n  '))

        # 5. answers (moved before numbering so empty back units can drop out)
        self.collect_answers()
        self.load_glossary()
        self.load_bib()
        self.load_errata()
        self.drop_empty_back()

        # 6. numbering
        self.refs = {}
        self.number()

        # 7. generated parts
        self.fill_openers()
        self.fill_next()
        self.fill_toc()
        self.fill_answers()
        self.fill_cases()
        self.fill_bib()
        self.fill_errata()

        # 8. references
        self.resolve_refs()
        self.resolve_cites()

        # 9. films
        self.films()

        # 10. checks
        self.checks()

        data = {
            'refs': self.refs,
            'units': [self.unit_data(u) for u in self.present],
            'glossaryExtra': self.glossary_extra,
            'films': {k: {'film': s['film'], 'start': s['start'], 'end': s['end'], 'part': s.get('part'), 'unit': s['unit']['id'],
                          'title': s['info']['title'], 'safeTitle': s['info'].get('safeTitle'), 'duration': s['info']['duration'],
                          'question': s.get('question'), 'tail': self.film_tail(s)} for k, s in self.segments.items()},
        }
        return self.doc.html(), data

    def unit_data(self, u):
        d = {'id': u['id'], 'kind': u['kind'], 'title': u.get('title'), 'label': self.unit_label(u)}
        for k in ('n', 'question', 'hook'):
            if u.get(k) is not None:
                d[k] = u[k]
        if u['kind'] == 'chapter':
            d['part'] = u['part']['id']
        return d

    def unit_label(self, u):
        k = u['kind']
        if k == 'chapter':
            return '%s %s' % (self.B['unitWord'], u['label'])
        if k == 'prologue':
            return 'the Prologue'
        if k == 'epilogue':
            return 'the Epilogue'
        if u.get('refLabel'):
            return u['refLabel']
        if u.get('label'):
            return 'Appendix %s' % u['label']
        return ('the %s' % u['title']) if k == 'back' else u['title']

    # ------------------------------------------------------------------ part openers
    def mini(self, n, label=None, cls='mini'):
        return bookmini.svg(n, label, cls)

    def mini_adds(self, n):
        for m in self.B.get('mini', []):
            if m.get('n') == n:
                return m.get('adds', '')
        return ''

    def part_opener(self, p):
        # the bare numeral, as in the Contents; the word is there for a screen reader
        lis = ''.join('<li class="toc-ch"><a href="#%s"><span><i class="sr">%s </i>%s</span><strong>%s</strong></a><p>%s</p></li>' % (
            c['id'], self.B['unitWord'], c['label'], H.esc(c['title']), H.esc(c['hook'])) for c in p['chapters'])
        m = ('<section class="part-opener" id="%s" data-label="%s">\n'
             '  <div class="wide part-head"><p class="part-num" aria-hidden="true">%s</p><div class="chapter-head"><span class="sheetno">Part %s</span><h2>%s</h2></div>%s</div>\n'
             '  <div class="col"><p class="prospect">%s</p><ol class="course">%s</ol></div>\n'
             '</section>') % (p['id'], p['numeral'], p['numeral'], p['numeral'], H.esc(p['title']),
                              # the stage the part ends on (its first chapter's opener shows where it starts)
                              '<div class="part-mini"><span class="mini-wrap">%s</span><p class="mini-cap">By the end of Part %s</p></div>' % (
                                  self.mini(p['chapters'][-1].get('mini', 0), cls='mini'), p['numeral']),
                              H.esc(p['prospect']), lis)
        self.part_refs = getattr(self, 'part_refs', {})
        self.part_refs[p['id']] = p
        return frag(m)[0]

    # ------------------------------------------------------------------ answers
    def collect_answers(self):
        self.answers = []
        for u in self.present:
            for a in u['el'].find_all(lambda e: e.hascls('q-answer') and e.parent is not None and e.parent.tag == 'li' and e.parent.hascls('q')):
                q = a.parent
                if not q.id:
                    self.error('%s: a question with an answer has no id' % u['file'])
                    continue
                link = frag('<p class="q-ans-link"><a href="#ans-%s">Answer</a></p>' % q.id)[0]
                a.replace_with(link)
                # the hint and the answer link share one line: wrap them in div.q-foot
                sib = [c for c in q.children if isinstance(c, H.El)]
                k = sib.index(link)
                if k > 0 and sib[k - 1].tag == 'details' and sib[k - 1].hascls('q-hint'):
                    hint = sib[k - 1]
                    foot = frag('<div class="q-foot"></div>')[0]
                    hint.before(foot)
                    hint.remove(); link.remove()
                    foot.append(hint, link)
                self.answers.append((u, q.id, a))

    # ------------------------------------------------------------------ glossary, bibliography, errata files
    def load_glossary(self):
        src = (self.src / 'app-glossary.js').read_text()
        i = src.index('const GLOSSARY')
        body = src[i:src.index('\n};', i)]
        self.glossary = {}
        for m in re.finditer(r"^\s*'([a-z0-9-]+)':\s*\['((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\]", body, re.M):
            self.glossary[m.group(1)] = [m.group(2).replace("\\'", "'"), m.group(3).replace("\\'", "'")]
        owners = self.B.get('glossaryOwners', {})
        self.glossary_extra = {}
        gdir = self.src / 'book' / 'glossary'
        for f in sorted(gdir.glob('*.json')) if gdir.is_dir() else []:
            key = f.stem
            try:
                entries = json.loads(f.read_text())
            except Exception as e:  # noqa: BLE001
                self.error('%s does not parse: %s' % (f.relative_to(self.root), e))
                continue
            own = owners.get(key, {})
            for slug, v in entries.items():
                rep = isinstance(v, dict)
                entry = v.get('entry') if rep else v
                if not (isinstance(entry, list) and len(entry) == 2 and all(isinstance(x, str) and x.strip() for x in entry)):
                    self.error('%s: %s must be ["Term", "Definition"]' % (f.name, slug))
                    continue
                if rep:
                    if not v.get('replace') or slug not in own.get('replaces', []):
                        self.error('%s: %s may not replace that entry (book.json glossaryOwners)' % (f.name, slug))
                        continue
                elif slug not in own.get('new', []):
                    self.error('%s: %s is not a term this unit owns (book.json glossaryOwners)' % (f.name, slug))
                    continue
                elif slug in self.glossary or slug in self.glossary_extra:
                    self.error('%s: %s is already defined' % (f.name, slug))
                    continue
                self.glossary_extra[slug] = entry

    def load_bib(self):
        self.bib = {}
        bdir = self.src / 'book' / 'bib'
        for f in sorted(bdir.glob('*.json')) if bdir.is_dir() else []:
            try:
                entries = json.loads(f.read_text())
            except Exception as e:  # noqa: BLE001
                self.error('%s does not parse: %s' % (f.relative_to(self.root), e))
                continue
            for k, v in entries.items():
                if k in self.bib and self.bib[k] != v:
                    self.error('bibliography key %s is defined differently in two files' % k)
                if v.get('group') not in dict(BIB_GROUPS):
                    self.error('%s: %s has an unknown group "%s"' % (f.name, k, v.get('group')))
                if v.get('verify'):
                    self.warn('bibliography %s still needs checking: %s' % (k, v['verify']))
                self.bib[k] = v

    def load_errata(self):
        self.errata = []
        edir = self.src / 'book' / 'errata'
        for f in sorted(edir.glob('*.json')) if edir.is_dir() else []:
            try:
                self.errata += json.loads(f.read_text())
            except Exception as e:  # noqa: BLE001
                self.error('%s does not parse: %s' % (f.relative_to(self.root), e))
        self.errata.sort(key=lambda e: e.get('date', ''), reverse=True)

    def drop_empty_back(self):
        """a generated back unit with nothing to list is left out until it has something"""
        cases = self.doc.find_all(self.is_case)
        count = {'answers': len(self.answers), 'cases': len(cases), 'bibliography': len(self.bib), 'errata': len(self.errata)}
        for u in list(self.present):
            g = u.get('generated')
            if g in count and not count[g]:
                u['el'].remove()
                self.present.remove(u)

    @staticmethod
    def is_case(e):
        return e.id and ((e.tag == 'figure' and e.hascls('case-plate')) or (e.tag == 'article' and e.hascls('case')))

    # ------------------------------------------------------------------ numbering
    @staticmethod
    def kind_of(e):
        c = e.classes
        if e.tag == 'figure':
            if 'film' in c:
                return 'film'
            if 'table' in c:
                return 'table'
            if 'sheet' in c or 'fig' in c or 'case-plate' in c:
                return 'fig'
        if e.tag == 'section' and 'we' in c:
            return 'ex'
        if e.tag == 'div' and 'eq' in c:
            return 'eq'
        if e.tag == 'li' and 'q' in c:
            return 'q'
        return None

    def number(self):
        for u in self.present:
            sec = u['el']
            label = u.get('label')
            uref = {'label': self.unit_label(u), 'num': label or '', 'kind': u['kind'], 'unit': u['id'], 'title': u.get('title')}
            self.refs[u['id']] = uref
            counters = {}
            for e in sec.iter():
                k = self.kind_of(e)
                if k is None and e.tag == 'h3' and e.id and label and e.closest(lambda a: a.tag == 'figure') is None:
                    k = 'sec'
                if k is None:
                    continue
                if not e.id:
                    if k != 'sec':
                        self.error('%s: a numbered %s has no id' % (u['file'], e.tag + '.' + '.'.join(e.classes)))
                    continue
                if e.get('data-label'):
                    num, text = e.get('data-label'), e.get('data-label')
                elif not label:
                    self.error('%s: #%s is numbered but %s has no label; give it data-label' % (u['file'], e.id, u['id']))
                    continue
                else:
                    counters[k] = counters.get(k, 0) + 1
                    num = '%s.%d' % (label, counters[k])
                    text = ('§%s' % num) if k == 'sec' else '%s %s' % (NUMBER_WORD[k], num)
                self.refs[e.id] = {'label': text, 'num': num, 'kind': k, 'unit': u['id'], 'title': self.title_of(e, k)}
                self.fill_number(e, k, num, text, u)
        for pid, p in getattr(self, 'part_refs', {}).items():
            self.refs[pid] = {'label': 'Part %s' % p['numeral'], 'num': p['numeral'], 'kind': 'part', 'unit': pid, 'title': p['title']}

    def title_of(self, e, k):
        if k == 'film' and e.id in self.segments:
            return self.segments[e.id]['info']['title']
        if k in ('fig', 'film', 'table'):
            cap = e.find(lambda x: x.hascls('figno') or x.hascls('tbl-cap'))
            if cap is not None:
                ph = cap.find(lambda x: x.has('data-num'))
                t = ''.join(x.text for x in cap.texts() if ph is None or x.parent is not ph)
                return re.sub(r'^[\s·]+', '', re.sub(r'\s+', ' ', t)).strip()
        if k == 'ex':
            t = e.find(lambda x: x.hascls('we-t'))
            return t.text.strip() if t is not None else ''
        if k == 'sec':
            return e.text.strip()
        return ''

    def fill_number(self, e, k, num, text, u):
        if k == 'q':
            e.insert(0, *frag('<span class="q-no">%s</span> ' % num))
            return
        if k == 'sec':
            e.insert(0, *frag('<span class="secno">%s</span> ' % num))
            return
        ph = e.find(lambda x: x.has('data-num') and self.kind_of(x) is None)
        if ph is None:
            self.error('%s: #%s has no <b data-num></b> placeholder for its number' % (u['file'], e.id))
            return
        if ph.text.strip():
            self.error('%s: #%s: its data-num placeholder must be empty (the build writes the number)' % (u['file'], e.id))
        ph.clear()
        ph.append(H.Text(H.esc('(%s)' % num if k == 'eq' else text)))

    # ------------------------------------------------------------------ openers and next cards
    def unit_counts(self, u):
        figs = [k for k, r in self.refs.items() if r['unit'] == u['id'] and r['kind'] == 'fig']
        films = [k for k, r in self.refs.items() if r['unit'] == u['id'] and r['kind'] == 'film']
        sec = u['el']
        n = 0
        skip = lambda e: (e.tag == 'figure' or e.hascls('opener') or e.hascls('ch-end') or e.hascls('sidenote')  # noqa: E731
                          or e.hascls('marginnote') or e.hascls('predict-reveal'))
        def walk(x):
            nonlocal n
            for c in x.children:
                if isinstance(c, H.Text):
                    n += words(c.text)
                elif isinstance(c, H.El) and c.tag not in ('script', 'style', 'svg') and not skip(c):
                    walk(c)
        walk(sec)
        return figs, films, n

    def fill_openers(self):
        for u in self.present:
            if u['kind'] not in ('chapter', 'prologue', 'epilogue'):
                continue
            op = u['el'].find(lambda e: e.tag == 'header' and e.hascls('opener') and e.get('data-gen') == 'opener')
            if op is None:
                self.error('%s: no <header class="opener" data-gen="opener">' % u['file'])
                continue
            figs, films, n = self.unit_counts(u)
            minutes = max(5, int(round(n / 200 / 5)) * 5)
            meta = []
            if figs:
                meta.append('%d figure%s' % (len(figs), '' if len(figs) == 1 else 's'))
            meta.append('about %d min to read' % minutes)
            for f in films:
                s = self.segments.get(f)
                if s:
                    meta.append('%s, %s' % (self.refs[f]['label'], fmt_len(s['end'] - s['start'])))
            if u['kind'] == 'chapter':
                kicker = '%s %s · Part %s · %s' % (self.B['unitWord'], u['label'], u['part']['numeral'], u['part']['title'])
                num = u['label']
            else:
                kicker = u['kind'].capitalize()
                num = ''
            head = ('<div class="wide opener-head"><div class="chapter-head">'
                    '%s<p class="sheetno ch-kicker">%s</p><h2 class="ch-title">%s</h2>'
                    '<p class="dek">%s</p></div></div>') % (
                ('<p class="ch-num" aria-hidden="true">%s</p>' % H.esc(num)) if num else '',
                H.esc(kicker), H.esc(u['title']), H.esc(u.get('question', '')))
            n_mini = u.get('mini')
            foot = '<div class="wide opener-foot">'
            if n_mini is not None:
                adds = self.mini_adds(n_mini)
                label = 'The running section%s%s' % (
                    (' as it stands in %s' % self.unit_label(u)) if u['kind'] != 'prologue' else ': the dam, drawn piece by piece; so far, only the ground',
                    ('; this chapter adds %s' % adds) if (adds and u['kind'] == 'chapter') else '')
                cap = ('<span class="mini-k">This chapter adds</span> %s' % H.esc(adds)) if (adds and u['kind'] == 'chapter' and n_mini > 0) else \
                      ('<span class="mini-k">The dam, piece by piece</span> %s' % ('so far, only the ground' if n_mini == 0 else 'complete'))
                foot += '<div class="mini-wrap">%s<p class="mini-cap">%s</p></div>' % (self.mini(n_mini, label), cap)
            foot += '<p class="ch-meta">%s</p></div>' % H.esc(' · '.join(meta))
            op.insert(0, *frag(head))
            op.append(*frag(foot))

    def fill_next(self):
        seq = [u for u in self.present if u['kind'] in ('prologue', 'chapter', 'epilogue')]
        for i, u in enumerate(seq):
            nav = u['el'].find(lambda e: e.get('data-gen') == 'next')
            if nav is None:
                if u['kind'] == 'chapter':
                    self.error('%s: no <nav class="next-card" data-gen="next">' % u['file'])
                continue
            out = ''
            if i + 1 < len(seq):
                n = seq[i + 1]
                out += '<p class="next-k">Next · <a href="#%s">%s</a></p>' % (n['id'], H.esc(self.toc_name(n)))
            if i > 0:
                p = seq[i - 1]
                out += '<p class="prev-k">Previous · <a href="#%s">%s</a></p>' % (p['id'], H.esc(self.toc_name(p)))
            nav.append(*frag(out))

    def toc_name(self, u):
        if u['kind'] == 'chapter':
            return '%s %s · %s' % (self.B['unitWord'], u['label'], u['title'])
        return '%s · %s' % (u['kind'].capitalize(), u['title']) if u['kind'] in ('prologue', 'epilogue') else u['title']

    # ------------------------------------------------------------------ contents
    def fill_toc(self):
        nav = self.doc.find(lambda e: e.get('data-gen') == 'toc')
        if nav is None:
            return
        present = {u['id'] for u in self.present}
        out = []
        def item(u, kick):
            figs, films, n = self.unit_counts(u)
            bits = []
            if figs:
                bits.append('%d figure%s' % (len(figs), '' if len(figs) == 1 else 's'))
            for f in films:
                s = self.segments.get(f)
                if s:
                    bits.append('%s, %d min' % (self.refs[f]['label'], max(1, int(round((s['end'] - s['start']) / 60)))))
            meta = (' <small class="toc-meta">%s</small>' % H.esc(' · '.join(bits))) if bits else ''
            mini = self.mini(u['mini'], cls='mini toc-mini') if u.get('mini') is not None else ''
            if u['kind'] == 'chapter':  # a large numeral; the word is there for a screen reader
                kick_html = '<span><i class="sr">%s </i>%s</span>' % (H.esc(self.B['unitWord']), H.esc(u['label']))
            else:
                kick_html = '<span>%s</span>' % H.esc(kick)
            return '<li%s><a href="#%s">%s<strong>%s</strong></a><p>%s%s</p>%s</li>' % (
                ' class="toc-ch"' if u['kind'] == 'chapter' else '', u['id'], kick_html, H.esc(u['title']), H.esc(u.get('hook', '')), meta, mini)
        pro = self.unit_by_id[self.B['prologue']['id']]
        if pro['id'] in present:
            out.append('<ol class="course">%s</ol>' % item(pro, 'Prologue'))
        for p in self.B['parts']:
            chs = [self.unit_by_id[c['id']] for c in p['chapters'] if c['id'] in present]
            out.append('<p class="eyebrow toc-part"><a href="#%s">Part %s · %s</a></p>' % (p['id'], p['numeral'], H.esc(p['title'])))
            out.append('<ol class="course">%s</ol>' % ''.join(item(c, '%s %s' % (self.B['unitWord'], c['label'])) for c in chs))
        epi = self.unit_by_id[self.B['epilogue']['id']]
        if epi['id'] in present:
            out.append('<ol class="course">%s</ol>' % item(epi, 'Epilogue'))
        back = [u for u in self.present if u['kind'] == 'back']
        if back:
            out.append('<p class="eyebrow toc-part">At the back</p>')
            out.append('<ol class="course">%s</ol>' % ''.join(
                '<li><a href="#%s"><span>%s</span><strong>%s</strong></a></li>' % (u['id'], 'Appendix %s' % u['label'] if u.get('label') else 'Reference', H.esc(u['title']))
                for u in back))
        # the films (SPEC B.5, final-plan front matter): all seven, in the order the book plays them,
        # each with its whole running time and where it plays; the safe title before the last chapter
        out.append(self.film_list())
        figs = ['<li><a href="#%s">%s</a> · %s</li>' % (k, r['label'], H.esc(r['title'])) for k, r in self.refs.items() if r['kind'] in ('fig', 'table')]
        if figs:
            out.append('<details class="toc-figs"><summary>Figures and tables</summary><ol class="toc-list">%s</ol></details>' % ''.join(figs))
        nav.append(*frag(''.join(out)))

    # ------------------------------------------------------------------ back matter
    def fill_answers(self):
        box = self.doc.find(lambda e: e.get('data-gen') == 'answers')
        if box is None:
            return
        cur = None
        for u, qid, a in self.answers:
            if u is not cur:
                box.append(*frag('<h4 class="ans-unit">%s</h4>' % H.esc(self.toc_name(u))))
                cur = u
            d = frag('<div class="ans" id="ans-%s"><p class="ans-k"><a data-ref="%s" data-form="num"></a> · <a href="#%s">back to the question</a></p></div>' % (qid, qid, qid))[0]
            for c in list(a.children):
                d.append(c)
            box.append(d)

    def fill_cases(self):
        box = self.doc.find(lambda e: e.get('data-gen') == 'cases')
        if box is None:
            return
        rows = []
        for e in self.doc.find_all(self.is_case):
            u = e.closest(lambda x: x.tag == 'section' and any(k in x.classes for k in KINDS))
            uref = self.refs.get(u.id) if u is not None else None
            if e.tag == 'figure':
                name = '%s · %s' % (e.get('data-case', e.id), e.get('data-year', ''))
                mech = e.get('data-mechanism-safe') or e.get('data-mechanism') or ''
            else:
                k = e.find(lambda x: x.hascls('case-k'))
                name, mech = (re.sub(r'\s+', ' ', k.text).strip() if k is not None else e.id), ''
            rows.append('<li><a href="#%s">%s</a>%s%s</li>' % (
                e.id, H.esc(name), (' · ' + H.esc(mech)) if mech else '', (' · %s' % uref['label']) if uref else ''))
        box.append(*frag('<ul class="case-index">%s</ul>' % ''.join(rows)))

    def bib_entry(self, k, v, full=True):
        g = v.get('group')
        title = H.esc(v.get('title') or '')
        cont = H.esc(v.get('container') or '')
        who = H.esc(v.get('authors') or '') + ((' (%s)' % H.esc(v['year'])) if v.get('year') else '') + '.'
        stop = lambda t: '' if t.rstrip().endswith(('.', '?', '!')) else '.'  # 'Design of Small Dams, 3rd ed.' keeps one full stop
        if g == 'papers':
            s = '%s %s%s%s' % (who, title, stop(title), (' <em>%s</em>%s' % (cont, stop(cont))) if cont else '')
        else:
            s = '%s <em>%s</em>%s%s' % (who, title, stop(title), (' ' + cont + stop(cont)) if cont else '')
        if v.get('doi'):
            s += ' doi:%s' % H.esc(v['doi'])
        elif v.get('url'):
            s += ' <a href="%s">%s</a>' % (H.esc_attr(v['url']), H.esc(v['url']))
        return re.sub(r'\.\.(?!\.)', '.', s)

    def fill_bib(self):
        box = self.doc.find(lambda e: e.get('data-gen') == 'bibliography')
        if box is None:
            return
        cited = {}
        for e in self.doc.find_all(lambda e: e.has('data-cite')):
            u = e.closest(lambda x: x.tag == 'section' and any(k in x.classes for k in KINDS))
            if u is not None and u.id in self.refs:
                for k in e.get('data-cite').split(','):
                    cited.setdefault(k.strip(), [])
                    if self.refs[u.id]['label'] not in cited[k.strip()]:
                        cited[k.strip()].append(self.refs[u.id]['label'])
        out = []
        for g, name in BIB_GROUPS:
            keys = sorted((k for k, v in self.bib.items() if v.get('group') == g), key=lambda k: (self.bib[k].get('authors') or '').lower())
            if not keys:
                continue
            lis = ''.join('<li id="bib-%s">%s%s</li>' % (
                k, self.bib_entry(k, self.bib[k]), (' <span class="bib-cited">Cited in %s.</span>' % H.esc(join_and(cited[k]))) if k in cited else '') for k in keys)
            out.append('<h4 class="bib-group">%s</h4><ul class="sources bib">%s</ul>' % (name, lis))
        box.append(*frag(''.join(out)))

    def fill_errata(self):
        box = self.doc.find(lambda e: e.get('data-gen') == 'errata')
        if box is None:
            return
        lis = []
        for x in self.errata:
            where = H.esc(x.get('where', ''))
            if x.get('ref'):
                where = '<a data-ref="%s">%s</a>' % (H.esc_attr(x['ref']), where) if where else '<a data-ref="%s"></a>' % H.esc_attr(x['ref'])
            lis.append('<li><span class="err-date">%s</span> · %s. Was: %s. Now: %s. %s</li>' % (
                H.esc(x.get('date', '')), where, H.esc(x.get('was', '')), H.esc(x.get('now', '')), H.esc(x.get('why', ''))))
        box.append(*frag('<ul class="sources errata">%s</ul>' % ''.join(lis)))

    # ------------------------------------------------------------------ references
    def resolve_refs(self):
        ids = {e.id: e for e in self.doc.iter() if e.id}
        for e in self.doc.find_all(lambda e: e.has('data-ref')):
            targets = [t.strip() for t in e.get('data-ref').split(',') if t.strip()]
            form = e.get('data-form')
            has_text = bool(e.text.strip()) or any(isinstance(c, H.El) for c in e.children)
            labels, missing = [], False
            for t in targets:
                if t in self.refs:
                    labels.append(self.refs[t])
                elif t in ids:
                    if not has_text:
                        self.error('data-ref="%s": #%s is not numbered, so the reference needs its own words' % (e.get('data-ref'), t))
                    labels.append(None)
                else:
                    self.error('data-ref="%s": no element #%s on the page' % (e.get('data-ref'), t), draftable=t in self.new_ids)
                    missing = True
            if e.tag == 'a' and targets:
                e.set('href', '#' + targets[0])
                e.addcls('xref')
            if has_text:
                continue
            if missing:
                text = '?'
            elif form == 'num':
                text = join_and(r['num'] for r in labels if r)
            elif form == 'title' and len(labels) == 1 and labels[0]:
                text = '%s, %s' % (labels[0]['label'], labels[0]['title'])
            else:
                rs = [r for r in labels if r]
                kinds = {r['kind'] for r in rs}
                if len(rs) > 1 and len(kinds) == 1 and next(iter(kinds)) in PLURAL:
                    text = '%s %s' % (PLURAL[rs[0]['kind']], join_and(r['num'] for r in rs))
                else:
                    text = join_and(r['label'] for r in rs)
            if text[:1].islower() and starts_sentence(e):
                text = text[:1].upper() + text[1:]   # "the Prologue starts…" at the head of a sentence
            e.append(H.Text(H.esc(text)))

    def resolve_cites(self):
        for e in self.doc.find_all(lambda e: e.has('data-cite')):
            keys = [k.strip() for k in e.get('data-cite').split(',')]
            for k in keys:
                if k not in self.bib:
                    self.error('data-cite="%s": no bibliography entry %s (src/book/bib/*.json)' % (e.get('data-cite'), k), draftable=True)
            k = keys[0]
            if e.tag == 'a':
                e.set('href', '#bib-' + k)
                if not e.text.strip() and k in self.bib:
                    e.append(H.Text(H.esc(self.bib[k].get('short', k))))
            elif e.tag == 'cite' and not e.text.strip() and k in self.bib:
                e.append(*frag(self.bib_entry(k, self.bib[k])))

    def film_list(self):
        order = []
        for k, r in self.refs.items():
            if r['kind'] == 'film' and k in self.segments and self.segments[k]['film'] not in order:
                order.append(self.segments[k]['film'])
        if not order:
            return ''
        rows, total = [], 0.0
        for f in order:
            info = self.B['films'][f]
            total += info['duration']
            segs = [(k, self.segments[k]) for k, r in self.refs.items() if r['kind'] == 'film' and self.segments.get(k, {}).get('film') == f]
            nums = join_and('<a href="#%s">%s</a>' % (k, H.esc(self.refs[k]['num'])) for k, _ in segs)
            units = [self.refs[sg['unit']['id']] for _, sg in segs]
            where = units[0]['label'] if len(units) == 1 else '%s %s' % (PLURAL['chapter'], join_and(r['num'] for r in units))
            if len(segs) > 1:
                where = 'in %s parts, %s' % ({2: 'two', 3: 'three'}.get(len(segs), len(segs)), where)
            title = info.get('safeTitle') or info['title']
            rows.append('<li><span class="tf-n">%s</span><span class="tf-t">%s</span><span class="tf-w">%s</span><span class="tf-l">%s</span></li>' % (
                nums, H.esc(title), H.esc(where), H.esc(fmt_len(info['duration']))))
        words_n = {1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine'}
        head = '%s films, %d minutes in all' % (words_n.get(len(order), str(len(order))), round(total / 60))
        return ('<section class="toc-films" aria-labelledby="toc-films-h"><p class="eyebrow toc-part" id="toc-films-h">The films</p>'
                '<p class="toc-films-k">%s. Each sits in the chapter it retells most closely, with a question before it, chapter marks and a transcript. '
                'The book plays some of them in part, and says where.</p><ol class="toc-film-list">%s</ol></section>') % (H.esc(head), ''.join(rows))

    # ------------------------------------------------------------------ films
    def films(self):
        """SPEC F.13: segment times onto each film block, its length, the poster question, the chapter
        marks checked against the segment and the captions, and a transcript built from the VTT"""
        figs = {e.id: e for e in self.doc.find_all(lambda e: e.tag == 'figure' and e.hascls('film'))}
        for fid, e in figs.items():
            if fid not in self.segments:
                self.error('film block #%s has no segment in src/book.json' % fid)
        for fid, s in self.segments.items():
            e = figs.get(fid)
            if e is None:
                if any(s['unit'] is u for u in self.present):
                    self.error('src/book.json lists film %s in %s, but the page has no figure.film#%s' % (fid, s['unit']['id'], fid))
                continue
            u = e.closest(lambda x: x.tag == 'section' and any(k in x.classes for k in KINDS))
            if u is None or u.id != s['unit']['id']:
                self.error('film #%s sits in %s, but src/book.json puts it in %s' % (fid, u.id if u is not None else '?', s['unit']['id']))
            e.set('data-film', s['film'])
            e.set('data-start', ('%g' % s['start']))
            e.set('data-end', ('%g' % s['end']))
            if s.get('question'):
                e.set('data-question', s['question'])
            ln = e.find(lambda x: x.get('data-gen') == 'film-len')
            if ln is not None:
                ln.clear()
                ln.append(H.Text(H.esc('%s · captions' % fmt_len(s['end'] - s['start']))))
            cues = self.cues(s)
            self.check_marks(fid, e, s, cues)
            tr = e.find(lambda x: x.get('data-gen') == 'transcript')
            if tr is not None and cues is not None:
                paras = self.transcript(s, cues)
                tr.append(*frag('<div class="film-transcript-text">%s</div>' % ''.join(
                    '<p><button type="button" class="tr-t" data-t="%g" aria-label="Play from %s">%s</button> %s</p>' % (t, clock(t), clock(t), H.esc(p))
                    for t, p in paras)))

    def film_tail(self, s):
        """the end card's line for a segment that stops before its file ends (book.json "tail"):
        {rest} becomes the length left, {unit-or-figure id} a link labelled as the page labels it"""
        t = s.get('tail')
        if not t:
            return None
        def sub(m):
            k = m.group(1)
            if k == 'rest':  # in prose: "23 seconds", "1 min 5 s"
                rest = s['info']['duration'] - s['end']
                return H.esc('%d seconds' % math.floor(rest + 0.5) if rest < 59.5 else fmt_len(rest))
            if k not in self.refs:
                self.error('src/book.json: film %s: tail names {%s}, which has no number on the page' % (s['id'], k))
                return '?'
            return '<a href="#%s">%s</a>' % (k, H.esc(self.refs[k]['label']))
        return re.sub(r'\{([a-z0-9-]+)\}', sub, H.esc(t))

    def cues(self, s):
        """every cue of the film's VTT file: (start, end, text), times in seconds from the file's start"""
        key = s['film']
        if key in self._cues:
            return self._cues[key]
        vtt = self.root / 'docs' / s['info']['vtt']
        if not vtt.is_file():
            self.error('film %s: caption file %s is missing' % (s['film'], s['info']['vtt']))
            self._cues[key] = None
            return None
        self._cues[key] = parse_vtt(vtt.read_text())
        return self._cues[key]

    def check_marks(self, fid, e, s, cues):
        """chapter marks (SPEC F.13): inside the segment, labelled with their own time, and each at a
        spoken line of the captions (within 1.5 s of a cue's start)"""
        for b in e.find_all(lambda x: x.tag == 'button' and x.has('data-t') and x.closest(lambda a: a.hascls('film-marks')) is not None):
            try:
                t = float(b.get('data-t'))
            except ValueError:
                self.error('film #%s: chapter mark data-t="%s" is not a time' % (fid, b.get('data-t')))
                continue
            if not (s['start'] - 0.01 <= t < s['end']):
                self.error('film #%s: chapter mark at %s s is outside its segment (%g–%g s)' % (fid, b.get('data-t'), s['start'], s['end']))
            if b.text.strip() != clock(t):
                self.error('film #%s: chapter mark at %s s is labelled "%s", not "%s"' % (fid, b.get('data-t'), b.text.strip(), clock(t)))
            if cues and not any(abs(c[0] - t) <= 1.5 for c in cues):
                self.error('film #%s: chapter mark at %s s is not at a spoken line of %s' % (fid, b.get('data-t'), s['info']['vtt']))

    def transcript(self, s, cues):
        """the cues inside the segment as readable paragraphs: a paragraph breaks where the narration
        pauses (0.9 s or more: the films leave about 1.2 s between beats and 0.3–0.4 s between lines),
        and a paragraph longer than about 650 characters is split at the line break nearest its middle.
        Returns [(start time, text)]."""
        inside = [c for c in cues if s['start'] - 0.05 <= c[0] < s['end']]
        groups, cur, last = [], [], None
        for c in inside:
            if last is not None and c[0] - last >= 0.9 and cur:
                groups.append(cur)
                cur = []
            cur.append(c)
            last = c[1]
        if cur:
            groups.append(cur)
        def split(g):
            if len(' '.join(c[2] for c in g)) <= 650 or len(g) < 2:
                return [g]
            total = len(' '.join(c[2] for c in g))
            best, run = None, 0
            for i in range(1, len(g)):
                run += len(g[i - 1][2]) + 1
                if g[i][0] - g[i - 1][1] < 0.2:  # inside one spoken line
                    continue
                if best is None or abs(run - total / 2) < abs(best[1] - total / 2):
                    best = (i, run)
            if best is None:
                return [g]
            return split(g[:best[0]]) + split(g[best[0]:])
        out = []
        for g in groups:
            for h in split(g):
                out.append((math.floor(h[0][0] * 10 + 1e-6) / 10, ' '.join(c[2] for c in h)))  # a tenth early, never clipping the first word
        return out

    # ------------------------------------------------------------------ global checks
    def checks(self):
        seen = {}
        for e in self.doc.iter():
            if e.id:
                if e.id in seen:
                    self.error('duplicate id "%s" on the page' % e.id)
                seen[e.id] = e
        terms = set(self.glossary) | set(self.glossary_extra)
        for e in self.doc.find_all(lambda e: e.has('data-term')):
            if e.get('data-term') not in terms:
                self.error('data-term="%s" has no glossary entry' % e.get('data-term'))
        num = re.compile(r'^[−-]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?%?$|^[−-]?\d+(\.\d+)? × 10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$|^10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+$')
        for e in self.doc.find_all(lambda e: e.has('data-n')):
            t = e.text.strip()
            if not e.get('data-n') or not num.match(t):
                self.error('data-n="%s": its text "%s" is not a number' % (e.get('data-n'), t))
        for e in self.doc.find_all(lambda e: e.tag == 'figure' and self.kind_of(e) in ('fig', 'film') and e.closest(lambda a: a.hascls('defs')) is None):
            if e.find(lambda x: x.tag == 'figcaption') is None:
                self.warn('figure #%s has no figcaption' % e.id)
        self.polley_guard()
        page_text = ''.join(t.text for t in self.doc.texts())
        for m in STUB_WORDS.finditer(page_text):
            self.error('visible placeholder text "%s" on the page' % m.group(0))

    def before_build(self):
        """the text nodes and elements that come before #ch-build in document order"""
        texts, els = [], []
        stop = False
        def walk(n):
            nonlocal stop
            for c in n.children:
                if stop:
                    return
                if isinstance(c, H.Text):
                    texts.append(c)
                elif isinstance(c, H.El):
                    if c.id == 'ch-build':
                        stop = True
                        return
                    els.append(c)
                    walk(c)
        walk(self.doc)
        return texts, els

    def polley_guard(self):
        texts, els = self.before_build()
        seen = set()
        for t in texts:
            if POLLEY_NEVER.search(t.text):
                self.error('Polley guard: "%s" appears before Chapter 13: "%s…"' % (POLLEY_NEVER.search(t.text).group(0), t.text.strip()[:80]))
            if re.search(r'layer nobody found', t.text, re.I):
                self.error('Polley guard: the last film\'s own title appears before Chapter 13; use its safeTitle')
            if 'Polley' not in t.text:
                continue
            b = t.parent
            while b is not None and isinstance(b, H.El) and b.tag not in GUARD_BLOCKS and b.tag != '#doc':
                b = b.parent
            if b is None or b.tag == '#doc':
                b = t.parent
            if id(b) in seen:
                continue
            seen.add(id(b))
            m = POLLEY_WORDS.search(b.text)
            if m:
                self.error('Polley guard: "%s" next to Mount Polley before Chapter 13: "%s…"' % (m.group(0), re.sub(r'\s+', ' ', b.text).strip()[:100]))
        for e in els:
            for a in ('aria-label', 'title', 'alt'):
                v = e.get(a) or ''
                if 'Polley' in v and POLLEY_WORDS.search(v):
                    self.error('Polley guard: %s on #%s gives the cause away before Chapter 13' % (a, e.id))
        for slug, (term, d) in list(self.glossary.items()) + list(self.glossary_extra.items()):
            if 'Polley' in d and POLLEY_WORDS.search(d):
                self.error('Polley guard: glossary entry %s names Mount Polley next to its cause' % slug)
        def strings(x, path):
            if isinstance(x, str):
                if 'Polley' in x and POLLEY_WORDS.search(x):
                    self.error('Polley guard: src/book.json %s gives the cause away' % path)
            elif isinstance(x, dict):
                for k, v in x.items():
                    strings(v, path + '.' + k)
            elif isinstance(x, list):
                for i, v in enumerate(x):
                    strings(v, '%s[%d]' % (path, i))
        strings(self.B, 'book')


def assemble(root, draft=False):
    b = Book(root, draft)
    try:
        res = b.run()
    except Exception as e:  # a crash is reported, never half-written
        import traceback
        b.errors.append('build crashed: %s\n%s' % (e, traceback.format_exc()))
        res = None
    return res, b.errors, b.warnings
