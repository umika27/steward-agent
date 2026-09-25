# Backend reconstruction report

Branch: `ui`. No commit, push, staging, frontend integration or frontend source changes.

## Root cause and recovery evidence

The committed backend Python source and original test source were zero bytes.
Compiled Python 3.13 caches retained class fields, method signatures, constants
and test names. The baseline test command discovered 0 tests and exited 5.
No claim is made that reconstruction is byte-for-byte identical to the lost source.
The previously exhausted Git recovery was not repeated.

The canonical WM-001 fixture was also still empty in this checkout. It was restored
exactly from `tmp/demo_runtime/failed-repair/machines/WM-001.json`, preserving the
₹1,200 May 2026 repair, expired warranty, provider history and ₹1,500 automatic limit.
Canonical fixture SHA256: `206273136b750490fe73d648c49a8c710369094eca7b790257a939dd36632a78`.

## Implemented architecture and behavior

Typed dataclass models and enums; explicit state graph; deterministic authority;
concrete commitments and material-question follow-up; atomic JSON machine memory;
interpretable repair-versus-replace heuristic; household verification; explicit
recovery plans; voice/payment/logistics interfaces and local mocks; case orchestration.
SELECT_RESOLUTION and VERIFYING are canonical, with aliases for cached historical
CHOOSE_RESOLUTION and VERIFY_OUTCOME names.

Closure requires household physical verification, settled/acceptable obligations,
persisted machine memory, and no unresolved material commitment. Provider claims
only reach VERIFYING. Tests reject closure from every state except UPDATE_MEMORY
and independently remove each required closure prerequisite.

₹900 and ₹1,500 are automatically permitted. ₹3,800 requires household approval.
Replacement always needs review. Unknown actions ask for review; secret disclosure
and fabricated consent are denied. Approval is scoped to concrete proposal terms.

Failure intake persists to machine memory. Verified repair finalization updates
repair history, failure resolution, cumulative spend and provider history. Duplicate
repair application does not double-count spend. Failed writes cannot mark memory
updated. Tests and demos use temporary copies; the canonical fixture stays unchanged.

Gnani T01 manual evidence is recorded in `evidence/gnani_observations.md`, including
the unresolved previous-repair coverage question. T02+ remain NOT RUN. Structured
local call results must preserve material questions with explicit follow-up action
and date. Completed service does not silently resolve these questions.

Gnani, Pine Labs and Delhivery integrations are NOT live. All supplied rails are
explicit local mocks. There are no credentials or new backend dependencies.

