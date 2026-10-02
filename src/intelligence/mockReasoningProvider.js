/**
 * Mock Reasoning Provider Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Provides deterministic offline task plan generation for test scenarios and development
 * without requiring live Gemini API keys.
 */

export class MockReasoningProvider {
  /**
   * Analyzes natural language request offline against detected scene objects
   *
   * @param {Object} input - { userRequest, sceneState, conversationContext }
   * @returns {Promise<Object>} Model output JSON object
   */
  async analyzeRequest(input) {
    const { userRequest = '', sceneState = {}, conversationContext = null } = input;
    const reqLower = userRequest.toLowerCase();
    const objects = sceneState?.objects || [];

    // Simulate short AI network latency
    await new Promise((r) => setTimeout(r, 200));

    // Scenario: Go Back / Return
    if (reqLower.includes('go back') || reqLower.includes('return') || reqLower.includes('home')) {
      return {
        status: 'PLAN_READY',
        goal: { intent: 'RETURN', description: 'Return Butler to home base' },
        target: null,
        steps: [{ id: 'step-1', action: 'RETURN' }],
      };
    }

    // Scenario: Wait
    if (reqLower.includes('wait')) {
      return {
        status: 'PLAN_READY',
        goal: { intent: 'WAIT', description: 'Wait at current location' },
        target: null,
        steps: [{ id: 'step-1', action: 'WAIT' }],
      };
    }

    // Scenario: Ambiguous Request ("check the appliance")
    if (reqLower === 'check the appliance' || reqLower === 'inspect the appliance') {
      const appliances = objects.filter((o) => (o.category || '').toLowerCase() === 'appliances');
      if (appliances.length > 1) {
        return {
          status: 'NEEDS_CLARIFICATION',
          question: `Which appliance would you like me to check? Detected: ${appliances.map((a) => a.label).join(', ')}.`,
        };
      }
    }

    // Scenario: Contextual Pronoun ("its documentation" / "check its manual")
    let targetObj = null;
    if ((reqLower.includes('its ') || reqLower.includes('that ')) && conversationContext?.previousTarget) {
      targetObj = objects.find((o) => String(o.id) === String(conversationContext.previousTarget.id));
    }

    // Search object by label in request
    if (!targetObj) {
      targetObj = objects.find((o) => reqLower.includes((o.label || '').toLowerCase()));
    }

    // Search object by category keyword
    if (!targetObj) {
      if (reqLower.includes('appliance') || reqLower.includes('machine')) {
        targetObj = objects.find((o) => (o.category || '').toLowerCase() === 'appliances');
      } else if (reqLower.includes('storage') || reqLower.includes('cupboard') || reqLower.includes('cabinet')) {
        targetObj = objects.find((o) => (o.category || '').toLowerCase() === 'storage' || (o.label || '').toLowerCase().includes('cupboard'));
      }
    }

    // Scenario: Target Not Found ("inspect the printer")
    if (!targetObj && (reqLower.includes('printer') || reqLower.includes('tv') || reqLower.includes('car'))) {
      return {
        status: 'NO_TARGET',
        reason: `Requested object "${userRequest}" is not present in current scene.`,
      };
    }

    // Fallback: If no target match found
    if (!targetObj) {
      if (objects.length > 0) {
        targetObj = objects[0];
      } else {
        return {
          status: 'NO_TARGET',
          reason: 'No objects detected in current scene',
        };
      }
    }

    // Scenario: Multi-step ("inspect ... and retrieve documentation")
    if (reqLower.includes('retrieve') || reqLower.includes('documentation') || reqLower.includes('manual')) {
      const storageObj = objects.find((o) => (o.category || '').toLowerCase() === 'storage' || (o.label || '').toLowerCase().includes('cupboard')) || targetObj;

      return {
        status: 'PLAN_READY',
        goal: { intent: 'INSPECT', description: `Inspect ${targetObj.label} and retrieve documentation` },
        target: { objectId: targetObj.id, label: targetObj.label, reason: 'Matched user target' },
        steps: [
          { id: 'step-1', action: 'INSPECT', targetObjectId: targetObj.id },
          { id: 'step-2', action: 'RETRIEVE', targetObjectId: storageObj.id },
        ],
      };
    }

    // Standard Single Object Inspection / Action
    let actionIntent = 'INSPECT';
    if (reqLower.includes('investigate')) actionIntent = 'INVESTIGATE';
    if (reqLower.includes('assist')) actionIntent = 'ASSIST';
    if (reqLower.includes('interact')) actionIntent = 'INTERACT';

    return {
      status: 'PLAN_READY',
      goal: { intent: actionIntent, description: `Execute ${actionIntent} for ${targetObj.label}` },
      target: { objectId: targetObj.id, label: targetObj.label, reason: 'Matched target' },
      steps: [
        { id: 'step-1', action: actionIntent, targetObjectId: targetObj.id },
      ],
    };
  }
}
