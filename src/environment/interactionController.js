/**
 * Environment Interaction Controller & State Machine
 *
 * Manages scripted household interaction workflows, coordinating:
 * - Navigator movement targets
 * - Emotion triggers
 * - Single SpeechBox text updates
 * - Lock/Unlock state for manual dragging
 */

export const INTERACTION_STATES = {
  IDLE: 'IDLE',
  WASHING_MACHINE_SELECTED: 'WASHING_MACHINE_SELECTED',
  BUTLER_ENTERING: 'BUTLER_ENTERING',
  MOVING_TO_MACHINE: 'MOVING_TO_MACHINE',
  INSPECTING_MACHINE: 'INSPECTING_MACHINE',
  DOCUMENTATION_REQUIRED: 'DOCUMENTATION_REQUIRED',
  MOVING_TO_CUPBOARD: 'MOVING_TO_CUPBOARD',
  CHECKING_DOCUMENTATION: 'CHECKING_DOCUMENTATION',
  RETURNING_TO_MACHINE: 'RETURNING_TO_MACHINE',
  REPAIR_REQUIRED: 'REPAIR_REQUIRED',
  MOVING_TO_PHONE: 'MOVING_TO_PHONE',
  CALLING_REPAIR: 'CALLING_REPAIR',
  SHOW_PURCHASE_OPTIONS: 'SHOW_PURCHASE_OPTIONS',
  USER_SELECTS_PRODUCT: 'USER_SELECTS_PRODUCT',
  RETURNING_HOME: 'RETURNING_HOME',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class InteractionController {
  constructor({
    navigator,
    setPos,
    setSpeechText,
    setEmotionOverride,
    setIsNavigating,
    setShowPurchaseOptions,
  }) {
    this.navigator = navigator;
    this.setPos = setPos;
    this.setSpeechText = setSpeechText;
    this.setEmotionOverride = setEmotionOverride;
    this.setIsNavigating = setIsNavigating;
    this.setShowPurchaseOptions = setShowPurchaseOptions;

    this.currentState = INTERACTION_STATES.IDLE;
    this.isRunning = false;
  }

  /**
   * Executes full washing machine inspection, cupboard documentation, and phone repair workflow
   */
  async runWashingMachineWorkflow(currentPos, getTargetPos) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.setIsNavigating(true);

    try {
      // 1. Machine Selected & Butler Entrance
      this.currentState = INTERACTION_STATES.WASHING_MACHINE_SELECTED;
      this.setEmotionOverride('attentive');
      this.setSpeechText('Washing Machine selected. Initiating diagnostic sequence...');
      await delay(800);

      // 2. Move to Washing Machine
      this.currentState = INTERACTION_STATES.MOVING_TO_MACHINE;
      const machinePos = getTargetPos('washing-machine');
      await this.navigator.moveTo(currentPos, machinePos, 1400);

      // 3. Inspect Machine
      this.currentState = INTERACTION_STATES.INSPECTING_MACHINE;
      this.setEmotionOverride('thinking');
      this.setSpeechText('Let me inspect the washing machine for technical anomalies.');
      await delay(1800);

      // 4. Documentation Needed
      this.currentState = INTERACTION_STATES.DOCUMENTATION_REQUIRED;
      this.setEmotionOverride('confused');
      this.setSpeechText("I'll check the service documentation for this specific model in the cupboard.");
      await delay(1600);

      // 5. Move to Cupboard
      this.currentState = INTERACTION_STATES.MOVING_TO_CUPBOARD;
      this.setEmotionOverride('attentive');
      const cupboardPos = getTargetPos('cupboard');
      await this.navigator.moveTo(machinePos, cupboardPos, 1500);

      // 6. Check Documentation at Cupboard
      this.currentState = INTERACTION_STATES.CHECKING_DOCUMENTATION;
      this.setEmotionOverride('thinking');
      this.setSpeechText('Retrieving official appliance service manual from cupboard files...');
      await delay(1800);

      this.setEmotionOverride('surprised');
      this.setSpeechText('I found the documentation. The diagnostic codes indicate a motor bearing failure.');
      await delay(2000);

      // 7. Return to Washing Machine
      this.currentState = INTERACTION_STATES.RETURNING_TO_MACHINE;
      this.setEmotionOverride('attentive');
      await this.navigator.moveTo(cupboardPos, machinePos, 1400);

      // 8. Repair Required & Move to Phone
      this.currentState = INTERACTION_STATES.REPAIR_REQUIRED;
      this.setEmotionOverride('worried');
      this.setSpeechText('This appliance requires professional servicing. Moving to the telephone to dispatch a repair technician.');
      await delay(2000);

      this.currentState = INTERACTION_STATES.MOVING_TO_PHONE;
      const phonePos = getTargetPos('telephone');
      await this.navigator.moveTo(machinePos, phonePos, 1400);

      // 9. Call Repair
      this.currentState = INTERACTION_STATES.CALLING_REPAIR;
      this.setEmotionOverride('worried');
      this.setSpeechText('Dialing certified Steward repair network...');
      await delay(1600);

      this.setEmotionOverride('relieved');
      this.setSpeechText('Repair request successfully dispatched! A technician is scheduled to arrive.');
      await delay(2200);

      // 10. Purchase / Replacement Option Stage
      this.currentState = INTERACTION_STATES.SHOW_PURCHASE_OPTIONS;
      this.setEmotionOverride('confident');
      this.setSpeechText('In case you prefer upgrading, here are recommended replacement units:');
      this.setShowPurchaseOptions(true);

      // Wait for user to select an option or skip after 8s
      await delay(6000);

      // 11. Return Home
      this.setShowPurchaseOptions(false);
      this.currentState = INTERACTION_STATES.RETURNING_HOME;
      this.setEmotionOverride('confident');
      this.setSpeechText('Workflow complete. Returning to standby station.');
      const homePos = getTargetPos('home');
      await this.navigator.moveTo(phonePos, homePos, 1500);

      this.setEmotionOverride(null); // Reset to contextual status
      this.currentState = INTERACTION_STATES.IDLE;
    } catch (err) {
      console.error('Interaction workflow error:', err);
    } finally {
      this.isRunning = false;
      this.setIsNavigating(false);
      this.setEmotionOverride(null);
    }
  }
}
