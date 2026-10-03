/**
 * Image Generation Provider Factory Module
 * Phase 12A — Generated Environment & Condition-Aware Perception
 *
 * Provider factory managing AI vs Mock image generation instances.
 */

import { GENERATION_PROVIDER_TYPES } from './imageGenerationTypes';
import { AIImageGenerationProvider } from './imageGenerationProvider';
import { MockImageGenerationProvider } from './mockImageGenerationProvider';

let activeProviderType = GENERATION_PROVIDER_TYPES.MOCK;
let currentProviderInstance = new MockImageGenerationProvider();

export function getImageGenerationProvider() {
  if (!currentProviderInstance) {
    currentProviderInstance = new MockImageGenerationProvider();
  }
  return currentProviderInstance;
}

export function setImageGenerationProviderType(type) {
  // Freezing external calls - deterministic mock is preserved
  activeProviderType = GENERATION_PROVIDER_TYPES.MOCK;
  currentProviderInstance = new MockImageGenerationProvider();
}

export function getActiveImageGenerationProviderType() {
  return activeProviderType;
}
