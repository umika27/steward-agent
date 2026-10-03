/**
 * Recovery Runtime (Phase 9B)
 *
 * Tracks recovery and reassessment status following failed verification or service exceptions.
 * Represents that reassessment is required without making repair vs replace decisions.
 */

export class RecoveryRuntime {
  constructor(initialRecovery = null) {
    this.recovery = initialRecovery ? JSON.parse(JSON.stringify(initialRecovery)) : null;
  }

  /**
   * Activate recovery mode
   * @param {Object} recoveryData - { reason, nextState, status }
   */
  activate({
    reason = 'Verification failed: machine remains unresolved',
    nextState = 'REASSESS_REPAIR_VS_REPLACE',
    status = 'REASSESSING',
    currentState = 'RECOVERING',
  }) {
    this.recovery = {
      active: true,
      status,
      reason,
      currentState,
      nextState,
      timestamp: new Date().toISOString(),
    };

    return this.get();
  }

  /**
   * Clear or mark recovery resolved
   */
  resolve() {
    this.recovery = null;
  }

  /**
   * Get recovery snapshot
   */
  get() {
    return this.recovery ? JSON.parse(JSON.stringify(this.recovery)) : null;
  }
}
