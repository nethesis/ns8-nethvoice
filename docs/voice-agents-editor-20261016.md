# Agent editor and publication lifecycle — 2026-10-16

Starting revisions: ns8-nethvoice `f94e43625ef94eb2ed129f958cb4279f8de05958`,
Satellite `29220e83f3ae9a32db0c5c24583ad3739a81df90`, both on `voice_agent`.
Pre-existing work, historical tool manifests and published configuration JSON
remain intact. No commit, push or release is included.

Directory lookup is automatic in newly created, saved or published editable
configurations, including the older extension-only editor. It is hidden from
administrators. Lookup filters through the transfer binding's permissions and
cannot grant transfers. Historical snapshots keep their pinned tool states.

The catalog supplies editor presentation metadata separately from immutable
runtime manifests. A disabled tool hides all its controls. Category toggles hide
the corresponding destination search and list without clearing saved settings.
All destination toggles have positive meaning: enabled means permitted. Existing
queue/IVR denylists and defaults are preserved internally, so the interface change
does not silently change existing grants or the eligibility of newly added PBX
queues/IVRs. Extensions still require explicit approval.

Enabled destinations have an inline optional description; disabled destinations
retain their text for later editing but do not expose it to the model. There is
no separate descriptions inventory or configured-description/remove-permission
summary. Extension/queue labels display the number without a type prefix; IVRs
show their name. Pagination appears only when needed. Saved descriptions are
searchable in both the administrator directory and runtime lookup. The runtime
continues to receive bounded, untrusted structured data containing typed ID,
name and description, rather than treating imported text as instructions.

The API returns `draft_version`: the publication version represented by the saved
draft, or the next immutable publication number when the saved draft differs.
It is distinct from the optimistic concurrency `revision`. The editor shows
published and saved-draft versions, disables saving a pristine draft, highlights
Publish after saving, and blocks publication while edits are unsaved.

Publishing now makes an editable agent available to native routing without a
second activation operation. The UI has no enable/disable action; the old API
rejects it for editable agents. Dialplan/VisualPlan decides when to invoke them.
Migration 012 activates previously published editable agents (contract >=5),
audits and revision-checks the change through a revision bump, and marks native
synchronization pending. It preserves removed and historical read-only agents,
unpublished drafts, routes and immutable publications. Publication still requires
a validated provider and successful native synchronization for routability.

Local verification: 126 Python cases, PHP/MariaDB services, authenticated REST,
CSRF/revision checks, migration twice, native dialplan, backup/restore and scoped
runtime accounts; 14 browser cases, 3 UI unit cases, type-check/lint/format and
production UI build. Assertions cover inline descriptions, category/tool hiding,
positive queue toggles, preserved grants across pages, unavailable targets,
publication activation, draft version numbers and lookup by permitted purpose.
The existing chunk-size and Starlette deprecation advisories remain.

Staging evidence, rollback and final verification are recorded below when complete.
No provider voice calls are required for this editor change; the previous live
routing/audio acceptance gates remain open.

## Makako staging verification

Deployed to `nethvoice57` on Makako, node 1, at 08:19 UTC. FreePBX now uses
`2ef42704ed55e6a4cf9f2deb7e24a0c70ed251541dcf4c5cf93c0ae36f5fedf7`.
The runner image is unchanged. The scoped image was made from an offline,
never-started container of the exact preceding image; no live volumes, generated
credentials or call data were copied into it. All 34 replaced PHP/UI/static files
matched their source hashes in both the offline image and deployed container.
Environment, entrypoint, command, user, working directory, declared volumes and
stop-signal semantics were checked. Podman's added `container` environment marker
was explicitly removed and its commit stop signal explicitly preserved. Earlier
offline configuration checks failed safely before any deployment. The previous
Wizard Agent menu correction is now preserved in this image as well.

The runner was stopped and resumed around the FreePBX restart after two fresh,
independent zero-call/channel gates. Transcription was not restarted. No operator
publication or route was changed. The currently published Receptionist is still
on its pre-deployment contract 6 snapshot. An administrator-authenticated HTTPS
API test created one isolated, unrouted agent, verified automatic lookup and its
normalization against a forged disabled binding, confirmed that publication
immediately activates native routability, rejected the separate disable action,
and saved draft version 2 while keeping publication 1 unchanged. It then removed
the isolated agent. No provider session or telephone call was opened. Its removed
identity, immutable publication and audit history remain for traceability.

Thirteen original configuration/native tables matched pre-deployment row counts
and hashes exactly after excluding that isolated test identity/history. A native
queue table changed between the initial fingerprint (08:18:30 UTC) and deployment:
its MariaDB update timestamp was 08:18:44 UTC, before the independent call gate
at 08:18:58 and service change at 08:19:00. This concurrent earlier change was
preserved; the queue fingerprint then stayed unchanged across deployment and
API verification. No queue was created, edited or deleted by this work.

Final checks: schema 12; five services running with zero container restart counts;
ready and healthy monitoring; zero active calls/channels; unchanged shared
configuration/secret-file hashes; correct proxy route, HTTPS certificate/assets
and webhook-prefix isolation. Journal priority alone also includes FreePBX
progress bars, INFO deprecations and Apache startup notices written to stderr;
these were inspected separately from application health. The NS8 get-status
action succeeded. Final whitespace checks passed in both repositories.

Rollback is unused and retained. The protected backup is under the directory
named by `AGENT_STATE_DIR/agent-editor-current-backup`, containing exact old/new
FreePBX systemd overrides and a configuration dump. The old image is retained as
`localhost/agent-editor-rollback:freepbx`. Under a fresh independent zero-call and
zero-channel gate, restore `freepbx-rollback.conf` to the discovered module
FreePBX drop-in, reload user systemd, stop the runner, restart FreePBX and resume
the runner. Verify health and routes again. Additive schema 12 can remain; do not
restore the SQL dump over later administrator edits. The old image predates the
previous menu's temporary live CSS patch; that source fix must be rebuilt or its
protected static patch reapplied if this image rollback is used.

Sanitized receipts, browser screenshots and staging helpers are in ignored
`local_testing/artifacts/agent-editor-20261016/`; protected configuration backups
stay on the server. No commit, push or release declaration was made.

### Published-draft button follow-up

`Publish` is now disabled (and no longer highlighted) when the API's saved draft
version matches the published version. It stays disabled while edits are unsaved
and becomes available for a saved, different draft or a first publication. The
handler also guards against invoking publication from the disabled state. Older
API fixtures without `draft_version` use the existing content comparison.
The browser regression failed on the old behavior and passed after the change;
three affected browser cases, type-check, lint, formatting and the UI build passed.

Deployed at 08:51 UTC to `nethvoice57`, FreePBX image
`9bcfcf861a307205e6842208d94a023c865014d56ab57d283d005fd6b244262a`,
using independent zero-call/channel gates and retaining the previous image as
`localhost/publish-button-rollback:freepbx`. All 34 PHP/UI/static source hashes
were verified; PHP and schema are unchanged. All fourteen original configuration
and native-table fingerprints remained identical, including publications and
queues. Runtime readiness, monitoring, HTTPS assets and prefix isolation passed;
no provider calls or configuration publication were made. Protected rollback
uses the current backup pointer and the same zero-call procedure described above.
Receipts are in ignored `local_testing/artifacts/publish-button-20261016/`.
