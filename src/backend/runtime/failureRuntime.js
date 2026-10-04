/**
 * Failure Runtime (Phase 9B)
 *
 * Records observed exceptions, no-shows, parts delays, and service failures.
 * Does NOT invent recovery decisions - purely captures failure facts.
 */

export class FailureRuntime {
  constructor(initialFailure = null) {
    this.failure = initialFailure ? JSON.parse(JSON.stringify(initialFailure)) : null;
  }

  /**
   * Record a failure fact
   * @param {Object} failureData - { type, description, source, affectedAction, title }
   */
  record({
    type = 'SERVICE_EXCEPTION',
    description = 'External service exception recorded',
    source = 'PROVIDER',
    affectedAction = 'Service Visit',
    title = 'Service Failure',
    timestamp = new Date().toISOString(),
  }) {
    this.failure = {
      type,
      title,
      description,
      source,
      affectedAction,
      status: 'FAILED',
      timestamp,
      recorded: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    return this.get();
  }

  /**
   * Clear or reset failure
   */
  clear() {
    this.failure = null;
  }

  /**
   * Get failure snapshot
   */
  get() {
    return this.failure ? JSON.parse(JSON.stringify(this.failure)) : null;
  }
}
