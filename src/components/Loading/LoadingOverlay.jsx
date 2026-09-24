import React from 'react';
import poolBallImg from '../../../images/pool_ball.png';
import './LoadingOverlay.css';

/**
 * LoadingOverlay Component
 *
 * Full-viewport loading screen displayed between conversation turns.
 * Features:
 * - Large responsive pool_ball.png (220px - 320px)
 * - Zero blue/cyan glow or color filters (faithful to original image)
 * - Zero text, pills, or status labels (ONLY blurred backdrop + sharp pool ball)
 * - Continuous smooth CSS rotation
 * - Strong backdrop blur (backdrop-filter: blur(16px))
 * - High z-index (9999) covering full application viewport
 * - prefers-reduced-motion support
 */
export const LoadingOverlay = ({ isLoading }) => {
  if (!isLoading) return null;

  return (
    <div
      className="loading-overlay-backdrop"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="pool-ball-container">
        <img
          src={poolBallImg}
          alt="Loading indicator"
          className="pool-ball-spinner"
        />
      </div>
    </div>
  );
};
