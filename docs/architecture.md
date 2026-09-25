# Reconstructed backend architecture

The committed Python source and tests were zero bytes. Reconstruction used
Python 3.13 cached code metadata (class fields, method signatures, constants and
test names), retained demo JSON, and the supplied behavioral requirements.
This is a source reconstruction, not a claim of byte-for-byte recovery.

`models.py` holds typed dataclasses/enums. `states.py` owns explicit transitions
and closure checks. `authority.py` owns deterministic spending, scheduling and
secret-disclosure policy. `commitments.py` tracks concrete promises and material
questions. `verifier.py` separates provider claims from household observations.
`repair_policy.py` contains an interpretable heuristic; `recovery.py` produces
explicit recovery states/plans. `case_manager.py` composes these modules and
the voice/payment/logistics interfaces under `rails/`.

The required SELECT_RESOLUTION and VERIFYING names are canonical. The cached
CHOOSE_RESOLUTION and VERIFY_OUTCOME spellings remain enum aliases.

Machine memory is JSON, written by atomic replacement. The canonical fixture
was restored from `tmp/demo_runtime/failed-repair/machines/WM-001.json`, which
contains the initial history: May 2026 drainage repair, ₹1,200 cumulative spend,
expired warranty, ₹1,500 automatic authority. Tests and demos use temporary copies.
Failure records persist at intake; successful repair/provider history persists
only after verified outcome, acceptable payment and resolved obligations.
Finalization reloads memory and deduplicates by case ID before saving.

Cases and approvals are process-local. This prototype is single-process and
does not offer concurrent-writer locking, case persistence, HTTP authentication,
or UI integration. Domain objects are internal trusted Python records, not an
untrusted request schema. Approval entrypoints represent authenticated household
input supplied by a future application boundary. Repair-versus-replacement
escalation produces reasons for a human; replacement purchasing is not implemented.

All supplied rails are local mocks, explicitly marked in results. No external
requests, credentials, payment transactions, shipments or Gnani webhook behavior
are implemented. The voice interface is a boundary for a future supported adapter.

Existing tracked Python caches and demo files remain tracked; ignore rules prevent
new generated files. Tracked `node_modules` and its pre-existing local changes
are outside this backend reconstruction and have been left untouched.
