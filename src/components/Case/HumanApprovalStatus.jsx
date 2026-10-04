import React from 'react';
import './HumanApprovalStatus.css';

/**
 * HumanApprovalStatus (Phase 5)
 * Displays human approval requirements when spending/actions exceed autonomous boundaries.
 * Read-only presentation layer — consumes authority & quote directly from mockCaseStore.
 */
export const HumanApprovalStatus = ({ authority, quote }) => {
  const isRequired = authority?.approvalRequired ?? false;
  const amount = quote?.amount ? `₹${quote.amount.toLocaleString('en-IN')}` : 'N/A';
  const limit = authority?.authorityLimit ? `₹${authority.authorityLimit.toLocaleString('en-IN')}` : 'N/A';

  return (
    <div className={`case-card human-approval-card ${isRequired ? 'is-required' : 'is-inactive'}`}>
      <div className="card-header">
        <span className="card-title-tag">HUMAN APPROVAL</span>
        <span className={`approval-badge ${isRequired ? 'status-required' : 'status-none'}`}>
          {isRequired ? 'REQUIRED' : 'NOT REQUIRED'}
        </span>
      </div>

      {isRequired ? (
        <div className="approval-body">
          <p className="approval-reason">
            Repair quote ({amount}) exceeds autonomous spending limit ({limit}). Explicit household authorization required.
          </p>
          <div className="approval-meta">
            <span className="meta-item">QUOTE: <strong>{amount}</strong></span>
            <span className="meta-item">LIMIT: <strong>{limit}</strong></span>
          </div>
        </div>
      ) : (
        <div className="approval-body compact">
          <span className="inactive-text">Quote is within autonomous authority. No human intervention needed.</span>
        </div>
      )}
    </div>
  );
};

export default HumanApprovalStatus;
