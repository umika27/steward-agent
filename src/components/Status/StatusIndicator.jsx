import React from 'react';
import { STATUS_METADATA, STEWARD_STATUSES } from '../../mock/mockStewardInput';
import './StatusIndicator.css';

/**
 * StatusIndicator Component
 *
 * Visual indicator showing the current Steward state (IDLE, THINKING, PROCESSING, RESPONDING, etc.)
 * Strictly presents status received via props.
 */
export const StatusIndicator = ({ status = STEWARD_STATUSES.IDLE, showDescription = false }) => {
  const meta = STATUS_METADATA[status] || STATUS_METADATA[STEWARD_STATUSES.IDLE];

  return (
    <div
      className={`status-indicator is-${status}`}
      style={{
        '--status-color': meta.color,
        '--status-glow': `${meta.color}40`,
      }}
      aria-label={`Current Steward status: ${meta.label}`}
    >
      <div className="status-dot-container">
        <div className="status-dot-ping" />
        <div className="status-dot" />
      </div>

      <div className="status-details">
        <div className="status-header-row">
          <span className="status-label">{meta.label}</span>
          <span className="status-tag">STEWARD</span>
        </div>
        {showDescription && (
          <span className="status-description" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {meta.description}
          </span>
        )}
      </div>
    </div>
  );
};
