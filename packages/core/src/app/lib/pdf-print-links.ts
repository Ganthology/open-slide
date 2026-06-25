const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;

const SKIP_LINKIFY = new Set([
  'A',
  'SCRIPT',
  'STYLE',
  'TEXTAREA',
  'INPUT',
  'SELECT',
  'OPTION',
  'CODE',
  'PRE',
  'SVG',
]);

export type LinkSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; display: string; href: string };

export function preparePrintLinks(root: HTMLElement): void {
  unwrapPrintSupersample(root);
  linkifyTextUrls(root);
  normalizeAnchorHrefs(root);
}

export function splitTextIntoLinkSegments(text: string): LinkSegment[] {
  const segments: LinkSegment[] = [];
  let lastIndex = 0;
  URL_RE.lastIndex = 0;

  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }
    const raw = match[0];
    const { href, display } = normalizeDetectedUrl(raw);
    segments.push({ type: 'url', display, href });
    lastIndex = start + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function unwrapPrintSupersample(root: HTMLElement): void {
  const wrappers = [...root.querySelectorAll<HTMLElement>('.os-print-supersample')];
  for (const wrapper of wrappers) {
    const parent = wrapper.parentElement;
    if (!parent) continue;
    while (wrapper.firstChild) {
      parent.insertBefore(wrapper.firstChild, wrapper);
    }
    wrapper.remove();
  }
}

export function linkifyTextUrls(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.nodeValue?.trim()) textNodes.push(node as Text);
    node = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const parent = textNode.parentElement;
    if (!parent || shouldSkipLinkify(parent)) continue;

    const text = textNode.nodeValue ?? '';
    const segments = splitTextIntoLinkSegments(text);
    if (!segments.some((segment) => segment.type === 'url')) continue;

    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (segment.type === 'text') {
        fragment.appendChild(document.createTextNode(segment.value));
        continue;
      }
      const anchor = document.createElement('a');
      anchor.href = segment.href;
      anchor.textContent = segment.display;
      anchor.style.color = 'inherit';
      anchor.style.textDecoration = 'inherit';
      fragment.appendChild(anchor);
    }

    parent.replaceChild(fragment, textNode);
  }
}

export function normalizeAnchorHrefs(root: HTMLElement): void {
  for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
      continue;
    try {
      anchor.href = new URL(href, window.location.href).href;
    } catch {
      // Keep author-provided href when it cannot be resolved.
    }
  }
}

function shouldSkipLinkify(element: HTMLElement): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (SKIP_LINKIFY.has(current.tagName)) return true;
    current = current.parentElement;
  }
  return false;
}

export function normalizeDetectedUrl(raw: string): { href: string; display: string } {
  let url = raw;
  let trailing = '';

  while (url.length > 0) {
    const last = url.at(-1);
    if (!last || !/[.,;:!?)}\]]/.test(last)) break;
    if (last === ')' && url.includes('(') && url.lastIndexOf('(') < url.lastIndexOf(')')) break;
    trailing = last + trailing;
    url = url.slice(0, -1);
  }

  const href = url.startsWith('www.') ? `https://${url}` : url;
  return { href, display: url + trailing };
}
