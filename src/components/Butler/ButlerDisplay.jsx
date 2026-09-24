import React, { useEffect, useState, useRef } from 'react';
import { resolveContextualEmotion } from '../../emotions/contextResolver';
import { preloadEmotionAssets } from '../../emotions/emotionDefinitions';
import { UserCheck } from 'lucide-react';
import './ButlerDisplay.css';

/**
 * ButlerDisplay Component (Final Development Pass)
 *
 * Primary visual identity of the Butler assistant.
 * Accepts status, context, overrideEmotion, and showDebug props.
 */
export const ButlerDisplay = ({
  status,
  context = {},
  overrideEmotion = null,
  showDebug = false,
}) => {
  useEffect(() => {
    preloadEmotionAssets();
  }, []);

  // Resolve contextual emotion & resolution reason via deterministic cascade
  const resolutionResult = resolveContextualEmotion(status, context, overrideEmotion);
  const targetEmotion = resolutionResult.emotion;
  const resolutionReason = resolutionResult.reason;

  const [activeEmotion, setActiveEmotion] = useState(targetEmotion);
  const [prevEmotion, setPrevEmotion] = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [isEnterAnimating, setIsEnterAnimating] = useState(false);

  const currentEmotionIdRef = useRef(targetEmotion.id);

  useEffect(() => {
    if (targetEmotion.id === currentEmotionIdRef.current && prevEmotion === null) {
      return;
    }

    if (targetEmotion.id !== currentEmotionIdRef.current) {
      setPrevEmotion(activeEmotion);
      setActiveEmotion(targetEmotion);
      setIsCrossfading(true);
      setIsEnterAnimating(true);
      currentEmotionIdRef.current = targetEmotion.id;

      const crossfadeTimer = setTimeout(() => {
        setPrevEmotion(null);
        setIsCrossfading(false);
      }, 420);

      const enterAnimTimer = setTimeout(() => {
        setIsEnterAnimating(false);
      }, 450);

      return () => {
        clearTimeout(crossfadeTimer);
        clearTimeout(enterAnimTimer);
      };
    }
  }, [targetEmotion.id]);

  const animConfig = activeEmotion.animation || {};
  const currentAnimClass = isEnterAnimating
    ? animConfig.enterClass || 'enter-attentive'
    : animConfig.idleClass || 'idle-attentive';

  return (
    <div
      className={`butler-display-container emotion-${activeEmotion.id}`}
      style={{
        '--emotion-color': activeEmotion.ambientColor,
      }}
      aria-label={`Butler Assistant — Current Emotion: ${activeEmotion.label}`}
    >
      {/* Ambient Layer */}
      <div className="butler-ambient-layer">
        <div className="butler-backdrop-glow" />
        <div className="butler-floor-light" />
        <div className="butler-shadow-platform" />
      </div>

      {/* Character Crossfade & Animation Stack */}
      <div className="butler-character-layer">
        <div className="butler-frame">
          {/* Fading Out Previous Emotion Image */}
          {isCrossfading && prevEmotion && (
            <img
              src={prevEmotion.image}
              alt={`Butler ${prevEmotion.label} state`}
              className="butler-character-image is-fading-out"
              aria-hidden="true"
            />
          )}

          {/* Active Emotion Image */}
          <img
            key={activeEmotion.id}
            src={activeEmotion.image}
            alt={`Steward Butler in ${activeEmotion.label} emotion state`}
            className={`butler-character-image ${currentAnimClass} ${
              isCrossfading ? 'is-fading-in' : ''
            }`}
            loading="eager"
          />

          <div className="butler-vignette-overlay" />
        </div>
      </div>
    </div>
  );
};