## Validation results

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v`:
  **75 tests, OK, exit 0** (final run reported 0.052 seconds).
- `PYTHONDONTWRITEBYTECODE=1 python3 -m steward.demo all`: **all four scenarios passed, exit 0**.
- In-memory `compile()` and `importlib.import_module()` sanity check:
  **27 Python modules passed, exit 0**; no tracked bytecode rewritten.
- `git diff --check`: **exit 0**, no whitespace errors.
- Frontend-source diff check: **empty**. Git index: **empty**.
- Credential-pattern scan of reconstructed Python: **no matches**.
- No frontend build/test was run: this task explicitly stops at backend reconstruction.

| Demo | Final state | Cumulative repair spend |
| --- | --- | --- |
| Happy | CLOSED | ₹2,100 |
| Over-limit | HUMAN_APPROVAL_REQUIRED | ₹1,200 |
| No-show | CLOSED, same case retained | ₹2,100 |
| Failed repair | REASSESS_REPAIR_VS_REPLACE | ₹1,200 |

An initial 72-test run found one error when a vague appointment date was passed
as an ISO follow-up deadline. This was fixed; the regression and additional
call-question/custom-authority/zero-charge tests pass in the final 75-test run.

## Scope and remaining limitations

No blockers remain for the requested local backend scenarios. Cases and approvals
are process-local; machine JSON has atomic replacement but no concurrent-writer
locking. Household verification is the implemented trusted source. Replacement
execution and live integrations remain outside this prototype. There is no HTTP
or authenticated household UI boundary yet. These are not production guarantees.

The repository already tracks 5,361 node_modules files, with pre-existing local
platform-package deletions/additions and lock changes. Those were left untouched.
Existing tracked Python caches and demo output remain tracked; new ignore rules
cover bytecode, demo output and .env files. Nothing was staged.

## Reconstructed/new Python files

- `rails/__init__.py`
- `rails/base.py`
- `rails/logistics.py`
- `rails/payments.py`
- `rails/voice.py`
- `steward/__init__.py`
- `steward/authority.py`
- `steward/case_manager.py`
- `steward/commitments.py`
- `steward/demo.py`
- `steward/machine_memory.py`
- `steward/models.py`
- `steward/recovery.py`
- `steward/repair_policy.py`
- `steward/states.py`
- `steward/verifier.py`
- `tests/test_authority.py`
- `tests/test_commitments.py`
- `tests/test_end_to_end.py`
- `tests/test_recovery.py`
- `tests/test_repair_policy.py`
- `tests/test_states.py`
- `tests/test_verification.py`
- `tests/support.py`
- `tests/test_machine_memory.py`
- `tests/test_rails.py`

## All task files changed or added

- `.gitignore`
- `README.md`
- `data/machines/WM-001.json`
- `docs/architecture.md`
- `docs/demo_walkthrough.md`
- `docs/rail_matrix.md`
- `docs/safety.md`
- `docs/state_machine.md`
- `evidence/gnani_observations.md`
- `rails/__init__.py`
- `rails/base.py`
- `rails/logistics.py`
- `rails/payments.py`
- `rails/voice.py`
- `requirements.txt`
- `steward/__init__.py`
- `steward/authority.py`
- `steward/case_manager.py`
- `steward/commitments.py`
- `steward/demo.py`
- `steward/machine_memory.py`
- `steward/models.py`
- `steward/recovery.py`
- `steward/repair_policy.py`
- `steward/states.py`
- `steward/verifier.py`
- `tests/test_authority.py`
- `tests/test_commitments.py`
- `tests/test_end_to_end.py`
- `tests/test_recovery.py`
- `tests/test_repair_policy.py`
- `tests/test_states.py`
- `tests/test_verification.py`
- `docs/backend_reconstruction_report.md`
- `tests/support.py`
- `tests/test_machine_memory.py`
- `tests/test_rails.py`

## git diff --stat

This includes pre-existing node_modules changes. Git diff does not count untracked
files; the new report and three new test/support modules are listed in status below.

```text
 .gitignore                                         |   6 +
 README.md                                          |  18 ++
 data/machines/WM-001.json                          |  59 ++++
 docs/architecture.md                               |  40 +++
 docs/demo_walkthrough.md                           |  26 ++
 docs/rail_matrix.md                                |  11 +
 docs/safety.md                                     |  17 ++
 docs/state_machine.md                              |  20 ++
 evidence/gnani_observations.md                     |  38 +++
 node_modules/.package-lock.json                    |  49 ++--
 node_modules/@esbuild/win32-x64/README.md          |   3 -
 node_modules/@esbuild/win32-x64/esbuild.exe        | Bin 9913856 -> 0 bytes
 node_modules/@esbuild/win32-x64/package.json       |  20 --
 .../@rollup/rollup-win32-x64-gnu/README.md         |   3 -
 .../@rollup/rollup-win32-x64-gnu/package.json      |  22 --
 .../rollup-win32-x64-gnu/rollup.win32-x64-gnu.node | Bin 2092032 -> 0 bytes
 .../@rollup/rollup-win32-x64-msvc/README.md        |   3 -
 .../@rollup/rollup-win32-x64-msvc/package.json     |  22 --
 .../rollup.win32-x64-msvc.node                     | Bin 2660352 -> 0 bytes
 rails/__init__.py                                  |   8 +
 rails/base.py                                      |  14 +
 rails/logistics.py                                 |  53 ++++
 rails/payments.py                                  |  63 ++++
 rails/voice.py                                     |  49 ++++
 requirements.txt                                   |   1 +
 steward/__init__.py                                |   1 +
 steward/authority.py                               |  85 ++++++
 steward/case_manager.py                            | 326 +++++++++++++++++++++
 steward/commitments.py                             | 111 +++++++
 steward/demo.py                                    |  80 +++++
 steward/machine_memory.py                          | 139 +++++++++
 steward/models.py                                  | 306 +++++++++++++++++++
 steward/recovery.py                                |  87 ++++++
 steward/repair_policy.py                           |  69 +++++
 steward/states.py                                  | 111 +++++++
 steward/verifier.py                                |  44 +++
 tests/test_authority.py                            |  60 ++++
 tests/test_commitments.py                          |  58 ++++
 tests/test_end_to_end.py                           | 153 ++++++++++
 tests/test_recovery.py                             |  84 ++++++
 tests/test_repair_policy.py                        |  48 +++
 tests/test_states.py                               |  75 +++++
 tests/test_verification.py                         |  59 ++++
 43 files changed, 2344 insertions(+), 97 deletions(-)
```

## git status --short

```text
 M .gitignore
 M README.md
 M data/machines/WM-001.json
 M docs/architecture.md
 M docs/demo_walkthrough.md
 M docs/rail_matrix.md
 M docs/safety.md
 M docs/state_machine.md
 M evidence/gnani_observations.md
 M node_modules/.package-lock.json
 D node_modules/@esbuild/win32-x64/README.md
 D node_modules/@esbuild/win32-x64/esbuild.exe
 D node_modules/@esbuild/win32-x64/package.json
 D node_modules/@rollup/rollup-win32-x64-gnu/README.md
 D node_modules/@rollup/rollup-win32-x64-gnu/package.json
 D node_modules/@rollup/rollup-win32-x64-gnu/rollup.win32-x64-gnu.node
 D node_modules/@rollup/rollup-win32-x64-msvc/README.md
 D node_modules/@rollup/rollup-win32-x64-msvc/package.json
 D node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node
 M rails/__init__.py
 M rails/base.py
 M rails/logistics.py
 M rails/payments.py
 M rails/voice.py
 M requirements.txt
 M steward/__init__.py
 M steward/authority.py
 M steward/case_manager.py
 M steward/commitments.py
 M steward/demo.py
 M steward/machine_memory.py
 M steward/models.py
 M steward/recovery.py
 M steward/repair_policy.py
 M steward/states.py
 M steward/verifier.py
 M tests/test_authority.py
 M tests/test_commitments.py
 M tests/test_end_to_end.py
 M tests/test_recovery.py
 M tests/test_repair_policy.py
 M tests/test_states.py
 M tests/test_verification.py
?? docs/backend_reconstruction_report.md
?? node_modules/@esbuild/darwin-arm64/
?? node_modules/@rollup/rollup-darwin-arm64/
?? node_modules/fsevents/
?? tests/support.py
?? tests/test_machine_memory.py
?? tests/test_rails.py
```
