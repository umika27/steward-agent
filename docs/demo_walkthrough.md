# Backend validation and local demos

Python 3.10+; standard library only, no installation or credentials needed.
From the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 -m steward.demo all
```

Individual scenarios: `happy`, `over-limit`, `no-show`, `failed-repair`.
All writes use temporary directories, removed on completion.

- Happy: ₹900 is automatically authorized, Saturday 12–2 PM is within the
  fixture availability. Provider completion reaches VERIFYING, never CLOSED.
  Household verification, mock settlement, fulfilled commitments and persisted
  machine memory allow closure. Cumulative spend becomes ₹2,100.
- Over-limit: ₹3,800 stops at HUMAN_APPROVAL_REQUIRED without booking or payment.
- No-show: the same case retains its breached appointment and follows up for a
  new Saturday appointment; successful verification and settlement allow closure.
- Failed repair: household reports the drainage problem persists. The case moves
  through REPAIR_FAILED to REASSESS_REPAIR_VS_REPLACE; closure is rejected.

The demo simulates a cooperative local provider. The real manual Gnani T01
coverage question remains unresolved in the evidence; tests separately prove
that preserving such a question blocks finalization until explicitly answered.
