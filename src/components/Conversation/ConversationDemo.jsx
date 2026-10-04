import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useConversationController } from '../../demo/conversationController';
import { ButlerDisplay } from '../Butler/ButlerDisplay';
import { GameDialogueBox } from '../SpeechBubble/GameDialogueBox';
import { LoadingOverlay } from '../Loading/LoadingOverlay';
import livingRoomBg from '../../assets/living-room-bg.jpg';
import { useSceneStore } from '../../scene/sceneStore';
import { sceneImageStore } from '../../scene/sceneImageStore';
import { SceneDetectionVisualizer } from '../../scene/SceneDetectionVisualizer';
import { InteractiveScene } from '../Scene/InteractiveScene';
import { sceneInteractionController } from '../../scene/sceneInteractionController';
import { butlerNavigator } from '../../navigation/butlerNavigator';
import { taskEngine, TASK_EVENT_TYPES } from '../../tasks/taskEngine';
import { reasoningController } from '../../intelligence/reasoningController';
import { autonomyController } from '../../autonomy/autonomyController';
import { Info, X, Scaling, Eye, LayoutDashboard, RotateCcw, RefreshCw } from 'lucide-react';
import { conditionDecisionController } from '../../scene/conditionDecisionController';
import { CaseDashboard } from '../Case/CaseDashboard';
import { stewardCaseAdapter } from '../../integration/stewardCaseAdapter';
import { SCENARIO_KEYS } from '../../case/caseTypes';
import { roomWallpaperManager, scenes } from '../../scene/roomWallpaperManager';
import './ConversationDemo.css';

/**
 * Story Stage Enum for Autonomous Progression
 */
export const STORY_STAGES = {
  INITIAL_WELCOME: 'INITIAL_WELCOME',
  SEARCH_PROMPT: 'SEARCH_PROMPT',
  SEARCHING: 'SEARCHING',
  OBJECT_DISCOVERED: 'OBJECT_DISCOVERED',
  DAMAGE_REVEALED: 'DAMAGE_REVEALED',
  FOCUSED_INVESTIGATION: 'FOCUSED_INVESTIGATION',
  REVEALED_HISTORY: 'REVEALED_HISTORY',
  REVIEWING_MANUAL: 'REVIEWING_MANUAL',
  ARRANGING_REPAIR: 'ARRANGING_REPAIR',
  CALLING_DISPATCH: 'CALLING_DISPATCH',
  COMPLETED: 'COMPLETED',
};

/**
 * ConversationDemo Component
 *
 * Atomic Scene Architecture:
 * - currentScene controls: wallpaper, brokenObject, and displayName as ONE synchronized unit.
 * - Clicking the small scene-change icon (⟳) triggers changeScene() to transition immediately
 *   to a new random room wallpaper and its corresponding broken object.
 */
