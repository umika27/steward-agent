/**
 * Reasoning Provider Factory Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Factory managing instantiated reasoning providers (AI vs Mock).
 */

import { AIReasoningProvider } from './aiReasoningProvider';
import { MockReasoningProvider } from './mockReasoningProvider';

export const REASONING_PROVIDER_TYPES = {
  AI: 'ai',
  MOCK: 'mock',
};

let activeProviderType = import.meta.env.VITE_REASONING_PROVIDER || (import.meta.env.VITE_GEMINI_API_KEY ? 'ai' : 'mock');
let currentProviderInstance = null;

export function getReasoningProvider() {
  if (currentProviderInstance) {
    return currentProviderInstance;
  }

  if (activeProviderType === REASONING_PROVIDER_TYPES.AI) {
    currentProviderInstance = new AIReasoningProvider();
  } else {
    currentProviderInstance = new MockReasoningProvider();
  }

  return currentProviderInstance;
}

export function setReasoningProviderType(providerType) {
  if (providerType === REASONING_PROVIDER_TYPES.AI || providerType === REASONING_PROVIDER_TYPES.MOCK) {
    activeProviderType = providerType;
    currentProviderInstance = null; // Re-instantiate on next access
  }
}

export function getActiveReasoningProviderType() {
  return activeProviderType;
}
