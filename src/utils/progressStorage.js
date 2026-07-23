import { debug } from './debug.js';

const STORAGE_PREFIX = 'typing-stories-progress';

function isStorageAvailable() {
  try {
    const key = `${STORAGE_PREFIX}:test`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function getProgressKey(storyId) {
  return `${STORAGE_PREFIX}:${storyId}`;
}

export function loadProgress(storyId) {
  if (!storyId || !isStorageAvailable()) return null;

  try {
    const raw = localStorage.getItem(getProgressKey(storyId));
    if (!raw) return null;

    const progress = JSON.parse(raw);
    debug.log('Progress', 'Loaded saved progress:', { storyId, ...progress });
    return progress;
  } catch (error) {
    debug.warn('Progress', 'Failed to load progress:', error);
    return null;
  }
}

export function saveProgress(storyId, progress) {
  if (!storyId || !isStorageAvailable()) return false;

  try {
    const payload = {
      ...progress,
      updatedAt: Date.now(),
    };
    localStorage.setItem(getProgressKey(storyId), JSON.stringify(payload));
    debug.log('Progress', 'Saved progress:', { storyId, ...payload });
    return true;
  } catch (error) {
    debug.warn('Progress', 'Failed to save progress:', error);
    return false;
  }
}

export function clearProgress(storyId) {
  if (!storyId || !isStorageAvailable()) return;
  localStorage.removeItem(getProgressKey(storyId));
  debug.log('Progress', 'Cleared progress for:', storyId);
}

export function isProgressStorageAvailable() {
  return isStorageAvailable();
}
