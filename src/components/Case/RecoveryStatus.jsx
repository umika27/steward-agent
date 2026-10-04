import React from 'react';
import './RecoveryStatus.css';

/**
 * RecoveryStatus (Phase 5)
 * Displays recovery and re-assessment status when a case requires continuity after service failures or unverified outcomes.
 * Purely read-only presentation layer.
 */
export const RecoveryStatus = ({ currentCase, decision, recovery, timeline }) => {
  const isRecoveringState = currentCase?.currentState === 'RECOVERING' || currentCase?.status === 'REASSESSMENT_REQUIRED';
  const timelineRecovery = timeline ? timeline.find(e => e.type === 'RECOVERY') : null;
  const explicitRecovery = recovery || (isRecoveringState ? {
    status: 'REASSESSING',
    reason: 'Household reports issue remains unresolved.',
    nextState: decision?.action || 'REASSESS_REPAIR_VS_REPLACE',
  } : null);

  const isActive = Boolean(explicitRecovery);

  return (
    <div className={`case-card recovery-status-card ${isActive ? 'is-active' : 'is-inactive'}`}>
      <div className="card-header">
        <span className="card-title-tag">RECOVERY</span>
        <span className={`recovery-badge ${isActive ? 'status-reassessing' : 'status-none'}`}>
          {isActive ? (explicitRecovery.status || 'REASSESSING') : 'NOT ACTIVE'}
        </span>
      </div>

      {isActive ? (
        <div className="recovery-body">
          {explicitRecovery.reason && (
            <div className="recovery-row flex-col">
              <span className="recovery-label">Reason:</span>
              <span className="recovery-text">{explicitRecovery.reason}</span>
            </div>
          )}
          {explicitRecovery.nextState && (
            <div className="recovery-row">
              <span className="recovery-label">Next case state:</span>
              <span className="recovery-value font-mono">{explicitRecovery.nextState}</span>
            </div>
          )}
          {timelineRecovery?.description && (
            <p className="recovery-description">{timelineRecovery.description}</p>
          )}
        </div>
      ) : (
        <div className="recovery-body compact">
          <span className="inactive-text">Not active</span>
        </div>
      )}
    </div>
  );
};

export default RecoveryStatus;
