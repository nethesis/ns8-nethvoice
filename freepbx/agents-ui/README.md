# Agents UI — M0

Selected source from the previous Vue application is relocated here: layout,
Wizard sign-in, theme, EN/IT translations, notification state and authentication
tests. The GPL license is preserved in `LICENSE`. The source revision and deferred
components are recorded in `../../docs/voice-agents-m0.md`.

M0 renders an authenticated empty workspace. Agent creation, tools, data sources,
workflows, activity and settings remain inaccessible until their server contracts
are implemented. There are no Satellite calls or legacy workflow proxy URLs.

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
