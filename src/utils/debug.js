const PREFIX = '[TypingStories]';

function isDev() {
  return import.meta.env.DEV;
}

function formatArgs(scope, args) {
  return [`${PREFIX}${scope ? ` ${scope}` : ''}`, ...args];
}

export const debug = {
  log(scope, ...args) {
    if (!isDev()) return;
    console.log(...formatArgs(scope, args));
  },

  warn(scope, ...args) {
    if (!isDev()) return;
    console.warn(...formatArgs(scope, args));
  },

  error(scope, ...args) {
    if (!isDev()) return;
    console.error(...formatArgs(scope, args));
  },

  group(scope, label) {
    if (!isDev()) return;
    console.group(`${PREFIX}${scope ? ` ${scope}` : ''} ${label}`);
  },

  groupEnd() {
    if (!isDev()) return;
    console.groupEnd();
  },

  table(scope, data) {
    if (!isDev()) return;
    console.log(`${PREFIX}${scope ? ` ${scope}` : ''}`);
    console.table(data);
  },
};
