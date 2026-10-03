/**
 * Task Intents Module
 * Phase 9 — Advanced Task Intelligence & Semantic Task Planning
 *
 * Defines deterministic semantic task intents for the Steward Butler.
 * Presentation-independent, scene-agnostic, zero room-specific coordinates.
 */

export const TASK_INTENTS = {
  INSPECT: {
    id: 'INSPECT',
    label: 'Inspect Object',
    description: 'Inspect a room object or appliance for operational status',
    supportedCategories: ['appliances', 'furniture', 'electronics', 'structures'],
    defaultBehavior: 'inspect',
  },
  RETRIEVE: {
    id: 'RETRIEVE',
    label: 'Retrieve Item',
    description: 'Retrieve items or documentation from storage',
    supportedCategories: ['storage', 'furniture', 'electronics'],
    defaultBehavior: 'retrieve',
  },
  DELIVER: {
    id: 'DELIVER',
    label: 'Deliver Item',
    description: 'Transport an item between location targets',
    supportedCategories: ['furniture', 'appliances', 'storage'],
    defaultBehavior: 'deliver',
  },
  INTERACT: {
    id: 'INTERACT',
    label: 'Interact',
    description: 'Interact with electronic equipment or user devices',
    supportedCategories: ['electronics', 'appliances', 'decor_lighting'],
    defaultBehavior: 'interact',
  },
  INVESTIGATE: {
    id: 'INVESTIGATE',
    label: 'Investigate',
    description: 'Investigate interesting or newly detected objects',
    supportedCategories: ['appliances', 'electronics', 'furniture', 'storage', 'decor_lighting', 'structures'],
    defaultBehavior: 'investigate',
  },
  ASSIST: {
    id: 'ASSIST',
    label: 'Assist User',
    description: 'Assist user with a room target',
    supportedCategories: ['appliances', 'furniture', 'electronics'],
    defaultBehavior: 'assist',
  },
  DIAGNOSE_BROKEN: {
    id: 'DIAGNOSE_BROKEN',
    label: 'Diagnose Broken Object',
    description: 'Autonomous diagnosis workflow for broken or malfunctioning objects',
    supportedCategories: ['appliances', 'electronics', 'furniture', 'structures', 'decor_lighting'],
    defaultBehavior: 'diagnose',
  },
  RETURN: {
    id: 'RETURN',
    label: 'Return Home',
    description: 'Return Butler to home base',
    supportedCategories: [],
    defaultBehavior: 'return',
  },
  WAIT: {
    id: 'WAIT',
    label: 'Wait',
    description: 'Wait at current position for instructions',
    supportedCategories: [],
    defaultBehavior: 'wait',
  },
};

/**
 * Gets intent definition by ID or key
 * @param {string} intentKey
 * @returns {Object|null}
 */
export function getIntent(intentKey) {
  if (!intentKey) return TASK_INTENTS.INSPECT;
  const key = String(intentKey).toUpperCase();
  return TASK_INTENTS[key] || TASK_INTENTS.INSPECT;
}
