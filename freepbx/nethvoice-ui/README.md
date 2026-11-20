# NethVoice UI

Administration interface and first-configuration wizard of NethVoice, served at `/nethvoice/`.
It runs next to the previous wizard (`../wizard-ui`, served at `/`): both use the same REST API and
the same sign-in, so an administrator can move between them at any time.

```bash
npx -y npm@11 install
cp .env.example .env.local      # set NETHVOICE_PBX_URL to a NethVoice instance
npm run dev                     # http://127.0.0.1:5183/nethvoice/
```


The bundle is built by the `nethvoice-ui-builder` stage of `../Containerfile` and copied to
`/var/www/html/freepbx/nethvoice-ui`. Apache serves it through an alias with a fallback to
`index.html` for client-side routes (`../etc/apache2/sites-enabled/000-default.conf`), and
`../entrypoint.sh` writes `config.json` (branding) next to it at container start.

If the dev server stops with `ENOSPC: System limit for number of file watchers reached`, the
editor is using all the inotify watches of the system: start it with
`CHOKIDAR_USEPOLLING=1 npm run dev`, or raise `fs.inotify.max_user_watches`.

## Commands

```bash
npm install                 # needs npm >= 11 (npx -y npm@11 install)
npm run dev                 # http://127.0.0.1:5183/nethvoice/ - proxies the API to NETHVOICE_PBX_URL (.env.local)
npm run pre-commit          # format + lint + type-check + openapi:check + unit tests
npm run build               # type-check + production bundle in dist/
npm run test:unit -- --run  # vitest
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e   # Playwright against a fully mocked API (no PBX needed)
npm run openapi:generate    # regenerate src/lib/api/schema.d.ts from ../var/www/html/freepbx/rest/openapi.yaml
```

## Rules

- `<script setup lang="ts">` and Composition API only. Path alias `@/` for `src/`, never `../../`.
- License header on every `.vue` and `.ts` file (see any existing file). No other code comments:
  explain in the pull request, not in the code.
- No hardcoded user-visible strings. Every key goes in **both** `src/i18n/en/translation.json` and
  `src/i18n/it/translation.json`, same order. Add keys with
  `python3 scripts/i18n-merge.py <<< '{"en": {...}, "it": {...}}'` (it merges and locks the files).
  Keys are `snake_case`, the top-level namespace is the section (`users`, `trunks`, `setup`, ...).
  Product terms that stay English in Italian: "Presence", "Web phone", "trunk" is "fascio".
- Type-safe always: no `any`, no non-null assertions. Parse every API response with a valibot
  schema at the boundary (`src/lib/**`), so a contract drift fails loudly in one place.
- No inline `style` attributes except for values computed at runtime. Tailwind utilities only, using
  the semantic tokens of `src/assets/main.css` (`elevation-0..4`, `text-primary-neutral`,
  `text-secondary-neutral`, `text-tertiary-neutral`, `primary-*`). Both themes must work: the
  design is dark-first but every screen is checked in light too.
- Use `@nethesis/vue-components` (`NeButton`, `NeTable*`, `NeSideDrawer`, `NeModal`, `NeTextInput`,
  `NeCombobox`, `NeDropdown`, `NeDropdownFilterV2`, `NePaginator`, `NeTabs`, `NeBadgeV2`,
  `NeTooltip`, `NeEmptyState`, `NeInlineNotification`, `NeSkeleton`, `NeToggle`, `NeFileInput`...)
  before writing markup. Icons are Font Awesome (`@fortawesome/free-solid-svg-icons`, plus
  `@nethesis/nethesis-{light,solid}-svg-icons`) through `FontAwesomeIcon`.
- Accessibility: every control has a label, icon-only buttons have an `sr-only` text, drawers and
  modals pass `close-aria-label`, focus goes to the first invalid field after validation.

## Layout

