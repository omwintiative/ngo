/*
  A blog post's text, in the limited format the admin editor saves:
    ## Heading        **bold**        _italic_        [words](https://…)
    - bullet list     1. numbered     > quote
  Blocks are separated by a blank line; a single line break stays a line
  break. A backslash keeps the next character as it is (\* is a star).

  renderPostText builds the page with DOM calls only (never innerHTML), so
  nothing in a post can run as code; links work only for https://, http://,
  mailto: and this site's own paths. Posts written before the editor are
  plain text and read the same as before.

  postTextFrom turns the editor's contents back into this format.
*/

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;
export const safeHref = (href: string) => SAFE_HREF.test(href.trim());

const INLINE = /\\([\\*_[\]()#>\-.0-9])|\*\*(.+?)\*\*|_(.+?)_|\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/g;

function appendInline(parent: Node, text: string) {
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) appendText(parent, text.slice(last, m.index));
    const [, escaped, bold, italic, linkText, href] = m;
    if (escaped !== undefined) appendText(parent, escaped);
    else if (bold !== undefined) appendInline(parent.appendChild(document.createElement('strong')), bold);
    else if (italic !== undefined) appendInline(parent.appendChild(document.createElement('em')), italic);
    else if (safeHref(href)) {
      const a = document.createElement('a');
      a.href = href;
      appendInline(parent.appendChild(a), linkText);
    } else appendInline(parent, linkText);
    last = m.index! + m[0].length;
  }
  if (last < text.length) appendText(parent, text.slice(last));
}

// Line breaks inside a paragraph become <br>.
function appendText(parent: Node, text: string) {
  text.split('\n').forEach((part, i) => {
    if (i > 0) parent.appendChild(document.createElement('br'));
    if (part) parent.appendChild(document.createTextNode(part));
  });
}

const BULLET = /^- /;
const NUMBER = /^\d+\. /;
const QUOTE = /^> ?/;

export function renderPostText(source: string): DocumentFragment {
  const out = document.createDocumentFragment();
  const blocks = source.replace(/\r\n?/g, '\n').split(/\n[ \t]*\n/).map((b) => b.trim()).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length === 1 && block.startsWith('## ')) {
      appendInline(out.appendChild(document.createElement('h2')), block.slice(3).trim());
    } else if (lines.every((l) => BULLET.test(l)) || lines.every((l) => NUMBER.test(l))) {
      const list = out.appendChild(document.createElement(BULLET.test(lines[0]) ? 'ul' : 'ol'));
      for (const line of lines) appendInline(list.appendChild(document.createElement('li')), line.replace(BULLET, '').replace(NUMBER, ''));
    } else if (lines.every((l) => QUOTE.test(l))) {
      const quote = out.appendChild(document.createElement('blockquote'));
      appendInline(quote.appendChild(document.createElement('p')), lines.map((l) => l.replace(QUOTE, '')).join('\n'));
    } else {
      appendInline(out.appendChild(document.createElement('p')), block);
    }
  }
  return out;
}

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'BLOCKQUOTE']);
const isBlock = (node: Node) => node instanceof Element && BLOCK_TAGS.has(node.tagName);
const escapeText = (text: string) => text.replace(/[\\*_[\]]/g, '\\$&');
// A paragraph that happens to start like a heading, list or quote keeps its text.
const escapeStart = (line: string) => (/^(## |- |\d+\. |>)/.test(line) ? `\\${line}` : line);

function inlineText(node: Node): string {
  let text = '';
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) text += escapeText((child.textContent ?? '').replace(/\s*\n\s*/g, ' '));
    else if (child instanceof HTMLBRElement) text += '\n';
    else if (child instanceof HTMLElement) {
      const inner = inlineText(child);
      const tag = child.tagName;
      if (!inner.trim()) text += inner;
      else if (tag === 'B' || tag === 'STRONG') text += `**${inner}**`;
      else if (tag === 'I' || tag === 'EM') text += `_${inner}_`;
      else if (child instanceof HTMLAnchorElement && safeHref(child.getAttribute('href') ?? '')) {
        text += `[${inner}](${child.getAttribute('href')!.trim().replace(/[()\s]/g, encodeURIComponent)})`;
      } else text += inner;
    }
  });
  return text;
}

const clean = (text: string) => text.replace(/[ \t]+\n/g, '\n').replace(/\n+$/, '').trim();

function blocksFrom(root: Node): string[] {
  const blocks: string[] = [];
  let loose: Node[] = [];
  const flushLoose = () => {
    if (!loose.length) return;
    const holder = document.createElement('p');
    loose.forEach((n) => holder.appendChild(n.cloneNode(true)));
    const text = clean(inlineText(holder));
    if (text) blocks.push(text.split('\n').map(escapeStart).join('\n'));
    loose = [];
  };
  root.childNodes.forEach((node) => {
    if (!isBlock(node)) {
      loose.push(node);
      return;
    }
    flushLoose();
    const element = node as HTMLElement;
    const tag = element.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const text = clean(inlineText(element)).replace(/\n/g, ' ');
      if (text) blocks.push(`## ${text}`);
    } else if (tag === 'UL' || tag === 'OL') {
      const items = [...element.children].map((li) => clean(inlineText(li)).replace(/\n/g, ' ')).filter(Boolean);
      if (items.length) blocks.push(items.map((item, i) => (tag === 'UL' ? `- ${item}` : `${i + 1}. ${item}`)).join('\n'));
    } else if (tag === 'BLOCKQUOTE') {
      const text = blocksFrom(element).join('\n');
      if (text) blocks.push(text.split('\n').map((l) => `> ${l}`).join('\n'));
    } else if ([...element.childNodes].some(isBlock)) {
      blocks.push(...blocksFrom(element));
    } else {
      const text = clean(inlineText(element));
      if (text) blocks.push(text.split('\n').map(escapeStart).join('\n'));
    }
  });
  flushLoose();
  return blocks;
}

export const postTextFrom = (root: HTMLElement) => blocksFrom(root).join('\n\n');
