/**
 * Runtime Case Provider (Phase 9C Integration Bridge)
 *
 * Bridges the mutable Phase 9B CaseRuntime to the read-oriented API consumers.
 * Exposes canonical serialized snapshots reflecting real-time lifecycle evolutions.
 */

import { caseRuntime, CaseRuntime } from '../runtime/caseRuntime.js';
import { CaseResponseSerializer } from './caseResponseSerializer.js';
import { canonicalCaseStore } from '../canonicalCaseStore.js';

export class RuntimeCaseProvider {
  /**
   * @param {CaseRuntime} runtimeInstance - Optional dedicated runtime instance
   */
  constructor(runtimeInstance = caseRuntime) {
    this.runtime = runtimeInstance;
    this._initializeDefaultScenarios();
  }

  /**
   * Pre-load standard canonical scenarios into runtime memory
   */
  _initializeDefaultScenarios() {
    try {
      for (const caseId of ['case_act_101', 'case_restrain_202', 'case_recover_303']) {
        if (!this.runtime.activeCases.has(caseId)) this.runtime.loadCase(caseId);
      }
    } catch (_) {
      // Handled gracefully if already loaded
    }
  }

  /**
   * Retrieve full canonical case snapshot by caseId or alias
   * @param {string} caseIdentifier
   * @returns {Object|null} Serialized case JSON
   */
  getCase(caseIdentifier) {
    if (!caseIdentifier || typeof caseIdentifier !== 'string') return null;

    let runtimeCase = null;
    try {
      runtimeCase = this.runtime.getCase(caseIdentifier);
    } catch (_) {
      runtimeCase = null;
    }

    if (!runtimeCase) {
      // Fallback lookup in canonical store if not yet loaded
      try {
        runtimeCase = this.runtime.loadCase(caseIdentifier);
      } catch (_) {
        return null;
      }
    }

    return CaseResponseSerializer.serializeCase(runtimeCase);
  }

  /**
   * Retrieve case status summary
   * @param {string} caseIdentifier
   * @returns {Object|null} Serialized status JSON
   */
  getStatus(caseIdentifier) {
    const rawCase = this.getCase(caseIdentifier);
    return rawCase ? CaseResponseSerializer.serializeStatus(rawCase) : null;
  }

  /**
   * Retrieve machine memory
   * @param {string} caseIdentifier
   * @returns {Object|null} Serialized memory JSON
   */
  getMemory(caseIdentifier) {
    const rawCase = this.getCase(caseIdentifier);
    return rawCase ? CaseResponseSerializer.serializeMemory(rawCase) : null;
  }

  /**
   * Retrieve chronological timeline ledger
   * @param {string} caseIdentifier
   * @returns {Object|null} Serialized timeline JSON
   */
  getTimeline(caseIdentifier) {
    const rawCase = this.getCase(caseIdentifier);
    return rawCase ? CaseResponseSerializer.serializeTimeline(rawCase) : null;
  }

  /**
   * List all available cases
   */
  listCases() {
    const baseList = canonicalCaseStore.listCases();
    return baseList.map((item) => {
      const activeCase = this.getCase(item.caseId);
      return {
        caseId: item.caseId,
        scenarioKey: item.scenarioKey,
        issue: activeCase?.currentCase?.issue || item.issue,
        currentState: activeCase?.currentCase?.currentState || item.currentState,
        machineModel: activeCase?.machine?.model || item.machineModel,
        updatedAt: activeCase?.currentCase?.createdAt || item.updatedAt,
      };
    });
  }

  /**
   * Access active runtime instance for state evolution
   */
  getRuntime() {
    return this.runtime;
  }
}

export const runtimeCaseProvider = new RuntimeCaseProvider();
