import { useCallback, useEffect, useRef, useState } from 'react';
import ePub from 'epubjs';
import TypingEngine from './components/TypingEngine.jsx';
import { buildChapterCatalog, loadFirstReadableChapter, loadLastReadableChapter } from './utils/epubChapters.js';
import { debug } from './utils/debug.js';
import {
  clearProgress,
  isProgressStorageAvailable,
  loadProgress,
  saveProgress,
} from './utils/progressStorage.js';

function describeSource(source) {
  if (typeof source === 'string') return { type: 'url', value: source };
  if (source instanceof File) return { type: 'file', name: source.name, size: source.size };
  if (source instanceof Blob) return { type: 'blob', size: source.size };
  return { type: typeof source, value: source };
}

function getStoryId(source, story) {
  if (story?.filename) return story.filename;
  if (typeof source === 'string') return source.replace(/^\//, '');
  if (source instanceof File) return `upload:${source.name}:${source.size}`;
  return 'unknown';
}

export default function App() {
  const [stories, setStories] = useState([]);
  const [loadingStories, setLoadingStories] = useState(true);
  const [storiesError, setStoriesError] = useState(null);

  const [typingText, setTypingText] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [contentError, setContentError] = useState(null);

  const [epubBook, setEpubBook] = useState(null);
  const [epubChapters, setEpubChapters] = useState([]);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [chapterTitle, setChapterTitle] = useState('');
  const [showChapterControls, setShowChapterControls] = useState(false);
  const [wpm, setWpm] = useState(0);

  const [storyId, setStoryId] = useState(null);
  const [savedWordIndex, setSavedWordIndex] = useState(0);
  const [progressHint, setProgressHint] = useState(null);
  const [typingFocused, setTypingFocused] = useState(false);

  const progressSaveTimer = useRef(null);

  useEffect(() => {
    debug.log('Library', 'Fetching /stories.json...');

    fetch('/stories.json')
      .then((response) => {
        debug.log('Library', 'Response status:', response.status, response.statusText);
        if (!response.ok) throw new Error('Failed to load library.');
        return response.json();
      })
      .then((data) => {
        const filtered = data.filter((story) => story.type !== 'pdf');
        debug.log('Library', `Loaded ${filtered.length} stories (skipped PDFs):`, filtered);
        setStories(filtered);
        setStoriesError(null);
      })
      .catch((error) => {
        debug.error('Library', 'Failed to load stories.json:', error);
        setStoriesError(error.message);
      })
      .finally(() => {
        setLoadingStories(false);
      });
  }, []);

  const persistProgress = useCallback(
    (nextChapterIndex, wordIndex, label) => {
      if (!storyId) return;

      if (progressSaveTimer.current) {
        clearTimeout(progressSaveTimer.current);
      }

      progressSaveTimer.current = setTimeout(() => {
        saveProgress(storyId, {
          chapterIndex: nextChapterIndex,
          wordIndex,
          chapterLabel: label,
        });
        setProgressHint('Progress saved');
      }, 300);
    },
    [storyId],
  );

  const goToChapter = useCallback(
    async (book, chapters, index, wordIndex = 0, direction = 'forward') => {
      if (!chapters.length) return;

      const clampedIndex = Math.max(0, Math.min(index, chapters.length - 1));

      setLoadingContent(true);
      setContentError(null);

      try {
        let result = null;

        if (direction === 'forward') {
          result = await loadFirstReadableChapter(book, chapters, clampedIndex);
        } else if (direction === 'backward') {
          result = await loadLastReadableChapter(book, chapters, clampedIndex);
        }

        if (!result) {
          setChapterIndex(clampedIndex);
          setChapterTitle(chapters[clampedIndex]?.label || '');
          setTypingText('');
          setSavedWordIndex(0);
          setProgressHint('This section has no typing text — use Next or Prev to continue');
          debug.warn('EPUB', `No readable text near chapter ${clampedIndex + 1}, navigation still available`);
          return;
        }

        const { index: resolvedIndex, chapter, text } = result;

        setChapterIndex(resolvedIndex);
        setChapterTitle(chapter.label);
        setSavedWordIndex(wordIndex);
        setTypingText(text);
        setProgressHint(wordIndex > 0 ? `Resumed ${chapter.label} from saved progress` : null);

        debug.log('EPUB', `Loaded chapter ${resolvedIndex + 1}/${chapters.length}:`, chapter.label);
      } catch (error) {
        debug.error('EPUB', `Failed to load chapter ${clampedIndex}:`, error);
        setChapterIndex(clampedIndex);
        setChapterTitle(chapters[clampedIndex]?.label || '');
        setTypingText('');
        setProgressHint('Could not load this section — use Next or Prev to continue');
      } finally {
        setLoadingContent(false);
      }
    },
    [],
  );

  const openEpub = useCallback(
    async (source, story = null) => {
      debug.group('EPUB', 'openEpub');
      debug.log('EPUB', 'Source:', describeSource(source));

      const activeStoryId = getStoryId(source, story);
      setStoryId(activeStoryId);
      setShowChapterControls(true);
      setLoadingContent(true);
      setContentError(null);
      setProgressHint(null);

      try {
        const book = ePub(source);
        setEpubBook(book);

        const metadata = await book.loaded.metadata;
        debug.log('EPUB', 'Metadata:', {
          title: metadata?.title,
          creator: metadata?.creator,
          language: metadata?.language,
        });

        const chapters = await buildChapterCatalog(book);
        if (!chapters.length) {
          setContentError('No chapters found in this EPUB.');
          setEpubChapters([]);
          setLoadingContent(false);
          return;
        }

        setEpubChapters(chapters);

        const saved = loadProgress(activeStoryId);
        const startChapter = saved?.chapterIndex ?? 0;
        const resumeWord =
          saved?.chapterIndex === startChapter ? saved?.wordIndex ?? 0 : 0;

        if (saved) {
          debug.log('EPUB', 'Restoring saved chapter index:', startChapter, 'word:', resumeWord);
        }

        await goToChapter(book, chapters, startChapter, resumeWord, 'forward');
      } catch (error) {
        debug.error('EPUB', 'Failed to open EPUB:', error);
        setContentError('Failed to open EPUB file.');
        setLoadingContent(false);
      } finally {
        debug.groupEnd();
      }
    },
    [goToChapter],
  );

  const openText = useCallback((text, activeStoryId) => {
    debug.log('Text', 'Opening text file:', {
      charLength: text.length,
      wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      preview: text.slice(0, 120),
    });

    setShowChapterControls(false);
    setEpubBook(null);
    setEpubChapters([]);
    setChapterIndex(0);
    setChapterTitle('');
    setContentError(null);
    setStoryId(activeStoryId);

    const saved = activeStoryId ? loadProgress(activeStoryId) : null;
    const wordIndex = saved?.wordIndex || 0;

    setSavedWordIndex(wordIndex);
    setTypingText(text);
    setLoadingContent(false);
    setProgressHint(saved && wordIndex > 0 ? 'Resumed from saved progress' : null);
  }, []);

  const handleStoryClick = async (story) => {
    debug.log('Story', 'Selected:', story);
    setLoadingContent(true);
    setContentError(null);

    if (story.type === 'txt') {
      try {
        const url = `/${story.filename}`;
        debug.log('Story', 'Fetching text from:', url);
        const response = await fetch(url);
        debug.log('Story', 'Text fetch status:', response.status, response.statusText);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        openText(text, story.filename);
      } catch (error) {
        debug.error('Story', 'Text load failed:', error);
        setContentError('Error loading text file.');
        setLoadingContent(false);
      }
      return;
    }

    if (story.type === 'epub') {
      await openEpub(`/${story.filename}`, story);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    debug.log('Upload', 'File selected:', { name: file.name, size: file.size, type: file.type });
    const filename = file.name.toLowerCase();
    const uploadId = getStoryId(file);

    if (filename.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        openText(loadEvent.target.result, uploadId);
      };
      reader.onerror = (loadError) => {
        debug.error('Upload', 'FileReader error:', loadError);
      };
      reader.readAsText(file);
      return;
    }

    if (filename.endsWith('.epub')) {
      openEpub(file);
      return;
    }

    debug.warn('Upload', 'Unsupported file type:', filename);
    alert('Please upload a .txt or .epub file.');
  };

  const handlePrevChapter = () => {
    if (epubBook && epubChapters.length && chapterIndex > 0) {
      goToChapter(epubBook, epubChapters, chapterIndex - 1, 0, 'backward');
    }
  };

  const handleNextChapter = () => {
    if (epubBook && epubChapters.length && chapterIndex < epubChapters.length - 1) {
      goToChapter(epubBook, epubChapters, chapterIndex + 1, 0, 'forward');
    }
  };

  const handleTypingProgress = useCallback(
    (wordIndex) => {
      if (!storyId) return;
      persistProgress(chapterIndex, wordIndex, chapterTitle);
    },
    [storyId, chapterIndex, chapterTitle, persistProgress],
  );

  const handleChapterComplete = useCallback(() => {
    if (!storyId) return;

    if (epubChapters.length && chapterIndex < epubChapters.length - 1) {
      saveProgress(storyId, {
        chapterIndex: chapterIndex + 1,
        wordIndex: 0,
        chapterLabel: epubChapters[chapterIndex + 1]?.label,
      });
      setProgressHint('Chapter complete — progress saved for next chapter');
    } else {
      saveProgress(storyId, {
        chapterIndex,
        wordIndex: 0,
        chapterLabel: chapterTitle,
        completed: true,
      });
      setProgressHint('Story complete — progress saved');
    }
  }, [storyId, epubChapters, chapterIndex, chapterTitle]);

  const handleClearProgress = () => {
    if (!storyId) return;
    clearProgress(storyId);
    setSavedWordIndex(0);
    setProgressHint('Saved progress cleared');
  };

  const totalChapters = epubChapters.length;
  const canGoPrev = chapterIndex > 0;
  const canGoNext = chapterIndex < totalChapters - 1;

  return (
    <div className={typingFocused ? 'app-shell typing-focused' : 'app-shell'}>
      <header>
        <h1>My Typing Stories</h1>
        <p>Type along with your favorite books.</p>
      </header>

      <main>
        <section className="controls-section">
          <div className="button-group">
            {loadingStories && <p className="loading-text">Loading library...</p>}
            {storiesError && <p className="error-text">{storiesError}</p>}
            {!loadingStories &&
              !storiesError &&
              stories.map((story) => (
                <button key={story.filename} type="button" onClick={() => handleStoryClick(story)}>
                  {story.title}
                </button>
              ))}
          </div>

          <div className="upload-area">
            <span>Or upload a local file: </span>
            <input type="file" accept=".txt,.epub" onChange={handleFileUpload} />
          </div>
        </section>

        <section className="viewer">
          <div className="stats-bar">
            <span className="wpm-display">WPM: {wpm}</span>
            {showChapterControls && totalChapters > 0 && (
              <div className="chapter-controls">
                <button type="button" onClick={handlePrevChapter} disabled={!canGoPrev}>
                  ❮ Prev
                </button>
                <span className="chapter-indicator">
                  Chapter {chapterIndex + 1} of {totalChapters}
                  {chapterTitle && <span className="chapter-title"> — {chapterTitle}</span>}
                </span>
                <button type="button" onClick={handleNextChapter} disabled={!canGoNext}>
                  Next ❯
                </button>
              </div>
            )}
          </div>

          {isProgressStorageAvailable() && storyId && typingText && (
            <div className="progress-bar-ui">
              <span className="progress-hint">
                {progressHint || 'Progress auto-saves to this browser'}
              </span>
              <button type="button" className="clear-progress-btn" onClick={handleClearProgress}>
                Clear saved progress
              </button>
            </div>
          )}

          {loadingContent && <p className="placeholder-text">Parsing file...</p>}
          {!loadingContent && contentError && <p className="error-text">{contentError}</p>}

          {!loadingContent && !contentError && !typingText && progressHint && (
            <p className="placeholder-text">{progressHint}</p>
          )}

          {!loadingContent && !contentError && !typingText && !progressHint && (
            <p className="placeholder-text">Select a story from above to begin typing.</p>
          )}

          {!loadingContent && !contentError && typingText && (
            <div className="typing-workspace">
              <TypingEngine
                key={`${storyId}-${chapterIndex}-${typingText.slice(0, 32)}`}
                text={typingText}
                initialWordIndex={savedWordIndex}
                onProgressChange={handleTypingProgress}
                onComplete={handleChapterComplete}
                onWpmChange={setWpm}
                onFocusModeChange={setTypingFocused}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
