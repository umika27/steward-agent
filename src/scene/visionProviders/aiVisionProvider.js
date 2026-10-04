/**
 * AI Vision Provider Module
 * Phase 7.1 — Gemini Provider Correction & Real API Validation
 *
 * Multimodal AI vision provider using Google Gemini Multimodal Vision API.
 * Analyzes synthetic AI-generated room environment images and returns raw structured object detections.
 *
 * SECURITY NOTE FOR FRONTEND PROTOTYPE:
 * VITE_ environment variables are bundled into browser-side client code.
 * In production deployments, requests MUST be routed through a server-side backend proxy
 * to avoid exposing API credentials to end-user clients.
 *
 * NO hardcoded API keys. Uses import.meta.env.VITE_GEMINI_API_KEY safely.
 * NO interaction point generation or Butler navigation logic inside this provider.
 */

import { IVisionProvider } from './visionProviderInterface';
import { validateVisionDetections } from './visionDetectionValidator';

const SYSTEM_PROMPT = `You are analyzing an AI-generated environment image.
Identify visible physical objects present in the room environment, including:
- furniture (sofa, coffee table, cupboard, cabinet, chair, desk, bookshelf)
- appliances (washing machine, refrigerator, microwave, oven)
- electronics (television, telephone, laptop, speaker)
- structures (door, window, wall structure)
- decor_lighting (lamp, pendant light, indoor plant, mirror)

RULES:
1. Only report objects that are visibly represented in the image. Do NOT invent hidden objects.
2. Do NOT return decorative background patterns or wall textures as objects unless they represent an actual physical object.
3. Identify separate physical instances separately.
4. For each object, inspect its visible physical condition and state:
   - "condition": strictly one of ["NORMAL", "DAMAGED", "MALFUNCTIONING", "UNCERTAIN"]
   - "conditionConfidence": numeric confidence score between 0.0 and 1.0
5. For each object, return a structured JSON object with:
   - "label": concise object name (e.g. "sofa", "washing machine", "cupboard", "telephone", "lamp")
   - "category": strictly one of ["furniture", "appliances", "electronics", "structures", "decor_lighting", "documents"]
   - "confidence": numeric confidence score between 0.0 and 1.0
   - "condition": "NORMAL" | "DAMAGED" | "MALFUNCTIONING" | "UNCERTAIN"
   - "conditionConfidence": 0.90
   - "box": normalized bounding box array [ymin, xmin, ymax, xmax] with all values strictly between 0.0 and 1.0

Return ONLY valid JSON matching this schema:
{
  "objects": [
    {
      "label": "string",
      "category": "string",
      "confidence": 0.95,
      "condition": "NORMAL",
      "conditionConfidence": 0.90,
      "box": [0.2, 0.1, 0.8, 0.5]
    }
  ]
}`;

export class AIVisionProvider extends IVisionProvider {
  constructor(apiKey = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_VISION_API_KEY) {
    super();
    this.apiKey = apiKey || '';
    this.modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  }

  async analyzeImage(imageSource) {
    if (!this.apiKey) {
      throw new Error(
        'AI Vision Provider Configuration Error: VITE_GEMINI_API_KEY is missing. Please add VITE_GEMINI_API_KEY to your .env file or select Mock Provider in Settings.'
      );
    }

    // Convert image source to base64 inline data for API payload
    const base64Data = await this._imageSourceToBase64(imageSource);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: SYSTEM_PROMPT },
            {
              inline_data: {
                mime_type: base64Data.mimeType || 'image/jpeg',
                data: base64Data.data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
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
      const errorText = await response.text();
      throw new Error(`AI Vision Provider API Error (${response.status}): ${errorText || response.statusText}`);
    }

    const responseData = await response.json();
    const candidateText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('AI Vision Provider received empty text response from model.');
    }

    let parsedResult = null;
    try {
      parsedResult = JSON.parse(candidateText);
    } catch (parseErr) {
      throw new Error(`AI Vision Provider JSON parse failure: ${parseErr.message}`);
    }

    const rawDetections = parsedResult?.objects || parsedResult?.detections || [];
    const validatedDetections = validateVisionDetections(rawDetections);

    return {
      width: base64Data.width || 1920,
      height: base64Data.height || 1080,
      detections: validatedDetections,
    };
  }

  /**
   * Private Helper: Converts image URL / Blob / File to base64 string
   */
  async _imageSourceToBase64(imageSource) {
    if (typeof imageSource === 'string' && imageSource.startsWith('data:')) {
      const [header, data] = imageSource.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      return { mimeType, data, width: 1920, height: 1080 };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1920;
        canvas.height = img.naturalHeight || 1080;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const data = dataUrl.split(',')[1];
        resolve({
          mimeType: 'image/jpeg',
          data,
          width: canvas.width,
          height: canvas.height,
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for AI Vision Provider base64 conversion.'));
      };

      img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
    });
  }
}
