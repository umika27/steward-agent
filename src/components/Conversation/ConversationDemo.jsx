import React, { useRef, useState, useEffect } from 'react';
import { useConversationController } from '../../demo/conversationController';
import { ButlerDisplay } from '../Butler/ButlerDisplay';
import { SpeechBubble } from '../SpeechBubble/SpeechBubble';
import { LoadingOverlay } from '../Loading/LoadingOverlay';
import livingRoomBg from '../../assets/living-room-bg.jpg';
import { useSceneStore } from '../../scene/sceneStore';
import { SceneDetectionVisualizer } from '../../scene/SceneDetectionVisualizer';
import { InteractiveScene } from '../Scene/InteractiveScene';
import { sceneInteractionController } from '../../scene/sceneInteractionController';
import { butlerNavigator } from '../../navigation/butlerNavigator';
import { taskEngine, TASK_EVENT_TYPES } from '../../tasks/taskEngine';
import { reasoningController } from '../../intelligence/reasoningController';
import { autonomyController } from '../../autonomy/autonomyController';
import { ROOM_OBJECTS } from '../../environment/environmentObjects';
import { PurchaseOptions } from '../../environment/PurchaseOptions';
import { Info, X, Scaling, Eye, ShieldAlert, Upload, RotateCcw, Cpu, Sparkles } from 'lucide-react';
import { getCurrentProviderType, setVisionProviderType } from '../../scene/visionProviders/visionProviderFactory';
import { globalSceneAnalyzer } from '../../scene/sceneStore';
import { getImageGenerationProvider } from '../../scene/imageGeneration/imageGenerationProviderFactory';
import { conditionDecisionController } from '../../scene/conditionDecisionController';
import { sceneImageStore } from '../../scene/sceneImageStore';
import { validateSceneContract } from '../../scene/imageGeneration/sceneContractValidator';
import './ConversationDemo.css';

