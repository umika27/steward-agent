/**
 * Case Data & API Validator (Phase 9A Backend Support)
 *
 * Validates canonical case structures and verifies zero credential exposure.
 * Controlled error generation - prevents server crashes on malformed inputs.
 */

const FORBIDDEN_SECRET_PATTERNS = [
  'otp',
  'pin',
  'cvv',
  'password',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'authtoken',
  'auth_token',
  'private_key',
  'credential',
];

export class CaseValidator {
  /**
   * Validate full canonical case object
   */
  static validateCase(caseData) {
    const errors = [];

    if (!caseData || typeof caseData !== 'object') {
      return { valid: false, errors: ['Case data must be a non-null object'] };
    }

    // Required root fields
    if (!caseData.caseId || typeof caseData.caseId !== 'string') {
      errors.push('Missing or invalid caseId');
    }

    if (!caseData.machine || typeof caseData.machine !== 'object') {
      errors.push('Missing or invalid machine object');
    } else {
      if (!caseData.machine.machineId) errors.push('Missing machine.machineId');
      if (!caseData.machine.manufacturer) errors.push('Missing machine.manufacturer');
      if (!caseData.machine.model) errors.push('Missing machine.model');
    }

    if (!caseData.machineMemory || typeof caseData.machineMemory !== 'object') {
      errors.push('Missing or invalid machineMemory');
    } else {
      if (!Array.isArray(caseData.machineMemory.previousIncidents)) {
        errors.push('machineMemory.previousIncidents must be an array');
      }
      if (typeof caseData.machineMemory.cumulativeRepairCost !== 'number') {
        errors.push('machineMemory.cumulativeRepairCost must be a number');
      }
    }

    if (!caseData.currentCase || typeof caseData.currentCase !== 'object') {
      errors.push('Missing or invalid currentCase object');
    } else {
      if (!caseData.currentCase.issue) errors.push('Missing currentCase.issue');
      if (!caseData.currentCase.currentState) errors.push('Missing currentCase.currentState');
    }

    if (!caseData.quote || typeof caseData.quote !== 'object') {
      errors.push('Missing or invalid quote object');
    } else {
      if (typeof caseData.quote.amount !== 'number') errors.push('quote.amount must be a number');
    }

    if (!caseData.authority || typeof caseData.authority !== 'object') {
      errors.push('Missing or invalid authority object');
    } else {
      if (typeof caseData.authority.authorityLimit !== 'number') {
        errors.push('authority.authorityLimit must be a number');
      }
      if (typeof caseData.authority.withinAuthority !== 'boolean') {
        errors.push('authority.withinAuthority must be a boolean');
      }
      if (typeof caseData.authority.approvalRequired !== 'boolean') {
        errors.push('authority.approvalRequired must be a boolean');
      }
    }

    if (!caseData.decision || typeof caseData.decision !== 'object') {
      errors.push('Missing or invalid decision object');
    } else {
      if (!caseData.decision.decision) errors.push('Missing decision.decision');
    }

    if (!caseData.verification || typeof caseData.verification !== 'object') {
      errors.push('Missing or invalid verification object');
    } else {
      if (!caseData.verification.verificationStatus) {
        errors.push('Missing verification.verificationStatus');
      }
    }

    if (!Array.isArray(caseData.timeline)) {
      errors.push('timeline must be an array');
    }

    // Security audit
    const secretAudit = this.auditForSecrets(caseData);
    if (!secretAudit.clean) {
      errors.push(`Security check failed: potentially sensitive field detected [${secretAudit.detectedKey}]`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recursively scan object keys to ensure no secrets or credentials are leakable
   */
  static auditForSecrets(obj, path = '') {
    if (!obj || typeof obj !== 'object') return { clean: true };

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        if (lowerKey.includes(pattern)) {
          return {
            clean: false,
            detectedKey: path ? `${path}.${key}` : key,
          };
        }
      }

      if (value && typeof value === 'object') {
        const nestedResult = this.auditForSecrets(value, path ? `${path}.${key}` : key);
        if (!nestedResult.clean) return nestedResult;
      }
    }

    return { clean: true };
  }
}
