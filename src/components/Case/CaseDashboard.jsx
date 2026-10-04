import React, { useEffect, useState } from 'react';
import { stewardCaseAdapter } from '../../integration/stewardCaseAdapter';
import { SCENARIO_KEYS } from '../../case/caseTypes';
import { MachineMemoryCard } from './MachineMemoryCard';
import { AuthorityCard } from './AuthorityCard';
import { DecisionCard } from './DecisionCard';
import { CommitmentStatus } from './CommitmentStatus';
import { CaseTimeline } from './CaseTimeline';
import { HumanApprovalStatus } from './HumanApprovalStatus';
import { FailureStatus } from './FailureStatus';
import { RecoveryStatus } from './RecoveryStatus';
import { VerificationStatus } from './VerificationStatus';
import './CaseDashboard.css';

/**
 * Steward Case Dashboard (Phase 7 Integration Boundary)
 *
 * Consumes normalized case data directly from stewardCaseAdapter integration layer.
 * Strictly read-only presentation layer.
 */
export const CaseDashboard = ({ scenarioKey }) => {
  const [caseData, setCaseData] = useState(() => {
    return stewardCaseAdapter.getCaseData(scenarioKey);
  });

  useEffect(() => {
    const unsubscribe = stewardCaseAdapter.subscribe((data) => {
      setCaseData(data);
    }, scenarioKey);
    return () => unsubscribe();
  }, [scenarioKey]);

  if (!caseData) return null;

  const {
    machine,
    machineMemory,
    currentCase,
    quote,
    authority,
    decision,
    commitment,
    timeline,
    failure,
    recovery,
    verification,
  } = caseData;

  const currentCaseId = currentCase?.caseId || '';
  const isAct = currentCaseId === 'case_act_101' || currentCase?.currentState === 'CLOSED';
  const isRestrain = currentCaseId === 'case_restrain_202' || currentCase?.currentState === 'RESTRAINED';
  const isRecover = currentCaseId === 'case_recover_303' || currentCase?.currentState === 'RECOVERING';

  return (
    <div className="case-dashboard-shell">
      {/* 1. Header: Machine & Case Identity + Scenario Selector */}
      <div className="case-dashboard-header">
        <div className="case-identity-brand">
          <span className="case-manufacturer">{machine?.manufacturer || 'Unknown Manufacturer'}</span>
          <h3 className="case-model">{machine?.model || 'Unknown Model'}</h3>
          <div className="case-scenario-selector">
            <button
              type="button"
              className={`scenario-pill-btn ${isAct ? 'is-active' : ''}`}
              onClick={() => stewardCaseAdapter.loadScenario(SCENARIO_KEYS.ACT)}
              title="Demonstrate Scenario A: ACT (Autonomous Resolution)"
            >
              ACT
            </button>
            <button
              type="button"
              className={`scenario-pill-btn ${isRestrain ? 'is-active' : ''}`}
              onClick={() => stewardCaseAdapter.loadScenario(SCENARIO_KEYS.RESTRAIN)}
              title="Demonstrate Scenario B: RESTRAIN (Human Approval Required)"
            >
              RESTRAIN
            </button>
            <button
              type="button"
              className={`scenario-pill-btn ${isRecover ? 'is-active' : ''}`}
              onClick={() => stewardCaseAdapter.loadScenario(SCENARIO_KEYS.RECOVER)}
              title="Demonstrate Scenario C: RECOVER (Household Verification Failed)"
            >
              RECOVER
            </button>
          </div>
        </div>
        <div className="case-identity-meta">
          <span className="case-id-badge">ID: {currentCase?.caseId || 'N/A'}</span>
          <span className={`case-status-badge status-${(currentCase?.currentState || '').toLowerCase()}`}>
            {currentCase?.currentState || 'UNKNOWN'}
          </span>
        </div>
      </div>

      {/* 2. Current Progress & Issue Summary */}
      <div className="case-dashboard-issue">
        <span className="case-issue-label">CURRENT ISSUE:</span>
        <p className="case-issue-text">{currentCase?.issue || 'No issue reported'}</p>
      </div>

      {/* 3. Case Content Area: Cards, Commitment, Timeline, Phase 5 Statuses */}
      <div className="case-content-area" id="case-content-area">
        <MachineMemoryCard machine={machine} memory={machineMemory} />

        <div className="case-cards-row">
          <AuthorityCard quote={quote} authority={authority} />
          <DecisionCard decision={decision} />
        </div>

        <CommitmentStatus commitment={commitment} />

        <CaseTimeline timeline={timeline} />

        {/* Phase 5 Status Surfaces */}
        <div className="case-cards-row">
          <HumanApprovalStatus authority={authority} quote={quote} />
          <FailureStatus failure={failure} commitment={commitment} timeline={timeline} />
        </div>

        <div className="case-cards-row">
          <RecoveryStatus currentCase={currentCase} decision={decision} recovery={recovery} timeline={timeline} />
          <VerificationStatus verification={verification} />
        </div>
      </div>
    </div>
  );
};

export default CaseDashboard;
