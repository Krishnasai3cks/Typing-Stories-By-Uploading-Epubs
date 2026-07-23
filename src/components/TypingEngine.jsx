import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debug } from '../utils/debug.js';
import { renderActiveWordHtml, wordsMatch } from '../utils/typingNormalize.js';
import { parseTypingText } from '../utils/textTokens.js';

const IDLE_PAUSE_MS = 2000;

export default function TypingEngine({
  text,
  initialWordIndex = 0,
  onComplete,
  onProgressChange,
  onWpmChange,
  onFocusModeChange,
}) {
  const { words: wordsArray, breaksAfter } = useMemo(() => parseTypingText(text), [text]);

  const [currentWordIndex, setCurrentWordIndex] = useState(initialWordIndex);
  const [inputValue, setInputValue] = useState('');
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const activeWordRef = useRef(null);
  const inputRef = useRef(null);
  const restoredRef = useRef(false);
  const idleTimerRef = useRef(null);

  const totalActiveMsRef = useRef(0);
  const segmentStartRef = useRef(null);
  const isPausedRef = useRef(true);
  const hasStartedRef = useRef(false);

  const getTotalActiveMs = useCallback(() => {
    let total = totalActiveMsRef.current;
    if (!isPausedRef.current && segmentStartRef.current) {
      total += Date.now() - segmentStartRef.current;
    }
    return total;
  }, []);

  const pauseTiming = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (!isPausedRef.current && segmentStartRef.current) {
      totalActiveMsRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = null;
    }

    isPausedRef.current = true;
    setIsPaused(true);
  }, []);

  const resumeTiming = useCallback(() => {
    if (!hasStartedRef.current || isComplete) return;

    isPausedRef.current = false;
    segmentStartRef.current = Date.now();
    setIsPaused(false);
  }, [isComplete]);

  const scheduleIdlePause = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      pauseTiming();
    }, IDLE_PAUSE_MS);
  }, [pauseTiming]);

  const recordActivity = useCallback(() => {
    hasStartedRef.current = true;
    setHasStarted(true);
    resumeTiming();
    scheduleIdlePause();
  }, [resumeTiming, scheduleIdlePause]);

  const resetTiming = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    totalActiveMsRef.current = 0;
    segmentStartRef.current = null;
    isPausedRef.current = true;
    hasStartedRef.current = false;
    setHasStarted(false);
    setIsPaused(false);
  }, []);

  useEffect(() => {
    const safeIndex = Math.min(Math.max(initialWordIndex, 0), Math.max(wordsArray.length - 1, 0));

    debug.log('Engine', 'Reset for new text:', {
      wordCount: wordsArray.length,
      initialWordIndex: safeIndex,
      preview: wordsArray.slice(0, 8).join(' '),
    });

    resetTiming();
    setCurrentWordIndex(safeIndex);
    setInputValue('');
    setCorrectKeystrokes(0);
    setWpm(0);
    setIsComplete(false);
    setShakeError(false);
    restoredRef.current = safeIndex > 0;
    onFocusModeChange?.(false);
    inputRef.current?.focus();
  }, [text, initialWordIndex, resetTiming, onFocusModeChange]);

  useEffect(() => {
    onWpmChange?.(0);
  }, [text, onWpmChange]);

  useEffect(() => {
    onWpmChange?.(wpm);
  }, [wpm, onWpmChange]);

  useEffect(() => {
    onProgressChange?.(currentWordIndex);
  }, [currentWordIndex, onProgressChange]);

  useEffect(() => {
    if (isComplete || correctKeystrokes === 0 || !hasStartedRef.current) return undefined;

    const interval = setInterval(() => {
      if (isPausedRef.current) return;

      const minutes = getTotalActiveMs() / 60000;
      if (minutes <= 0) return;
      setWpm(Math.round((correctKeystrokes / 5) / minutes));
    }, 1000);

    return () => clearInterval(interval);
  }, [correctKeystrokes, isComplete, isPaused, getTotalActiveMs]);

  useEffect(() => {
    activeWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentWordIndex]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    [],
  );

  const handleFocus = () => {
    if (isComplete) return;

    onFocusModeChange?.(true);

    if (hasStartedRef.current) {
      resumeTiming();
      scheduleIdlePause();
    }
  };

  const handleBlur = () => {
    pauseTiming();
    onFocusModeChange?.(false);
  };

  const handleInput = (event) => {
    if (isComplete) return;
    recordActivity();
    setInputValue(event.target.value.replace(/[\r\n]/g, ''));
  };

  const tryAdvanceWord = (event) => {
    const currentWord = wordsArray[currentWordIndex];
    if (!wordsMatch(currentWord, inputValue)) {
      debug.warn('Engine', 'Advance blocked — word mismatch:', {
        expected: currentWord,
        typed: inputValue,
        wordIndex: currentWordIndex,
      });
      event.preventDefault();
      setShakeError(true);
      setTimeout(() => setShakeError(false), 200);
      return;
    }

    event.preventDefault();

    const nextKeystrokes = correctKeystrokes + inputValue.length + 1;
    setCorrectKeystrokes(nextKeystrokes);

    const nextIndex = currentWordIndex + 1;
    setCurrentWordIndex(nextIndex);
    setInputValue('');

    if (nextIndex % 50 === 0) {
      debug.log('Engine', 'Progress:', { wordIndex: nextIndex, total: wordsArray.length, wpm });
    }

    if (nextIndex >= wordsArray.length) {
      pauseTiming();
      debug.log('Engine', 'Chapter complete!', { totalWords: wordsArray.length, keystrokes: nextKeystrokes });
      setIsComplete(true);
      onComplete?.();
    }
  };

  const handleKeyDown = (event) => {
    if (isComplete) return;

    recordActivity();

    const isSpace = event.key === ' ' || event.code === 'Space';
    const isEnter = event.key === 'Enter';
    if (!isSpace && !isEnter) return;

    tryAdvanceWord(event);
  };

  if (wordsArray.length === 0) {
    return <p className="placeholder-text">No text available to type.</p>;
  }

  return (
    <>
      {restoredRef.current && currentWordIndex > 0 && (
        <p className="progress-restored">Resumed from word {currentWordIndex + 1}</p>
      )}

      <div className="viewer-content">
        {wordsArray.map((word, index) => {
          const wordNode =
            index < currentWordIndex ? (
              <span key={`word-${index}`} className="word completed">
                {word}
              </span>
            ) : index === currentWordIndex ? (
              <span
                key={`word-${index}`}
                ref={activeWordRef}
                className="word active"
                dangerouslySetInnerHTML={{
                  __html: renderActiveWordHtml(word, inputValue),
                }}
              />
            ) : (
              <span key={`word-${index}`} className="word pending">
                {word}
              </span>
            );

          return (
            <span key={index} className="word-group">
              {wordNode}
              {breaksAfter.has(index) && <span className="paragraph-break" aria-hidden="true" />}
            </span>
          );
        })}
      </div>

      <div className="input-container">
        <input
          ref={inputRef}
          type="text"
          className={`typing-input${shakeError ? ' error-shake' : ''}`}
          value={isComplete ? 'Chapter Complete!' : inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={isComplete}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="Start typing here..."
        />
        {isPaused && hasStarted && !isComplete && (
          <p className="timer-paused">Timer paused — click input or keep typing to resume</p>
        )}
      </div>
    </>
  );
}
