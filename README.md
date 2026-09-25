# Steward

The reconstructed Python backend manages machine service cases with deterministic
authority, explicit commitments, household outcome verification and JSON machine
memory. It uses only the Python 3.10+ standard library.

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 -m steward.demo all
```

All demos use isolated temporary memory and **local mock** voice, payment and
logistics rails. No credentials or live external integrations are required.

See [architecture](docs/architecture.md), [demo walkthrough](docs/demo_walkthrough.md),
and [manual Gnani evidence](evidence/gnani_observations.md).

The existing React/Vite UI is unchanged and is not connected to this backend.
