import React from 'react';
import './CommitmentStatus.css';

/**
 * CommitmentStatus (Phase 4)
 * Displays external provider commitments, appointments, and fulfillment status.
 * Read-only presentation layer — consumes data directly from mockCaseStore.
 */
export const CommitmentStatus = ({ commitment }) => {
  if (!commitment) return null;

  const provider = commitment.provider || 'N/A';
  const status = commitment.status || 'NONE';
  const completionStatus = commitment.completionStatus || null;

  const formatTime = (isoString) => {
    if (!isoString) return 'Not scheduled';
    try {
      const d = new Date(isoString);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (_) {
      return isoString;
    }
  };

  const appointmentTime = formatTime(commitment.appointment || commitment.expectedTime);

  return (
    <div className="case-card commitment-status-card">
      <div className="card-header">
        <span className="card-title-tag">SERVICE COMMITMENT</span>
        <span className="card-subtitle">{provider}</span>
      </div>

      <div className="commitment-body">
        <div className="commitment-info-group">
          <div className="info-item">
            <span className="info-label">EXPECTED APPOINTMENT:</span>
            <span className="info-val highlight">{appointmentTime}</span>
          </div>

          {completionStatus && (
            <div className="info-item">
              <span className="info-label">COMPLETION STATUS:</span>
              <span className={`status-pill status-${completionStatus.toLowerCase()}`}>
                {completionStatus}
              </span>
            </div>
          )}
        </div>

        <div className="commitment-badge-box">
          <span className="badge-label">BOOKING STATUS</span>
          <span className={`commitment-status-pill state-${status.toLowerCase()}`}>
            {status}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommitmentStatus;
