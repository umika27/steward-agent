import React from 'react';
import './FailureStatus.css';

/**
 * FailureStatus (Phase 5)
 * Displays external or service exceptions/failures present in the active case data.
 * Purely read-only presentation layer.
 */
export const FailureStatus = ({ failure, commitment, timeline }) => {
  // Extract failure from explicit failure prop, or commitment status, or timeline event
  const explicitFailure = failure || null;
  const noShowFailure = commitment?.completionStatus === 'NO_SHOW' ? {
    type: 'SERVICE EXCEPTION',
    title: 'Technician no-show',
    affectedAction: 'Scheduled repair visit',
    status: 'FAILED',
    recorded: '14:00',
    description: 'Service provider failed to arrive at scheduled commitment time.',
  } : null;

  const timelineFailure = timeline ? timeline.find(e => e.status === 'FAILED' || e.type === 'FAILURE') : null;

  const activeFailure = explicitFailure || noShowFailure || (timelineFailure ? {
    type: 'SERVICE EXCEPTION',
    title: timelineFailure.label || 'Service Failure',
    affectedAction: timelineFailure.description || 'Service Action',
    status: 'FAILED',
    recorded: timelineFailure.timestamp ? new Date(timelineFailure.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
    description: timelineFailure.description || 'External action encountered failure.',
  } : null);

  const hasFailure = Boolean(activeFailure);

  return (
    <div className={`case-card failure-status-card ${hasFailure ? 'has-failure' : 'is-inactive'}`}>
      <div className="card-header">
        <span className="card-title-tag">SERVICE EXCEPTION</span>
        <span className={`failure-badge ${hasFailure ? 'status-failed' : 'status-none'}`}>
          {hasFailure ? (activeFailure.status || 'FAILED') : 'NONE'}
        </span>
      </div>

      {hasFailure ? (
        <div className="failure-body">
          <div className="failure-title">{activeFailure.title || activeFailure.type || 'Service Exception'}</div>
          {activeFailure.affectedAction && (
            <div className="failure-row">
              <span className="failure-label">Affected action:</span>
              <span className="failure-value">{activeFailure.affectedAction}</span>
            </div>
          )}
          {activeFailure.recorded && (
            <div className="failure-row">
              <span className="failure-label">Recorded:</span>
              <span className="failure-value font-mono">{activeFailure.recorded}</span>
            </div>
          )}
          {activeFailure.description && (
            <p className="failure-description">{activeFailure.description}</p>
          )}
        </div>
      ) : (
        <div className="failure-body compact">
          <span className="inactive-text">No active exception</span>
        </div>
      )}
    </div>
  );
};

export default FailureStatus;
