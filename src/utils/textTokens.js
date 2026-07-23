export function parseTypingText(text) {
  const words = [];
  const breaksAfter = new Set();

  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphWords = paragraph.split(' ').filter(Boolean);
    paragraphWords.forEach((word) => words.push(word));

    if (paragraphIndex < paragraphs.length - 1 && words.length > 0) {
      breaksAfter.add(words.length - 1);
    }
  });

  return { words, breaksAfter };
}
