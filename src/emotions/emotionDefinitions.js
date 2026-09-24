import imgAttentive from '../../images/ATTENTIVE-removebg-preview.png';
import imgConfident from '../../images/confident-removebg-preview (1).png';
import imgConfused from '../../images/CONFUSED-removebg-preview.png';
import imgFrustrated from '../../images/frustrated-removebg-preview.png';
import imgRelieved from '../../images/RELIEVED-removebg-preview.png';
import imgSurprised from '../../images/SURPRISED-removebg-preview (1).png';
import imgThinking from '../../images/THINKING-removebg-preview.png';
import imgWorried from '../../images/WORRIED-removebg-preview.png';

/**
 * Centralized Butler Emotion Definitions (Phase 4 — Emotion Behaviors & Animations)
 *
 * Single source of truth for all 8 Butler emotional states, asset mappings,
 * ambient colors, and lightweight CSS visual behavior metadata.
 */

export const EMOTION_IDS = {
  ATTENTIVE: 'attentive',
  CONFIDENT: 'confident',
  CONFUSED: 'confused',
  FRUSTRATED: 'frustrated',
  RELIEVED: 'relieved',
  SURPRISED: 'surprised',
  THINKING: 'thinking',
  WORRIED: 'worried',
};

export const EMOTION_DEFINITIONS = {
  [EMOTION_IDS.ATTENTIVE]: {
    id: EMOTION_IDS.ATTENTIVE,
    label: 'Attentive',
    image: imgAttentive,
    description: 'Calm, focused standby listening state.',
    ambientColor: '#3b82f6', // Calm blue
    ambientGlow: 'rgba(59, 130, 246, 0.35)',
    accentBadge: 'status-idle',
    animation: {
      idleClass: 'idle-attentive',
      enterClass: 'enter-attentive',
      intensity: 'LOW',
      behaviorDescription: 'Calm breathing & subtle forward attention posture',
    },
  },
  [EMOTION_IDS.CONFIDENT]: {
    id: EMOTION_IDS.CONFIDENT,
    label: 'Confident',
    image: imgConfident,
    description: 'Energetic, assured execution and synthesis.',
    ambientColor: '#06b6d4', // Vibrant cyan
    ambientGlow: 'rgba(6, 182, 212, 0.35)',
    accentBadge: 'status-responding',
    animation: {
      idleClass: 'idle-confident',
      enterClass: 'enter-confident',
      intensity: 'LOW-MEDIUM',
      behaviorDescription: 'Controlled upward presence & stable posture',
    },
  },
  [EMOTION_IDS.CONFUSED]: {
    id: EMOTION_IDS.CONFUSED,
    label: 'Confused',
    image: imgConfused,
    description: 'Uncertain, muted evaluation of ambiguous input.',
    ambientColor: '#8b5cf6', // Muted violet
    ambientGlow: 'rgba(139, 92, 246, 0.35)',
    accentBadge: 'status-thinking',
    animation: {
      idleClass: 'idle-confused',
      enterClass: 'enter-confused',
      intensity: 'MEDIUM',
      behaviorDescription: 'Subtle lateral shift & slight hesitation',
    },
  },
  [EMOTION_IDS.FRUSTRATED]: {
    id: EMOTION_IDS.FRUSTRATED,
    label: 'Frustrated',
    image: imgFrustrated,
    description: 'Tense focus resolving task execution failures.',
    ambientColor: '#ef4444', // Tense rose red
    ambientGlow: 'rgba(239, 68, 68, 0.4)',
    accentBadge: 'status-error',
    animation: {
      idleClass: 'idle-frustrated',
      enterClass: 'enter-frustrated',
      intensity: 'MEDIUM',
      behaviorDescription: 'Restrained short tension movement & stiff micro-vibration',
    },
  },
  [EMOTION_IDS.RELIEVED]: {
    id: EMOTION_IDS.RELIEVED,
    label: 'Relieved',
    image: imgRelieved,
    description: 'Calm, released satisfaction after task completion.',
    ambientColor: '#10b981', // Emerald green
    ambientGlow: 'rgba(16, 185, 129, 0.35)',
    accentBadge: 'status-success',
    animation: {
      idleClass: 'idle-relieved',
      enterClass: 'enter-relieved',
      intensity: 'LOW',
      behaviorDescription: 'Gradual downward relaxation & softer ambient release',
    },
  },
  [EMOTION_IDS.SURPRISED]: {
    id: EMOTION_IDS.SURPRISED,
    label: 'Surprised',
    image: imgSurprised,
    description: 'Heightened awareness triggered by unexpected event.',
    ambientColor: '#f59e0b', // Warm amber
    ambientGlow: 'rgba(245, 158, 11, 0.35)',
    accentBadge: 'status-warning',
    animation: {
      idleClass: 'idle-surprised',
      enterClass: 'enter-surprised-oneshot', // One-shot enter reaction
      intensity: 'MEDIUM',
      behaviorDescription: 'Quick one-shot scale lift reaction then gentle settle',
    },
  },
  [EMOTION_IDS.THINKING]: {
    id: EMOTION_IDS.THINKING,
    label: 'Thinking',
    image: imgThinking,
    description: 'Deeply focused cognitive processing.',
    ambientColor: '#0284c7', // Deep sky blue
    ambientGlow: 'rgba(2, 132, 199, 0.35)',
    accentBadge: 'status-processing',
    animation: {
      idleClass: 'idle-thinking',
      enterClass: 'enter-thinking',
      intensity: 'LOW',
      behaviorDescription: 'Slow contemplative drift & deliberate ambient pulse',
    },
  },
  [EMOTION_IDS.WORRIED]: {
    id: EMOTION_IDS.WORRIED,
    label: 'Worried',
    image: imgWorried,
    description: 'Concerned attention to degrading conditions or warnings.',
    ambientColor: '#f97316', // Coral orange
    ambientGlow: 'rgba(249, 115, 22, 0.35)',
    accentBadge: 'status-warning',
    animation: {
      idleClass: 'idle-worried',
      enterClass: 'enter-worried',
      intensity: 'LOW-MEDIUM',
      behaviorDescription: 'Restless micro-floating & irregular subtle movement',
    },
  },
};

/**
 * Preload all 8 emotion image assets into browser memory
 */
export const preloadEmotionAssets = () => {
  if (typeof window === 'undefined') return;
  Object.values(EMOTION_DEFINITIONS).forEach((emotion) => {
    if (emotion.image) {
      const img = new Image();
      img.src = emotion.image;
    }
  });
};
