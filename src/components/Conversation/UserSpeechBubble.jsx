import React from 'react';
import { User } from 'lucide-react';
import './UserSpeechBubble.css';

/**
 * UserSpeechBubble Component (Phase 5.1 — Comic User Input Bubble)
 *
 * Visually distinct pop-art comic bubble for mock user inputs.
 * Positioned on the user input side, pointing left/down towards the user avatar.
 */
export const UserSpeechBubble = ({ text, turnNumber }) => {
  if (!text) return null;

  return (
    <div className="user-speech-bubble-container">
      <div className="user-speech-card">
        <div className="user-speech-header">
          <User size={13} style={{ color: '#38bdf8' }} />
          <span className="user-badge">USER INPUT // TURN {turnNumber}</span>
        </div>
        <div className="user-text-content">{text}</div>
        <div className="user-bubble-tail" />
      </div>
    </div>
  );
};
