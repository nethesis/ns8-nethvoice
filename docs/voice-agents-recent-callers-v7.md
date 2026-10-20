# Recent-caller routing — contract v7

Implemented locally on 2026-10-20. This is not a live-provider acceptance or a
v0.2 release claim. The separate Satellite WebSocket bridge remains deferred.

## Behavior

Fresh Receptionist and custom drafts enable Transfer and Recent callbacks, with
a seven-day lookback (configurable from 1 to 90 days). Direct extensions remain
disabled with an empty allowlist. Callback exclusions are a separate denylist:
all current and newly added extensions are eligible unless excluded. Existing
queue defaults remain on; the current editor keeps IVRs off.

The caller must ask to return a call before lookup. The model receives instructions
to name a single match and ask confirmation, or name multiple contacts and ask
whom to connect. Results are newest-first, deduplicated by extension, with at most
five contacts per page and an explicit next offset. Duplicate names can be
distinguished by extension. No match or unavailable history leads to ordinary
permitted routing, not an invented contact.

A valid callback reference overrides only the direct-extension setting:

| Transfer | Recent callbacks | Direct extension | Valid reference | Callback |
| --- | --- | --- | --- | --- |
| on | on | off | yes | permitted |
| off | on | any | yes | denied |
| on | off | on | yes | denied |
| on | on | off | no | denied |

The lookup binding must also be enabled. Excluded or removed extensions fail
closed. Caller ID is a routing identity and is not strong authentication.
Confirmation is conversational guidance, not a cryptographic proof of consent.
Automated emulators verify the supplied instructions and scripted choices;
they do not prove how a live model will speak or interpret an actual caller.

## Contracts and ownership

- `published-v7.schema.json` pins `pbx.find_destinations` v1,
  `pbx.find_recent_callers` v1 and `pbx.transfer` v2.
- `tools-v4.json` is mirrored byte-for-byte in Satellite. Historical manifests
  and contracts v1–v6 are unchanged.
- The transfer binding owns `recent_callers_enabled`,
  `recent_caller_lookback_days` and `recent_caller_denylist`.
- Lookup accepts only an optional `offset`. The trusted inbound ARI caller
  number is captured at admission; neither a model argument nor spoken number
  can replace it.
- Lookup returns `name`, `extension`, `seconds_ago` and `candidate_ref`. Transfer
  accepts exactly one of `destination_id` and `candidate_ref`. A callback
  reference never grants the direct-ID path.
- Candidate references contain 192 bits of randomness, remain only in memory,
  expire after five minutes and are cleared at call termination. They are bound
  to the resolver for one caller, session, agent and publication. A new lookup
  can refresh expired evidence; an expired continuation page returns an error.
- The common native transfer executor rechecks evidence, current existence and
  pinned grants before preparation and immediately before continuation. Success
  still requires the private destination/token acknowledgement and ARI release.
- Monitoring stores fixed errors, result counts and resolved transfer destinations.
  It does not store caller numbers, CDR rows or candidate references.

Migration 013 adds immutable catalog entries, v7 acceptance and the monitoring
tool identifier. Installation refreshes narrow native views. The existing
configuration reader receives SELECT on those views only; it cannot read or
write the base CDR table. The monitoring writer gains no CDR access.

Fresh installation seeds use the same factory as new agents. Upgrades preserve
saved drafts and publications. On an existing v6 agent, **Add recent callbacks to
this draft** prepares an unsaved v7 draft, preserving the master switch and all
existing grants. Normal Save and Publish activate it. There is no new upgrade
endpoint, automatic publication, agent reset or route change. Older publications
remain executable; v7-to-older draft downgrades are rejected.

## CDR qualification and limits

The resolver reads only a narrow CDR view and nonsecret device, trunk and digit
pattern metadata. It requires a real internal device origin and a qualifying
outbound native trunk Dial leg, including ANSWERED, NO ANSWER and BUSY attempts.
It uses linked legs to corroborate Local-channel attempts, rejects groups with
an inbound trunk leg or multiple internal origins, and deduplicates contacts.
This intentionally excludes ambiguous forwarded or transferred histories.

