import React, { useEffect } from 'react';
import { useSpeechEngine } from '../../speech/useSpeechEngine';
import { SPEECH_STATES } from '../../speech/speechState';
import { ArrowRight, RotateCcw } from 'lucide-react';
import './SpeechBubble.css';

/**
 * SpeechBubble Component (Simplified Floating Interface)
 *
 * Renders ONLY the Butler response text and inline NEXT / RESTART action button.
 */
export const SpeechBubble = ({
  text,
  onSkipReady,
  onNextClick,
  isLastTurn = false,
  isLoading = false,
}) => {
  const { speechState, displayedText, skipReveal, isRevealing } = useSpeechEngine(text);

  useEffect(() => {
    if (onSkipReady) {
      onSkipReady(skipReveal);
    }
  }, [onSkipReady, skipReveal]);

  return (
    <div className="speech-bubble-container fade-in">
      <div className="speech-bubble-card">
        <div className="speech-bubble-tail" />

        <div className="speech-card-body">
          {/* Main Response Text Content */}
          <div className="speech-content">
            {speechState === SPEECH_STATES.IDLE ? (
              <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Awaiting Steward transmission...
              </span>
            ) : (
              <>
                {displayedText}
                {isRevealing && <span className="speech-typing-cursor" aria-hidden="true" />}
              </>
            )}
          </div>

          {/* Inline NEXT / RESTART Action Button Positioned Right Inside Text Box */}
          <button
            type="button"
            className={`speech-inline-next-btn ${isLastTurn ? 'restart-btn' : ''}`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent drag event trigger on button click
              if (onNextClick) onNextClick();
            }}
            disabled={isLoading}
            aria-label={isLastTurn ? 'Restart Demonstration' : 'Advance to Next Conversation Turn'}
          >
            {isLastTurn ? (
              <>
                <span>RESTART</span>
                <RotateCcw size={15} />
              </>
            ) : (
              <>
                <span>NEXT</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
