import { useCallback, useEffect, useRef, useState } from 'react';
import { stewardApi } from './steward';

const SESSION_KEY = 'steward.localCaseId';
const savedCase = () => { try { return sessionStorage.getItem(SESSION_KEY); } catch { return null; } };
const remember = (id) => {
  try { if (id) sessionStorage.setItem(SESSION_KEY, id); else sessionStorage.removeItem(SESSION_KEY); }
  catch { /* Private browsing may disable storage; live case state still works. */ }
};

export function useSteward() {
  const [serviceCase, setServiceCase] = useState(null);
  const [machine, setMachine] = useState(null);
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const caseId = useRef(savedCase());

  const accept = useCallback((data) => {
    caseId.current = data.case_id;
    remember(data.case_id);
    setServiceCase(data);
    return data;
  }, []);

  const run = useCallback(async (operation) => {
    if (pending.current) return null;
    pending.current = true;
    setBusy(true);
    setError('');
    try { return await operation(); }
    catch (failure) {
      console.error('Steward request failed', failure);
      // A multi-step backend operation may have partially progressed. Read its
      // authoritative state; never assume an error means no state change occurred.
      if (caseId.current) {
        try { accept(await stewardApi.case(caseId.current)); }
        catch (refreshError) {
          if (refreshError.status === 404) {
            caseId.current = null;
            remember(null);
            setServiceCase(null);
          }
        }
      }
      setError(failure.message);
      return null;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }, [accept]);

  const refresh = useCallback(() => run(async () => {
    setHealth(await stewardApi.health());
    setMachine(await stewardApi.machine());
    if (caseId.current) accept(await stewardApi.case(caseId.current));
    return true;
  }), [run, accept]);

  useEffect(() => { refresh(); }, [refresh]);

  const report = (issue, scenario) => run(async () => {
    let data = accept(await stewardApi.create(issue, scenario));
    setMachine(await stewardApi.machine());
    // Steward chooses the resolution; this single action starts its mock provider
    // interaction without requiring the household to steer individual states.
    if (data.actions.advance_demo) data = accept(await stewardApi.advance(data));
    return data;
  });
  const advance = () => run(async () => {
    const data = accept(await stewardApi.advance(serviceCase));
    setMachine(await stewardApi.machine());
    return data;
  });
  const approve = (approved) => run(async () => accept(await stewardApi.approve(serviceCase, approved)));
  const verify = (working) => run(async () => {
    const data = accept(await stewardApi.verify(serviceCase, working));
    setMachine(await stewardApi.machine());
    return data;
  });
  const reset = () => run(async () => {
    const data = await stewardApi.reset();
    caseId.current = null;
    remember(null);
    setServiceCase(null);
    setMachine(data);
    return true;
  });

  return { serviceCase, machine, health, busy, error, report, advance, approve, verify, refresh, reset };
}
