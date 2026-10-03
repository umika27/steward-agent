import React from 'react';
import './MachineMemoryCard.css';

/**
 * MachineMemoryCard (Phase 3)
 * Displays persistent machine identity, historical repairs, and cumulative repair cost.
 * Read-only presentation layer — consumes data directly from mockCaseStore.
 */
export const MachineMemoryCard = ({ machine, memory }) => {
  if (!machine && !memory) return null;

  const incidents = memory?.previousIncidents || [];
  const cumulativeCost = memory?.cumulativeRepairCost ?? 0;

  return (
    <div className="case-card machine-memory-card">
      <div className="card-header">
        <span className="card-title-tag">MACHINE MEMORY</span>
        <span className="card-subtitle">PERSISTENT INCIDENT HISTORY</span>
      </div>

      <div className="memory-identity-section">
        <div className="identity-item">
          <span className="identity-label">MACHINE ID:</span>
          <span className="identity-val">{machine?.machineId || 'N/A'}</span>
        </div>
        <div className="identity-item">
          <span className="identity-label">LOCATION:</span>
          <span className="identity-val">{machine?.location || 'N/A'}</span>
        </div>
        <div className="identity-item">
          <span className="identity-label">SERIAL:</span>
          <span className="identity-val">{machine?.serialNumber || 'N/A'}</span>
        </div>
      </div>

      <div className="memory-history-section">
        <span className="section-sublabel">RELEVANT REPAIR HISTORY ({incidents.length})</span>
        {incidents.length === 0 ? (
          <p className="no-history-text">No previous repair history recorded.</p>
        ) : (
          <div className="incident-list">
            {incidents.map((item, idx) => (
              <div key={item.repairId || idx} className="incident-item">
                <div className="incident-main">
                  <span className="incident-desc">{item.description}</span>
                  <span className="incident-date">{item.date}</span>
                </div>
                <div className="incident-meta">
                  <span className="incident-cost">₹{item.cost?.toLocaleString('en-IN')}</span>
                  <span className={`incident-outcome outcome-${(item.outcome || '').toLowerCase()}`}>
                    {item.outcome}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="memory-cumulative-footer">
        <span className="cumulative-label">CUMULATIVE REPAIR COST:</span>
        <span className="cumulative-val">₹{cumulativeCost.toLocaleString('en-IN')}</span>
      </div>
    </div>
  );
};

export default MachineMemoryCard;
