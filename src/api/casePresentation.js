import { normalizeStewardInput } from '../adapter/stewardInputAdapter.js';

// Presentation only: no authority arithmetic, transitions, or fabricated events.
export function casePresentation(serviceCase, busy = false) {
  if (!serviceCase) return normalizeStewardInput({
    text: 'Tell me what is wrong with your washing machine. I’ll review its history and arrange local mock service.',
    status: busy ? 'thinking' : 'idle',
  });
  const status = serviceCase.state === 'CLOSED' ? 'success'
    : serviceCase.actions.approval || serviceCase.state === 'REASSESS_REPAIR_VS_REPLACE' ? 'warning'
    : busy ? 'thinking' : 'responding';
  const appointment = serviceCase.appointment;
  const booking = appointment && serviceCase.state === 'AWAITING_VISIT'
    ? ` ${appointment.date}, ${appointment.time_window}. ₹${serviceCase.quote.amount_inr}. Reference ${appointment.reference_number || 'not supplied'}. [MOCK]` : '';
  return normalizeStewardInput({
    text: `${serviceCase.state_label}.${booking} ${serviceCase.next_action}`,
    status,
    context: { taskResult: status === 'success' ? 'success' : status === 'warning' ? 'warning' : 'none' },
  });
}
