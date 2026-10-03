import React from 'react';
import './CaseTimeline.css';

/**
 * CaseTimeline (Phase 4)
 * Displays chronological sequence of case events & lifecycle progression.
 * Read-only presentation layer — consumes events array directly from mockCaseStore.
 */
export const CaseTimeline = ({ timeline }) => {
  if (!timeline || !Array.isArray(timeline) || timeline.length === 0) return null;

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (_) {
      return isoString;
    }
  };

  return (
    <div className="case-card case-timeline-card">
      <div className="card-header">
        <span className="card-title-tag">CASE TIMELINE</span>
        <span className="card-subtitle">{timeline.length} EVENTS RECORDED</span>
      </div>

      <div className="timeline-list">
        {timeline.map((event, idx) => {
          const isLast = idx === timeline.length - 1;
          const statusClass = (event.status || 'COMPLETED').toLowerCase();

          return (
            <div key={idx} className={`timeline-item ${isLast ? 'is-current' : ''}`}>
              <div className="timeline-left">
                <span className="timeline-time">{formatTime(event.timestamp)}</span>
                <div className="timeline-node-container">
                  <div className={`timeline-dot dot-${statusClass}`} />
                  {!isLast && <div className="timeline-line" />}
                </div>
              </div>

              <div className="timeline-content">
                <div className="timeline-header-row">
                  <span className="timeline-label">{event.label || event.type}</span>
                  <span className={`timeline-status-tag tag-${statusClass}`}>
                    {event.status || 'COMPLETED'}
                  </span>
                </div>
                {event.description && (
                  <p className="timeline-description">{event.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CaseTimeline;
