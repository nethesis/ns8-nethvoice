# Published configuration v8

Canonical files are in `freepbx/var/www/html/freepbx/rest/lib/agents/contracts/`:

- `published-v8.schema.json` and `published-v8.example.json`
- `tools-v5.json` (the current four-tool catalog)
- `provider-models-v2.json` (current per-agent capabilities)

Satellite mirrors these files byte for byte in `voice_agent/`. PHP and Python both
reject any other publication version, unknown keys, non-integer numeric settings,
duplicate tool IDs, unsupported manifest versions, invalid category identifiers,
invalid model/voice/options combinations and duplicate destination descriptions.
The snapshot is bounded to 64 KiB. Agent IDs, stable native destinations and
publication versions must agree with the database row.

A draft has `contract_version: 8`, nullable provider/model/voice choices until
complete, a conversation, four independently configured `tool_bindings`, fallback,
call deadline and debug policy. Publishing requires a ready provider, valid
conversation and available explicitly allowed targets. Publication atomically
creates an immutable version and selects it as active. The runtime validates and
detaches that exact document before provider usage and validates the trusted tool
catalog against executable handlers. A disabled or wrong-version tool fails even
when invoked directly by its wire name.

`pbx.transfer` v2 accepts exactly one typed `destination_id` or call-bound
`candidate_ref`. No model-supplied dial strings, callback flags, caller-number
substitutions or arbitrary SQL are accepted. Realtime's advertisement projects the
known root `oneOf` into its supported schema dialect; runtime authorization keeps
the original exclusive-choice semantics. Grok and Live retain the canonical schema.

Fallback wrappers are derived from the pinned agent ID and fallback, never from
model input. Native destination existence, permissions and ARI ownership are
rechecked immediately before transfer. Compact Asterisk channel IDs keep Local
halves within native CDR uniqueid and CEL peer limits while full session/run IDs
remain separate monitoring identities.
