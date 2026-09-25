import React, { useRef, useState, useEffect } from 'react';
import { useConversationController } from '../../demo/conversationController';
import { ButlerDisplay } from '../Butler/ButlerDisplay';
import { SpeechBubble } from '../SpeechBubble/SpeechBubble';
import { LoadingOverlay } from '../Loading/LoadingOverlay';
import { ROOM_OBJECTS } from '../../environment/environmentObjects';
import { ButlerNavigator } from '../../environment/butlerNavigator';
import { InteractionController } from '../../environment/interactionController';
import { RoomHotspots } from '../../environment/RoomHotspots';
import { PurchaseOptions } from '../../environment/PurchaseOptions';
import { Info, X, Scaling } from 'lucide-react';
import './ConversationDemo.css';

/**
 * ConversationDemo Component (With Living-Room Environment Navigation & Interaction System)
 *
 * Preserves existing 4 foreground elements + resize handle while adding:
 * - Interactive Room Hotspots (Washing Machine, Cupboard, Telephone)
 * - Automatic smooth Butler movement (moveTo, returnHome) with easing
 * - Scripted appliance diagnostic, cupboard documentation & telephone repair workflow
 * - Compact purchase/replacement options selector
 * - Single SpeechBox message delivery
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

  // Single Parent Floating Group Position, Scale & Pointer Event State
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Environment Interaction & Automatic Navigation State
  const [isNavigating, setIsNavigating] = useState(false);
  const [environmentSpeechText, setEnvironmentSpeechText] = useState(null);
  const [emotionOverride, setEmotionOverride] = useState(null);
  const [activeObjectId, setActiveObjectId] = useState(null);
  const [showPurchaseOptions, setShowPurchaseOptions] = useState(false);

  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const resizeStartRef = useRef({ startX: 0, startY: 0, startScale: 1 });
  const groupRef = useRef(null);

  const navigatorRef = useRef(null);
  const controllerRef = useRef(null);

  const skipRevealRef = useRef(null);
  const loadingTimerRef = useRef(null);

  // Initialize Navigator & Interaction Controller Systems
  useEffect(() => {
    navigatorRef.current = new ButlerNavigator((newPos) => {
      setPos(newPos);
    });

    controllerRef.current = new InteractionController({
      navigator: navigatorRef.current,
      setPos,
      setSpeechText: setEnvironmentSpeechText,
      setEmotionOverride,
      setIsNavigating,
      setShowPurchaseOptions,
    });

    return () => {
      if (navigatorRef.current) {
        navigatorRef.current.cancel();
      }
    };
  }, []);

  // Handle Room Object Selection (Washing Machine Workflow Trigger)
  const handleSelectObject = (objectId) => {
    if (isNavigating) return;
    setActiveObjectId(objectId);

    if (objectId === ROOM_OBJECTS.WASHING_MACHINE.id) {
      const getTargetPos = (targetId) => {
        const containerWidth = groupRef.current?.parentElement?.clientWidth || window.innerWidth;
        const obj = Object.values(ROOM_OBJECTS).find((o) => o.id === targetId);
        if (obj && typeof obj.getPosition === 'function') {
          return obj.getPosition(containerWidth);
        }
        return { x: 0, y: 0 };
      };

      controllerRef.current?.runWashingMachineWorkflow(pos, getTargetPos);
    }
  };

  // Handle Purchase Option Selection
  const handleSelectPurchaseOption = (option) => {
    setShowPurchaseOptions(false);
    setEmotionOverride('confident');
    setEnvironmentSpeechText(`Confirmed order for ${option.name} (${option.price})! Replacement unit scheduled.`);
    setTimeout(() => {
      setEnvironmentSpeechText(null);
      setEmotionOverride(null);
      setActiveObjectId(null);
    }, 4500);
  };

  // MOVE DRAG HANDLERS (Temporarily disabled while Butler is navigating automatically)
  const handlePointerDown = (e) => {
    if (isNavigating) return;

    if (
      e.target.closest('button') ||
      e.target.closest('a') ||
      e.target.closest('.speech-inline-next-btn') ||
      e.target.closest('.butler-info-btn') ||
      e.target.closest('.butler-resize-handle') ||
      e.target.closest('.purchase-option-card')
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
    if (!isDragging || isNavigating) return;

    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    let newX = dragStartRef.current.initialX + deltaX;
    let newY = dragStartRef.current.initialY + deltaY;

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

  // RESIZE HANDLERS (Temporarily disabled while Butler is navigating automatically)
  const handleResizePointerDown = (e) => {
    if (isNavigating) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.target.setPointerCapture && typeof e.target.setPointerCapture === 'function') {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    setIsResizing(true);
    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScale: scale,
    };
  };

  const handleResizePointerMove = (e) => {
    if (!isResizing || isNavigating) return;
    e.stopPropagation();

    const deltaX = e.clientX - resizeStartRef.current.startX;
    const deltaY = e.clientY - resizeStartRef.current.startY;
    const delta = (deltaX + deltaY) / 2;

    const newScale = Math.max(0.6, Math.min(1.6, resizeStartRef.current.startScale + delta * 0.003));
    setScale(newScale);
  };

  const handleResizePointerUp = (e) => {
    if (!isResizing) return;
    e.stopPropagation();
    setIsResizing(false);
    if (e.target.releasePointerCapture && typeof e.target.releasePointerCapture === 'function') {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  const handleNextClick = () => {
    if (isLoading) return;

    if (environmentSpeechText) {
      setEnvironmentSpeechText(null);
      setEmotionOverride(null);
    }

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

  return (
    <div className="conversation-demo-container">
      {/* Full Viewport Backdrop-Blurred Loading Screen */}
      <LoadingOverlay isLoading={isLoading} />

      {/* Interactive Environment Room Hotspots Layer */}
      <RoomHotspots
        onSelectObject={handleSelectObject}
        activeObjectId={activeObjectId}
        isNavigating={isNavigating}
      />

      {/* SINGLE PARENT DRAGGABLE & RESIZABLE FLOATING GROUP */}
      <div
        ref={groupRef}
        className={`butler-floating-group ${isDragging ? 'is-dragging' : ''} ${
          isResizing ? 'is-resizing' : ''
        } ${isNavigating ? 'is-navigating' : ''}`}
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0px) scale(${scale})`,
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
          overrideEmotion={emotionOverride || stewardState?.overrideEmotion}
          showDebug={false}
        />

        {/* 2 & 3. Butler Speech Box containing Response Text + NEXT Button inside */}
        <SpeechBubble
          text={environmentSpeechText || currentTurn?.assistantText}
          onSkipReady={(fn) => {
            skipRevealRef.current = fn;
          }}
          onNextClick={handleNextClick}
          isLastTurn={isLastTurn}
          isLoading={isLoading}
        />

        {/* Purchase Options Selector inside interaction flow */}
        {showPurchaseOptions && (
          <PurchaseOptions onSelectOption={handleSelectPurchaseOption} />
        )}

        {/* 4. Info / Settings Icon Button (ⓘ) */}
        <button
          type="button"
          className="butler-info-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoModal(true);
          }}
          title="System Status & Settings"
          aria-label="System Information and Settings"
        >
          <Info size={16} />
        </button>

        {/* 5. Bottom-Right Resize Handle */}
        {!isNavigating && (
          <div
            className={`butler-resize-handle ${isResizing ? 'is-resizing' : ''}`}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Click and drag to resize Butler group"
            aria-label="Resize Butler group"
          >
            <Scaling size={10} style={{ transform: 'rotate(90deg)' }} />
          </div>
        )}
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
                <span className="info-label">Navigation State:</span>
                <span className="info-value">
                  {isNavigating ? 'AUTO NAVIGATING' : 'IDLE / STANDBY'}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Turn Progress:</span>
                <span className="info-value">
                  Turn {turnNumber} of {totalTurns}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

