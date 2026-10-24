# Agents UI

Vue 3/TypeScript/Vite/Tailwind and Nethesis components serve
`/freepbx/agents-ui/`. The same-origin PHP REST API owns authorization, CSRF,
configuration validation and grants. Current v8 agents share one editing view.
Publication activates a saved agent; there are no compatibility upgrade actions.
Graph workflows, duplication and caller admission remain roadmap work.

Use the supported Node version from `package.json` and the committed lockfile:

```sh
npm ci
npm run type-check
npm run lint
npm run format
npm test
npm run build
npm run test:browser
```

Browser tests use synthetic REST responses on isolated port 5187. The FreePBX
image builds in a separate Node stage and copies only `dist`; no node_modules,
environment files or source maps ship. Vue Flow is not a dependency of this alpha.
See [architecture and operations](../../docs/voice-agents.md),
[contract](../../docs/voice-agents-contract-v8.md) and
[testing](../../docs/voice-agents-testing.md).
