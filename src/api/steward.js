// One transport boundary. Domain decisions are returned by Python, never inferred here.
export class StewardApiError extends Error {
  constructor(message, status = 0, code = 'UNAVAILABLE') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    let data;
    try { data = await response.json(); }
    catch { throw new StewardApiError('Backend unavailable. Start the Python API, then refresh.', response.status); }
    if (!response.ok) {
      throw new StewardApiError(data.error?.message || 'Request failed.', response.status, data.error?.code);
    }
    return data;
  } catch (error) {
    if (error instanceof StewardApiError) throw error;
    throw new StewardApiError('Cannot reach Steward. Check the Python API and refresh before retrying.');
  } finally {
    clearTimeout(timer);
  }
}

const casePath = (id) => `/cases/${encodeURIComponent(id)}`;
export const stewardApi = {
  health: () => request('/health'),
  machine: () => request('/machines/WM-001'),
  create: (issue, scenario) => request('/cases', { machine_id: 'WM-001', issue, scenario }),
  case: (id) => request(casePath(id)),
  advance: (serviceCase) => request(`${casePath(serviceCase.case_id)}/advance-demo`, { expected_state: serviceCase.state }),
  approve: (serviceCase, approved) => request(`${casePath(serviceCase.case_id)}/approval`, { approved, expected_state: serviceCase.state }),
  verify: (serviceCase, working) => request(`${casePath(serviceCase.case_id)}/verification`, { working, expected_state: serviceCase.state }),
  reset: () => request('/demo/reset', { confirm: true }),
};
