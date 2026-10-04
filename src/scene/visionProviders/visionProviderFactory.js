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

// Phase 1 Freeze: External AI image analysis disabled, locked to deterministic Mock provider
let currentProviderType = VISION_PROVIDER_TYPES.MOCK;
let activeProviderInstance = new MockDevVisionProvider();

/**
 * Returns the currently active vision provider instance (deterministic mock)
 *
 * @param {string} providerType - 'mock' | 'ai'
 * @returns {IVisionProvider} Concrete vision provider instance
 */
export function getVisionProvider(providerType = currentProviderType) {
  if (!activeProviderInstance) {
    activeProviderInstance = new MockDevVisionProvider();
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
  // Freezing external calls - deterministic mock is preserved
  currentProviderType = VISION_PROVIDER_TYPES.MOCK;
  activeProviderInstance = new MockDevVisionProvider();
  return activeProviderInstance;
}

export function getCurrentProviderType() {
  return currentProviderType;
}
