/**
 * Commitment Runtime (Phase 9B)
 *
 * Tracks external provider appointments, actions, and completion statuses.
 * Generates commitment ledger events without implementing provider intelligence.
 */

import { COMMITMENT_STATUS } from '../../case/caseTypes.js';

export class CommitmentRuntime {
  /**
   * @param {Object} initialCommitment
   */
  constructor(initialCommitment = null) {
    this.commitment = initialCommitment
      ? JSON.parse(JSON.stringify(initialCommitment))
      : {
          type: 'REPAIR_SERVICE',
          provider: 'Unknown Provider',
          expectedAction: 'Service Visit',
          appointment: null,
          expectedTime: null,
          status: COMMITMENT_STATUS.REQUESTED,
          completionStatus: null,
        };
  }

  /**
   * Update commitment record
   * @param {Object} update - Partial commitment updates
   * @returns {Object} Updated commitment
   */
  update(update = {}) {
    this.commitment = {
      ...this.commitment,
      ...update,
      provider: update.provider || this.commitment.provider,
      status: update.status || this.commitment.status,
      completionStatus: update.completionStatus !== undefined ? update.completionStatus : this.commitment.completionStatus,
    };

    return this.get();
  }

  /**
   * Get current commitment snapshot
   */
  get() {
    return JSON.parse(JSON.stringify(this.commitment));
  }
}
