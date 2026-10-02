/**
 * Image Generation Provider Factory Module
 * Phase 12A — Generated Environment & Condition-Aware Perception
 *
 * Provider factory managing AI vs Mock image generation instances.
 */

import { GENERATION_PROVIDER_TYPES } from './imageGenerationTypes';
import { AIImageGenerationProvider } from './imageGenerationProvider';
import { MockImageGenerationProvider } from './mockImageGenerationProvider';

let activeProviderType = import.meta.env.VITE_IMAGE_GENERATION_PROVIDER || (import.meta.env.VITE_GEMINI_API_KEY ? 'ai' : 'mock');
let currentProviderInstance = null;

export function getImageGenerationProvider() {
  if (currentProviderInstance) {
    return currentProviderInstance;
  }

  if (activeProviderType === GENERATION_PROVIDER_TYPES.AI) {
    currentProviderInstance = new AIImageGenerationProvider();
  } else {
    currentProviderInstance = new MockImageGenerationProvider();
  }

  return currentProviderInstance;
}

export function setImageGenerationProviderType(type) {
  if (type === GENERATION_PROVIDER_TYPES.AI || type === GENERATION_PROVIDER_TYPES.MOCK) {
    activeProviderType = type;
    currentProviderInstance = null;
  }
}

export function getActiveImageGenerationProviderType() {
  return activeProviderType;
}
