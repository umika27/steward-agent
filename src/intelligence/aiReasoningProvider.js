/**
 * AI Reasoning Provider Module
 * Phase 10 — AI Reasoning & Natural-Language Task Planning
 *
 * Connects to Google Gemini API to analyze natural language user requests against
 * active SceneState objects and generate structured JSON task plans.
 */

import { buildSystemPrompt, buildUserPrompt } from './reasoningPrompt';

export class AIReasoningProvider {
  constructor(apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_VISION_API_KEY) {
    this.apiKey = apiKey || '';
    this.modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Sends natural language request + scene objects to Gemini API and returns raw JSON text
   *
   * @param {Object} input - { userRequest, sceneState, conversationContext }
   * @returns {Promise<Object>} Model output JSON object
   */
  async analyzeRequest(input) {
    if (!this.apiKey) {
      throw new Error(
        'AI Reasoning Provider Error: VITE_GEMINI_API_KEY is missing. Please add VITE_GEMINI_API_KEY to your .env file or use Mock Reasoning Provider.'
      );
    }

    const { userRequest = '', sceneState = {}, conversationContext = null } = input;
    const sceneObjects = sceneState?.objects || [];

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(userRequest, sceneObjects, conversationContext);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const textOutput = candidate?.content?.parts?.[0]?.text;

    if (!textOutput) {
      throw new Error('Gemini API returned an empty response');
    }

    // Clean markdown code blocks if model included them
    const cleanedText = textOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedText);
  }
}
