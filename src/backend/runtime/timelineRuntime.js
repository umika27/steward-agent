/**
 * Timeline Runtime (Phase 9B)
 *
 * Appends chronological events to case ledger with strict immutability.
 * Previous events are never mutated or deleted.
 */

export class TimelineRuntime {
  /**
   * Initialize a new timeline or clone existing
   * @param {Array} initialTimeline
   */
  constructor(initialTimeline = []) {
    this.events = Array.isArray(initialTimeline)
      ? JSON.parse(JSON.stringify(initialTimeline))
      : [];
  }

  /**
   * Append an event to timeline immutably
   * @param {Object} eventData - { type, label, description, status, timestamp, metadata }
   * @returns {Object} Appended event record
   */
  appendEvent({
    type = 'EVENT',
    label,
    description = '',
    status = 'COMPLETED',
    timestamp = new Date().toISOString(),
    metadata = {},
  }) {
    const newEvent = {
      event: type,
      type,
      label: label || type.replace(/_/g, ' '),
      timestamp,
      description,
      status,
      metadata: typeof metadata === 'object' && metadata !== null ? { ...metadata } : {},
    };

    this.events.push(newEvent);
    return { ...newEvent };
  }

  /**
   * Get all chronological events (immutable clone)
   */
  getEvents() {
    return JSON.parse(JSON.stringify(this.events));
  }

  /**
   * Get total event count
   */
  getCount() {
    return this.events.length;
  }
}
