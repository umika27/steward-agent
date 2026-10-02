/**
 * Vision Provider Factory Module
 * Phase 7 — AI Scene Understanding Provider
 *
 * Instantiates and manages pluggable Vision Provider backends ('mock' vs 'ai').
 * Preserves MockDevVisionProvider for offline development while enabling
 * Google Gemini Multimodal AI Provider for live AI-generated room analysis.
 */

import { MockDevVisionProvider } from './mockDevVisionProvider';
import { AIVisionProvider } from './aiVisionProvider';

export const VISION_PROVIDER_TYPES = {
  MOCK: 'mock',
  AI: 'ai',
};

let currentProviderType = import.meta.env.VITE_VISION_PROVIDER || VISION_PROVIDER_TYPES.MOCK;
let activeProviderInstance = null;

/**
 * Returns the currently active vision provider instance
 *
 * @param {string} providerType - 'mock' | 'ai'
 * @returns {IVisionProvider} Concrete vision provider instance
 */
export function getVisionProvider(providerType = currentProviderType) {
  const targetType = providerType === VISION_PROVIDER_TYPES.AI ? VISION_PROVIDER_TYPES.AI : VISION_PROVIDER_TYPES.MOCK;

  if (!activeProviderInstance || currentProviderType !== targetType) {
    currentProviderType = targetType;
    if (targetType === VISION_PROVIDER_TYPES.AI) {
      activeProviderInstance = new AIVisionProvider();
    } else {
      activeProviderInstance = new MockDevVisionProvider();
    }
  }

  return activeProviderInstance;
}

/**
 * Switches the active vision provider dynamically at runtime
 *
 * @param {string} newProviderType - 'mock' | 'ai'
 * @returns {IVisionProvider} New active provider instance
 */
export function setVisionProviderType(newProviderType) {
  const targetType = newProviderType === VISION_PROVIDER_TYPES.AI ? VISION_PROVIDER_TYPES.AI : VISION_PROVIDER_TYPES.MOCK;
  currentProviderType = targetType;

  if (targetType === VISION_PROVIDER_TYPES.AI) {
    activeProviderInstance = new AIVisionProvider();
  } else {
    activeProviderInstance = new MockDevVisionProvider();
  }

  return activeProviderInstance;
}

export function getCurrentProviderType() {
  return currentProviderType;
}
