import React from 'react';
import './DecisionCard.css';

/**
 * DecisionCard (Phase 3)
 * Displays latest Steward decision, evidence, rule, and action.
 * Read-only presentation layer — consumes values directly from mockCaseStore.
 */
export const DecisionCard = ({ decision }) => {
  if (!decision) return null;

  const decisionType = decision.decision || 'NONE';
  const evidenceText = decision.evidence || 'No evidence recorded';
  const ruleText = decision.rule || 'No rule specified';
  const actionText = decision.action || 'NO_ACTION';
  const timestamp = decision.timestamp ? new Date(decision.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="case-card decision-card">
      <div className="card-header">
        <span className="card-title-tag">STEWARD DECISION</span>
        {timestamp && <span className="card-subtitle">{timestamp}</span>}
      </div>

      <div className="decision-main-badge">
        <span className="decision-label">DECISION:</span>
        <span className={`decision-value decision-${decisionType.toLowerCase()}`}>
          {decisionType}
        </span>
      </div>

      <div className="decision-detail-group">
        <div className="detail-item">
          <span className="detail-label">EVIDENCE:</span>
          <p className="detail-text">{evidenceText}</p>
        </div>

        <div className="detail-item">
          <span className="detail-label">RULE:</span>
          <p className="detail-text">{ruleText}</p>
        </div>

        <div className="detail-item">
          <span className="detail-label">ACTION:</span>
          <span className="action-tag">{actionText}</span>
        </div>
      </div>
    </div>
  );
};

export default DecisionCard;
