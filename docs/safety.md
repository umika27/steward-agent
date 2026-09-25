# Backend boundaries

- Deterministic authority allows repair amounts up to and including the configured
  limit (fixture: ₹1,500). Higher amounts require explicit household approval.
- Replacement always requires household review; no replacement purchasing exists.
- Approval is scoped to provider, amount, diagnosis and appointment terms. A changed
  proposal is re-evaluated. Unknown actions require review. Secrets such as OTP,
  PIN, CVV, passwords and UPI PIN must never be disclosed, even under human approval.
- Provider claims never verify the physical outcome. Only household confirmation
  is implemented as a trusted verification source in this prototype.
- Successful service cannot erase unrelated questions. Call-result ingestion
  requires every unresolved question to have an explicit follow-up action/date.
- Financial settlement and verified repair memory writes occur only after success.
- Machine JSON writes are atomic but not locked across concurrent processes.
- Cases and household approval evidence are internal process-local objects. A
  future API must authenticate household input; no API/UI boundary is built here.
- No external rail action is real. Every supplied adapter identifies itself as a mock.
