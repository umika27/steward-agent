# Service lifecycle

The authoritative adjacency map and guards are in `steward/states.py`.

Normal flow:

NEW_CASE → LOAD_MEMORY → ASSESS → SELECT_RESOLUTION → CONTACT_PROVIDER →
NEGOTIATING → SCHEDULED → AWAITING_VISIT → SERVICE_ATTEMPTED → VERIFYING →
RESOLVED → UPDATE_MEMORY → CLOSED.

Provider completion only reaches VERIFYING. A negative household observation
enters REPAIR_FAILED, then REASSESS_REPAIR_VS_REPLACE. No-show enters NO_SHOW and
returns to CONTACT_PROVIDER within the same case. Missing appointment details
enter COMMITMENT_INCOMPLETE. Over-limit quotes and appointments outside configured
availability enter HUMAN_APPROVAL_REQUIRED. Payment failure blocks finalization.

CLOSED has exactly one incoming edge, from UPDATE_MEMORY, and no outgoing edges.
The transition rechecks all four conditions: independent household verification,
acceptable financial obligations, persisted machine memory, and no unresolved
material commitment/question. Pending human decisions also block closure.
