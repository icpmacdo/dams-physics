"""A small HTML tree for the book build: parse, query, edit, and write back.

It keeps the source text of every tag it has not changed, so parse → serialize gives back the
input byte for byte (the build checks this). It is not a browser parser: it does not close <p>
or <li> implicitly; the book's markup closes every element it opens.
"""
import html as _html
import re

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'param'}
RAWTEXT = {'script', 'style', 'textarea'}
BLOCK = {'p', 'li', 'tr', 'dd', 'dt', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'summary',
         'div', 'section', 'header', 'footer', 'nav', 'figure', 'ul', 'ol', 'dl', 'table', 'article', 'aside', 'details', 'main'}

_TOKEN = re.compile(
    r'<!--.*?-->'                                   # comment
    r'|<![^>]*>'                                    # doctype
    r'|</([a-zA-Z][\w:-]*)\s*>'                     # end tag
    r'|<([a-zA-Z][\w:-]*)'                          # start tag name
    r'((?:\s+[^\s=>/"\']+(?:\s*=\s*(?:"[^"]*"|\'[^\']*\'|[^\s>"\']+))?)*)'
    r'\s*(/?)>', re.S)
_ATTR = re.compile(r'([^\s=>/"\']+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>"\']+))?')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def esc_attr(s):
    return s.replace('&', '&amp;').replace('"', '&quot;')


class Node:
    parent = None

    def remove(self):
        if self.parent is not None:
            self.parent.children.remove(self)
            self.parent = None
        return self


class Text(Node):
    def __init__(self, raw):
        self.raw = raw

    @property
    def text(self):
        return _html.unescape(self.raw)

    def html(self):
        return self.raw


class Raw(Node):
    """A comment, a doctype or a stray end tag: kept as it was, never text."""

    def __init__(self, raw):
        self.raw = raw

    def html(self):
        return self.raw

    @property
    def is_comment(self):
        return self.raw.startswith('<!--')


class El(Node):
    def __init__(self, tag, attrs=None, raw=None, selfclose=False):
        self.tag = tag.lower()
        self.attrs = attrs if attrs is not None else []   # [name, raw value with quotes, or None]
        self.raw = raw                                     # the source text of the start tag, while unchanged
        self.selfclose = selfclose
        self.children = []
        self.end = None if (self.tag in VOID or selfclose) else '</%s>' % tag
        self.closed = True

    # ---- attributes
    def get(self, name, default=None):
        for k, v in self.attrs:
            if k.lower() == name:
                if v is None:
                    return ''
                if v[:1] in '"\'':
                    v = v[1:-1]
                return _html.unescape(v)
        return default

    def has(self, name):
        return any(k.lower() == name for k, _ in self.attrs)

    def set(self, name, value):
        raw = None if value is None else '"' + esc_attr(str(value)) + '"'
        for a in self.attrs:
            if a[0].lower() == name:
                a[1] = raw
                break
        else:
            self.attrs.append([name, raw])
        self.raw = None
        return self

    def unset(self, name):
        n = len(self.attrs)
        self.attrs = [a for a in self.attrs if a[0].lower() != name]
        if len(self.attrs) != n:
            self.raw = None
        return self

    @property
    def id(self):
        return self.get('id')

    @property
    def classes(self):
        return (self.get('class') or '').split()

    def hascls(self, c):
        return c in self.classes

    def addcls(self, c):
        if not self.hascls(c):
            self.set('class', ' '.join(self.classes + [c]))
        return self

    # ---- tree
    def append(self, *nodes):
        for n in nodes:
            n.remove()
            n.parent = self
            self.children.append(n)
        return self

    def insert(self, i, *nodes):
        for k, n in enumerate(nodes):
            n.remove()
            n.parent = self
            self.children.insert(i + k, n)
        return self

    def before(self, *nodes):
        p = self.parent
        p.insert(p.children.index(self), *nodes)

    def after(self, *nodes):
        p = self.parent
        p.insert(p.children.index(self) + 1, *nodes)

    def replace_with(self, *nodes):
        p = self.parent
        i = p.children.index(self)
        self.remove()
        p.insert(i, *nodes)

    def clear(self):
        for c in list(self.children):
            c.remove()
        return self

    def iter(self):
        """Every element below this one, in document order (not itself)."""
        stack = list(reversed(self.children))
        while stack:
            n = stack.pop()
            if isinstance(n, El):
                yield n
                stack.extend(reversed(n.children))

    def find_all(self, pred):
        return [e for e in self.iter() if pred(e)]

    def find(self, pred):
        for e in self.iter():
            if pred(e):
                return e
        return None

    def ancestors(self):
        p = self.parent
        while p is not None:
            yield p
            p = p.parent

    def closest(self, pred):
        if pred(self):
            return self
        for a in self.ancestors():
            if isinstance(a, El) and pred(a):
                return a
        return None

    def texts(self):
        """The text nodes below this element, in order (not inside script or style)."""
        stack = list(reversed(self.children))
        while stack:
            n = stack.pop()
            if isinstance(n, Text):
                yield n
            elif isinstance(n, El) and n.tag not in ('script', 'style'):
                stack.extend(reversed(n.children))

    @property
    def text(self):
        return ''.join(t.text for t in self.texts())

    def set_html(self, markup):
        self.clear()
        for n in parse(markup).children:
            self.append(n)
        return self

    # ---- output
    def start_tag(self):
        if self.raw is not None:
            return self.raw
        a = ''.join(' ' + k if v is None else ' %s=%s' % (k, v) for k, v in self.attrs)
        return '<%s%s%s>' % (self.tag, a, ' /' if self.selfclose else '')

    def html(self):
        out = []
        _write(self, out)
        return ''.join(out)

    def inner_html(self):
        out = []
        for c in self.children:
            _write(c, out)
        return ''.join(out)


