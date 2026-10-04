import React, { useState } from 'react';

export function CaseActions({ runtime }) {
  const { serviceCase, busy, approve, verify } = runtime;
  if (serviceCase?.actions.approval) return (
    <div className="case-actions" aria-label="Household approval">
      <button className="speech-inline-next-btn" disabled={busy} onClick={() => approve(true)}>Approve</button>
      <button className="speech-inline-next-btn" disabled={busy} onClick={() => approve(false)}>Reject</button>
    </div>
  );
  if (serviceCase?.actions.verification) return (
    <div className="case-actions" aria-label="Household verification">
      <button className="speech-inline-next-btn" disabled={busy} onClick={() => verify(true)}>Yes, it’s working</button>
      <button className="speech-inline-next-btn" disabled={busy} onClick={() => verify(false)}>No, the problem remains</button>
    </div>
  );
  return null;
}

export function CaseDetails({ runtime, onReported }) {
  const { machine, serviceCase, health, busy, report, refresh, reset } = runtime;
  const [issue, setIssue] = useState('');
  const [scenario, setScenario] = useState('happy');
  const [confirmReset, setConfirmReset] = useState(false);
  const [newReport, setNewReport] = useState(false);
  const canReport = !serviceCase || (serviceCase.state === 'CLOSED' && newReport);

  return (
    <div className="info-modal-body case-details">
      <p className="info-label">{health ? 'Python backend connected' : 'Backend connection unavailable'} · External calls, payments and logistics are LOCAL MOCKS.</p>
      {canReport && <form className="case-report" onSubmit={async (event) => {
        event.preventDefault();
        if (await report(issue.trim(), scenario)) { setNewReport(false); onReported(); }
      }}>
        <label htmlFor="machine-issue">What is wrong with your machine?</label>
        <textarea id="machine-issue" required maxLength={2000} value={issue}
          onChange={(event) => setIssue(event.target.value)} placeholder="My washing machine isn’t draining." />
        <label htmlFor="demo-scenario">Local provider demo</label>
        <select id="demo-scenario" value={scenario} onChange={(event) => setScenario(event.target.value)}>
          <option value="happy">Normal visit · ₹900 mock quote</option>
          <option value="over-limit">Over-limit · ₹3,800 mock quote</option>
          <option value="no-show">Technician no-show</option>
          <option value="failed-repair">Failed repair · answer No after the visit</option>
        </select>
        <button className="speech-inline-next-btn" disabled={busy || !issue.trim() || !machine}>Report problem</button>
      </form>}

      {serviceCase && <section aria-label="Current service case">
        <p className="info-value">{serviceCase.state_label}</p>
        <p>{serviceCase.issue}</p>
        <small className="info-label">{serviceCase.case_id} · {serviceCase.state}</small>
        {serviceCase.quote && <p>Proposed service: ₹{serviceCase.quote.amount_inr} · {serviceCase.quote.provider_name}</p>}
        {serviceCase.authority_evaluations.filter((result) => result.action === 'approve_repair').slice(-1).map((result) => (
          <p key={result.action}>{result.reason}{serviceCase.quote?.approved_by === 'household' ? ' — Household approved this proposal.' : ''}</p>
        ))}
        {serviceCase.appointment && <p>Appointment: {serviceCase.appointment.date} · {serviceCase.appointment.time_window}<br />
          Ref: {serviceCase.appointment.reference_number || 'Not supplied'} [MOCK]</p>}
        <p>{serviceCase.next_action}</p>
        <CaseActions runtime={runtime} />
        {serviceCase.actions.advance_demo && <button className="speech-inline-next-btn" disabled={busy} onClick={runtime.advance}>{serviceCase.next_action}</button>}
      </section>}

      {machine && <details open>
        <summary>Machine history · {machine.machine_id}</summary>
        <p>{machine.brand} {machine.model} · {machine.category.replaceAll('_', ' ')}</p>
        <p>Purchased: {machine.purchase_date || machine.purchase_year}<br />
          Warranty: {machine.warranty.status} {machine.warranty.expiry_date && `(expiry ${machine.warranty.expiry_date})`}<br />
          Automatic repair limit: ₹{machine.autonomous_repair_limit_inr}<br />
          Cumulative repair spend: ₹{machine.cumulative_repair_spend}<br />
          Lifecycle: {machine.current_lifecycle_status}</p>
        {machine.repair_history.map((repair) => <p key={repair.repair_id}>
          {repair.date} · {repair.problem} · ₹{repair.cost_inr}<br />{repair.resolution_summary}<br />
          <small>{repair.provider_name} · {repair.verified_by_household ? 'Household verified' : 'Not verified'}</small>
        </p>)}
        <details><summary>Reported failures ({machine.failure_history.length})</summary>
          {machine.failure_history.map((failure) => <p key={failure.failure_id}>{failure.date} · {failure.problem} · {failure.resolved ? 'Resolved' : 'Unresolved'}</p>)}
        </details>
      </details>}

      {serviceCase && <details open>
        <summary>Case activity</summary>
        <ol className="case-timeline">
          {serviceCase.timeline.map((event, index) => <li key={`${index}-${event.timestamp}`}>
            <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleTimeString()}</time> · {event.state_label}
            <p>{event.reason}</p>
            <small>{event.actor}{event.evidence ? ` · ${event.evidence}` : ''}</small>
          </li>)}
        </ol>
      </details>}
      <div className="case-actions">
        <button className="speech-inline-next-btn" disabled={busy} onClick={refresh}>Refresh</button>
        {serviceCase?.state === 'CLOSED' && <button className="speech-inline-next-btn" disabled={busy} onClick={() => setNewReport(true)}>Report another issue</button>}
        <button className="speech-inline-next-btn" disabled={busy} onClick={() => setConfirmReset(true)}>Reset local demo</button>
      </div>
      {confirmReset && <div role="group" aria-label="Confirm local demo reset">
        <p>Clear local demo cases and restore the original ₹1,200 machine history? Canonical machine data is untouched.</p>
        <div className="case-actions">
          <button className="speech-inline-next-btn" disabled={busy} onClick={async () => { if (await reset()) { setConfirmReset(false); setNewReport(false); setIssue(''); } }}>Reset demo memory</button>
          <button className="speech-inline-next-btn" disabled={busy} onClick={() => setConfirmReset(false)}>Cancel</button>
        </div>
      </div>}
    </div>
  );
}
