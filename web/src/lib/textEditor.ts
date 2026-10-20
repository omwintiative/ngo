/*
  Makes components/admin/TextEditor.astro work. `load` fills it from the
  limited format, `text` reads it back (lib/postText.ts); `onChange` runs on
  every edit, `onError` gets messages such as a refused link.
*/
import { renderPostText, postTextFrom, safeHref } from './postText';

export function setupTextEditor(
  root: HTMLElement,
  { onChange, onError }: { onChange: () => void; onError: (message: string) => void },
) {
  const editor = root.querySelector<HTMLElement>('[data-editor]')!;

  // execCommand is old but still the only built-in way to format inside an
  // editable area in every browser; what it produces is turned back into the
  // limited format on save, so stray markup never reaches the site.
  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.execCommand('styleWithCSS', false, 'false');

  // The text always sits in blocks: an empty editor gets one empty
  // paragraph, so the first line typed is a paragraph too.
  const markEmpty = () => {
    const empty = !editor.textContent?.trim() && !editor.querySelector('li');
    editor.toggleAttribute('data-empty', empty);
    if (empty && !editor.querySelector('p, h2, blockquote')) {
      const p = document.createElement('p');
      p.append(document.createElement('br'));
      editor.replaceChildren(p);
    }
  };

  const closestInEditor = (selector: string) => {
    const node = window.getSelection()?.anchorNode;
    const element = node instanceof Element ? node : node?.parentElement;
    const found = element?.closest(selector);
    return found && editor.contains(found) ? found : null;
  };

  const addLink = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
    const range = selection.getRangeAt(0);
    const existing = closestInEditor('a');
    let href = window.prompt('Link address', existing?.getAttribute('href') ?? 'https://')?.trim();
    if (href === undefined) return;
    if (!href || href === 'https://') {
      if (existing) document.execCommand('unlink');
      return;
    }
    if (/^www\./i.test(href)) href = `https://${href}`;
    if (!safeHref(href)) {
      onError('Links must start with https:// (or mailto: for an email address).');
      return;
    }
    if (selection.isCollapsed) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = href;
      range.insertNode(a);
      range.setStartAfter(a);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      document.execCommand('createLink', false, href);
    }
  };

  const tools: Record<string, () => void> = {
    heading: () => document.execCommand('formatBlock', false, closestInEditor('h2') ? '<p>' : '<h2>'),
    bold: () => document.execCommand('bold'),
    italic: () => document.execCommand('italic'),
    link: addLink,
    bullets: () => document.execCommand('insertUnorderedList'),
    numbers: () => document.execCommand('insertOrderedList'),
    quote: () => document.execCommand('formatBlock', false, closestInEditor('blockquote') ? '<p>' : '<blockquote>'),
  };

  const toolButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-tool]')];
  const updateTools = () => {
    const state: Record<string, boolean> = {
      heading: Boolean(closestInEditor('h2')),
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      link: Boolean(closestInEditor('a')),
      bullets: Boolean(closestInEditor('ul')),
      numbers: Boolean(closestInEditor('ol')),
      quote: Boolean(closestInEditor('blockquote')),
    };
    toolButtons.forEach((b) => b.setAttribute('aria-pressed', String(state[b.dataset.tool!] ?? false)));
  };

  toolButtons.forEach((button) => {
    // Keep the text selection in the editor while a tool is clicked.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => {
      if (!editor.contains(window.getSelection()?.anchorNode ?? null)) editor.focus();
      tools[button.dataset.tool!]();
      onChange();
      markEmpty();
      updateTools();
    });
  });

  // Pasted text arrives without its outside formatting.
  editor.addEventListener('paste', (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData?.getData('text/plain') ?? '');
  });
  editor.addEventListener('input', () => {
    onChange();
    markEmpty();
  });
  document.addEventListener('selectionchange', () => {
    if (editor.contains(window.getSelection()?.anchorNode ?? null)) updateTools();
  });

  markEmpty();
  return {
    load(text: string) {
      editor.replaceChildren(renderPostText(text));
      markEmpty();
    },
    text: () => postTextFrom(editor),
  };
}