Queries use exact destination values and the existing destination/time and
linkedid indexes. The destination search and linked-leg expansion each have a
500-row-examination limit; all queries have a one-second statement limit.
Incomplete-query warnings are treated as overflow, never as a complete partial
answer. Metadata and returned-record sets are also bounded at 1,000 rows.
See MariaDB's [LIMIT ROWS EXAMINED documentation](https://mariadb.com/docs/server/ha-and-performance/optimization-and-tuning/query-optimizations/limit-rows-examined).

Number matching preserves leading zeros and never uses suffix matching or
guesses a country. Native route patterns can explain the original CDR
destination, while only the actual trunk's rules can explain its dialed number.
At most 16 exact variants are generated. The initial implementation supports
literal digits and native X/Z/N/final-dot patterns; unsupported patterns,
custom trunk URIs and uncertain local/international equivalences produce no
authorized match. The native SIP/PJSIP Dial forms are covered by fixtures.

`VOICE_AGENT_CDR_TIMEZONE` comes from the same NS8 TIMEZONE used by FreePBX.
CDR DATETIME is interpreted in that zone; ambiguous/nonexistent daylight-saving
wall times are excluded. Historical records spanning an installation timezone
change require separate validation. Missing optional native sources produce no
qualifying contacts; database failures return a fixed unavailable category.

## Local validation and rollout

Starting revisions:

- ns8-nethvoice: `292c9fbb8f087df9beac7a5f6795b22450f1ee96`
- Satellite: `9499c10c6e0976d9a6675c6b1522b9ed6ff13213`

Pre-existing editor changes and GPT-Live diagnostics were retained. No legacy
`.bak` or `old/` checkouts were available. The implementation reuses the active
registry, schema editor, native views, transfer executor and provider emulators.

Validation covers PHP/Python contract parity, defaults and independent grants,
reference forgery/expiry/isolation, actual executor rechecks and confirmed
handoff, zero/one/multiple contacts, pagination, minimal result data, missed
calls, Local legs, prefixes, timezone boundaries and query overflow. Disposable
MariaDB tests exercise repeatable migrations, unmodified publications,
backup/restore and actual runtime privilege denial. Browser tests cover desktop
and mobile rendering, exclusions and explicit draft activation. OpenAI Realtime
and Grok emulators exercise the v7 wire tools and scripted contact selection.

Run the cross-repository suite with:

```sh
M0_PYTHON=/path/to/python-with-agent-dependencies \
  bash ns8-nethvoice/freepbx/tests/agents/run-foundation.sh
```

Observed results: the disposable-database suite passed all PHP checks and
192 Python tests, including both provider emulators. A subsequent regression
exposed a removed inbound trunk being overlooked during linked-leg qualification;
unknown non-Local source legs now fail closed. The final targeted run passed
26 tests, with its database integration case skipped outside the disposable
runner. Four UI unit tests, four affected browser tests, TypeScript/build, lint
and changed-file formatting checks passed. The optional Wizard authentication
harness was not selected. Existing Vite bundle-size and Starlette deprecation
warnings remain.

The UI production build and Satellite container build are local artifacts.
No changes were deployed, no provider sessions were opened, and no commits or
pushes were made. Disposable database containers are removed by the test harness.

For staging, first verify the current nethvoice70 identity, original image IDs,
backups, unchanged 7777 route and a separately authorized bounded test window.
Use synthetic CDR history and automated calls. Gate every restart on fresh
zero-call/channel checks and account for shared transcription.

For rollback, prefer keeping the v7-capable runtime while disabling Recent
callbacks in a new publication. For an image rollback to v6, first restore the
previous saved configuration/active-publication state from the verified backup
under zero calls; do not rewrite immutable snapshots or leave an active v7
publication on an older runtime. Additive catalog/view/schema changes may stay
installed. Verify agents, routes, credentials and transcription after rollback.

Live SIP/provider acceptance, the intermittent GPT-Live SIP audio issue, caller
admission policies and agent duplication remain outside this slice.
