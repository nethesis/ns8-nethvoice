## REST API fixtures

`tests/fixtures/rest_api/` stores normalized fixture snapshots for curated REST
API scenarios.

Fixture refresh workflow:

1. Run the smoke suite against a known-good NS8 node.
2. Inspect `${OUTPUT DIR}/rest_api_smoke/.../captured` and the generated diff.
3. Replace the committed fixture only when the resulting config change is
   expected.
4. Keep fixtures narrow. Prefer filtered fragments from specific files over
   broad snapshots that are hard to review.