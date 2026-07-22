# @owd/ai

This package is a provider-free compatibility facade and bounded local
quality-gate runner.

- `src/gateway.mjs` is a deterministic local compatibility facade. It never
  reads credentials, calls a provider, or executes generated commands.
- `npm run quality-loop -w @owd/ai` runs a bounded, fixed quality-gate loop and
  writes an atomic receipt to `CANA_CONTROL_TOWER/LOCAL_LOOP_STATUS.json`.
- The product runtime is direct local code; the package name remains only for
  workspace compatibility.
