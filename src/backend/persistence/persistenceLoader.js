/**
 * Persistence Loader (Phase 9D)
 *
 * Bridges CaseRuntime instances with the durable PersistenceStore.
 * Handles startup state restoration and durable case checkpointing.
 */

import { persistenceStore, PersistenceStore } from './persistenceStore.js';
import { PersistenceSerializer } from './persistenceSerializer.js';
import { CommitmentRuntime } from '../runtime/commitmentRuntime.js';
import { VerificationRuntime } from '../runtime/verificationRuntime.js';
import { FailureRuntime } from '../runtime/failureRuntime.js';
import { RecoveryRuntime } from '../runtime/recoveryRuntime.js';
import { TimelineRuntime } from '../runtime/timelineRuntime.js';

export class PersistenceLoader {
  /**
   * @param {PersistenceStore} store - Storage driver
   */
  constructor(store = persistenceStore) {
    this.store = store;
  }

  /**
   * Persist single runtime case to durable storage
   * @param {Object} caseRuntime - CaseRuntime instance
   * @param {string} caseId - Case identifier
   */
  async persistCase(caseRuntime, caseId) {
    if (!caseRuntime || !caseId) return null;

    const runtimeCase = caseRuntime.getCase(caseId);
    if (!runtimeCase) {
      throw new Error(`Case "${caseId}" is not loaded in runtime`);
    }

    const serialized = PersistenceSerializer.serialize(runtimeCase);
    await this.store.saveCase(caseId, serialized);
    return serialized;
  }

  /**
   * Persist all active cases from runtime
   * @param {Object} caseRuntime
   */
  async persistAll(caseRuntime) {
    if (!caseRuntime || !caseRuntime.activeCases) return {};

    const payload = {};
    for (const [caseId] of caseRuntime.activeCases.entries()) {
      const runtimeCase = caseRuntime.getCase(caseId);
      if (runtimeCase) {
        payload[caseId] = PersistenceSerializer.serialize(runtimeCase);
      }
    }

    await this.store.saveAll(payload);
    return payload;
  }

  /**
   * Restore single case from storage into CaseRuntime instance
   * @param {Object} caseRuntime - Target CaseRuntime
   * @param {string} caseId - Case identifier
   * @returns {Object|null} Restored case snapshot
   */
  restoreCase(caseRuntime, caseId) {
    if (!caseRuntime || !caseId) return null;

    const rawRecord = this.store.getCase(caseId);
    if (!rawRecord) return null;

    const record = PersistenceSerializer.deserialize(rawRecord);

    const reconstructed = {
      caseId: record.caseId,
      scenarioKey: record.scenarioKey,
      machine: JSON.parse(JSON.stringify(record.machine)),
      machineMemory: JSON.parse(JSON.stringify(record.machineMemory)),
      currentCase: JSON.parse(JSON.stringify(record.currentCase)),
      quote: JSON.parse(JSON.stringify(record.quote)),
      authority: JSON.parse(JSON.stringify(record.authority)),
      decision: JSON.parse(JSON.stringify(record.decision)),
      commitmentManager: new CommitmentRuntime(record.commitment),
      verificationManager: new VerificationRuntime(record.verification),
      failureManager: new FailureRuntime(record.failure),
      recoveryManager: new RecoveryRuntime(record.recovery),
      timelineManager: new TimelineRuntime(record.timeline),
    };

    caseRuntime.activeCases.set(record.caseId, reconstructed);
    return caseRuntime.getCase(record.caseId);
  }

  /**
   * Restore all persisted cases into CaseRuntime instance on startup
   * @param {Object} caseRuntime
   * @returns {number} Count of restored cases
   */
  restoreAll(caseRuntime) {
    if (!caseRuntime) return 0;

    let records = {};
    try {
      records = this.store.loadAll();
    } catch (err) {
      console.warn(`[PersistenceLoader] Startup restoration error: ${err.message}`);
      return 0;
    }

    let count = 0;
    for (const [caseId] of Object.entries(records)) {
      try {
        const restored = this.restoreCase(caseRuntime, caseId);
        if (restored) count++;
      } catch (err) {
        console.warn(`[PersistenceLoader] Failed to restore case "${caseId}": ${err.message}`);
      }
    }

    return count;
  }
}

export const persistenceLoader = new PersistenceLoader();