/**
 * ConversationDemo Component (With Phase 1 — Scene Perception System)
 *
 * Integrates:
 * - Scene Perception Store & Vision Provider Pipeline
 * - Development-Only Scene Detection Bounding-Box Visualizer
 * - Living-Room Background & Normalized Object Detection Schema
 * - Floating Draggable & Resizable Butler Group
 * - Single SpeechBox Interface
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

  // Phase 1 - 6 Scene Perception & Image Upload Engine
  const {
    sceneState,
    imageSnapshot,
    isDebugVisualizerOpen,
    toggleDebugVisualizer,
    uploadSceneImage,
    resetSceneImage,
  } = useSceneStore(livingRoomBg);

  const [isLoading, setIsLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      taskEngine.cancelTask();
      butlerNavigator.cancelNavigation();
      sceneInteractionController.clearSelection();
      setEnvironmentSpeechText(null);
      setEmotionOverride(null);

      await uploadSceneImage(file);
    } catch (err) {
      alert(err.message || 'Failed to upload scene image');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleResetScene = () => {
    taskEngine.cancelTask();
    butlerNavigator.cancelNavigation();
    sceneInteractionController.clearSelection();
    setEnvironmentSpeechText(null);
    setEmotionOverride(null);

    resetSceneImage();
  };

  const handleGenerateScene = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const maxAttempts = 3;
    let attempt = 0;
    let validScene = false;
    let acceptedSource = null;
    let acceptedWidth = 1920;
    let acceptedHeight = 1080;

    try {
      taskEngine.cancelTask();
      butlerNavigator.cancelNavigation();
      sceneInteractionController.clearSelection();
      setEnvironmentSpeechText(null);
      setEmotionOverride(null);

      const provider = getImageGenerationProvider();

      while (attempt < maxAttempts && !validScene) {
        attempt++;
        const result = await provider.generateScene();

        if (!result || !result.imageSource) {
          continue;
        }

        // 1. Normalize image source (Blob vs Object URL vs Data URL vs URL string)
        let normalizedSrc = result.imageSource;
        let createdTempUrl = null;

        if (typeof Blob !== 'undefined' && result.imageSource instanceof Blob) {
          createdTempUrl = URL.createObjectURL(result.imageSource);
          normalizedSrc = createdTempUrl;
        }

        const width = result.width || 1920;
        const height = result.height || 1080;

        // 2. Perform Vision Perception BEFORE setting visible background
        const newSceneState = await globalSceneAnalyzer.analyzeScene(normalizedSrc, true, {
          width,
          height,
        });

        // 3. Audit Scene Contract (brokenCount >= 1 && brokenCount <= 1)
        const validation = validateSceneContract(newSceneState);

        if (validation.valid) {
          validScene = true;
          acceptedSource = normalizedSrc;
          acceptedWidth = width;
          acceptedHeight = height;
          break;
        } else {
          console.warn(`Scene Contract Rejected (Attempt ${attempt}/${maxAttempts}): ${validation.reason}`);
          if (createdTempUrl) {
            URL.revokeObjectURL(createdTempUrl);
          }
        }
      }

      if (validScene && acceptedSource) {
        // 4. ACCEPT: Load validated scene into active image store and render background
        sceneImageStore.loadGeneratedScene(acceptedSource, acceptedWidth, acceptedHeight);

        setEnvironmentSpeechText('New room prepared.');
        setEmotionOverride('attentive');
        setTimeout(() => {
          setEnvironmentSpeechText(null);
          setEmotionOverride(null);
        }, 3000);
      } else {
        // Fallback if all 3 generation attempts failed contract validation
        setEnvironmentSpeechText("I couldn't prepare the room. Try again.");
        setEmotionOverride('worried');
      }
    } catch (err) {
      console.error('Generation pipeline error:', err);
      setEnvironmentSpeechText("I couldn't prepare the room. Try again.");
      setEmotionOverride('worried');
    } finally {
      setIsLoading(false);
    }
  };

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

  // Phase 5 — Task & Interaction Engine Integration
  useEffect(() => {
    const getGeometryContext = () => {
      const parentEl = groupRef.current?.parentElement || document.body;
      const containerWidth = parentEl.clientWidth || window.innerWidth;
      const containerHeight = parentEl.clientHeight || window.innerHeight;
      const groupWidth = groupRef.current?.offsetWidth || 320;
      const groupHeight = groupRef.current?.offsetHeight || 360;
      const rect = groupRef.current?.getBoundingClientRect();
      const baseLeft = rect ? rect.left - pos.x : 0;
      const baseTop = rect ? rect.top - pos.y : 0;

      return {
        containerWidth,
        containerHeight,
        groupWidth,
        groupHeight,
        scale,
        baseLeft,
        baseTop,
      };
    };

    const unsubNav = butlerNavigator.subscribe((event, stateSnapshot) => {
      if (stateSnapshot.state === 'MOVING') {
        setIsNavigating(true);
      } else {
        setIsNavigating(false);
      }
    });

    const unsubTask = taskEngine.subscribe((event) => {
      switch (event.type) {
        case TASK_EVENT_TYPES.TASK_NAVIGATION_REQUESTED:
          if (event.returnHome) {
            butlerNavigator.returnHome((newPixelPos) => {
              setPos(newPixelPos);
            }, getGeometryContext());
          } else if (event.targetObject) {
            butlerNavigator.navigateTo(
              event.targetObject,
              (newPixelPos) => {
                setPos(newPixelPos);
              },
              getGeometryContext()
            );
          }
          break;

        case TASK_EVENT_TYPES.TASK_SPEECH_REQUESTED:
          setEnvironmentSpeechText(event.text);
          setEmotionOverride('attentive');
          break;

        case TASK_EVENT_TYPES.TASK_COMPLETED:
          setEmotionOverride('confident');
          setTimeout(() => {
            setEnvironmentSpeechText(null);
            setEmotionOverride(null);
          }, 3500);
          break;

        case TASK_EVENT_TYPES.TASK_CANCELLED:
          setEnvironmentSpeechText(null);
          setEmotionOverride(null);
          break;

        default:
          break;
      }
    });

    const unsubInteraction = sceneInteractionController.subscribe((event) => {
      if (event.type === 'SCENE_OBJECT_SELECTED' && event.object) {
        const outcome = conditionDecisionController.processObjectSelection(event.object, sceneState);
        if (outcome.action === 'NORMAL_RESPONSE' && outcome.speechText) {
          setEnvironmentSpeechText(outcome.speechText);
          setEmotionOverride('confident');
          setTimeout(() => {
            setEnvironmentSpeechText(null);
            setEmotionOverride(null);
          }, 3500);
        } else if (outcome.speechText) {
          setEnvironmentSpeechText(outcome.speechText);
          setEmotionOverride('thinking');
        }
      } else if (event.type === 'SCENE_SELECTION_CLEARED') {
        taskEngine.cancelTask();
        setEnvironmentSpeechText(null);
        setEmotionOverride(null);
        butlerNavigator.returnHome((newPixelPos) => {
          setPos(newPixelPos);
        }, getGeometryContext());
      }
    });

    const unsubReasoning = reasoningController.subscribe((event, snapshot) => {
      switch (snapshot.state) {
        case 'ANALYZING':
          setEmotionOverride('thinking');
          setEnvironmentSpeechText('Analyzing request...');
          break;
        case 'PLAN_READY':
          setEmotionOverride('confident');
          break;
        case 'NEEDS_CLARIFICATION':
          setEmotionOverride('thinking');
          setEnvironmentSpeechText(snapshot.clarificationQuestion || 'Which object would you like me to inspect?');
          break;
        case 'INVALID_PLAN':
          setEmotionOverride('worried');
          setEnvironmentSpeechText(snapshot.lastError || 'Invalid task plan generated.');
          break;
        case 'NO_TARGET':
          setEmotionOverride('confused');
          setEnvironmentSpeechText(snapshot.lastError || 'Target object not found in scene.');
          break;
        case 'ERROR':
          setEmotionOverride('frustrated');
          setEnvironmentSpeechText(snapshot.lastError || 'Failed to process task reasoning request.');
          break;
        default:
          break;
      }
    });

    const unsubAutonomy = autonomyController.subscribe((event, snapshot) => {
      switch (snapshot.state) {
        case 'EXECUTING':
        case 'MONITORING':
          setEmotionOverride('attentive');
          break;
        case 'RECOVERING':
          setEmotionOverride('worried');
          setEnvironmentSpeechText('I couldn\'t reach that target. Attempting recovery...');
          break;
        case 'REPLANNING':
          setEmotionOverride('thinking');
          setEnvironmentSpeechText('The situation changed. Adjusting plan...');
          break;
        case 'WAITING_FOR_USER':
          setEmotionOverride('thinking');
          break;
        case 'COMPLETED':
          setEmotionOverride('relieved');
          break;
        case 'FAILED':
          setEmotionOverride('frustrated');
          break;
        default:
          break;
      }
    });

    return () => {
      unsubNav();
      unsubTask();
      unsubInteraction();
      unsubReasoning();
      unsubAutonomy();
    };
  }, [scale, pos.x, pos.y, sceneState?.objects]);

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
      {/* Dynamic Full Viewport Scene Background Layer */}
      <div
        className="custom-scene-background"
        style={{
          backgroundImage: `linear-gradient(rgba(9, 12, 21, 0.42), rgba(9, 12, 21, 0.48)), url(${imageSnapshot?.source || livingRoomBg})`,
        }}
      />

      {/* Full Viewport Backdrop-Blurred Loading Screen */}
      <LoadingOverlay isLoading={isLoading} />

      {/* Minimal Top Scene Generate Action Bar */}
      <div className="scene-generate-bar">
        <button
          type="button"
          className="generate-scene-btn"
          onClick={handleGenerateScene}
          disabled={isLoading}
          title="Generate new AI Environment"
        >
          <Sparkles size={14} />
          <span>Generate</span>
        </button>
      </div>

      {/* Development-Only Scene Perception Visualizer Overlay */}
      <SceneDetectionVisualizer
        sceneState={sceneState}
        isVisible={isDebugVisualizerOpen}
        onToggle={toggleDebugVisualizer}
      />

      {/* Phase 3 Interactive Detected Scene Layer */}
      <InteractiveScene
        sceneState={sceneState}
        imageWidth={imageSnapshot?.width || 1920}
        imageHeight={imageSnapshot?.height || 1080}
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
                <span className="info-label">Scene Source:</span>
                <span className="info-value">
                  {imageSnapshot?.sourceType === 'upload'
                    ? `UPLOAD (${imageSnapshot.width}x${imageSnapshot.height})`
                    : `DEFAULT (${imageSnapshot.width}x${imageSnapshot.height})`}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Vision Provider:</span>
                <span className="info-value status-tag">
                  {getCurrentProviderType().toUpperCase()} {getCurrentProviderType() === 'ai' ? `(${import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'})` : ''}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Scene Perception:</span>
                <span className="info-value status-tag">
                  {sceneState?.status?.toUpperCase() || 'IDLE'} ({sceneState?.objects?.length || 0} OBJECTS)
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Turn Progress:</span>
                <span className="info-value">
                  Turn {turnNumber} of {totalTurns}
                </span>
              </div>

              {/* Hidden File Input for Image Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />

              {/* Phase 12A Image Generation Trigger */}
              <button
                type="button"
                className="info-visualizer-toggle-btn upload-btn"
                onClick={() => {
                  setShowInfoModal(false);
                  handleGenerateScene();
                }}
              >
                <Sparkles size={13} />
                <span>GENERATE NEW AI SCENE</span>
              </button>

              {/* Phase 6 Image Upload Control */}
              <button
                type="button"
                className="info-visualizer-toggle-btn upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                <span>UPLOAD NEW SCENE IMAGE</span>
              </button>

              {/* Reset to Default Scene Button */}
              {imageSnapshot?.sourceType === 'upload' && (
                <button
                  type="button"
                  className="info-visualizer-toggle-btn reset-btn"
                  onClick={handleResetScene}
                >
                  <RotateCcw size={13} />
                  <span>RESET TO DEFAULT SCENE</span>
                </button>
              )}

              {/* Phase 7.1 Provider Switcher Button */}
              <button
                type="button"
                className="info-visualizer-toggle-btn"
                onClick={() => {
                  const nextType = getCurrentProviderType() === 'mock' ? 'ai' : 'mock';
                  setVisionProviderType(nextType);
                  if (imageSnapshot?.source) {
                    globalSceneAnalyzer.analyzeScene(imageSnapshot.source, true, {
                      width: imageSnapshot.width,
                      height: imageSnapshot.height,
                    });
                  }
                }}
              >
                <Cpu size={13} />
                <span>
                  {getCurrentProviderType() === 'mock'
                    ? 'SWITCH TO AI VISION PROVIDER'
                    : 'SWITCH TO MOCK VISION PROVIDER'}
                </span>
              </button>

              {/* Dev Scene Detection Toggle Button */}
              <button
                type="button"
                className="info-visualizer-toggle-btn"
                onClick={toggleDebugVisualizer}
              >
                <Eye size={13} />
                <span>
                  {isDebugVisualizerOpen
                    ? 'HIDE PERCEPTION DETECTION OVERLAY'
                    : 'SHOW PERCEPTION DETECTION OVERLAY'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