export const ConversationDemo = ({ stewardState }) => {
  // ONE Authoritative Scene State
  const [currentScene, setCurrentScene] = useState(() => roomWallpaperManager.getCurrentScene());
  const [isTransitioningScene, setIsTransitioningScene] = useState(false);
  const [showProblemIndicator, setShowProblemIndicator] = useState(false);

  const {
    sceneState,
    imageSnapshot,
    isDebugVisualizerOpen,
    toggleDebugVisualizer,
  } = useSceneStore(currentScene.wallpaper || livingRoomBg);

  const [isLoading, setIsLoading] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCaseDashboard, setShowCaseDashboard] = useState(false);

  // Position, Scale & Drag/Resize State
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Character Emotion & Story State
  const [emotionOverride, setEmotionOverride] = useState(null);
  const [storyStage, setStoryStage] = useState(STORY_STAGES.INITIAL_WELCOME);
  const [dialogueState, setDialogueState] = useState({
    speaker: 'STEWARD',
    text: "Welcome home. I'm Steward.\nLet me check things around the house.",
    snippet: null,
    choices: [],
  });

  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const resizeStartRef = useRef({ startX: 0, startY: 0, startScale: 1 });
  const groupRef = useRef(null);
  const skipRevealRef = useRef(null);
  const autoFlowTimers = useRef([]);

  const getGeometryContext = useCallback(() => {
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
  }, [pos.x, pos.y, scale]);

  // Clear all autonomous timers
  const clearTimers = useCallback(() => {
    autoFlowTimers.current.forEach((t) => clearTimeout(t));
    autoFlowTimers.current = [];
  }, []);

  /**
   * STEP 1 & 2: Welcome & Search Prompt Initiation Sequence
   */
  const startWelcomeAndSearchSequence = useCallback((scene = currentScene) => {
    clearTimers();
    sceneInteractionController.resetSceneInteraction();
    setShowProblemIndicator(false);
    setStoryStage(STORY_STAGES.INITIAL_WELCOME);
    setEmotionOverride('attentive');
    setDialogueState({
      speaker: 'STEWARD',
      text: "Welcome home. I'm Steward.\nLet me check things around the house.",
      snippet: null,
      choices: [],
    });

    const t1 = setTimeout(() => {
      setStoryStage(STORY_STAGES.SEARCH_PROMPT);
      setEmotionOverride('attentive');
      setDialogueState({
        speaker: 'STEWARD',
        text: 'Where should I start looking?',
        snippet: null,
        choices: [
          { id: 'START_SEARCH', label: 'Search the house', primary: true },
        ],
      });
    }, 2200);
    autoFlowTimers.current.push(t1);
  }, [clearTimers, currentScene]);

  /**
   * STEP 3, 4, 5 & 6: Search Exploration -> Discovery -> Damage Reveal -> Investigation Choices
   */
  const performEnvironmentSearch = useCallback((scene = currentScene) => {
    clearTimers();
    setStoryStage(STORY_STAGES.SEARCHING);
    setEmotionOverride('thinking');
    setDialogueState({
      speaker: 'STEWARD',
      text: 'Let me take a look around.',
      snippet: null,
      choices: [],
    });

    const brokenData = scene.brokenObject;
    const displayName = scene.displayName || 'appliance';

    // Stage 3a: Environment observation phase (1.3s)
    const t1 = setTimeout(() => {
      setDialogueState({
        speaker: 'STEWARD',
        text: "Something doesn't look right over there.",
        snippet: null,
        choices: [],
      });

      const targetObj = (sceneState?.objects || scene.objects || []).find(
        (o) =>
          o.id === brokenData.id ||
          o.condition === 'MALFUNCTIONING' ||
          o.condition === 'DAMAGED' ||
          o.condition === 'BROKEN' ||
          (o.label || '').toLowerCase().includes(displayName.toLowerCase())
      ) || brokenData;

      // Stage 3b: Navigate towards the problem object
      butlerNavigator
        .navigateTo(
          targetObj,
          (newPixelPos) => setPos(newPixelPos),
          getGeometryContext()
        )
        .then(() => {
          // STEP 4: Object reached & discovered -> Reveal problem indicator & lock focus
          setStoryStage(STORY_STAGES.OBJECT_DISCOVERED);
          setShowProblemIndicator(true);
          sceneInteractionController.setFocusedInvestigation(targetObj);
          setEmotionOverride('thinking');
          setDialogueState({
            speaker: 'STEWARD',
            text: `There's a problem with this ${displayName}.`,
            snippet: null,
            choices: [],
          });

          // STEP 5 & 6: Damage revealed & present investigation choices
          const t2 = setTimeout(() => {
            setStoryStage(STORY_STAGES.FOCUSED_INVESTIGATION);
            setEmotionOverride('attentive');
            setDialogueState({
              speaker: 'STEWARD',
              text: `The ${displayName} isn't behaving normally. What should I check first?`,
              snippet: null,
              choices: [
                { id: 'CHECK_HISTORY', label: 'Check repair history', primary: true },
                { id: 'CHECK_MANUAL', label: 'Review user manual' },
                { id: 'ARRANGE_REPAIR', label: 'Arrange repair service' },
              ],
            });
          }, 2000);
          autoFlowTimers.current.push(t2);
        });
    }, 1300);
    autoFlowTimers.current.push(t1);
  }, [clearTimers, currentScene, getGeometryContext, sceneState?.objects]);

  /**
   * Atomic Scene Change Handler
   */
  const changeScene = useCallback(() => {
    clearTimers();
    setIsTransitioningScene(true);

    const nextScene = roomWallpaperManager.selectNextRandomScene();
    setCurrentScene(nextScene);
    sceneImageStore.loadDefaultScene(nextScene.wallpaper);
    sceneInteractionController.resetSceneInteraction();
    setShowProblemIndicator(false);

    butlerNavigator.returnHome(
      (newPixelPos) => setPos(newPixelPos),
      getGeometryContext()
    );

    // Subtle fade transition (300ms)
    setTimeout(() => {
      setIsTransitioningScene(false);
      startWelcomeAndSearchSequence(nextScene);
    }, 320);
  }, [clearTimers, getGeometryContext, startWelcomeAndSearchSequence]);

  // Direct manual inspection trigger (if user clicks the focused object)
  const triggerDirectInspectionFlow = useCallback((targetObj) => {
    clearTimers();
    const brokenData = currentScene.brokenObject;
    const target = targetObj || brokenData;
    const displayName = currentScene.displayName || 'appliance';
    const issueDesc = brokenData.issueDescription || 'A malfunction has been detected.';

    setShowProblemIndicator(true);
    sceneInteractionController.setFocusedInvestigation(target);
    setStoryStage(STORY_STAGES.SEARCHING);
    setEmotionOverride('thinking');
    setDialogueState({
      speaker: 'STEWARD',
      text: `Moving to inspect the ${displayName}...`,
      snippet: null,
      choices: [],
    });

    butlerNavigator
      .navigateTo(
        target,
        (newPixelPos) => setPos(newPixelPos),
        getGeometryContext()
      )
      .then(() => {
        setStoryStage(STORY_STAGES.OBJECT_DISCOVERED);
        setEmotionOverride('thinking');
        setDialogueState({
          speaker: 'STEWARD',
          text: `Inspecting the ${displayName}... ${issueDesc}`,
          snippet: null,
          choices: [],
        });

        const t3 = setTimeout(() => {
          setStoryStage(STORY_STAGES.FOCUSED_INVESTIGATION);
          setEmotionOverride('attentive');
          setDialogueState({
            speaker: 'STEWARD',
            text: `The ${displayName} isn't behaving normally. What should I check first?`,
            snippet: null,
            choices: [
              { id: 'CHECK_HISTORY', label: 'Check repair history', primary: true },
              { id: 'CHECK_MANUAL', label: 'Review user manual' },
              { id: 'ARRANGE_REPAIR', label: 'Arrange repair service' },
            ],
          });
        }, 2000);
        autoFlowTimers.current.push(t3);
      });
  }, [clearTimers, currentScene, getGeometryContext]);

  // Subscribe to Navigator, Task Engine, Scene Interactions
  useEffect(() => {
    const unsubNav = butlerNavigator.subscribe((event, stateSnapshot) => {
      setIsNavigating(stateSnapshot.state === 'MOVING');
    });

    const unsubTask = taskEngine.subscribe((event) => {
      switch (event.type) {
        case TASK_EVENT_TYPES.TASK_NAVIGATION_REQUESTED:
          if (event.returnHome) {
            butlerNavigator.returnHome((newPixelPos) => setPos(newPixelPos), getGeometryContext());
          } else if (event.targetObject) {
            butlerNavigator.navigateTo(
              event.targetObject,
              (newPixelPos) => setPos(newPixelPos),
              getGeometryContext()
            );
          }
          break;

        case TASK_EVENT_TYPES.TASK_SPEECH_REQUESTED:
          setDialogueState((prev) => ({
            ...prev,
            speaker: 'STEWARD',
            text: event.text,
          }));
          setEmotionOverride('attentive');
          break;

        case TASK_EVENT_TYPES.TASK_COMPLETED:
          setEmotionOverride('confident');
          break;

        case TASK_EVENT_TYPES.TASK_CANCELLED:
          setEmotionOverride(null);
          break;

        default:
          break;
      }
    });

    const unsubInteraction = sceneInteractionController.subscribe((event) => {
      if (event.type === 'SCENE_OBJECT_SELECTED' && event.object) {
        const brokenData = currentScene.brokenObject;
        const isBroken =
          event.object.condition === 'MALFUNCTIONING' ||
          event.object.condition === 'DAMAGED' ||
          event.object.condition === 'BROKEN' ||
          event.object.id === brokenData.id ||
          (event.object.label || '').toLowerCase().includes(currentScene.displayName.toLowerCase());

        if (isBroken) {
          clearTimers();
          triggerDirectInspectionFlow(event.object);
        } else {
          const outcome = conditionDecisionController.processObjectSelection(event.object, sceneState);
          setDialogueState({
            speaker: 'STEWARD',
            text: outcome.speechText || `The ${(event.object.label || 'object').toLowerCase()} looks fine.`,
            snippet: null,
            choices: [
              { id: 'START_SEARCH', label: 'Search the house', primary: true }
            ],
          });
          setEmotionOverride('confident');
        }
      }
    });

    return () => {
      unsubNav();
      unsubTask();
      unsubInteraction();
    };
  }, [clearTimers, currentScene, getGeometryContext, sceneState, triggerDirectInspectionFlow]);

  // Initial mount trigger
  useEffect(() => {
    startWelcomeAndSearchSequence(currentScene);
    return () => clearTimers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Resolves typed or spoken user commands against active choices and domain vocabulary
   */
  const resolveUserCommandToChoice = (command, activeChoices = []) => {
    if (!command) return null;
    if (typeof command === 'object' && command.id) {
      return command;
    }

    const raw = String(command).trim();
    const lower = raw.toLowerCase();

    // 1. Direct label or ID match against active choices
    for (const choice of activeChoices) {
      const choiceLabel = (choice.label || '').toLowerCase();
      const choiceId = (choice.id || '').toLowerCase();
      if (lower === choiceLabel || lower === choiceId) {
        return choice;
      }
      if (lower.includes(choiceLabel) || choiceLabel.includes(lower)) {
        return choice;
      }
    }

    // 2. Keyword & semantic mapping for Search
    if (/search|look|check|explore|find|start|house|observe|around|scan/i.test(lower)) {
      return { id: 'START_SEARCH', label: 'Search the house' };
    }

    // 3. Keyword & semantic mapping for Investigation & Actions
    if (/history|previous|past|earlier|record/i.test(lower)) {
      return { id: 'CHECK_HISTORY', label: 'Check repair history' };
    }
    if (/manual|guide|document|read|check manual|user manual/i.test(lower)) {
      return { id: 'CHECK_MANUAL', label: 'Review user manual' };
    }
    if (/dispatch|call|phone|book|technician|bosch|sony|lg|samsung|confirm/i.test(lower)) {
      return { id: 'CALL_DISPATCH', label: 'Confirm & Dispatch technician' };
    }
    if (/repair|service|fix|arrange|cost|quote/i.test(lower)) {
      return { id: 'ARRANGE_REPAIR', label: 'Arrange repair service' };
    }
    if (/washing|machine|washer|drum|tv|television|screen|refrigerator|fridge|microwave|inspect|examine/i.test(lower)) {
      return { id: 'START_SEARCH', label: 'Search the house' };
    }
    if (/standby|home|base|return|stop|dismiss|cancel/i.test(lower)) {
      return { id: 'RETURN_HOME', label: 'Return to standby' };
    }
    if (/restart|replay|again|reset|start over|demonstration/i.test(lower)) {
      return { id: 'RESTART_FLOW', label: 'Replay autonomous demonstration' };
    }
    if (/approve|yes|proceed|accept|ok|sure|go ahead/i.test(lower)) {
      const primaryChoice = activeChoices.find((c) => c.primary) || activeChoices[0];
      if (primaryChoice) return primaryChoice;
      return { id: 'ARRANGE_REPAIR', label: 'Arrange repair service' };
    }
    if (/decline|no|reject|nevermind|back/i.test(lower)) {
      return { id: 'RETURN_HOME', label: 'Return to standby' };
    }

    // 4. Fallback to first active choice
    if (activeChoices.length > 0) {
      return activeChoices[0];
    }

    return { id: 'START_SEARCH', label: 'Search the house' };
  };

  // Unified Command Handler (Option 1: Choice Click, Option 2: Text Input, Option 3: Voice Input)
  const handleUserCommand = (commandOrChoice) => {
    const resolvedChoice = resolveUserCommandToChoice(commandOrChoice, dialogueState.choices);
    if (!resolvedChoice) return;
    handleDialogueChoiceSelect(resolvedChoice);
  };

  // Handle Progressive Game Dialogue Choices
  const handleDialogueChoiceSelect = (choice) => {
    const displayName = currentScene.displayName || 'appliance';
    const serviceName = currentScene.serviceType || currentScene.brokenObject.serviceType || 'Authorized Service Care';
    const quoteVal = currentScene.quoteAmount || currentScene.brokenObject.quoteAmount || '₹900';

    switch (choice.id) {
      case 'START_SEARCH': {
        performEnvironmentSearch(currentScene);
        break;
      }

      case 'CHECK_HISTORY': {
        setStoryStage(STORY_STAGES.REVEALED_HISTORY);
        setEmotionOverride('attentive');
        setDialogueState({
          speaker: 'STEWARD',
          text: `Checking persistent memory for ${displayName}... Prior maintenance recorded: routine diagnostic inspection and filter service (verified).`,
          snippet: {
            label: 'PREVIOUS RECORD',
            value: `Maintenance history verified for ${displayName} · Logged in household ledger`,
          },
          choices: [
            { id: 'CHECK_MANUAL', label: 'Review user manual' },
            { id: 'ARRANGE_REPAIR', label: 'Arrange repair service', primary: true },
          ],
        });
        break;
      }

      case 'CHECK_MANUAL': {
        setStoryStage(STORY_STAGES.REVIEWING_MANUAL);
        setEmotionOverride('attentive');
        setDialogueState({
          speaker: 'STEWARD',
          text: 'Checking documentation on the table...',
          snippet: null,
          choices: [],
        });

        const docObj = (sceneState?.objects || currentScene.objects || []).find(
          (o) => o.category === 'documents' || /manual|guide/i.test(o.label)
        ) || {
          id: 'det_user_manual_01',
          label: 'User Manual',
          normalizedBoundingBox: [0.62, 0.28, 0.68, 0.36],
        };

        butlerNavigator
          .navigateTo(
            docObj,
            (newPixelPos) => setPos(newPixelPos),
            getGeometryContext()
          )
          .then(() => {
            setEmotionOverride('thinking');
            setDialogueState({
              speaker: 'STEWARD',
              text: `Reviewing technical service manual for ${displayName}... Component wear diagnosed.`,
              snippet: {
                label: 'DIAGNOSIS',
                value: `${currentScene.brokenObject.issueDescription || 'Hardware malfunction requiring technician service'}`,
              },
              choices: [],
            });

            setTimeout(() => {
              const targetObj = (sceneState?.objects || currentScene.objects || []).find(
                (o) => o.id === currentScene.brokenObject.id || (o.label || '').toLowerCase().includes(displayName.toLowerCase())
              ) || currentScene.brokenObject;

              butlerNavigator
                .navigateTo(
                  targetObj,
                  (newPixelPos) => setPos(newPixelPos),
                  getGeometryContext()
                )
                .then(() => {
                  setDialogueState({
                    speaker: 'STEWARD',
                    text: `Diagnosis confirmed for ${displayName}. How shall I proceed?`,
                    snippet: {
                      label: 'DIAGNOSIS',
                      value: `${currentScene.brokenObject.issueDescription || 'Hardware fault verified'}`,
                    },
                    choices: [
                      { id: 'ARRANGE_REPAIR', label: 'Arrange repair service', primary: true },
                      { id: 'RETURN_HOME', label: 'Return to standby' },
                    ],
                  });
                });
            }, 2400);
          });
        break;
      }

      case 'ARRANGE_REPAIR': {
        setStoryStage(STORY_STAGES.ARRANGING_REPAIR);
        setEmotionOverride('thinking');
        setDialogueState({
          speaker: 'STEWARD',
          text: `Quote received from ${serviceName}: ${quoteVal}. Authority limit is ₹1,500. This is within autonomous authority.`,
          snippet: {
            label: 'AUTHORITY CHECK',
            value: `Quote ${quoteVal} ≤ Authority Limit ₹1,500 · Autonomous approval granted`,
          },
          choices: [
            { id: 'CALL_DISPATCH', label: 'Confirm & Dispatch technician', primary: true },
            { id: 'RETURN_HOME', label: 'Return to standby' },
          ],
        });
        break;
      }

      case 'CALL_DISPATCH': {
        setStoryStage(STORY_STAGES.CALLING_DISPATCH);
        setEmotionOverride('confident');
        setDialogueState({
          speaker: 'STEWARD',
          text: `Calling ${serviceName}...`,
          snippet: null,
          choices: [],
        });

        const phoneObj = (sceneState?.objects || currentScene.objects || []).find((o) =>
          /phone|telephone/i.test(o.label)
        ) || {
          id: 'det_telephone_01',
          label: 'Telephone',
          normalizedBoundingBox: [0.60, 0.04, 0.67, 0.11],
        };

        butlerNavigator
          .navigateTo(
            phoneObj,
            (newPixelPos) => setPos(newPixelPos),
            getGeometryContext()
          )
          .then(() => {
            setDialogueState({
              speaker: 'STEWARD',
              text: 'Booking technician for 14:30 appointment slot...',
              snippet: {
                label: 'SERVICE COMMITMENT',
                value: `${serviceName} · Confirmed for today at 14:30`,
              },
              choices: [],
            });

            setTimeout(() => {
              setEmotionOverride('relieved');
              setDialogueState({
                speaker: 'STEWARD',
                text: 'Repair requested. Service dispatched for 14:30. Returning to base.',
                snippet: {
                  label: 'RESOLUTION',
                  value: 'Technician dispatched autonomously · Appointment confirmed',
                },
                choices: [],
              });

              setTimeout(() => {
                butlerNavigator
                  .returnHome(
                    (newPixelPos) => setPos(newPixelPos),
                    getGeometryContext()
                  )
                  .then(() => {
                    setStoryStage(STORY_STAGES.COMPLETED);
                    setEmotionOverride('confident');
                    setDialogueState({
                      speaker: 'STEWARD',
                      text: 'I am on standby. The technician visit is scheduled for 14:30.',
                      snippet: {
                        label: 'STATUS',
                        value: 'Case active · Scheduled & Monitored',
                      },
                      choices: [
                        { id: 'RESTART_FLOW', label: 'Replay autonomous demonstration' },
                      ],
                    });
                  });
              }, 2500);
            }, 2200);
          });
        break;
      }

      case 'RETURN_HOME': {
        butlerNavigator
          .returnHome(
            (newPixelPos) => setPos(newPixelPos),
            getGeometryContext()
          )
          .then(() => {
            setStoryStage(STORY_STAGES.COMPLETED);
            setEmotionOverride('confident');
            setDialogueState({
              speaker: 'STEWARD',
              text: 'Returned to standby base.',
              snippet: null,
              choices: [
                { id: 'START_SEARCH', label: 'Search the house', primary: true },
                { id: 'RESTART_FLOW', label: 'Replay autonomous demonstration' },
              ],
            });
          });
        break;
      }

      case 'RESTART_FLOW': {
        sceneInteractionController.resetSceneInteraction();
        setShowProblemIndicator(false);
        butlerNavigator.returnHome(
          (newPixelPos) => setPos(newPixelPos),
          getGeometryContext()
        );
        startWelcomeAndSearchSequence(currentScene);
        break;
      }

      default:
        break;
    }
  };

  // Drag Handlers
  const handlePointerDown = (e) => {
    if (isNavigating) return;
    if (
      e.target.closest('button') ||
      e.target.closest('a') ||
      e.target.closest('.game-dialogue-choice-btn') ||
      e.target.closest('.game-dialogue-input') ||
      e.target.closest('.game-dialogue-voice-btn') ||
      e.target.closest('.butler-info-btn') ||
      e.target.closest('.butler-resize-handle')
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

  // Resize Handlers
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

  return (
    <div className="conversation-demo-container">
      {/* 1. Dynamic Full Viewport Scene Background Layer (Directly driven by currentScene.wallpaper) */}
      <div
        key={currentScene.id}
        className={`custom-scene-background ${isTransitioningScene ? 'is-fading' : ''}`}
        style={{
          backgroundImage: `linear-gradient(rgba(9, 12, 21, 0.42), rgba(9, 12, 21, 0.48)), url(${currentScene.wallpaper || livingRoomBg})`,
        }}
      />

      {/* 2. Full Viewport Backdrop-Blurred Loading Screen */}
      <LoadingOverlay isLoading={isLoading} />

      {/* 3. Subtle Scene Change Icon (Unobtrusive single icon in top-right) */}
      <div className="scene-quick-actions-bar">
        <button
          type="button"
          className="scene-wallpaper-refresh-btn"
          onClick={changeScene}
          title="Switch room scene"
          aria-label="Switch room scene"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* 4. Development-Only Scene Perception Visualizer Overlay */}
      <SceneDetectionVisualizer
        sceneState={sceneState}
        isVisible={isDebugVisualizerOpen}
        onToggle={toggleDebugVisualizer}
      />

      {/* 5. Full Case Dashboard Shell (Toggled on demand for internal inspection) */}
      {showCaseDashboard && (
        <div className="case-dashboard-overlay-wrapper">
          <div className="case-dashboard-close-bar">
            <button
              type="button"
              className="case-dashboard-close-btn"
              onClick={() => setShowCaseDashboard(false)}
            >
              <X size={14} />
              <span>CLOSE DASHBOARD</span>
            </button>
          </div>
          <CaseDashboard />
        </div>
      )}

      {/* 6. Interactive Detected Scene Layer with 🔧 Problem Indicator */}
      <InteractiveScene
        sceneState={sceneState}
        imageWidth={imageSnapshot?.width || 1920}
        imageHeight={imageSnapshot?.height || 1080}
        showProblemIndicator={showProblemIndicator}
      />

      {/* 7. SINGLE PARENT DRAGGABLE & RESIZABLE FLOATING BUTLER GROUP */}
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
        {/* Butler Character Display */}
        <ButlerDisplay
          status={stewardState?.status}
          context={stewardState?.context || {}}
          overrideEmotion={emotionOverride || stewardState?.overrideEmotion}
          showDebug={false}
        />

        {/* Compact Game Dialogue Box (with Predefined Choices + Text Input + Voice Input) */}
        <GameDialogueBox
          speaker={dialogueState.speaker}
          text={dialogueState.text}
          contextSnippet={dialogueState.snippet}
          choices={dialogueState.choices}
          onChoiceSelect={handleUserCommand}
          onSkipReady={(fn) => {
            skipRevealRef.current = fn;
          }}
          isLoading={isLoading}
        />

        {/* Info / Settings Icon Button (ⓘ) */}
        <button
          type="button"
          className="butler-info-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfoModal(true);
          }}
          title="System Status & Options"
          aria-label="System Information"
        >
          <Info size={16} />
        </button>

        {/* Bottom-Right Resize Handle */}
        {!isNavigating && (
          <div
            className={`butler-resize-handle ${isResizing ? 'is-resizing' : ''}`}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerUp}
            title="Click and drag to resize Butler"
            aria-label="Resize Butler"
          >
            <Scaling size={10} style={{ transform: 'rotate(90deg)' }} />
          </div>
        )}
      </div>

      {/* Clean Modal Popup for Settings / System Information */}
      {showInfoModal && (
        <div className="info-modal-backdrop" onClick={() => setShowInfoModal(false)}>
          <div className="info-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <div className="info-modal-title">
                <Info size={16} style={{ color: '#fbbf24' }} />
                <span>STEWARD BUTLER OPTIONS</span>
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
                <span className="info-label">Active State:</span>
                <span className="info-value status-tag">
                  {storyStage}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Active Scene:</span>
                <span className="info-value">
                  {currentScene.title || currentScene.displayName}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Problem Object:</span>
                <span className="info-value" style={{ color: '#fbbf24' }}>
                  {showProblemIndicator ? `${currentScene.displayName} (Discovered)` : 'Undiscovered (Searching)'}
                </span>
              </div>

              {/* Replay Autonomous Sequence */}
              <button
                type="button"
                className="info-visualizer-toggle-btn"
                onClick={() => {
                  setShowInfoModal(false);
                  startWelcomeAndSearchSequence(currentScene);
                }}
              >
                <RotateCcw size={13} />
                <span>REPLAY AUTONOMOUS DEMONSTRATION</span>
              </button>

              {/* Toggle Full Case Dashboard */}
              <button
                type="button"
                className="info-visualizer-toggle-btn"
                onClick={() => {
                  setShowInfoModal(false);
                  setShowCaseDashboard(!showCaseDashboard);
                }}
              >
                <LayoutDashboard size={13} />
                <span>
                  {showCaseDashboard ? 'HIDE CASE DASHBOARD' : 'INSPECT FULL CASE DASHBOARD'}
                </span>
              </button>

              {/* Dev Scene Detection Toggle Button */}
              <button
                type="button"
                className="info-visualizer-toggle-btn"
                onClick={() => {
                  toggleDebugVisualizer();
                }}
              >
                <Eye size={13} />
                <span>
                  {isDebugVisualizerOpen
                    ? 'HIDE PERCEPTION DETECTION OVERLAY'
                    : 'SHOW PERCEPTION DETECTION OVERLAY'}
                </span>
              </button>

              {/* Scenario Demonstration Selectors */}
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="info-label" style={{ fontSize: '0.68rem', letterSpacing: '0.05em' }}>
                  CANONICAL CASE SCENARIOS:
                </span>
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button
                    type="button"
                    className="info-visualizer-toggle-btn"
                    style={{ flex: 1, padding: '6px 4px', fontSize: '0.62rem' }}
                    onClick={() => {
                      stewardCaseAdapter.loadScenario(SCENARIO_KEYS.ACT);
                      setShowInfoModal(false);
                      setShowCaseDashboard(true);
                    }}
                    title="Load ACT Scenario"
                  >
                    ACT
                  </button>
                  <button
                    type="button"
                    className="info-visualizer-toggle-btn"
                    style={{ flex: 1, padding: '6px 4px', fontSize: '0.62rem' }}
                    onClick={() => {
                      stewardCaseAdapter.loadScenario(SCENARIO_KEYS.RESTRAIN);
                      setShowInfoModal(false);
                      setShowCaseDashboard(true);
                    }}
                    title="Load RESTRAIN Scenario"
                  >
                    RESTRAIN
                  </button>
                  <button
                    type="button"
                    className="info-visualizer-toggle-btn"
                    style={{ flex: 1, padding: '6px 4px', fontSize: '0.62rem' }}
                    onClick={() => {
                      stewardCaseAdapter.loadScenario(SCENARIO_KEYS.RECOVER);
                      setShowInfoModal(false);
                      setShowCaseDashboard(true);
                    }}
                    title="Load RECOVER Scenario"
                  >
                    RECOVER
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationDemo;
