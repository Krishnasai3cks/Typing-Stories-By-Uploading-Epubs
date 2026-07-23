export const EM_DASH = '—';
const EM_DASH_TYPED = '---';
const CURLY_APOSTROPHE = '\u2019';
const CURLY_OPEN_APOSTROPHE = '\u2018';
const STRAIGHT_APOSTROPHE = "'";

const APOSTROPHE_CHARS = new Set([STRAIGHT_APOSTROPHE, CURLY_APOSTROPHE, CURLY_OPEN_APOSTROPHE]);

export function isApostrophe(char) {
  return APOSTROPHE_CHARS.has(char);
}

export function expandEmDash(text) {
  return text.replace(/—/g, EM_DASH_TYPED);
}

export function normalizeForTyping(text) {
  return expandEmDash(text).replace(/[\u2018\u2019]/g, STRAIGHT_APOSTROPHE);
}

export function wordsMatch(targetWord, typedWord) {
  if (typedWord === targetWord) return true;
  return typedWord === normalizeForTyping(targetWord);
}

function matchTargetChar(char, typed, typedIndex) {
  if (char === EM_DASH) {
    const typedSlice = typed.slice(typedIndex, typedIndex + EM_DASH_TYPED.length);

    if (typedSlice === EM_DASH_TYPED) {
      return { matched: true, consumed: EM_DASH_TYPED.length };
    }
    if (EM_DASH_TYPED.startsWith(typedSlice) && typedSlice.length > 0) {
      return { matched: true, consumed: typedSlice.length, partial: true };
    }
    if (typedSlice.length > 0) {
      return { matched: false, consumed: typedSlice.length };
    }
    return { matched: null, consumed: 0 };
  }

  if (isApostrophe(char)) {
    if (typedIndex >= typed.length) return { matched: null, consumed: 0 };
    if (isApostrophe(typed[typedIndex])) {
      return { matched: true, consumed: 1 };
    }
    return { matched: false, consumed: 1 };
  }

  if (typedIndex >= typed.length) return { matched: null, consumed: 0 };
  if (typed[typedIndex] === char) return { matched: true, consumed: 1 };
  return { matched: false, consumed: 1 };
}

export function renderActiveWordHtml(targetWord, typed) {
  let html = '';
  let typedIndex = 0;

  for (let i = 0; i < targetWord.length; i += 1) {
    const char = targetWord[i];
    const result = matchTargetChar(char, typed, typedIndex);

    if (result.matched === true) {
      html += `<span class="correct">${char}</span>`;
      typedIndex += result.consumed;
    } else if (result.matched === false) {
      html += `<span class="incorrect">${char}</span>`;
      typedIndex += result.consumed;
    } else {
      html += `<span class="pending">${char}</span>`;
    }
  }

  if (typedIndex < typed.length) {
    html += `<span class="incorrect">${typed.slice(typedIndex)}</span>`;
  }

  return html;
}
