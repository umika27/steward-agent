import React from 'react';
import './VerificationStatus.css';

/**
 * VerificationStatus (Phase 5)
 * Displays household physical outcome verification details.
 * Communicates that Provider claim != Household verified outcome.
 * Purely read-only presentation layer.
 */
export const VerificationStatus = ({ verification }) => {
  const status = verification?.verificationStatus || 'PENDING';
  const providerClaim = verification?.providerClaim || null;
  const response = verification?.householdResponse;
  const householdResponse = typeof response === 'boolean' ? String(response) : response || null;

  return (
    <div className={`case-card verification-status-card status-${status.toLowerCase()}`}>
      <div className="card-header">
        <span className="card-title-tag">HOUSEHOLD VERIFICATION</span>
        <span className={`verification-badge badge-${status.toLowerCase()}`}>
          {status}
        </span>
      </div>

      <div className="verification-body">
        {providerClaim && (
          <div className="verification-row">
            <span className="verification-label">Provider Claim:</span>
            <span className="verification-value claim">{providerClaim}</span>
          </div>
        )}

        {householdResponse && (
          <div className="verification-row">
            <span className="verification-label">Outcome / Evidence:</span>
            <span className="verification-value outcome">{householdResponse}</span>
          </div>
        )}

        {!providerClaim && !householdResponse && (
          <div className="verification-body compact">
            <span className="inactive-text">Awaiting physical outcome verification</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationStatus;
