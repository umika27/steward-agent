/**
 * Mock Image Generation Provider Module
 * Phase 12B Hotfix — Generated Environment & Condition-Aware Perception
 *
 * Offline mock image generation provider delivering 5 distinct synthetic indoor room
 * background images with guaranteed broken object contracts.
 */

import livingRoomBg from '../../assets/living-room-bg.jpg';

function buildSvgDataUrl(bgGradient, accentColor, roomTitle, objectText) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGradient[0]}"/>
        <stop offset="100%" stop-color="${bgGradient[1]}"/>
      </linearGradient>
      <linearGradient id="floor" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <!-- Room Walls & Background -->
    <rect width="1920" height="1080" fill="url(#bg)"/>
    <!-- Room Floor -->
    <polygon points="0,720 1920,720 1920,1080 0,1080" fill="url(#floor)"/>
    <line x1="0" y1="720" x2="1920" y2="720" stroke="${accentColor}" stroke-width="3" opacity="0.6"/>
    <!-- Room Title Badge -->
    <rect x="60" y="50" width="460" height="60" rx="12" fill="rgba(15,23,42,0.85)" stroke="${accentColor}" stroke-width="2"/>
    <text x="80" y="88" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="22" font-weight="700" letter-spacing="1">${roomTitle}</text>
    <!-- Primary Appliance Graphic -->
    <rect x="220" y="520" width="220" height="280" rx="16" fill="rgba(30,41,59,0.9)" stroke="${accentColor}" stroke-width="4"/>
    <rect x="240" y="540" width="180" height="140" rx="10" fill="rgba(15,23,42,0.9)" stroke="${accentColor}" stroke-width="2"/>
    <circle cx="330" cy="610" r="45" fill="none" stroke="${accentColor}" stroke-width="4"/>
    <!-- Malfunctioning Warning Glow Indicator -->
    <circle cx="410" cy="535" r="14" fill="#ef4444"/>
    <text x="330" y="750" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="16" font-weight="600" text-anchor="middle">${objectText}</text>
    <text x="330" y="775" fill="#fca5a5" font-family="system-ui, sans-serif" font-size="13" font-weight="600" text-anchor="middle">[ MALFUNCTIONING / DAMAGED ]</text>
    <!-- Furniture & Desk -->
    <rect x="700" y="660" width="500" height="160" rx="12" fill="rgba(30,41,59,0.85)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <!-- Telephone Graphic -->
    <rect x="760" y="610" width="90" height="50" rx="8" fill="rgba(56,189,248,0.3)" stroke="#38bdf8" stroke-width="2"/>
    <text x="805" y="640" fill="#7dd3fc" font-family="system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">Telephone</text>
    <!-- User Manual / Document Graphic -->
    <rect x="980" y="600" width="110" height="60" rx="6" fill="rgba(251,191,36,0.3)" stroke="#fbbf24" stroke-width="2"/>
    <text x="1035" y="635" fill="#fef08a" font-family="system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">User Manual</text>
    <!-- Storage Cupboard / Cabinet -->
    <rect x="1450" y="320" width="280" height="480" rx="12" fill="rgba(30,41,59,0.85)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <line x1="1590" y1="320" x2="1590" y2="800" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <text x="1590" y="570" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="16" font-weight="600" text-anchor="middle">Storage Cupboard</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class MockImageGenerationProvider {
  constructor() {
    this.mockEnvironments = [
      {
        type: 'laundry_room',
        width: 1920,
        height: 1080,
        imageSource: buildSvgDataUrl(['#0f172a', '#1e1b4b'], '#f43f5e', 'SCENE 1: LAUNDRY & UTILITY SUITE', 'Washing Machine'),
      },
      {
        type: 'kitchen_room',
        width: 1920,
        height: 1080,
        imageSource: buildSvgDataUrl(['#064e3b', '#022c22'], '#10b981', 'SCENE 2: KITCHEN APPLIANCE SUITE', 'Refrigerator'),
      },
      {
        type: 'workspace_room',
        width: 1920,
        height: 1080,
        imageSource: buildSvgDataUrl(['#1e1b4b', '#311042'], '#a855f7', 'SCENE 3: TECH WORKSHOP SUITE', '3D Printer'),
      },
      {
        type: 'living_lounge',
        width: 1920,
        height: 1080,
        imageSource: buildSvgDataUrl(['#451a03', '#1c1917'], '#f59e0b', 'SCENE 4: LIVING LOUNGE SUITE', 'Television'),
      },
      {
        type: 'appliance_studio',
        width: 1920,
        height: 1080,
        imageSource: buildSvgDataUrl(['#134e4a', '#042f2e'], '#14b8a6', 'SCENE 5: APPLIANCE STUDIO SUITE', 'Microwave'),
      },
    ];
    this.currentIndex = 0;
  }

  /**
   * Generates a scene background image payload offline
   * @returns {Promise<Object>} { imageSource: string, width: number, height: number, type: string }
   */
  async generateScene() {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const env = this.mockEnvironments[this.currentIndex % this.mockEnvironments.length];
    this.currentIndex++;

    return {
      imageSource: env.imageSource,
      width: env.width,
      height: env.height,
      type: env.type,
    };
  }
}
