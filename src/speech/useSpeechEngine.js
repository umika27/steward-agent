import { useState, useEffect, useRef, useCallback } from 'react';
import { SPEECH_STATES } from './speechState';

/**
 * Custom Hook: useSpeechEngine
 *
 * Manages the visual speech communication lifecycle (RECEIVING → REVEALING → COMPLETE).
 *
 * Features:
 * - Progressive text reveal without external animation libraries
 * - Instant skip functionality
 * - Identical text change protection
 * - Automatic reduced-motion detection
 * - Timer cleanup on unmount or payload updates
 */
export function useSpeechEngine(incomingText, options = {}) {
  const { speedMs = 18, instantReveal = false } = options;

  const [speechState, setSpeechState] = useState(
    incomingText ? SPEECH_STATES.COMPLETE : SPEECH_STATES.IDLE
  );
  const [displayedText, setDisplayedText] = useState(incomingText || '');
  const [fullText, setFullText] = useState(incomingText || '');

  const timerRef = useRef(null);
  const stepTimerRef = useRef(null);
  const lastProcessedTextRef = useRef(incomingText || '');

  // Skip reveal and immediately display complete text
  const skipReveal = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);

    if (fullText) {
      setDisplayedText(fullText);
      setSpeechState(SPEECH_STATES.COMPLETE);
    }
  }, [fullText]);

  useEffect(() => {
    // Check if incoming text is identical to last processed text
    if (incomingText === lastProcessedTextRef.current && speechState !== SPEECH_STATES.IDLE) {
      return;
    }

    lastProcessedTextRef.current = incomingText;

    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);

    // Empty text handling
    if (!incomingText || !incomingText.trim()) {
      setFullText('');
      setDisplayedText('');
      setSpeechState(SPEECH_STATES.IDLE);
      return;
    }

    setFullText(incomingText);

    // Reduced motion or explicit instant reveal check
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (instantReveal || prefersReducedMotion) {
      setDisplayedText(incomingText);
      setSpeechState(SPEECH_STATES.COMPLETE);
      return;
    }

    // Step 1: RECEIVING phase
    setSpeechState(SPEECH_STATES.RECEIVING);
    setDisplayedText('');

    // Step 2: Transition to REVEALING phase after brief preparation delay
    timerRef.current = setTimeout(() => {
      setSpeechState(SPEECH_STATES.REVEALING);

      let index = 0;
      const totalLen = incomingText.length;
      // Reveal 1-2 characters per tick for smooth, readable speed
      const stepChunk = totalLen > 140 ? 3 : totalLen > 80 ? 2 : 1;

      stepTimerRef.current = setInterval(() => {
        index += stepChunk;
        if (index >= totalLen) {
          setDisplayedText(incomingText);
          setSpeechState(SPEECH_STATES.COMPLETE);
          clearInterval(stepTimerRef.current);
        } else {
          setDisplayedText(incomingText.slice(0, index));
        }
      }, speedMs);
    }, 70);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [incomingText, instantReveal, speedMs]);

  return {
    speechState,
    displayedText,
    fullText,
    skipReveal,
    isRevealing: speechState === SPEECH_STATES.REVEALING,
    isComplete: speechState === SPEECH_STATES.COMPLETE,
  };
}