class Doc(El):
    def __init__(self):
        super().__init__('#doc')
        self.end = None

    def start_tag(self):
        return ''


def _write(n, out):
    stack = [n]
    while stack:
        n = stack.pop()
        if isinstance(n, str):
            out.append(n)
        elif isinstance(n, El):
            out.append(n.start_tag())
            if n.end and n.closed:
                stack.append(n.end)
            stack.extend(reversed(n.children))
        else:
            out.append(n.html())


def parse(src):
    doc = Doc()
    stack = [doc]
    pos = 0
    n = len(src)
    while pos < n:
        m = _TOKEN.search(src, pos)
        if not m:
            stack[-1].append(Text(src[pos:]))
            break
        if m.start() > pos:
            stack[-1].append(Text(src[pos:m.start()]))
        tok = m.group(0)
        pos = m.end()
        if tok.startswith('<!'):
            stack[-1].append(Raw(tok))
        elif m.group(1):                               # end tag
            name = m.group(1).lower()
            for i in range(len(stack) - 1, 0, -1):
                if stack[i].tag == name:
                    for open_el in stack[i + 1:]:
                        open_el.closed = False
                    stack[i].end = tok
                    del stack[i:]
                    break
            else:
                stack[-1].append(Raw(tok))
        else:                                          # start tag
            name = m.group(2)
            attrs = [[a.group(1), a.group(2)] for a in _ATTR.finditer(m.group(3) or '')]
            el = El(name, attrs, tok, bool(m.group(4)))
            stack[-1].append(el)
            if el.tag in RAWTEXT:
                close = re.compile(r'</%s\s*>' % el.tag, re.I).search(src, pos)
                body_end = close.start() if close else n
                if body_end > pos:
                    el.append(Text(src[pos:body_end]))
                el.end = close.group(0) if close else ''
                pos = close.end() if close else n
            elif el.end is not None:
                stack.append(el)
    for open_el in stack[1:]:
        open_el.closed = False
    return doc


def el(tag, attrs=None, *children, text=None):
    """Build a new element: el('a', {'href': '#x', 'class': 'xref'}, text='Fig. 4.1')."""
    e = El(tag)
    for k, v in (attrs or {}).items():
        e.set(k, v)
    for c in children:
        e.append(c)
    if text is not None:
        e.append(Text(esc(text)))
    return e
