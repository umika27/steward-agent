import React, { useEffect, useState } from 'react';
import { stewardMockStore } from '../mock/mockStewardInput';
import { StewardInputAdapter } from '../adapter/stewardInputAdapter';
import { ConversationDemo } from '../components/Conversation/ConversationDemo';
import { StatusIndicator } from '../components/Status/StatusIndicator';
import { MockControls } from '../components/UI/MockControls';
import { ShieldCheck, Cpu } from 'lucide-react';
import './App.css';

/**
 * App Component (Final Development Pass — Standalone Steward Butler UI)
 *
 * Architecture:
 *
 *               Steward Input Adapter (Data Boundary)
 *                         │
 *          ┌──────────────┴──────────────┐
 *          ↓                             ↓
 *   Emotion Resolver               Speech Engine
 *   (src/emotions/)                (src/speech/)
 *          ↓                             ↓
 *   Butler Emotion                 Speech State
 *          ↓                             ↓
 *   ButlerDisplay               ConversationDemo (Pop-Art Comic UI)
 *
 * Pure, deterministic, 100% client-side standalone execution.
 */
export function App() {
  const [stewardState, setStewardState] = useState(
    StewardInputAdapter.adapt(stewardMockStore).getState()
  );

  useEffect(() => {
    const adapter = StewardInputAdapter.adapt(stewardMockStore);
    const unsubscribe = adapter.subscribe((normalizedState) => {
      setStewardState(normalizedState);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="app-container">
      <main className="app-main">
        <ConversationDemo stewardState={stewardState} />
      </main>
    </div>
  );
}

export default App;
