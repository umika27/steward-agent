/**
 * Task Target Resolver Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Resolves target scene objects dynamically from SceneState.objects
 * using semantic categories, labels, confidence scores, and explicit identifiers.
 *
 * ZERO hardcoded room coordinates or hardcoded object names.
 */

import { getIntent } from './taskIntents';

/**
 * Resolves a target scene object from active SceneState for a given task intent or criteria
 *
 * @param {Object} sceneState - Current normalized scene perception state
 * @param {string|Object} intentOrKey - Task intent key (e.g. 'INSPECT') or intent object
 * @param {Object} [options] - Optional search parameters { targetId, targetLabel, category, object }
 * @returns {Object} Structured resolution result { success: boolean, targetObject: Object|null, reason?: string }
 */
export function resolveTaskTarget(sceneState, intentOrKey = 'INSPECT', options = {}) {
  const objects = sceneState?.objects || [];

  if (!Array.isArray(objects) || objects.length === 0) {
    return {
      success: false,
      reason: 'NO_TARGET_FOUND',
      error: 'SceneState contains no detected objects',
    };
  }

  // 1. Direct Object Provided
  if (options.object) {
    const existing = objects.find((obj) => obj.id === options.object.id);
    return {
      success: true,
      targetObject: existing || options.object,
    };
  }

  // 2. Explicit Target ID Match
  if (options.targetId) {
    const matched = objects.find((obj) => String(obj.id) === String(options.targetId));
    if (matched) {
      return {
        success: true,
        targetObject: matched,
      };
    }
  }

  // 3. Explicit Target Label Match
  if (options.targetLabel) {
    const searchLabel = String(options.targetLabel).toLowerCase();
    const matches = objects.filter((obj) =>
      (obj.label || '').toLowerCase().includes(searchLabel)
    );

    if (matches.length > 0) {
      // Sort by confidence (highest first), then deterministic ID sort
      matches.sort((a, b) => (b.confidence || 0) - (a.confidence || 0) || String(a.id).localeCompare(String(b.id)));
      return {
        success: true,
        targetObject: matches[0],
      };
    }
  }

  // 4. Intent & Category Matching
  const intent = typeof intentOrKey === 'object' ? intentOrKey : getIntent(intentOrKey);
  const targetCategory = (options.category || '').toLowerCase();
  const supportedCategories = (intent?.supportedCategories || []).map((c) => c.toLowerCase());

  let candidates = [];

  if (targetCategory) {
    // Match explicit category parameter
    candidates = objects.filter((obj) => {
      const cat = (obj.category || '').toLowerCase();
      const lbl = (obj.label || '').toLowerCase();
      return cat.includes(targetCategory) || lbl.includes(targetCategory);
    });
  } else if (supportedCategories.length > 0) {
    // Match any supported category for the intent
    candidates = objects.filter((obj) => {
      const cat = (obj.category || '').toLowerCase();
      return supportedCategories.includes(cat);
    });
  } else {
    // Any detected object
    candidates = [...objects];
  }

  if (candidates.length === 0) {
    // Fallback: search all objects if no candidate matched category filter
    candidates = [...objects];
  }

  if (candidates.length === 0) {
    return {
      success: false,
      reason: 'NO_TARGET_FOUND',
      error: `No suitable target object found in scene for intent ${intent?.id || 'INSPECT'}`,
    };
  }

  // Sort candidates by highest confidence score, then deterministic ID string order
  candidates.sort((a, b) => (b.confidence || 0) - (a.confidence || 0) || String(a.id).localeCompare(String(b.id)));

  return {
    success: true,
    targetObject: candidates[0],
  };
}
