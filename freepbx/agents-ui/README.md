# Agents UI — Basic Voice

Selected source from the previous Vue application is relocated here: layout,
Wizard sign-in, theme, EN/IT translations, notification state and authentication
tests. Nethesis-owned source is licensed GPL-3.0-or-later; see `LICENSE` and
`../../docs/voice-agents-v01.md` for the supported behavior and test commands.

The v0.1 interface configures built-in/custom Basic Voice agents, enabled tools,
approved transfer extensions, provider trunks and run activity through the
PHP REST API. Default language uses the PBX default; provider voices use a
server-side catalog. API keys can inherit server environment credentials.
Fallback routing is configured on the native VisualPlan Agent output. Wizard’s
Apps menu opens this interface in a new tab. There are no browser-to-Satellite
calls or legacy workflow proxy URLs. Graph workflows and custom tools remain
future milestones. See `../../docs/voice-agents-v01.md` for the current contract.

Use Node 24.15 or later supported by the lockfile dependencies:

```sh
npm ci
npm run type-check
npm run lint
npm test
npm run test:browser
npm run build
```

The Vite base is `/freepbx/agents-ui/`. Browser tests use isolated port 5187 and
synthetic same-origin REST responses. FreePBX's Containerfile builds this source
in a separate Node stage and copies only `dist` into the final image. Development
dependencies, environment files and source maps are excluded from the deployed UI.

Activity monitoring, metric definitions and the environment-only metadata retention
policy are documented in [monitoring v2](../../docs/voice-agents-monitoring-v2.md).
