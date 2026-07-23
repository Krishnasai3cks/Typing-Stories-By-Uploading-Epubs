import { debug } from './debug.js';

const MIN_CHAPTER_LENGTH = 15;

const SKIP_HREF_PATTERN = /cover|colophon|wrap|toc\.(xhtml|ncx)/i;
const SKIP_LABEL_PATTERN = /^(table of contents|contents|cover|title page|copyright|dedication|acknowledgments?)$/i;

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'hr',
]);

function normalizeTitle(text) {
  return text?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim() || '';
}

function shouldSkipCandidate(item, bookTitle) {
  if (!item.href) return true;
  if (SKIP_HREF_PATTERN.test(item.href)) return true;

  const label = item.label?.trim().toLowerCase() || '';
  if (SKIP_LABEL_PATTERN.test(label)) return true;

  const titleNorm = normalizeTitle(bookTitle);
  const labelNorm = normalizeTitle(item.label);
  if (titleNorm && labelNorm && labelNorm === titleNorm) return true;

  return false;
}

function getBody(doc) {
  return doc?.getElementsByTagName?.('body')?.[0] || doc?.documentElement || null;
}

function parseHref(href) {
  const [path = '', fragment = ''] = href.split('#');
  return { path, fragment };
}

function findElement(doc, fragmentId) {
  if (!doc) return null;
  if (!fragmentId) return getBody(doc);

  return (
    doc.getElementById?.(fragmentId) ||
    doc.querySelector?.(`[id="${fragmentId}"]`) ||
    doc.querySelector?.(`a[name="${fragmentId}"]`)
  );
}

function nextNode(node) {
  if (node.firstChild) return node.firstChild;

  let current = node;
  while (current) {
    if (current.nextSibling) return current.nextSibling;
    current = current.parentNode;
  }

  return null;
}

function flushParagraph(currentParts, paragraphs) {
  const text = currentParts.join(' ').replace(/\s+/g, ' ').trim();
  if (text) paragraphs.push(text);
  currentParts.length = 0;
}

function extractTextBetween(startEl, endEl) {
  if (!startEl) return '';

  const paragraphs = [];
  const currentParts = [];
  let node = startEl;

  while (node) {
    if (endEl && node === endEl) break;

    if (node.nodeType === 1) {
      const tag = node.tagName?.toLowerCase();

      if (tag === 'script' || tag === 'style') {
        node = nextNode(node);
        continue;
      }

      if (tag === 'br' || tag === 'hr') {
        flushParagraph(currentParts, paragraphs);
        node = nextNode(node);
        continue;
      }

      if (BLOCK_TAGS.has(tag)) {
        flushParagraph(currentParts, paragraphs);
      } else if (!node.firstChild) {
        const text = node.textContent?.replace(/\s+/g, ' ').trim();
        if (text && tag !== 'img') currentParts.push(text);
      }
    } else if (node.nodeType === 3) {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text) currentParts.push(text);
    }

    node = nextNode(node);
  }

  flushParagraph(currentParts, paragraphs);
  return paragraphs.join('\n\n');
}

function flattenToc(items, result = []) {
  for (const item of items || []) {
    if (item.href) {
      result.push({
        label: item.label?.trim() || `Section ${result.length + 1}`,
        href: item.href,
      });
    }
    if (item.subitems?.length) flattenToc(item.subitems, result);
  }
  return result;
}

function cleanChapterLabel(label) {
  if (!label) return '';

  const chapterMatch = label.match(/CHAPTER\s+[IVXLCDM\d]+(?:\.|\b)/i);
  if (chapterMatch) {
    return chapterMatch[0].replace(/\.$/, '').toUpperCase();
  }

  return label.length > 80 ? `${label.slice(0, 77)}...` : label;
}

export async function buildChapterCatalog(book) {
  const navigation = await book.loaded.navigation;
  const metadata = await book.loaded.metadata;
  const flat = flattenToc(navigation.toc);
  const candidates = flat.filter((item) => !shouldSkipCandidate(item, metadata?.title));

  debug.log('EPUB', `TOC flattened to ${flat.length} items, ${candidates.length} chapter entries`);

  return candidates.map((chapter, index) => ({
    label: cleanChapterLabel(chapter.label) || `Chapter ${index + 1}`,
    href: chapter.href,
  }));
}

export async function extractChapterText(book, chapter, nextChapter) {
  const { path, fragment } = parseHref(chapter.href);
  const spine = await book.loaded.spine;
  const item = spine.get(path);

  if (!item) {
    throw new Error(`Spine item not found for ${path}`);
  }

  await item.load(book.load.bind(book));
  const doc = item.document;
  const body = getBody(doc);
  const startEl = findElement(doc, fragment) || body;

  if (!startEl) return '';

  let endEl = null;
  if (nextChapter) {
    const next = parseHref(nextChapter.href);
    if (next.path === path) {
      endEl = findElement(doc, next.fragment);
    }
  }

  const text = extractTextBetween(startEl, endEl);

  debug.log('EPUB', 'Chapter text extracted:', {
    label: chapter.label,
    href: chapter.href,
    textLength: text.length,
    preview: text.slice(0, 100) || '(empty)',
  });

  return text;
}

export async function loadChapterText(book, chapters, index) {
  if (index < 0 || index >= chapters.length) return null;

  const chapter = chapters[index];
  const nextChapter = chapters[index + 1];
  const text = await extractChapterText(book, chapter, nextChapter);

  if (text.length >= MIN_CHAPTER_LENGTH) {
    return { index, chapter, text };
  }

  return null;
}

export async function loadLastReadableChapter(book, chapters, startIndex) {
  let index = Math.min(startIndex, chapters.length - 1);

  while (index >= 0) {
    const result = await loadChapterText(book, chapters, index);
    if (result) return result;
    debug.warn('EPUB', `Chapter ${index} too short, trying previous`);
    index -= 1;
  }

  return null;
}

export async function loadFirstReadableChapter(book, chapters, startIndex = 0) {
  let index = Math.max(0, startIndex);

  while (index < chapters.length) {
    const result = await loadChapterText(book, chapters, index);
    if (result) return result;
    debug.warn('EPUB', `Chapter ${index} too short, trying next`);
    index += 1;
  }

  return null;
}

export { MIN_CHAPTER_LENGTH };
