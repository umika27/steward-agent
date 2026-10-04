/**
 * AI Image Generation Provider Module
 * Phase 12A — Generated Environment & Condition-Aware Perception
 *
 * Connects to Google Gemini / Imagen image generation API.
 */

import { getFixedGenerationPrompt } from './imageGenerationPrompt';
import { MockImageGenerationProvider } from './mockImageGenerationProvider';

export class AIImageGenerationProvider {
  constructor(apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_VISION_API_KEY) {
    this.apiKey = apiKey || '';
    this.fallbackMock = new MockImageGenerationProvider();
  }

  async generateScene() {
    if (!this.apiKey) {
      // Fallback gracefully to mock mode if API key is not supplied
      return this.fallbackMock.generateScene();
    }

    try {
      const prompt = getFixedGenerationPrompt();
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`;

      const requestBody = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          outputOptions: { mimeType: 'image/jpeg' },
        },
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        // If Imagen API endpoint returns error or permissions issue, fallback to mock
        return this.fallbackMock.generateScene();
      }

      const data = await response.json();
      const b64Data = data.predictions?.[0]?.bytesBase64Encoded;

      if (!b64Data) {
        return this.fallbackMock.generateScene();
      }

      return {
        imageSource: `data:image/jpeg;base64,${b64Data}`,
        width: 1920,
        height: 1080,
      };
    } catch (_) {
      return this.fallbackMock.generateScene();
    }
  }
}
