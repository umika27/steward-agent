import React, { useEffect, useState, useRef } from 'react';
import { useSpeechEngine } from '../../speech/useSpeechEngine';
import { Mic, Send } from 'lucide-react';
import './GameDialogueBox.css';

/**
 * GameDialogueBox Component
 *
 * Cinematic RPG / Game-style compact dialogue box for Steward character interactions.
 * Features:
 * - Speaker identification badge ("STEWARD")
 * - Progressive typewriter text reveal with click-to-skip
 * - Contextual memory/state snippet pill (revealed only when relevant)
 * - Interactive contextual choice buttons
 * - Single-line text input & browser-native voice recognition (🎙) below choices
 */
export const GameDialogueBox = ({
  speaker = 'STEWARD',
  text,
  contextSnippet = null,
  choices = [],
  onChoiceSelect,
  onSkipReady,
  isLoading = false,
}) => {
  const { displayedText, skipReveal, isRevealing } = useSpeechEngine(text);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const recognitionRef = useRef(null);
  const statusTimerRef = useRef(null);

  useEffect(() => {
    if (onSkipReady) {
      onSkipReady(skipReveal);
    }
  }, [onSkipReady, skipReveal]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }
      if (statusTimerRef.current) {
        clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  const showStatusMessage = (msg) => {
    setVoiceStatus(msg);
    if (statusTimerRef.current) {
      clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = setTimeout(() => {
      setVoiceStatus(null);
    }, 3200);
  };

  // Toggle Browser Native Voice Recognition (SpeechRecognition)
  const handleVoiceToggle = (e) => {
    e.stopPropagation();

    // Check if browser supports native SpeechRecognition
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      showStatusMessage('Voice input unavailable in this browser');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceStatus('Listening...');
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText(transcript);
        }
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          showStatusMessage('Microphone permission denied');
        } else if (event.error === 'no-speech') {
          showStatusMessage('No speech detected');
        } else {
          showStatusMessage('Voice input unavailable');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (statusTimerRef.current) {
          clearTimeout(statusTimerRef.current);
        }
        statusTimerRef.current = setTimeout(() => {
          setVoiceStatus(null);
        }, 1200);
      };

      recognition.start();
    } catch (err) {
      console.warn('SpeechRecognition start error:', err);
      setIsListening(false);
      showStatusMessage('Voice input unavailable');
    }
  };

  // Handle Text/Voice Submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      setIsListening(false);
    }

    const trimmed = inputText.trim();
    if (!trimmed || isLoading) {
      return;
    }

    setInputText('');
    setVoiceStatus(null);
    if (onChoiceSelect) {
      onChoiceSelect(trimmed);
    }
  };

  const isWaitingForInput = choices && choices.length > 0 && !isRevealing;

  if (!text && (!choices || choices.length === 0)) {
    return null;
  }

  return (
    <div className="game-dialogue-container fade-in" onClick={skipReveal}>
      <div className="game-dialogue-card">
        {/* Speaker Name Tag */}
        <div className="game-dialogue-speaker-tag">
          <span className="speaker-dot" />
          <span className="speaker-name">{speaker}</span>
        </div>

        {/* Dialogue Text Body */}
        <div className="game-dialogue-body">
          <p className="game-dialogue-text">
            {displayedText}
            {isRevealing && <span className="game-dialogue-cursor" aria-hidden="true" />}
          </p>

          {/* Contextual Information Snippet (Only revealed when story demands) */}
          {contextSnippet && (
            <div className="game-dialogue-context-snippet fade-in">
              <span className="context-snippet-label">{contextSnippet.label}:</span>
              <span className="context-snippet-value">{contextSnippet.value}</span>
            </div>
          )}

          {/* Option 1: Predefined Interactive Choices */}
          {isWaitingForInput && (
            <div className="game-dialogue-choices fade-in">
              {choices.map((choice, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`game-dialogue-choice-btn ${choice.primary ? 'is-primary' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onChoiceSelect) {
                      onChoiceSelect(choice);
                    }
                  }}
                  disabled={isLoading || choice.disabled}
                >
                  <span className="choice-bullet">›</span>
                  <span className="choice-text">{choice.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Option 2 & Option 3: Unified Text + Voice Input Row */}
          {isWaitingForInput && (
            <form
              className="game-dialogue-input-form fade-in"
              onSubmit={handleFormSubmit}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`game-dialogue-input-wrapper ${isListening ? 'is-listening' : ''}`}>
                <input
                  type="text"
                  className="game-dialogue-text-input"
                  placeholder={isListening ? 'Listening...' : 'Type your response...'}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isLoading}
                  aria-label="Type your response"
                />

                {/* Microphone Button (🎙) */}
                <button
                  type="button"
                  className={`game-dialogue-voice-btn ${isListening ? 'is-listening' : ''}`}
                  onClick={handleVoiceToggle}
                  title={isListening ? 'Listening... Click to stop' : 'Click to speak'}
                  aria-label={isListening ? 'Stop listening' : 'Voice input'}
                  disabled={isLoading}
                >
                  {isListening ? (
                    <span className="voice-listening-pulse" />
                  ) : (
                    <Mic size={14} className="voice-mic-icon" />
                  )}
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  className="game-dialogue-send-btn"
                  disabled={isLoading || !inputText.trim()}
                  title="Send response"
                  aria-label="Send response"
                >
                  <Send size={12} className="send-icon" />
                  <span className="send-label">Send</span>
                </button>
              </div>

              {/* Status / Error Toast */}
              {voiceStatus && (
                <div className="game-dialogue-voice-status fade-in">
                  <span className="voice-status-dot" />
                  <span className="voice-status-text">{voiceStatus}</span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameDialogueBox;
