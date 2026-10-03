import React from 'react';
import './AuthorityCard.css';

/**
 * AuthorityCard (Phase 3)
 * Displays quote amount vs autonomous spending authority bounds.
 * Read-only presentation layer — consumes values directly from mockCaseStore.
 */
export const AuthorityCard = ({ quote, authority }) => {
  if (!quote && !authority) return null;

  const amount = quote?.amount ?? 0;
  const currencySymbol = quote?.currency === 'INR' ? '₹' : (quote?.currency || '$');
  const formattedAmount = `${currencySymbol}${amount.toLocaleString('en-IN')}`;

  const limit = authority?.authorityLimit ?? 0;
  const formattedLimit = `${currencySymbol}${limit.toLocaleString('en-IN')}`;

  const withinAuthority = authority?.withinAuthority ?? false;
  const approvalRequired = authority?.approvalRequired ?? false;

  return (
    <div className="case-card authority-card">
      <div className="card-header">
        <span className="card-title-tag">SPENDING AUTHORITY</span>
        <span className="card-subtitle">{quote?.provider || 'PROVIDER QUOTE'}</span>
      </div>

      <div className="authority-grid">
        <div className="authority-metric">
          <span className="metric-label">CURRENT QUOTE</span>
          <span className="metric-value quote-val">{formattedAmount}</span>
        </div>

        <div className="authority-metric">
          <span className="metric-label">AUTHORITY LIMIT</span>
          <span className="metric-value limit-val">{formattedLimit}</span>
        </div>
      </div>

      <div className="authority-status-row">
        <div className="status-pill-group">
          <span className="pill-label">WITHIN AUTHORITY:</span>
          <span className={`pill-val ${withinAuthority ? 'is-success' : 'is-error'}`}>
            {withinAuthority ? 'YES' : 'NO'}
          </span>
        </div>

        <div className="status-pill-group">
          <span className="pill-label">APPROVAL REQUIRED:</span>
          <span className={`pill-val ${approvalRequired ? 'is-warning' : 'is-neutral'}`}>
            {approvalRequired ? 'YES' : 'NO'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthorityCard;
