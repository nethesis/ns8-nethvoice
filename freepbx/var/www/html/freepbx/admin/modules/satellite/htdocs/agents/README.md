# NethVoice Agents

Standalone Vue 3 application served at `/freepbx/satellite/agents/`. The Wizard
Agents menu opens it in a new tab. The separate document isolates Tailwind 4 from
the AngularJS, Bootstrap and PatternFly Wizard. The provider webhook stays at
the parent `htdocs/index.php`.

## Development

Use Node 24.15 or later in the Node 24 release line. Dependencies are locked.

```sh
npm ci
npm run dev
npm run type-check
npm run lint
npm run format
npm test
npm run test:browser
npm run build
```

Browser tests use synthetic REST fixtures and Chrome. Screenshots and test
results go to `/tmp`. There are no production demo-data fallbacks. The shared
theme uses Poppins and the complete green primary palette; library button
variants retain their light/dark behavior. The V2 badge, toast and filter are used.
Vue Flow provides canvas interaction; publication validation stays on the server.

The root FreePBX Containerfile builds this app in the `agents-ui` Node stage and
copies only `dist/` into the PHP image. Source files and development dependencies
are removed from the document root.

## Authentication and APIs

The app reads the existing Wizard credential pair and sends it only to the same
origin `/freepbx/rest/agents` gateway. `GET /access` obtains the session CSRF value.
Mutations carry `X-Agents-CSRF`. No browser actor header establishes privileges.
Sign-in returns through a validated same-origin application path. Sign-out in
another tab clears cached data.

For local development on a PBX, reverse-proxy the Vite document through the PBX
origin. That keeps Origin/Host, credentials and session cookies consistent. The
optional `AGENTS_PBX_URL` Vite proxy does not bypass TLS or gateway origin checks.
A standalone localhost origin is suitable for the synthetic browser tests.

The maintained runtime contract is
`Satellite/docs/agents/workflow-api-contract.md`, including the schema 2 section.
Native trunks/profiles/directory remain in FreePBX. Runtime graphs, tools,
encrypted sources, simulations and invocations remain in Satellite PostgreSQL.
Do not deploy this UI with the old runtime digest: build and publish the matching
runtime, then record its registry digest in `satellite/runtime-image.txt` before
building the NethVoice wrapper/module.

## Design and acceptance

The supplied `design.fig` is the layout reference. The shared Figma file is
`wlBq1Ie0i5g4eIlh9I7YMo`, node `12:708`. Component styles take precedence where
the approved mock differs from the Nethesis library. Full Figma screenshot
comparison requires connector access; local browser screenshots alone do not
establish exact visual acceptance.

The Test tab is an offline fixture simulation. It makes no provider, connector or
phone calls. Connection probes are real read requests; machine `/test-runs` are
live execution. Live OpenAI/PBX acceptance still requires explicit user approval.
Enabled schema 2 write tools execute immediately within their configured scope.
Legacy explicit confirmation nodes retain their behavior.
