import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeAdvanceInput } from './typingNormalize.js';

test('normalizeAdvanceInput trims trailing whitespace used for advancing', () => {
  assert.equal(normalizeAdvanceInput('hello'), 'hello');
  assert.equal(normalizeAdvanceInput('hello '), 'hello');
  assert.equal(normalizeAdvanceInput('hello\r\n'), 'hello');
  assert.equal(normalizeAdvanceInput('hello\t'), 'hello');
});
