import React, { useRef, useState, useEffect } from 'react';
import { useConversationController } from '../../demo/conversationController';
import { ButlerDisplay } from '../Butler/ButlerDisplay';
import { SpeechBubble } from '../SpeechBubble/SpeechBubble';
import { LoadingOverlay } from '../Loading/LoadingOverlay';
import { Info, X } from 'lucide-react';
import './ConversationDemo.css';

/**
 * ConversationDemo Component (Simplified Floating Living-Room Interface)
 *
 * ONLY 4 visible foreground elements:
 * 1. ONE Butler character image
 * 2. ONE Butler response text box
 * 3. ONE NEXT button (placed inside text box on the right)
 * 4. ONE INFO icon button (ⓘ)
 *
 * Everything belongs to ONE parent draggable container (.butler-floating-group).
 */
export const ConversationDemo = ({ stewardState }) => {
  const {
    turnNumber,
    totalTurns,
    currentTurn,
    isLastTurn,
    nextTurn,
    restartConversation,
  } = useConversationController();

  const [isLoading, setIsLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Single Parent Draggable Floating Group Position & Pointer Drag State
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const groupRef = useRef(null);

  const skipRevealRef = useRef(null);
  const loadingTimerRef = useRef(null);

  const handlePointerDown = (e) => {
    // Prevent drag when clicking interactive buttons (NEXT button or Info icon button)
    if (
      e.target.closest('button') ||
      e.target.closest('a') ||
      e.target.closest('.speech-inline-next-btn') ||
      e.target.closest('.butler-info-btn')
    ) {
      return;
    }

    e.preventDefault();

    if (groupRef.current && typeof groupRef.current.setPointerCapture === 'function') {
      try {
        groupRef.current.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: pos.x,
      initialY: pos.y,
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    let newX = dragStartRef.current.initialX + deltaX;
    let newY = dragStartRef.current.initialY + deltaY;

    // Viewport containment bounding clamp (Keep floating group inside viewport)
    if (groupRef.current) {
      const rect = groupRef.current.getBoundingClientRect();
      const baseLeft = rect.left - pos.x;
      const baseTop = rect.top - pos.y;

      const minX = 16 - baseLeft;
      const maxX = window.innerWidth - 16 - baseLeft - rect.width;
      const minY = 16 - baseTop;
      const maxY = window.innerHeight - 16 - baseTop - rect.height;

      newX = Math.max(minX, Math.min(maxX, newX));
      newY = Math.max(minY, Math.min(maxY, newY));
    }

    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (groupRef.current && typeof groupRef.current.releasePointerCapture === 'function') {
      try {
        groupRef.current.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handleNextClick = () => {
    if (isLoading) return;

    if (typeof skipRevealRef.current === 'function') {
      skipRevealRef.current();
    }

    setIsLoading(true);

    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }

    loadingTimerRef.current = setTimeout(() => {
      if (isLastTurn) {
        restartConversation();
      } else {
        nextTurn();
      }
      setIsLoading(false);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="conversation-demo-container">
      {/* Full Viewport Backdrop-Blurred Loading Screen */}
      <LoadingOverlay isLoading={isLoading} />

      {/* SINGLE PARENT DRAGGABLE FLOATING GROUP */}
      <div
        ref={groupRef}
        className={`butler-floating-group ${isDragging ? 'is-dragging' : ''}`}
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0px)`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* 1. Butler Character Image */}
        <ButlerDisplay
          status={stewardState?.status || currentTurn?.status}
          context={stewardState?.context || currentTurn?.context || {}}
          overrideEmotion={stewardState?.overrideEmotion}
          showDebug={false}
        />

        {/* 2 & 3. Butler Speech Box containing Response Text + NEXT Button inside */}
        <SpeechBubble
          text={currentTurn?.assistantText}
          onSkipReady={(fn) => {
            skipRevealRef.current = fn;
          }}
          onNextClick={handleNextClick}
          isLastTurn={isLastTurn}
          isLoading={isLoading}
        />

        {/* 4. Info / Settings Icon Button (ⓘ) */}
        <button
          type="button"
          className="butler-info-btn"
          onClick={(e) => {
            e.stopPropagation(); // Stop drag event trigger
            setShowInfoModal(true);
          }}
          title="System Status & Settings"
          aria-label="System Information and Settings"
        >
          <Info size={16} />
        </button>
      </div>

      {/* Clean Modal Popup for Settings / System Information */}
      {showInfoModal && (
        <div
          className="info-modal-backdrop"
          onClick={() => setShowInfoModal(false)}
        >
          <div
            className="info-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="info-modal-header">
              <div className="info-modal-title">
                <Info size={16} style={{ color: '#fbbf24' }} />
                <span>STEWARD BUTLER SYSTEM INFO</span>
              </div>
              <button
                type="button"
                className="info-modal-close-btn"
                onClick={() => setShowInfoModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="info-modal-body">
              <div className="info-row">
                <span className="info-label">Active Status:</span>
                <span className="info-value status-tag">
                  {stewardState?.status || currentTurn?.status || 'IDLE'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Turn Progress:</span>
                <span className="info-value">
                  Turn {turnNumber} of {totalTurns}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">User Query context:</span>
                <span className="info-value text-dim font-mono">
                  {currentTurn?.userText || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