```
src/lib/<section>/*.ts        valibot schemas, types, pure helpers and API functions (+ *.test.ts)
src/lib/api/client.ts         openapi-fetch client typed by schema.d.ts (adds User/Secretkey headers)
src/queries/<section>/*.ts    Pinia Colada queries (defineQuery, key = [<X>_KEY, ...filters])
src/stores/*.ts               login (credentials), theme, notifications, runtimeConfig (branding), setup
src/components/<section>/     ActionEntityType.vue: UsersTable, CreateOrEditUserDrawer, DeleteTrunkModal
src/components/setup/         first-configuration wizard steps (SetupStepLayout + one file per step)
src/components/common/        DeleteObjectModal, LoadError, ComingSoon
src/views/*View.vue           one per route; section tabs are a `:tab` route param (useRouteTab)
e2e/                          Playwright specs + fixtures/mockApi.ts
scripts/                      i18n-merge.py, check-i18n.mjs, openapi-patch.py, openapi-lint.yaml, screenshot.mjs
```

## Data flow

1. **API function** in `src/lib/<section>/x.ts`: calls `api.GET/POST/...` (typed by the OpenAPI
   document), parses the response with valibot and returns a UI-oriented model. Legacy quirks (ids
   as strings, `"on"/"off"`, nested shapes) are normalized here and nowhere else, so that the day
   the backend exposes the cleaned-up API only this layer changes.
2. **Query** in `src/queries/<section>/x.ts` with `defineQuery` + `useQuery`, guarded by
   `enabled: () => loginStore.isAuthenticated`. Lists are small (tens to hundreds of rows) and the
   API has no server-side pagination: filter, sort and paginate client-side with the helpers of
   `src/lib/common.ts`.
3. **Mutation** with `useMutation`: invalidate the affected keys in `onSettled`; on success close the
   drawer/modal and show a toast after 500 ms (`notificationsStore.createNotification`); on error
   show the failure inside the drawer/modal (`describeError(error)`), never only in a toast.

## API contract (OpenAPI)

The REST API is `../var/www/html/freepbx/rest` (Slim, PHP). Its OpenAPI document started as a
skeleton with untyped bodies. **Before calling an endpoint, document its real request and response
in `openapi.yaml`** and regenerate the types:

```bash
python3 scripts/openapi-patch.py <<'YAML'
schemas:
  CtiGroup: {type: object, required: [id, name], properties: {id: {type: integer}, name: {type: string}}}
operations:
  - path: /cti/groups
    method: get
    responses:
      200: {type: array, items: {$ref: '#/components/schemas/CtiGroup'}}
      500: null
YAML
npm run openapi:generate
```

Read the PHP handler (`modules/*.php`, `lib/*.php`) to get the shape right and check it with a real
`GET` when a PBX is available. Do not change the behaviour of existing endpoints: the previous
wizard depends on them. New endpoints are additive.

Other APIs reachable with the same headers: `/api/*` (nethcti-middleware, only the admin
allowlist) and `/tancredi/api/v1/*` (phone provisioning). They are called with `fetch` wrappers in
`src/lib`, each with its valibot schemas.

## Authentication and coexistence with the previous wizard

- Login: `POST /testauth` returns the shared secret; `Secretkey = sha1(user + sha1(password) + secret)`.
  Credentials are stored in `localStorage.secretkey` as `{user, hash}`, the same entry the previous
  wizard uses, so signing in to one signs in to the other.
- Wizard progress is the single row of `GET/POST /configuration/wizard`, shared with the previous
  wizard. Steps are saved with their legacy number (`src/lib/setup/steps.ts`). Saving step 13
  restarts Asterisk: only the final "Complete setup" action may do it.

## Tests

- **Unit** (vitest, co-located `*.test.ts`): every pure function of `src/lib` (parsers, validators,
  mappers, filters). Test behaviour, not implementation.
- **End-to-end** (Playwright, `e2e/specs/<section>.spec.ts`): drive the real UI against
  `mockApi` (`e2e/fixtures/mockApi.ts`). Every API call must be mocked, or the test fails. Assert
  both what the user sees and what was sent (`mockApi.callsTo('POST', '/freepbx/rest/...')`).
  Cover: list rendering, empty state, load error, each create/edit/delete flow, validation errors.

## Looking at the result

`node scripts/screenshot.mjs dark "name|/path|await page.click('text=Create user')"` drives a headless
Chrome on the dev server and saves `screenshots/name-dark.png`. It blocks every request that is not
a `GET` (plus the login call), so it can be pointed at a real PBX without changing it.
