/**
 * Persistence Store Driver (Phase 9D)
 *
 * Durable JSON-based local persistent store with atomic writes, write serialization,
 * and safe corruption handling.
 */

import fs from 'node:fs';
import path from 'node:path';

export class PersistenceStore {
  /**
   * @param {string} storageFilePath - Target JSON file path
   */
  constructor(storageFilePath = null) {
    const defaultDir = path.resolve(process.cwd(), 'data');
    this.filePath = storageFilePath || path.join(defaultDir, 'steward_cases_runtime.json');
    this.dirPath = path.dirname(this.filePath);
    this._writeQueue = Promise.resolve();
    this._ensureDirectory();
  }

  /**
   * Ensure parent directory exists
   */
  _ensureDirectory() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }
    } catch (_) {}
  }

  /**
   * Atomically save all cases map to disk
   * @param {Object} casesMap - Object of { caseId: caseData }
   */
  async saveAll(casesMap) {
    // Chain write onto queue to guarantee serialized execution
    this._writeQueue = this._writeQueue.then(async () => {
      this._ensureDirectory();
      const tmpPath = `${this.filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      const dataString = JSON.stringify(casesMap, null, 2);

      try {
        await fs.promises.writeFile(tmpPath, dataString, 'utf8');
        await fs.promises.rename(tmpPath, this.filePath);
      } catch (err) {
        try {
          if (fs.existsSync(tmpPath)) {
            await fs.promises.unlink(tmpPath);
          }
        } catch (_) {}
        throw new Error(`Failed to persist case state atomically: ${err.message}`);
      }
    });

    return this._writeQueue;
  }

  /**
   * Load all persisted cases from disk
   * @returns {Object} Cases map { caseId: caseData }
   */
  loadAll() {
    if (!fs.existsSync(this.filePath)) {
      return {};
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      if (!raw || !raw.trim()) {
        return {};
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Persisted storage is not an object');
      }
      return parsed;
    } catch (err) {
      // Corruption handling: preserve corrupted file with timestamp and throw controlled error
      const backupPath = `${this.filePath}.corrupted_${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backupPath);
      } catch (_) {}
      throw new Error(`Persisted storage is corrupted: ${err.message}. Backup saved to ${backupPath}`);
    }
  }

  /**
   * Save a single case snapshot
   */
  async saveCase(caseId, caseData) {
    let allCases = {};
    try {
      allCases = this.loadAll();
    } catch (_) {
      allCases = {};
    }
    allCases[caseId] = caseData;
    await this.saveAll(allCases);
    return caseData;
  }

  /**
   * Get single case from storage
   */
  getCase(caseId) {
    const allCases = this.loadAll();
    return allCases[caseId] || null;
  }

  /**
   * Clear storage file (used in clean tests)
   */
  clear() {
    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (_) {}
  }
}

export const persistenceStore = new PersistenceStore();
