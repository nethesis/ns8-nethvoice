# PLAN — Satellite Agents: NethVoice Integration and Application Roadmap

## Application direction and planning scope

The longer-term goal is a broader **NethVoice application** for defining and
running agentic workflows, connecting external APIs and tools, using files as
context, and monitoring execution. It remains dedicated to NethVoice; a standalone
product or independent deployment is not part of this roadmap. Voice integration
is the first implemented use case.

Confirmed direction: explicit workflows with agent/tool steps; prioritize
monitoring, API integrations, and file context before workflow authoring. Advanced
voice control remains a separate planned track.

Phase 1 is complete. Phase 2 is implemented, committed and published through
coordinated CI, and the `agent` images are deployed to `nethvoice51`. See
[satellite/phase2-development.md](satellite/phase2-development.md) and
[the CI acceptance report](satellite/phase2-ci-test-report.md). Automated checks
and controlled voice scenarios passed within their recorded scope. Human
listening, exact spoken email/VAT content, and the actual external incoming-call
path remain acceptance gates; Phase 2 is not marked production-ready here.
The modularity requirements in section 2.6 govern these changes.

**Phase 3 is monitoring-first (roadmap M1).** The owner confirmed a dedicated
NethVoice Agents area with the existing management login, administrator-only
access, execution metadata by default, per-agent transcript opt-in, and
configurable defaults of 30 days for metadata / 7 days for transcripts.
The detailed implementation plan is
[satellite/phase3-plan.md](satellite/phase3-plan.md). API integrations, files and
workflow authoring remain later milestones. The detailed Phase 3 plan governs
its delivery scope; references to the original Phase 3 transfer work below
identify the separate advanced voice track.

The later application milestones in section 101 remain a **draft roadmap**.
Their detailed designs, estimates, acceptance tests and delivery commitments
will be refined when each becomes the next implementation increment.

The two initial profiles, FreePBX pages, local HTTP integration, and single
Satellite daemon describe the Phase 2 delivery. They are not permanent limits
on agent count, workflow types, NethVoice application navigation, or internal
workload isolation. Preserve Phase 1 compatibility and the confirmed Phase 2
feature scope. References below to the original Phase 3/4 describe capability
scope; section 101 governs the draft post-Phase-2 delivery priority.

## Phase 2 review after Phase 1 — 2026-10-02

Review baseline: NS8 repository commit `8a550886`, FreePBX Satellite module
`0.1.2`, and the packaged upstream Satellite image `0.2.4`. Phase 1 is complete;
its implemented contracts take precedence over the original illustrative examples
below. This review changes the implementation plan only.

### Confirmed Phase 2 decisions

1. **Navigation:** retain Phase 1's two top-level pages: `satellite_agents`
   (Satellite Agent) and `satellite_webhooks`. Add Internal/External profile tabs
   alongside Destinations and Agent Trunks.
2. **OpenAI API:** implement **Realtime only** in Phase 2. Live is a separate
   future adapter extension; do not select the API implicitly by model name.
3. **Transfer scope:** include **basic human handoff** in Phase 2: send the caller
   into an allowed FreePBX destination and end the AI session. Supervised
   transfer, private consultation, and resuming AI after target failure remain
   Phase 3. Section 38 defines the handoff contract.
4. **Opening hours:** use existing **FreePBX time groups/time conditions**.
   Section 45 defines the distinction between scheduled hours and routing
   overrides.

---

### Phase 1 contracts that Phase 2 must preserve

- Stable `CleverAI_<id>` names and `satellite-agent-destination-<id>,s,1`
  routing keys, including Visualplan Agent nodes and destination usage checks.
- The existing `AgentSchema`, repositories, `AgentCrypto`, `AgentSession`,
  provisioner, POST/CSRF handling, and shared Agent views. Extend these instead
  of creating a parallel admin or persistence implementation.
- Proxy-mediated SIP: the FreePBX side uses UDP through `PROXY_IP:PROXY_PORT`;
  the provider URI specifies TLS. OpenAI uses `media_encryption=no` on the
  Asterisk leg. Reuse provider-specific settings and validate both media legs.
- Explicit provider URI dial strings and `isTrunk: 1`, alongside all existing
  `X-OS-*` headers. CleverAI keeps its existing linkedid session header.
- Phase 1 removed enable/disable controls. Its repositories force `enabled=1`
  and schema installation normalizes old rows to 1. Retain this compatibility
  behavior; readiness is a separate derived status. References below to an
  editable Enabled field are historical, not a Phase 2 UI requirement.

### Required Phase 2 foundations

These are delivery requirements, even where the original plan placed their
general discussion in Phase 4:

- Additive, repeatable schema migration; configuration revision/hash handling;
  saved-versus-applied status; startup/reload retry and restore resynchronization.
- Configuration includes destinations, provider bindings, credentials, profiles,
  directory rules and resolved resources, company information, and hours data.
- Pending call snapshots, unpredictable provider-leg correlation tokens, signed
  webhook verification, replay handling, per-session serialization, deadlines,
  bounded event queues, and deterministic fallback/cleanup.
- Agent service lifetime independent of transcription, plus coordinated runtime
  image packaging. The NS8 `satellite/` directory is documentation only; runtime
  implementation belongs to the separate `nethesis/satellite` repository.
- Preserve Visualplan navigation, Agent node serialization/load/save, validation,
  and deletion protection while introducing the built-in destination types.
- Keep agent definitions, execution, tools, context access, and execution events
  independent of FreePBX/ARI through the boundaries in section 2.6. Implement
  only the boundaries used by Phase 2; workflow engines and application editors
  are later milestones.

Recommended implementation order:

1. Freeze the configuration/event schemas using the confirmed decisions above.
2. Implement migrations, profiles, shared validation and UI/Visualplan changes.
3. Deliver the Satellite Agent lifecycle/API and configuration synchronization,
   including NS8 startup, image pinning, restart, and restore integration.
4. Implement ARI caller/provider legs and authenticated provider adapters.
5. Add policy-enforced tools, basic handoff, and FreePBX opening-hours integration.
6. Validate upgrades, existing CleverAI routes, transcription/TTS isolation,
   failure handling, and real provider calls before release.

Provider contracts checked against official documentation on 2026-10-02:
[OpenAI SIP](https://developers.openai.com/api/docs/guides/voice-sip) and
[xAI Direct SIP](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech/sip).
Recheck the selected API contract during implementation; never mix Realtime and
Live acceptance handlers for the same pending OpenAI call.

## 1. Initial voice-integration goal

Extend the existing FreePBX `satellite` module in:

```text
ns8-nethvoice/freepbx/var/www/html/freepbx/admin/modules/satellite/
```

to add configurable SIP connections to OpenAI and Grok and expose those connections as native FreePBX destinations.

The implementation is split into phases.

**Phase 1** provides integration with the separately developed **CleverAI** application. Administrators can create an arbitrary number of FreePBX destinations such as:

```text
Destination: CleverAI_1
CleverAI flow: foo

Destination: CleverAI_2
CleverAI flow: bar

Destination: CleverAI_3
CleverAI flow: sales
```

Each destination generates its own:

```text
X-OS-FLOW: <configured-flow>
```

but all CleverAI calls use the webhook configured at:

```text
CLEVERAI_WEBHOOK
```

CleverAI owns the webhook processing, AI session, prompt, tools, and business logic in Phase 1.

**Phase 2** adds the NethVoice built-in agent implementation, executed by the existing `nethesis/satellite` service. Two destinations are created automatically:

```text
Destination: Satellite Agent Internal
Satellite Flow: Internal
```

and:

```text
Destination: Satellite Agent External
Satellite Flow: External
```

The existing user-created `CleverAI_<ID>` destinations also gain an **Agent** selector:

```text
CleverAI
Builtin Internal
Builtin External
```

Changing the selected agent must not change the FreePBX destination identifier, so routes already pointing to `CleverAI_17`, for example, continue working.

**Phase 3** adds supervised and consultative transfer, including private consultation with the called party and conversation resumption.

The implementation must keep the existing Satellite transcription/TTS functionality working unchanged.

---

# 2. Non-negotiable architectural decisions

These requirements govern Phase 1 compatibility and Phase 2 delivery. Future
milestones may extend UI, storage ownership, and deployment through explicit
migrations; they must not silently reinterpret deployed voice contracts.

The following decisions must be treated as requirements.

## 2.1 Naming

Use **Agent**, not `AI`, for all new NethVoice-specific naming.

Use:

```text
satellite-agent
satellite-agent-*
AgentTrunk
AgentDestination
AgentProfile
AgentSession
SATELLITE_AGENT_*
AGENT_*
```

Do not introduce names such as:

```text
satellite-ai
AITrunk
AI_EXTENSION
```

except where required for backwards compatibility with an already deployed variable.

Provider terminology such as `OPENAI_API_KEY` must obviously keep the provider's existing name.

---

## 2.2 Preserve the two shipped FreePBX pages

This is the Phase 2 navigation contract. The broader application's future
authoring and monitoring UI is planned separately; it is not constrained to
put every capability inside these two FreePBX pages.

Phase 1 deliberately consolidated the original three-page design in commit
`f8cd56de` (`feat(agent): unify admin forms under tabs`). Phase 2 retains:

```text
Satellite Agent    display=satellite_agents
Webhooks           display=satellite_webhooks
```

Satellite Agent contains:

```text
Destinations | Agent Trunks | Builtin Internal | Builtin External
```

Use `page.satellite_agents.php` and `page.satellite_webhooks.php`. Tools,
permissions, directory policy, and profiles remain sections within these tabs.
Do not add a top-level Agent Trunks page.

---

## 2.3 Phase 1 does not use Satellite as the agent runtime

Phase 1 call flow is:

```text
Caller
  │
  ▼
Asterisk
  │ SIP
  ▼
OpenAI / Grok
  │ webhook
  ▼
CLEVERAI_WEBHOOK
  │
  ▼
CleverAI
```

Satellite must not manage Phase 1 conversations.

---

## 2.4 Phase 2 built-in agents use the existing Satellite service

Keep this deployment rule for Phase 2. Separate components within the existing
service so later background work or another application UI does not require
rewriting call handling. Future process/service separation requires its own
lifecycle and data-ownership design after Phase 2; no such split is implemented
as part of this milestone.

Do not create:

```text
bin/satellite-agent-worker
```

or any other new daemon.

The existing `nethesis/satellite` service already has:

- an HTTP API;
- ARI connectivity;
- an asynchronous runtime;
- lifecycle management.

Extend that service.

The runtime architecture becomes:

```text
FreePBX satellite module
        │
        │ HTTP on localhost
        │ Authorization: Bearer SATELLITE_API_TOKEN
        ▼
Existing Satellite service
        │
        ├── satellite transcription runtime
        └── satellite-agent runtime
                 │
                 ├── ARI
                 ├── OpenAI adapter
                 ├── Grok adapter
                 ├── tool registry
                 ├── transfer state machine
                 └── consultation state machine
```

Use **Option A**, local HTTP.

Do not implement a Unix socket in this feature.

---

## 2.5 Do not change existing Satellite HTTP security behavior

This requirement refers to the packaged Satellite `0.2.4` baseline. The local
runtime checkout at `c761ed7` contains a later, untagged change requiring API
authentication and defaulting the listener to localhost. Do not accidentally
include or undo that separate security change while implementing Phase 2.
Use an isolated runtime branch consistent with the agreed release baseline;
any broader runtime upgrade must identify this compatibility difference.

The new `/api/agent/v1` routes require a configured, nonempty shared token via a
separate Agent API dependency. This includes configuration, provider events,
catalogs, call control, and diagnostics. Existing routes and their optional-auth
dependency remain unchanged. Without the token, built-in readiness fails and
calls use their fallback; existing Satellite functions retain their behavior.
Provisioning must preserve the existing token and pass the same value to both
FreePBX and Satellite. Provider signatures remain independently mandatory.

This project must **not** change:

- the existing `API_TOKEN` optional-authentication behavior;
- the Satellite HTTP listener address;
- Satellite's existing API exposure model.

Those will be handled separately.

The new FreePBX Agent client must send:

```http
Authorization: Bearer <SATELLITE_API_TOKEN>
```

and report missing-token configuration as unready, as specified above.

---

## 2.6 Modularity required during Phase 2

Build a modular application inside the existing Satellite service. The initial
composition remains small: two voice agents using the same registry and
execution services. Avoid embedding all policy and business logic in an ARI
callback or a provider WebSocket loop.

### Component boundaries

| Component | Phase 2 responsibility | Future extension it permits |
|---|---|---|
| Agent definition | Stable agent ID, configuration revision, prompt/model settings, tool grants, context bindings | More agents and references from workflow steps |
| Execution service | Admit a run, invoke capabilities, enforce policy/deadlines, report outcomes | API-triggered and workflow runs without a telephone call |
| Voice controller | Call state, provenance, ARI channels/bridges, handoff/fallback | Advanced transfer as an optional voice capability |
| Provider adapters | Provider-specific conversation, event, and tool-call translation | Additional model/session protocols without changing tool handlers |
| Tool registry and dispatcher | Versioned manifests, schema validation, permissions, invocation identity, result/error mapping | External API connectors and reusable workflow actions |
| Context access | Read approved directory/company/schedule data through adapters | File resources and retrieval without placing file parsing in prompts or call control |
| Configuration repository/importer | Apply the versioned FreePBX snapshot and expose normalized definitions | A later application-owned configuration store behind the same interface |
| Execution event sink | Emit structured lifecycle, invocation, timing, and outcome events | Monitoring UI and history without parsing ad hoc logs |

The execution service, registry, and common schemas must not import FreePBX
database code, ARI channel objects, or provider SDK event classes. Adapters may
depend on these common contracts; common contracts do not depend on adapters.
Use ordinary in-process interfaces/functions initially. Do not add a message
broker, distributed scheduler, generic plugin loader, or unused service layer
solely to anticipate the roadmap.

### Definitions, bindings, and runs

- Treat `internal` and `external` as the two seeded agent IDs exposed by the
  Phase 2 UI. Common code resolves an ID through a registry/repository; it must
  not have two hardcoded branches throughout the executor and tool handlers.
- Keep the existing profile tables and destination mapping for compatibility.
  A FreePBX destination, a SIP provider binding, and an agent definition are
  distinct identities. Preserve the `Internal`/`External` SIP flow labels as
  voice-integration values; they are not future workflow IDs or definitions.
- Give each admitted execution a `run_id` and an immutable definition revision.
  A Phase 2 run references its voice session. Keep that reference separate from
  Asterisk linkedid, provider call ID, and destination ID. Do not assume that
  every future run has a call or that an entire workflow has only one session.
- Generic run state describes execution and outcome. `CONVERSING`, channel
  ownership, and transfer states stay in the voice controller. Do not implement
  durable workflows or resumable non-voice jobs in Phase 2.

In Phase 2 the run is a thin execution record for correlation, pinned
configuration, deadline/cancellation, and outcome. The voice controller owns
call transitions and derives the terminal run outcome once; do not introduce a
second competing lifecycle controller. Normalize existing profile rows without
a new general authoring schema or authoritative-storage migration.

### Reusable tools, context, and policy

The dispatcher accepts a server-created execution context with run/agent IDs,
definition revision, authenticated principal/provenance, effective permissions,
deadline/cancellation, and available capabilities. Voice-specific fields live
in an optional voice context. A telephony tool requires that capability and
appropriate call state; a company-information tool must not require ARI objects.

Tool manifests define input/output contracts, timeouts, and whether an operation
is read-only or has side effects, as well as the existing version and policy
rules. The dispatcher owns validation, authorization, invocation IDs, and event
emission. The provider adapter translates provider events/results into that
contract; it does not execute business actions itself. Declare unavailable
capabilities unavailable, rather than fabricating a call context for them.

A timeout/cancellation does not prove an action did not happen. Retain operation
identity and commitment state for handoff; an ambiguous continuation must not be
automatically retried or reported as safely undone. Later connectors extend this
rule with operation-specific reconciliation. Phase 2 does not need a general
transaction, compensation, or approval engine. Register trusted handlers in code;
a manifest supplied through configuration must not load arbitrary Python code.

Wrap existing FreePBX directory/company/hours access in the narrow adapters
needed by Phase 2. Context results carry source identity/revision and freshness
where meaningful. Preserve permission filtering before returning data to the
model. Future file context uses resource references and provenance through this
boundary; Phase 2 does not implement uploads, extraction, indexing, or retrieval.
Context content never grants permission to invoke a tool.

Distinguish pinned configuration/source references from fresh observations such
as a time-condition override. Record when an observation was made and apply its
freshness rule; pinning the definition must not freeze a live routing override.

### Ownership, versions, and diagnostics

FreePBX remains the sole configuration authority in Phase 2. Its importer
normalizes definitions/bindings through a repository boundary; generic runtime
logic must not query FreePBX tables or rely on PHP page names. Keep transport
schema version, configuration revision, tool version, and event schema version
separate. Calls pin the versions they were admitted with.

Reject unsupported schema/tool versions before run admission. Keeping an admitted
definition in memory does not require multiple historical execution engines,
long-lived replay support, or a persisted workflow scheduler.

Emit versioned, structured events for run start/end, provider connection state,
tool start/end/error, handoff/fallback, and cancellation. Include run/session/
invocation correlation, ordering within a run, timestamps, duration, and a
redacted outcome/error code. Use a bounded log/event sink initially; full
historical storage and monitoring pages are later milestones. Monitoring failure
must not block call handling. Raw prompts, audio, file text, tool payloads, and
secrets are not automatically included in events.

Specify bounded-buffer overflow behavior and a dropped-event count. Events are
observations, not the authoritative call state or a prerequisite for committing
an operation. A future history UI must be able to identify incomplete traces.

Do not expose the internal `/api/agent/v1` configuration/control API as a future
public integration API. External callers will need their own scoped contract,
authentication/authorization, limits, and run-oriented operations. Likewise,
future application configuration ownership must have an explicit cutover;
FreePBX and an application editor must never be concurrent writers of the same
agent definition.

### Phase 2 completion check for modularity

During Phase 2 implementation, demonstrate that a non-telephony built-in tool
can execute through the dispatcher without constructing ARI/provider objects;
both supported providers invoke the same handlers and policy checks; and a call
can be traced from run admission through tool use to its terminal outcome.
Keep these checks focused on the implemented paths. They do not require a
third agent UI, non-voice transport, workflow engine, or monitoring application.

---

# 3. Current provider model

The provider layer must remain abstract because OpenAI and Grok have different SIP provisioning models.

For OpenAI Realtime SIP, the existing project-based SIP path remains documented:

```text
sip:<PROJECT_ID>@sip.api.openai.com;transport=tls
```

and the project webhook receives incoming-call events.

For xAI/Grok Direct SIP, a registered Direct SIP phone number is used:

```text
sip:<PHONE_NUMBER>@sip.voice.x.ai;transport=tls
```

and the number registration contains the webhook configuration.

Therefore do **not** force a single generic `project_id` field on both providers.

Use provider-specific fields.

---

# 4. FreePBX module layout for the initial voice implementation

Phase 1 already provides `AgentSchema.php`, `AgentSession.php`, shared
`views/agent/index.php`, repositories, validation, and provisioning. The tree
below is illustrative; keep these existing components. Page wrappers and menu
entries retain the two shipped display IDs.

The intended final module layout is approximately:

```text
satellite/
├── AGENTS.md
├── Satellite.class.php
├── functions.inc.php
├── module.xml
│
├── page.satellite_agents.php
├── page.satellite_webhooks.php
│
├── lib/
│   ├── AgentCrypto.php
│   ├── AgentTrunkRepository.php
│   ├── AgentDestinationRepository.php
│   ├── AgentProfileRepository.php
│   ├── AgentTrunkProvisioner.php
│   ├── AgentSatelliteClient.php
│   ├── AgentWebhookVerifier.php
│   └── AgentValidation.php
│
├── views/
│   └── agent/
│       ├── default.php
│       ├── trunks-grid.php
│       ├── trunk-form.php
│       ├── destinations-grid.php
│       ├── destination-form.php
│       ├── builtin-internal.php
│       ├── builtin-external.php
│       └── webhooks.php
│
├── htdocs/
│   └── index.php
│
├── bin/
│   └── satellite_transcript
│
└── tests/
    ├── ...
    └── agent/
        ├── bootstrap.php
        ├── destinations_test.php
        ├── headers_test.php
        ├── validation_test.php
        ├── webhook_signature_test.php
        └── config_serialization_test.php
```

`htdocs/index.php` is introduced only when built-in agents are implemented in Phase 2.

---

# 5. FreePBX menu registration

Update `module.xml`.

Example:

```xml
<module>
    <rawname>satellite</rawname>
    <repo>unsupported</repo>
    <name>Satellite Module</name>
    <version>0.1.2</version>
    <category>Applications</category>
    <Publisher>Nethesis</Publisher>

    <menuitems>
        <satellite_agents>Satellite Agent</satellite_agents>
        <satellite_webhooks>Webhooks</satellite_webhooks>
    </menuitems>

    <depends>
        <version>14</version>
    </depends>

    <supported>14.0</supported>

    <methods>
        <get_config pri="480">satellite_get_config</get_config>
        <get_config pri="600">satellite_get_config_late</get_config>
    </methods>

    <description>
        Satellite transcription, TTS and voice agent integration
    </description>
</module>
```

Do not remove the existing dialplan hooks.

---

# 6. Persistent data model

Create module-owned tables in the existing FreePBX MariaDB database.

Do not overload existing FreePBX core tables with agent-specific metadata.

## 6.1 `satellite_agent_trunks`

Suggested schema:

```sql
CREATE TABLE IF NOT EXISTS satellite_agent_trunks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    name VARCHAR(100) NOT NULL,
    provider VARCHAR(16) NOT NULL,

    runtime_owner VARCHAR(16) NOT NULL DEFAULT 'cleverai',

    freepbx_trunk_id INT NULL,
    freepbx_trunk_name VARCHAR(100) NOT NULL,

    openai_project_id VARCHAR(128) NULL,
    grok_phone_number VARCHAR(32) NULL,

    api_key_encrypted TEXT NULL,

    sip_auth_mode VARCHAR(16) NOT NULL DEFAULT 'none',
    sip_auth_username VARCHAR(128) NULL,
    sip_auth_password_encrypted TEXT NULL,

    webhook_signing_secret_encrypted TEXT NULL,
    remote_webhook_id VARCHAR(128) NULL,

    enabled TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uniq_satellite_agent_trunk_name (name),
    UNIQUE KEY uniq_satellite_agent_freepbx_trunk (freepbx_trunk_id)
);
```

Allowed `provider` values:

```text
openai
grok
```

Phase 1 allows only:

```text
runtime_owner = cleverai
```

Phase 2 additionally allows:

```text
runtime_owner = builtin
```

Never use one provider binding for both CleverAI and the built-in runtime.

That is important because provider webhook ownership is attached to an OpenAI project or Grok Direct SIP number rather than being selected separately for every SIP INVITE.

---

## 6.2 `satellite_agent_destinations`

```sql
CREATE TABLE IF NOT EXISTS satellite_agent_destinations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    system_key VARCHAR(64) NULL,
    freepbx_name VARCHAR(100) NOT NULL,

    agent_type VARCHAR(32) NOT NULL DEFAULT 'cleverai',

    cleverai_trunk_id INT UNSIGNED NULL,
    cleverai_flow VARCHAR(128) NULL,

    fallback_destination VARCHAR(255) NULL,

    system_managed TINYINT(1) NOT NULL DEFAULT 0,
    enabled TINYINT(1) NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uniq_satellite_agent_system_key (system_key),
    UNIQUE KEY uniq_satellite_agent_freepbx_name (freepbx_name)
);
```

Valid `agent_type` values:

```text
cleverai
builtin_internal
builtin_external
```

Phase 1 uses only:

```text
cleverai
```

---

## 6.3 Built-in profile table — Phase 2

Extend the schema below to persist all settings exposed by the profile UI:
`max_call_duration_seconds`, `fallback_destination`, and the selected hours
configuration/reference. Specify bounded duration validation and storage for
company/calendar data in the configuration schema. Profile `config_revision`
can track profile edits, but synchronization uses the global revision in
section 54, including changes outside profiles.

```sql
CREATE TABLE IF NOT EXISTS satellite_agent_profiles (
    profile_key VARCHAR(32) NOT NULL,

    display_name VARCHAR(100) NOT NULL,

    trunk_id INT UNSIGNED NULL,

    flow VARCHAR(64) NOT NULL,

    model VARCHAR(128) NULL,
    voice VARCHAR(128) NULL,
    language VARCHAR(16) NOT NULL DEFAULT 'it',

    greeting TEXT NULL,
    prompt LONGTEXT NULL,

    permissions_json LONGTEXT NOT NULL,
    tools_json LONGTEXT NOT NULL,
    transfer_policy_json LONGTEXT NOT NULL,
    knowledge_json LONGTEXT NOT NULL,

    config_revision BIGINT UNSIGNED NOT NULL DEFAULT 1,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (profile_key)
);
```

Phase 2 seeds and exposes exactly two records. Treat these as data resolved by
ID; do not make the generic runtime schema or dispatcher an enum with only two
possible agents. Additional definitions and their UI are later roadmap work.

Initially:

```text
internal
external
```

---

## 6.4 Directory metadata — Phase 2

The two visibility columns below are a compatibility storage representation for
Phase 2. Normalize them to resource grants keyed by agent ID inside the runtime
adapter. Future agents use a migrated grant relation rather than one new SQL
column for every agent. Do not expose these column names as the public tool
contract.

Add:

```sql
CREATE TABLE IF NOT EXISTS satellite_agent_directory_rules (
    resource_key VARCHAR(128) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,

    description TEXT NULL,
    synonyms TEXT NULL,

    internal_allowed TINYINT(1) NOT NULL DEFAULT 0,
    external_allowed TINYINT(1) NOT NULL DEFAULT 0,

    PRIMARY KEY (resource_key)
);
```

Examples:

```text
extension:203
queue:600
ivr:4
```

The model must never receive raw dialplan destinations as something it may modify.

---

# 7. Secrets

Do not store provider API keys as plaintext in module tables.

Add a dedicated instance secret:

```text
SATELLITE_AGENT_CONFIG_KEY
```

Generate it once in NS8 `passwords.env`.

Follow the existing pattern used to add missing Satellite credentials during updates.

Example:

```python
passwordsfile = agent.read_envfile("passwords.env")

if "SATELLITE_AGENT_CONFIG_KEY" not in passwordsfile:
    passwordsfile["SATELLITE_AGENT_CONFIG_KEY"] = gen_password(64)

agent.write_envfile("passwords.env", passwordsfile)
```

Because FreePBX already receives `passwords.env`, the value becomes available inside the container.

Use PHP sodium encryption.

Example:

```php
private function encryptSecret($plaintext)
{
    if ($plaintext === '' || $plaintext === null) {
        return null;
    }

    $master = getenv('SATELLITE_AGENT_CONFIG_KEY');
    if (!$master) {
        throw new \Exception('SATELLITE_AGENT_CONFIG_KEY is not configured');
    }

    $key = hash('sha256', $master, true);
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

    $cipher = sodium_crypto_secretbox(
        $plaintext,
        $nonce,
        $key
    );

    return base64_encode($nonce . $cipher);
}
```

And:

```php
private function decryptSecret($encoded)
{
    if (!$encoded) {
        return '';
    }

    $master = getenv('SATELLITE_AGENT_CONFIG_KEY');
    if (!$master) {
        throw new \Exception('SATELLITE_AGENT_CONFIG_KEY is not configured');
    }

    $raw = base64_decode($encoded, true);

    if ($raw === false) {
        throw new \Exception('Invalid encrypted secret');
    }

    $nonceSize = SODIUM_CRYPTO_SECRETBOX_NONCEBYTES;
    $nonce = substr($raw, 0, $nonceSize);
    $cipher = substr($raw, $nonceSize);

    $key = hash('sha256', $master, true);

    $plaintext = sodium_crypto_secretbox_open(
        $cipher,
        $nonce,
        $key
    );

    if ($plaintext === false) {
        throw new \Exception('Unable to decrypt secret');
    }

    return $plaintext;
}
```

Never return API keys to AJAX calls after they have been stored.

Return only:

```json
{
  "api_key_configured": true,
  "api_key_source": "explicit"
}
```

or:

```json
{
  "api_key_configured": true,
  "api_key_source": "environment"
}
```

---

# 8. OpenAI API key precedence

For an OpenAI trunk:

```text
explicit per-trunk API key
        ↓ if empty
OPENAI_API_KEY environment variable
        ↓ if missing
configuration error
```

Code:

```php
public function resolveProviderApiKey(array $trunk)
{
    if ($trunk['provider'] === 'openai') {
        if (!empty($trunk['api_key_encrypted'])) {
            return $this->decryptSecret($trunk['api_key_encrypted']);
        }

        $key = getenv('OPENAI_API_KEY');

        if ($key) {
            return $key;
        }

        throw new \Exception(
            'No OpenAI API key configured for this trunk'
        );
    }

    if ($trunk['provider'] === 'grok') {
        if (empty($trunk['api_key_encrypted'])) {
            throw new \Exception(
                'An API key is required for Grok'
            );
        }

        return $this->decryptSecret($trunk['api_key_encrypted']);
    }

    throw new \Exception('Unsupported provider');
}
```

An invalid explicit key must **not** fall back silently to the environment key.

---

# 9. Phase 1 — CleverAI

# 9.1 Agent Trunks page

The page must allow an administrator to create multiple managed trunks.

Example grid:

| Name | Provider | Remote identifier | Runtime | Status |
|---|---|---|---|---|
| OpenAI Production | OpenAI | `proj_xxx` | CleverAI | Ready |
| Grok Production | Grok | `+390721...` | CleverAI | Ready |

Actions:

```text
Add
Edit
Delete
Validate
```

---

## 9.2 OpenAI trunk form

Fields:

```text
Name
Provider = OpenAI
Project ID
API key
Enabled
```

Advanced/read-only generated settings:

```text
SIP server: sip.api.openai.com
SIP port: 5061
Registration: none
Transport: TLS
Webhook: CLEVERAI_WEBHOOK
```

The project ID must match:

```text
^proj_[A-Za-z0-9_-]+$
```

Do not put the OpenAI API key into PJSIP configuration.

The SIP user part is:

```text
<project_id>
```

Example target:

```text
PJSIP/proj_DXOYe9K8MfIP8p17q56GK9vT@AgentTrunk_1
```

---

## 9.3 Grok trunk form

Fields:

```text
Name
Provider = Grok
Direct SIP number
API key
SIP authentication mode
SIP username
SIP password
Enabled
```

Direct SIP number should normally be E.164.

Example:

```text
+390721123456
```

Generated destination:

```text
sip:+390721123456@sip.voice.x.ai;transport=tls
```

xAI currently documents Direct SIP number registration and webhook configuration as part of the number resource.

Supported auth modes:

```text
none / IP allowlist
digest
```

If Digest is selected, SIP username/password are PJSIP credentials and are distinct from the xAI HTTP API key.

---

# 10. Managed FreePBX trunks

Do not manually write:

```text
pjsip.endpoint.conf
pjsip.aor.conf
pjsip.auth.conf
```

Use the FreePBX Core trunk APIs.

FreePBX 14's PJSIP implementation stores PJSIP trunk settings through `Core()->addTrunk()` and its PJSIP driver.

Create a wrapper:

```php
class AgentTrunkProvisioner
{
    public function createManagedTrunk(array $agentTrunk)
    {
        // ...
    }

    public function updateManagedTrunk(array $agentTrunk)
    {
        // ...
    }

    public function deleteManagedTrunk(array $agentTrunk)
    {
        // ...
    }
}
```

Generated trunk names:

```text
AgentTrunk_1
AgentTrunk_2
AgentTrunk_3
```

Do not derive them from user input.

---

## 10.1 Example PJSIP settings

Phase 1 established the following NethVoice proxy path. The provider-side TLS
URI does not imply a TLS transport between Asterisk and the local proxy.

OpenAI settings excerpt (extend the existing provisioner):

```php
$pjsip = array(
    'registration' => 'none',
    'authentication' => 'none',

    'sip_server' => 'sip.api.openai.com',
    'sip_server_port' => '5061',

    'aor_contact' =>
        'sip:sip.api.openai.com:5061;transport=tls',

    'transport' => '0.0.0.0-udp',
    'outbound_proxy' => 'sip:<PROXY_IP>:<PROXY_PORT>;lr',

    'context' => 'from-pstn',

    'direct_media' => 'no',
    'rtp_symmetric' => 'yes',
    'rewrite_contact' => 'no',
    'force_rport' => 'yes',

    'media_encryption' => 'no',

    'dtmfmode' => 'rfc4733',

    'codec' => array(
        'ulaw' => true,
        'alaw' => true,
        'g722' => true
    )
);
```

Keep the existing UDP transport validation and discovered proxy address checks.
Grok currently retains SDES and optional outbound digest credentials; do not
apply the OpenAI media setting indiscriminately. Preserve the provider-specific
proxy/media behavior and verify it with both providers.

Use the full provider URI through the managed trunk:

```text
PJSIP/AgentTrunk_<id>/sip:<provider-user>@<provider-host>:5061;transport=tls
```

Escape the semicolon as required by the generated Asterisk configuration.
The abbreviated `PJSIP/user@trunk` examples elsewhere are not the implementation
contract. Both CleverAI Dial and the built-in Local provider leg must reuse
this path and the `isTrunk: 1` header.

---

## 10.2 Important FreePBX 14 implementation detail

`FreePBX::Core()->addTrunk()` merges `$_POST` into PJSIP settings.

Do **not** call it while the module's unrelated form values remain in `$_POST`, otherwise arbitrary agent settings can accidentally become PJSIP keywords.

Wrap the call.

Example:

```php
$originalPost = $_POST;

try {
    $_POST = $pjsipSettings;

    $base = array(
        'channelid' => $trunkName,
        'dialoutprefix' => '',
        'maxchans' => '',
        'outcid' => '',
        'peerdetails' => '',
        'usercontext' => '',
        'userconfig' => '',
        'register' => '',
        'keepcid' => 'off',
        'failtrunk' => '',
        'disabletrunk' => 'off',
        'provider' => 'satellite-agent',
        'continue' => 'off',
        'dialopts' => false
    );

    $trunkId = FreePBX::Core()->addTrunk(
        $trunkName,
        'pjsip',
        $base
    );
} finally {
    $_POST = $originalPost;
}
```

Implement an equivalent isolated edit path.

Never edit the `trunks` or `pjsip` tables manually unless the target FreePBX API cannot perform the required operation.

---

# 11. Phase 1 — Agents page

Initially the Agents page manages **CleverAI destinations**.

There is no built-in Satellite agent yet.

The default page is a grid:

| Destination | Trunk | CleverAI flow | Agent | Enabled |
|---|---|---|---|---|
| CleverAI_1 | OpenAI Production | `foo` | CleverAI | Yes |
| CleverAI_2 | OpenAI Production | `bar` | CleverAI | Yes |
| CleverAI_3 | Grok Production | `sales` | CleverAI | Yes |

There must be no limit imposed by the module on the number of destinations other than reasonable database/system limits.

Actions:

```text
Add destination
Edit
Delete
```

---

# 12. Creating a CleverAI destination

Form fields:

```text
Trunk
CleverAI flow
Fallback destination
Enabled
```

The name is generated automatically.

Sequence:

```text
INSERT row
    ↓
get AUTO_INCREMENT id
    ↓
freepbx_name = CleverAI_<ID>
    ↓
UPDATE row
```

Example:

```php
$id = $repository->insertDestination(array(
    'agent_type' => 'cleverai',
    'cleverai_trunk_id' => $trunkId,
    'cleverai_flow' => $flow,
    'fallback_destination' => $fallback,
    'enabled' => 1
));

$name = 'CleverAI_' . $id;

$repository->setFreePBXName($id, $name);
```

IDs must never be renumbered.

Deleting `CleverAI_5` must not cause a new destination to reuse `5`.

---

# 13. Flow validation

The flow becomes a SIP header, so validate it strictly.

Initial accepted syntax:

```regex
^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$
```

Examples accepted:

```text
foo
sales
customer-care
it.support
company:reception
```

Rejected:

```text
foo\r\nX-Evil: yes
foo bar
<foo>
```

The restriction can be relaxed later if CleverAI requires other characters, but CR/LF/control characters must always be rejected.

---

# 14. FreePBX destination registration

The Satellite module must advertise these as native FreePBX destinations.

Implement the standard FreePBX destination functions in `functions.inc.php`.

Example:

```php
function satellite_destinations()
{
    $destinations = array();

    foreach (FreePBX::Satellite()->getAgentDestinations() as $row) {
        if (!$row['enabled']) {
            continue;
        }

        $destinations[] = array(
            'destination' =>
                'satellite-agent-destination-' .
                $row['id'] .
                ',s,1',

            'description' =>
                $row['freepbx_name']
        );
    }

    return $destinations;
}
```

Implement:

```php
function satellite_getdest($id)
{
    return array(
        'satellite-agent-destination-' . $id . ',s,1'
    );
}
```

Implement destination metadata:

```php
function satellite_getdestinfo($dest)
{
    if (
        preg_match(
            '/^satellite-agent-destination-([0-9]+),s,1$/',
            trim($dest),
            $match
        )
    ) {
        $row = FreePBX::Satellite()
            ->getAgentDestination((int)$match[1]);

        if (!$row) {
            return array();
        }

        return array(
            'description' =>
                'Agent: ' . $row['freepbx_name'],

            'edit_url' =>
                'config.php?display=satellite_agents' .
                '&view=form&id=' .
                urlencode($row['id'])
        );
    }

    return false;
}
```

This allows the destination to appear in:

- inbound routes;
- IVRs;
- time conditions;
- announcements;
- other FreePBX destination selectors.

---

# 15. Protect destination deletion

Before deleting:

```text
CleverAI_12
```

check whether another FreePBX module references:

```text
satellite-agent-destination-12,s,1
```

Use the FreePBX destination usage registry.

Pseudo-code:

```php
$dest =
    'satellite-agent-destination-' .
    $id .
    ',s,1';

$usage = FreePBX::Destinations()
    ->destinationUsageArray($dest);

if (!empty($usage)) {
    throw new \Exception(
        'Destination is currently in use'
    );
}
```

Also implement:

```text
satellite_check_destinations()
satellite_change_destination()
```

because this module itself stores fallback destinations.

---

# 16. Phase 1 dialplan generation

Do **not** place the new logic inside:

```php
if (SATELLITE_CALL_TRANSCRIPTION_ENABLED)
```

Agent dialplan generation is independent of transcription.

Structure `satellite_get_config_late()` approximately as:

```php
function satellite_get_config_late($engine)
{
    if ($engine !== 'asterisk') {
        return;
    }

    satellite_generate_transcription_dialplan();
    satellite_generate_agent_dialplan();
}
```

Preserve the existing transcription code behavior.

---

# 17. Generated CleverAI dialplan

For destination `CleverAI_12`, generate:

```ini
[satellite-agent-destination-12]

exten => s,1,NoOp(Satellite Agent destination CleverAI_12)

 same => n,Set(__AGENT_DESTINATION_ID=12)
 same => n,Set(__AGENT_TYPE=cleverai)
 same => n,Set(__AGENT_FLOW=foo)

 same => n,Set(__AGENT_ORIGINAL_CALLER=${CALLERID(num)})
 same => n,Set(__AGENT_ORIGINAL_CALLER_NAME=${CALLERID(name)})
 same => n,Set(__AGENT_ORIGINAL_DID=${FROM_DID})

 same => n,Set(__AGENT_EXTENSION=)

 same => n,Dial(
     PJSIP/proj_xxx@AgentTrunk_1,
     ,
     b(satellite-agent-add-headers^s^1)
 )

 same => n,GotoIf(
     $["${DIALSTATUS}"="ANSWER"]?
     end
 )

 same => n,Goto(<configured fallback>)

 same => n(end),Hangup()
```

The actual generated dialplan must not contain multiline application arguments. The previous block is formatted for readability only.

---

# 18. Common outbound SIP headers

Generate one common pre-dial subroutine:

```ini
[satellite-agent-add-headers]

exten => s,1,NoOp(Add headers to Agent SIP leg)

 same => n,Set(CALLED_NUMBER=${AGENT_ORIGINAL_DID})

 same => n,ExecIf(
     $["${CALLED_NUMBER}"=""]?
     Set(CALLED_NUMBER=${AGENT_EXTENSION})
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-Caller)=
     ${AGENT_ORIGINAL_CALLER}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-Caller-Name)=
     ${AGENT_ORIGINAL_CALLER_NAME}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-DID)=
     ${CALLED_NUMBER}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-Extension)=
     ${AGENT_EXTENSION}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-FLOW)=
     ${AGENT_FLOW}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-Agent-ID)=
     ${AGENT_DESTINATION_ID}
 )

 same => n,Set(
     PJSIP_HEADER(add,X-OS-Session-ID)=
     ${CHANNEL(linkedid)}
 )

 same => n,Return()
```

The real generated output must be single-line Asterisk applications.

Use inherited `__AGENT_*` variables instead of repeatedly depending on `MASTER_CHANNEL()`.

Capture the values before creating the provider leg.

The original tested `MASTER_CHANNEL()` behavior can remain only as a fallback for backwards compatibility.

---

# 19. Required Phase 1 `X-OS-FLOW` behavior

Given:

```text
CleverAI_1 → foo
CleverAI_2 → bar
CleverAI_3 → sales
```

the SIP INVITEs must respectively contain:

```text
X-OS-FLOW: foo
```

```text
X-OS-FLOW: bar
```

```text
X-OS-FLOW: sales
```

They all use the same CleverAI webhook:

```text
CLEVERAI_WEBHOOK
```

The flow is selected **per FreePBX destination**, not per trunk.

Multiple destinations may share the same trunk.

---

# 20. Critical Phase 1 interoperability test

Do not consider Phase 1 complete merely because Asterisk sends:

```text
X-OS-FLOW
```

The provider webhook delivered to CleverAI must actually contain that custom SIP header.

The current OpenAI and Grok documentation exposes `sip_headers` in incoming SIP webhook data, but does not provide a sufficiently strong contract in the cited examples guaranteeing every arbitrary private `X-*` header.

Therefore perform a real end-to-end test for each provider:

```text
Asterisk
  → SIP INVITE with X-OS-FLOW
  → OpenAI/Grok
  → incoming webhook
  → CleverAI
```

The test succeeds only if CleverAI receives:

```text
X-OS-FLOW
X-OS-Agent-ID
X-OS-Session-ID
```

If a provider filters private headers, stop implementation and define an alternative correlation mechanism before proceeding.

Do not silently default to a CleverAI flow.

---

# 21. Phase 1 Webhooks page

CleverAI owns the actual webhook processing.

The FreePBX page therefore does **not** host or execute the Phase 1 webhook.

Read:

```text
CLEVERAI_WEBHOOK
```

from the environment.

It must be read-only.

Example:

```text
CleverAI webhook
https://cleverai.example.org/provider/webhook
```

The administrator cannot replace it with an arbitrary URL.

If the variable is missing:

```text
Status: Not configured
```

and show a clear warning.

The page should show one row per Agent Trunk:

| Trunk | Provider | Expected webhook | Runtime |
|---|---|---|---|
| OpenAI Production | OpenAI | `CLEVERAI_WEBHOOK` | CleverAI |
| Grok Production | Grok | `CLEVERAI_WEBHOOK` | CleverAI |

Where provider APIs allow introspection, add:

```text
Validate remote webhook
```

but **do not make FreePBX the owner of CleverAI's webhook signing secret**.

CleverAI owns those secrets in Phase 1.

---

# 22. Passing `CLEVERAI_WEBHOOK` into FreePBX

`freepbx.service` currently passes selected environment variables.

Add:

```text
--env=CLEVERAI_WEBHOOK
```

or include the variable through the appropriate existing environment propagation mechanism.

Do not hardcode the actual URL into PHP source.

"Hardcoded to CLEVERAI_WEBHOOK" means:

```text
the user cannot configure an arbitrary URL;
the module always uses the CLEVERAI_WEBHOOK environment value.
```

---

# 23. Phase 1 page implementation

The following wrappers are illustrative. Phase 1 routes trunks through the
Satellite Agent tab; extend the actual existing page and handler methods.

Page wrappers should remain very small.

Example:

```php
<?php

echo FreePBX::Satellite()->showAgentTrunksPage();
```

and:

```php
<?php

echo FreePBX::Satellite()->showAgentsPage();
```

and:

```php
<?php

echo FreePBX::Satellite()->showWebhooksPage();
```

Use the BMO class for actions and storage.

---

# 24. Phase 1 form handling

Extend `Satellite.class.php` with:

```php
public function doConfigPageInit($page)
{
    switch ($page) {
        case 'satellite_agents':
            // Dispatch trunk/destination/profile POSTs using the existing tab/form action.
            $this->handleAgentRequest();
            break;

        case 'satellite_webhooks':
            $this->handleWebhookRequest();
            break;
    }
}
```

Any change affecting:

```text
trunk
destination
flow
enabled state
```

must call:

```php
needreload();
```

Changing only a diagnostic setting does not require Asterisk reload.

---

# 25. Phase 1 acceptance criteria

Phase 1 is complete only when all of these work:

```text
Create OpenAI trunk.
Create Grok trunk.

Create 1 CleverAI destination.
Create 20 CleverAI destinations.

Use multiple destinations on one trunk.
Use destinations on different trunks.

Each destination appears in native FreePBX destination selectors.

CleverAI_1 sends its configured X-OS-FLOW.
CleverAI_2 sends a different X-OS-FLOW.

X-OS-Caller is correct.
X-OS-Caller-Name is correct.
X-OS-DID is correct.
X-OS-Agent-ID is correct.
X-OS-Session-ID is correct.

Provider webhook reaches CLEVERAI_WEBHOOK.

CleverAI receives the correct flow through the provider webhook.

Deleting a destination used by an inbound route is blocked.

Reload is idempotent.

Existing Satellite transcription still works.
Existing Satellite TTS still works.
```

---

# Phase 2 — Built-in Satellite agents

# 26. Phase 2 migration

Preserve the Phase 1 rows. `agent_type` already exists with this default:

```text
agent_type = cleverai
```

Do not reset this field on every install/upgrade: that would change a destination
back to CleverAI after the administrator selected a built-in agent. Add new
tables/columns idempotently and backfill only missing legacy values. Seed the
two profiles and system destinations only when absent; preserve subsequent
profile edits. Do not reintroduce Enabled controls through migration.

Existing:

```text
cleverai_flow
cleverai_trunk_id
freepbx_name
```

remain unchanged.

No route changes.

No destination IDs change.

---

# 27. Automatically create the two built-in destinations

During upgrade/install call:

```php
ensureBuiltinAgentDestinations();
```

Implement idempotently.

Pseudo-code:

```php
$this->ensureSystemDestination(
    'builtin_internal',
    'Satellite Agent Internal',
    'builtin_internal'
);

$this->ensureSystemDestination(
    'builtin_external',
    'Satellite Agent External',
    'builtin_external'
);
```

The resulting rows are:

```text
system_key = builtin_internal
freepbx_name = Satellite Agent Internal
agent_type = builtin_internal
system_managed = 1
```

and:

```text
system_key = builtin_external
freepbx_name = Satellite Agent External
agent_type = builtin_external
system_managed = 1
```

They cannot be deleted.

Initially the profiles have no selected built-in trunk and are **Not configured**.
Never silently choose an existing CleverAI trunk. Referencing an unready system
destination must use its validated fallback or end the call if none is set;
it must not originate a provider call. System rows keep their fixed type/name.

---

# 28. Fixed Satellite flows

The internal destination uses:

```text
X-OS-FLOW: Internal
```

The external destination uses:

```text
X-OS-FLOW: External
```

These values are reserved.

They are not editable.

---

# 29. Agents page in Phase 2

Extend the existing `satellite_agents` tabbed page:

```text
[ Destinations ] [ Agent Trunks ] [ Builtin Internal ] [ Builtin External ]
```

Rename the current CleverAI Destinations tab because it will contain all agent
kinds. Reuse the current form action bar, POST/CSRF protection, and destination
picker. Keep Webhooks as the existing second top-level page.

---

# 30. Destinations tab

Update Visualplan's existing Agent block in the same change. Its current queries
filter to `runtime_owner=cleverai`, CleverAI agent types, and non-system rows.
Allow selection of the two built-in system destinations and user destinations
of every supported agent type, while keeping their existing routing IDs.
System nodes reference protected records; they do not create/delete profiles.
Preserve saved graphs, fallback edges, cycle checks, and the rule that removing
a block from a graph does not delete the shared FreePBX destination. Keep the
existing `X-Satellite-Agent-CSRF` checks for graph writes.

The table becomes:

| Destination | Agent | CleverAI flow | Status |
|---|---|---|---|
| CleverAI_1 | CleverAI | foo | Configured |
| CleverAI_2 | Builtin Internal | foo | Ready / Not configured |
| CleverAI_3 | Builtin External | sales | Ready / Not configured |
| Satellite Agent Internal | Builtin Internal | Internal | System |
| Satellite Agent External | Builtin External | External | System |

For user-created destinations, add this dropdown:

```html
<select name="agent_type">
    <option value="cleverai">
        CleverAI
    </option>

    <option value="builtin_internal">
        Builtin Internal
    </option>

    <option value="builtin_external">
        Builtin External
    </option>
</select>
```

The original CleverAI flow value must remain stored when switching away from CleverAI.

Example:

```text
CleverAI_5
flow = reception
agent_type = builtin_internal
```

If switched back:

```text
agent_type = cleverai
```

the flow is still:

```text
reception
```

Do not destroy it.

---

# 31. Runtime selection

Update `satellite_agent_destination_valid()`, repository validation, destination
registration, and dialplan generation together. They currently accept only
CleverAI rows. Built-in system rows have no CleverAI flow/trunk; that must not
hide them from selectors or prevent generation of a safe fallback context.

For a user-created destination:

```php
switch ($destination['agent_type']) {
    case 'cleverai':
        $runtime = 'cleverai';
        $flow = $destination['cleverai_flow'];
        $trunk = $destination['cleverai_trunk_id'];
        break;

    case 'builtin_internal':
        $runtime = 'satellite';
        $flow = 'Internal';
        $trunk = $internalProfile['trunk_id'];
        break;

    case 'builtin_external':
        $runtime = 'satellite';
        $flow = 'External';
        $trunk = $externalProfile['trunk_id'];
        break;

    default:
        throw new \Exception('Invalid agent type');
}
```

This design lets a destination change runtime while preserving its FreePBX destination string.

---

# 32. Provider binding rule

Enforce ownership in the repositories, provisioner, profile validation, and
runtime snapshot. Reject reuse of the same normalized OpenAI project or Grok
number across different runtime owners, and ambiguous duplicate built-in
bindings. Do not convert a referenced CleverAI binding in place. Create a
separate built-in binding and leave the destination's CleverAI fields intact.
The existing provisioner's CleverAI-only guard must become an explicit
allowlist with owner-aware validation, not an unrestricted bypass.

A CleverAI provider binding and a built-in Satellite provider binding must be separate.

For example:

```text
OpenAI project A
    webhook = CLEVERAI_WEBHOOK

OpenAI project B
    webhook = https://voice.example.org/freepbx/satellite/index.php
```

Likewise for Grok:

```text
Grok Direct SIP number A
    webhook = CLEVERAI_WEBHOOK

Grok Direct SIP number B
    webhook = https://voice.example.org/freepbx/satellite/index.php
```

Do not attempt to use the same OpenAI project or Grok Direct SIP number simultaneously for both webhook owners.

This avoids a fragile webhook proxy/dispatcher between CleverAI and Satellite.

When a `CleverAI_7` destination is switched to:

```text
Builtin Internal
```

it stops using its CleverAI trunk for new calls and instead uses the trunk configured on the **Builtin Internal** tab.

Its FreePBX destination remains:

```text
satellite-agent-destination-7,s,1
```

Existing inbound routes therefore require no modification.

---

# 33. Builtin Internal tab

Phase 2 exposes basic handoff and failure fallback settings. Supervised-transfer
and consultation settings become available in Phase 3 when implemented; do not
advertise inactive controls as functioning features.

Sections:

```text
General
Prompt
Permissions
Tools
Directory
Company information
Calendar
Transfer policy
Consultation
Fallback
```

General settings:

```text
Agent trunk
Model
Voice
Language
Greeting
Prompt
Maximum call duration
Fallback FreePBX destination
```

The selected trunk must have:

```text
runtime_owner = builtin
```

Reject CleverAI-owned trunks.

---

# 34. Builtin External tab

Use the same layout as Internal but independent values.

An external profile normally has fewer permissions.

Do not infer privileges solely from which destination was called.

Actual call provenance must still be checked.

Effective permissions are the selected profile's permissions intersected with
the caller-origin ceiling. For an external or unknown origin, the External
profile supplies that ceiling, including directory visibility. An external call
routed to Builtin Internal must therefore never gain Internal-only access.
Tool enablement, participant role, call state, and resource allow rules are
additional checks. Denial wins; missing/unknown permissions deny. Capture these
rules in the admitted call snapshot; profile edits apply to subsequent calls.

---

# 35. Permissions UI: use radio buttons

Every permission must be explicit.

Example:

```html
<tr>
    <td>Search internal extensions</td>

    <td>
        <label>
            <input
                type="radio"
                name="permissions[directory.extensions]"
                value="allow">
            Allow
        </label>

        <label>
            <input
                type="radio"
                name="permissions[directory.extensions]"
                value="deny">
            Deny
        </label>
    </td>
</tr>
```

Do not use absence of a checkbox to mean denial.

Store explicit:

```json
{
  "directory.extensions": "deny",
  "directory.queues": "allow",
  "directory.ivrs": "allow",
  "company.public_information": "allow",
  "calendar.opening_hours": "allow",
  "telephony.transfer.extension": "allow",
  "telephony.transfer.queue": "allow",
  "telephony.transfer.ivr": "deny",
  "telephony.consultative_transfer": "deny"
}
```

Unknown permissions default to:

```text
deny
```

---

# 36. Initial permission catalog

Use the same canonical names in UI, stored policy, tool manifests, and runtime.
There is no separate untyped `telephony.transfer` permission. Handoff checks
the typed scope for the resolved resource; advanced transfer uses the same
target scope plus its mode-specific scope. Consultation/message relay belong
to Phase 3. External-number dialing remains unavailable in Phase 2.

At minimum:

```text
directory.extensions
directory.queues
directory.ivrs

company.public_information
company.address
company.email
company.vat_number

calendar.opening_hours

telephony.transfer.extension
telephony.transfer.queue
telephony.transfer.ivr

telephony.consultative_transfer

telephony.message_relay

telephony.external_destination
```

The permission check occurs in Satellite.

Prompt text can never override permission policy.

---

# 37. Tools UI: radio buttons

Satellite exposes the available tool catalog.

For every tool show:

```text
Enabled
Disabled
```

Example:

```html
<tr>
    <td>directory.find_destinations</td>
    <td>1.0.0</td>

    <td>
        <label>
            <input
                type="radio"
                name="tools[directory.find_destinations]"
                value="enabled">
            Enabled
        </label>

        <label>
            <input
                type="radio"
                name="tools[directory.find_destinations]"
                value="disabled">
            Disabled
        </label>
    </td>
</tr>
```

Store explicit values.

---

# 38. Initial built-in tools

Implement in Phase 2:

```text
directory.find_destinations

company.get_information

calendar.get_opening_hours

telephony.handoff
```

`telephony.handoff` accepts only a normalized `destination_id` and a bounded
reason. It is allowed for the caller role in `CONVERSING`. Satellite resolves
the current allowed extension, queue, or IVR from trusted configuration and
checks typed transfer permission and directory visibility again at execution.
The model never supplies context/exten/priority, a telephone number, or SIP URI.

Handoff is a terminal release into the normal FreePBX destination using ARI
channel continuation. Keep the AI leg until the continuation is committed;
then close its sideband/provider leg and release Agent-owned resources. A
validation or continuation error before commit returns an error to the current
conversation. Once handed off, normal FreePBX busy/no-answer, forwarding,
voicemail, queue, and IVR behavior applies; there is no return to the AI session.
Do not use provider REFER. Emit one handoff operation per invocation and ignore
late Agent events after commitment; cleanup must never hang up the handed-off
caller. This contract does not claim that a human answered.

Add in Phase 3:

```text
telephony.start_transfer

telephony.cancel_transfer

consultation.submit_decision
```

Potential later additions:

```text
message.create_callback_request
ticket.lookup
ticket.create
appointment.lookup
appointment.create
crm.find_contact
```

Do not expose generic:

```text
execute_shell
execute_sql
http_request
dial_any_number
ami_command
ari_command
goto_dialplan
```

to the model.

---

# 39. Strict tool contract

The transfer manifest below is a **Phase 3** example. Phase 2 registers a
separate `nethvoice.telephony.handoff` manifest with wire name
`nv_handoff_v1`, caller role, `CONVERSING` state, exclusive per-call execution,
and idempotency. Its schema has `additionalProperties: false`, required
`destination_id` and `reason`, and the same bounds shown below; it has no
`mode` argument. Check the resolved resource's typed transfer scope at runtime.

Each tool must have a versioned manifest.

Example:

```yaml
id: nethvoice.telephony.start_transfer
version: 1.0.0
wire_name: nv_start_transfer_v1

handler: builtin.telephony.start_transfer

allowed_roles:
  - caller

required_scopes:
  - telephony.transfer.extension # example for an extension target

allowed_states:
  - CONVERSING

execution: asynchronous

concurrency:
  policy: exclusive_per_call

idempotency:
  required: true

input_schema:
  type: object
  additionalProperties: false

  required:
    - destination_id
    - mode
    - reason

  properties:
    destination_id:
      type: string
      minLength: 1
      maxLength: 128

    mode:
      type: string
      enum:
        - supervised
        - consultative

    reason:
      type: string
      maxLength: 600
```

The model does not provide:

```text
call_id
ARI channel ID
SIP URI
dialplan target
profile
permissions
origin
```

Those come from trusted server context.

---

# 40. Tool execution context

Use the common run context from section 2.6. The voice controller adds its own
trusted fields; model arguments cannot construct or override either context.
An execution principal identifies the authorized execution, not a claimed caller
identity. Non-telephony tools depend only on the common context and required
capabilities.

Illustrative Phase 2 context:

```python
context = {
    "run_id": run.id,
    "agent_id": definition.id,
    "definition_revision": definition.revision,
    "principal": execution_principal,
    "permissions": effective_permissions,
    "capabilities": available_capabilities,
    "deadline": run.deadline,
    "cancellation": run.cancellation,
    "voice": {
        "call_session_id": call.session_id,
        "destination_id": call.destination_id,
        "origin": call.origin,
        "participant_role": call.participant_role,
        "state": call.state,
        "state_revision": call.state_revision,
    },
}
```

Model arguments are validated separately.

---

# 41. Satellite tool registry

Suggested structure in `nethesis/satellite`:

```text
agent/
├── tools/
│   ├── registry.py
│   ├── dispatcher.py
│   ├── directory.py
│   ├── company.py
│   ├── calendar.py
│   ├── telephony.py
│   └── consultation.py
```

Example registry:

```python
class ToolRegistry:
    def __init__(self):
        self._tools = {}

    def register(self, manifest, handler):
        key = f"{manifest['id']}@{manifest['version']}"

        if key in self._tools:
            raise ValueError(f"Duplicate tool {key}")

        validate_tool_manifest(manifest)

        self._tools[key] = {
            "manifest": manifest,
            "handler": handler,
        }

    def get(self, tool_id, version):
        return self._tools[
            f"{tool_id}@{version}"
        ]
```

---

# 42. Custom tools

Custom HTTP tools belong to draft milestone M2 in section 101, replacing their
placement in the former catch-all Phase 4. Phase 2 delivers the shared registry
and built-in handlers; it does not deliver a connector editor or HTTP executor.

Define a reusable connector/tool once and grant access to agent/workflow
versions. Do not duplicate credentials and endpoint definitions under each
Internal/External profile. Future authoring belongs to the application UI chosen
after Phase 2; the two current FreePBX pages retain their integration role.

The initial extension mechanism should be HTTP.

Configuration:

```text
Tool ID
Version
Description
Input schema
Output schema
HTTPS endpoint
Timeout
Authentication secret
```

Satellite validates:

```text
manifest
input
output
timeout
URL allowlist
response size
```

The model never chooses the endpoint URL.

Local arbitrary PHP/Python execution is outside the initial custom-tool feature.

---

# 43. Directory tool

Build the directory snapshot from FreePBX.

Collect:

```text
extensions
queues
IVRs
```

Example normalized resource:

```json
{
  "id": "queue:600",
  "type": "queue",
  "name": "Technical Support",
  "description": "Technical assistance for existing customers",
  "synonyms": [
    "support",
    "technical problems",
    "assistance"
  ]
}
```

The model receives this ID:

```text
queue:600
```

not:

```text
ext-queues,600,1
```

Satellite resolves the actual target from trusted configuration.

---

# 44. Company information

Store structured information rather than putting everything into the prompt.

Example:

```json
{
  "company_name": "Example S.r.l.",
  "vat_number": "IT01234567890",
  "email": {
    "general": "info@example.com",
    "support": "support@example.com"
  },
  "locations": [
    {
      "name": "Headquarters",
      "address": "...",
      "directions": "..."
    }
  ]
}
```

Tool:

```text
company.get_information
```

only returns fields allowed by the active profile.

---

# 45. Calendar/opening hours

Use existing FreePBX time groups/time conditions as the source. Configure each
Agent service's reference to those objects; do not duplicate schedules in
profile-specific prose or introduce external-calendar credentials in Phase 2.
Snapshot timezone, time-group rules, and supported exception rules through
FreePBX APIs. Define the evaluator against Asterisk/FreePBX rule semantics,
including overnight ranges and daylight-saving transitions.

Distinguish scheduled business hours from effective routing state: a manual
time-condition override must be reported explicitly, with its observation time
and freshness, rather than silently changing the recurring schedule. Refresh
schedule changes after FreePBX apply/reload and refresh volatile override state
through a bounded synchronization mechanism. Return unknown/unavailable for a
missing, unsupported, or stale source. Never invent hours or `next_opening`.

Implement:

```text
calendar.get_opening_hours
```

Inputs:

```json
{
  "service_id": "support",
  "date": "2026-10-01"
}
```

Output:

```json
{
  "is_open": true,
  "opens_at": "09:00",
  "closes_at": "18:00",
  "timezone": "Europe/Rome",
  "next_opening": null
}
```

Handle:

```text
timezone
recurrence
holidays
exceptions
temporary closures
stale calendar data
```

The model must not calculate business hours itself from raw calendar prose.

---

# 46. Phase 2 local webhook endpoint

Create:

```text
ns8-nethvoice/freepbx/var/www/html/freepbx/admin/modules/satellite/htdocs/index.php
```

Publish it as:

```text
https://<NETHVOICE_HOST>/freepbx/satellite/index.php
```

Use the existing configured NethVoice host.

Do not introduce another hostname variable merely for this feature.

---

# 47. Apache mapping

Add an explicit alias.

Example:

```apache
Alias "/freepbx/satellite/index.php" \
"/var/www/html/freepbx/admin/modules/satellite/htdocs/index.php"

<Directory "/var/www/html/freepbx/admin/modules/satellite/htdocs">
    Options -Indexes
    AllowOverride None
    Require all granted
</Directory>
```

Do not publish the whole module as:

```text
/satellite/*
```

Only the webhook entry point is needed.

Inside PHP additionally reject alternate URL paths:

```php
$path = parse_url(
    $_SERVER['REQUEST_URI'],
    PHP_URL_PATH
);

if ($path !== '/freepbx/satellite/index.php') {
    http_response_code(404);
    exit;
}
```

This prevents using the filesystem-derived module URL as an alternative webhook path.

---

# 48. Local webhook authentication

Only OpenAI and Grok webhooks must be processed.

Use the providers' signed webhook mechanism.

Both currently expose:

```text
webhook-id
webhook-timestamp
webhook-signature
```

for Direct SIP webhook authentication.

Do not authenticate using:

```text
User-Agent
source IP only
caller ID
X-OS-* headers
```

because those are not sufficient proof of origin.

---

# 49. Webhook handler structure

`htdocs/index.php` should be tiny.

Pseudo-code:

```php
<?php

require_once __DIR__ . '/../lib/AgentWebhookBootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit;
}

$rawBody = file_get_contents('php://input');

if ($rawBody === false) {
    http_response_code(400);
    exit;
}

try {
    $result = AgentWebhookBootstrap::handle(
        $rawBody,
        getallheaders()
    );

    http_response_code($result['status']);
    echo $result['body'];

} catch (\Throwable $e) {
    error_log(
        'Satellite agent webhook error: ' .
        $e->getMessage()
    );

    http_response_code(500);
}
```

Do not put provider business logic in `index.php`.

---

# 50. Resolving the built-in trunk

For each built-in binding, store its provider webhook signing secret encrypted.
Verify the original request bytes, provider signature headers, and timestamp
before trusting event fields. Reject malformed or ambiguous security headers,
unknown incoming-call schemas, and oversized requests. Resolve exactly one
binding; zero matches returns 403 and multiple matches are a configuration error.

PHP forwards the unchanged body (encoded losslessly within the local JSON
envelope), signature headers, and candidate binding ID to Satellite using the
mandatory Agent API bearer token. Satellite verifies the signature itself
against trusted synchronized binding data. A `verified=true` flag or echoed
`X-OS-*` fields never substitute for verification.

Match the signed event to the pre-created pending provider leg described in
section 61: binding, destination, session, leg nonce, role, and flow must agree.
Use the call's original admitted configuration, not the destination's current
agent type. Switching a destination during provider setup must not reroute or
invalidate a legitimate in-flight call. Keep previous binding verification
material for the bounded pending-call/retry window when rotating secrets.

Bind the provider call reference exactly once. A conflicting reference, expired
attempt, unknown session, or mismatch must have no telephone side effects.
Deduplicate by binding plus provider event/call identity, and retain a bounded
receipt record so retries cannot create another session. Late retries after
termination must never resurrect calls. Acknowledge recognized already-handled
retries without performing another accept operation.

Authenticated event families outside the chosen adapter subscription can be
acknowledged as ignored; they must not invoke call acceptance. Do not derive
provider URLs or credentials from webhook contents.

---

# 51. Webhook response policy

Bound body size and execution time. An accepted response means Satellite has
recorded responsibility and scheduled work within the pending call deadline;
PHP must not wait for the whole conversation setup. Invalid signatures,
expired attempts, and failed synchronization must never trigger provider accept.

Use:

| Condition | Status |
|---|---:|
| Wrong method | 405 |
| Invalid/missing signature | 403 |
| Invalid JSON | 400 |
| Missing Agent ID | 400 |
| Unknown Agent ID | 404 |
| Conflicting binding/session/leg or expired pending attempt | 409 |
| Unsupported authenticated event family, safely ignored | 200 |
| Satellite unavailable | 503 |
| Accepted | 200 |
| Duplicate accepted event | 200 |

Do not send `200` for a supported incoming-call event if Satellite has not
accepted responsibility. Safely ignored event families are the explicit
exception above and never start a call.

---

# 52. Internal FreePBX → Satellite client

Implement:

```php
class AgentSatelliteClient
{
    private $baseUrl;
    private $token;

    public function __construct()
    {
        $port = getenv('SATELLITE_HTTP_PORT');

        $this->baseUrl =
            'http://127.0.0.1:' .
            $port .
            '/api/agent/v1';

        $this->token =
            getenv('SATELLITE_API_TOKEN') ?: '';

        if ($this->token === '') {
            throw new \RuntimeException('Satellite Agent API token is not configured');
        }
    }
}
```

Request helper:

```php
private function request(
    $method,
    $path,
    array $payload = null
) {
    $ch = curl_init();

    $headers = array(
        'Accept: application/json',
        'Content-Type: application/json'
    );

    if ($this->token !== '') {
        $headers[] =
            'Authorization: Bearer ' .
            $this->token;
    }

    curl_setopt(
        $ch,
        CURLOPT_URL,
        $this->baseUrl . $path
    );

    curl_setopt(
        $ch,
        CURLOPT_CUSTOMREQUEST,
        $method
    );

    curl_setopt(
        $ch,
        CURLOPT_RETURNTRANSFER,
        true
    );

    curl_setopt(
        $ch,
        CURLOPT_HTTPHEADER,
        $headers
    );

    curl_setopt(
        $ch,
        CURLOPT_CONNECTTIMEOUT,
        2
    );

    curl_setopt(
        $ch,
        CURLOPT_TIMEOUT,
        5
    );

    if ($payload !== null) {
        curl_setopt(
            $ch,
            CURLOPT_POSTFIELDS,
            json_encode($payload)
        );
    }

    // Execute, validate HTTP result,
    // decode JSON and close curl.
}
```

Do not modify Satellite's existing authentication dependency. Require the token
on the new Agent router through its own dependency (section 2.5). Configuration
and call-control requests cannot be trusted solely because this client normally
uses localhost.

---

# 53. Satellite Agent API

Add routes under:

```text
/api/agent/v1
```

Suggested API:

```text
PUT  /api/agent/v1/configuration

POST /api/agent/v1/provider-events/openai
POST /api/agent/v1/provider-events/grok

GET  /api/agent/v1/catalog/tools
GET  /api/agent/v1/catalog/permissions

GET  /api/agent/v1/calls/{session_id}

POST /api/agent/v1/calls/{session_id}/transfer
POST /api/agent/v1/calls/{session_id}/transfer/{attempt_id}/cancel

GET  /api/agent/v1/readiness
```

The two transfer routes are Phase 3. For Phase 2, route the basic handoff tool
through the shared dispatcher and, if exposed as an admin call operation, use
`POST /api/agent/v1/calls/{session_id}/handoff` with the same validation and
idempotency checks. Do not expose inactive advanced operations in the catalog.
Specify schema versions, bounded request sizes, error responses, accepted
revision/hash, and event idempotency in the implementation's API contract.

Do not expose arbitrary ARI operations.

---

# 54. Configuration synchronization

In Phase 2, FreePBX MariaDB and its encrypted credentials remain authoritative. Define a
versioned, complete snapshot rather than passing only prompt/profile fragments.
The envelope contains `schema_version`, a persisted global `revision`, and a
canonical payload hash. Hash the defined canonical payload, excluding the hash
field itself. All mutations affecting runtime data increment the global revision
transactionally, including destination, trunk, credential, permission, directory,
company, and opening-hours changes. Profile revisions alone are insufficient.

The payload must include:

- Both profiles, their model/voice/language/greeting/prompt, maximum duration,
  tools, permissions, company data, and referenced FreePBX hours configuration.
- Destination IDs/types, preserved CleverAI fields, effective built-in bindings,
  and validated fallback targets.
- Provider bindings, runtime owner, protocol, managed trunk identity, provider
  URI, resolved API credentials and webhook verification material.
- Directory resources, per-profile visibility rules and metadata, and trusted
  resolved FreePBX targets. Model-facing directory results omit raw targets.
- Source observation times and freshness limits for schedule/override data.

Resolve credentials in FreePBX using the existing per-trunk/environment
precedence. Send them only over the authenticated local client connection; never
include them in browser responses, diagnostics, or logs. Keep decrypted runtime
credentials in memory. Persist non-secret revision/hash/receipt metadata as
needed; rehydrate credentials from FreePBX after restart.

Validate the entire snapshot before atomic activation. A successful response
returns the accepted revision and hash; reject older revisions, and accept an
equal revision only with an identical hash. Failed validation leaves the prior
accepted snapshot intact. Report incompatible schema versions explicitly.

Save locally first and show desired revision, acknowledged revision, sync error,
and pending dialplan reload separately. Use bounded retries through lifecycle
hooks and a scheduled one-shot synchronization command; no resident worker is
needed. Resynchronize after startup, runtime restart, apply/reload, relevant
FreePBX data changes, and restore, including recovery without an admin page visit.

Routing and runtime changes must not combine incompatible generations. Include
a routing configuration identity in generated built-in dialplan; admit calls only
when the runtime has the corresponding routing data, otherwise use fallback.
Prompt-only changes can activate without an Asterisk reload. Calls already
admitted retain their snapshot and credential references until cleanup.

On restore, invalidate Satellite's Agent cache/revision watermark through the
trusted local restore lifecycle before importing the restored authoritative
snapshot. This allows an older backup to initialize cleanly without allowing
ordinary API clients to bypass revision ordering. Do not restore active calls.
Until rehydration completes, built-in readiness is false.

---

# 55. Satellite application structure

Organize the additions around the boundaries in section 2.6. The tree below is
illustrative: common definitions, execution, configuration adapters, and events
belong outside the Asterisk controller. Create only modules used by Phase 2;
future workflow, connector, and file services are not empty placeholders now.

Suggested additions to `nethesis/satellite`:

```text
agent/
├── __init__.py
├── runtime.py
├── models.py
├── state.py
├── definitions.py
├── execution.py
├── configuration.py
├── events.py
│
├── context/
│   └── freepbx.py
│
├── asterisk/
│   ├── controller.py
│   ├── provider_leg.py
│   ├── destination_leg.py
│   └── transfer.py
│
├── providers/
│   ├── base.py
│   ├── openai.py
│   └── grok.py
│
├── tools/
│   ├── registry.py
│   ├── dispatcher.py
│   ├── directory.py
│   ├── company.py
│   ├── calendar.py
│   ├── telephony.py
│   └── consultation.py
│
└── consultation/
    └── controller.py
```

Do not put this logic into the existing transcription-specific `AsteriskBridge` class.

Reuse its ARI connection patterns, but maintain independent agent resources.

---

# 56. ARI application name

Use:

```text
satellite-agent
```

Add:

```text
SATELLITE_AGENT_ARI_APP=satellite-agent
```

The existing:

```text
SATELLITE_ARI_APP=satellite
```

remains unchanged.

---

# 57. Make Agent service lifetime independent of transcription

The existing Satellite service remains the sole daemon. Two current gates need
explicit changes:

1. `imageroot/actions/configure-module/80start_services` currently stops Satellite
   when both transcription flags are false. Start the existing `satellite.service`
   for configured NethVoice instances independently of those flags. Keep MQTT,
   recording cleanup, and transcription-specific work under their current gates.
   Built-in readiness still requires usable synchronized profiles and credentials.
2. Satellite `0.2.4` starts HTTP in a daemon thread and returns from its main
   coroutine if `DEEPGRAM_API_KEY` is missing. Make application/process lifetime
   own the HTTP and Agent runtime tasks, so missing transcription credentials
   do not terminate them. Preserve existing transcription startup/shutdown
   behavior when transcription is configured.

Use a separate Agent ARI controller/connection for `satellite-agent`; the existing
`AsteriskBridge` creates transcription snoops, externalMedia, RTP, and Deepgram
resources and must not receive Agent channels. Pass `SATELLITE_AGENT_ARI_APP`
through `satellite.service` and keep `SATELLITE_ARI_APP=satellite` unchanged.

Keep the existing listener and existing-endpoint authentication behavior as
specified in section 2.5. Do not change the process to multiple independent
workers owning one ARI application; one process owns each Agent session and its
lock. Bound background tasks and make shutdown cancel/await them safely.

Runtime changes belong to the separate `nethesis/satellite` repository. NS8
currently repackages `ghcr.io/nethesis/satellite:0.2.4` in `build-images.sh`.
Deliver a matching runtime image and update that pin as a coordinated change;
PHP-only deployment cannot implement Phase 2. Select compatible provider/HTTP/
WebSocket dependency versions explicitly and record them in that runtime build.
Image publication/deployment is a later delivery step, not part of plan review.

---

# 58. Phase 2 built-in dialplan architecture

CleverAI calls can continue to use normal `Dial()`.

Built-in calls require Satellite to retain call control.

Use:

```text
Caller
  │
  ▼
Stasis(satellite-agent)
  │
  ▼
Satellite ARI
  │
  ├── caller channel
  │
  └── retained Local provider leg
          │
          ▼
      Dial(PJSIP/provider)
```

The Local channel must use:

```text
/n
```

to prevent Local channel optimization.

---

# 59. Built-in destination dialplan

Fallback precedence is explicit destination fallback, then profile fallback,
then Hangup. Extend destination usage/deletion and cycle validation to profile
fallbacks; never loop back into the same failed Agent path.

Example:

```ini
[satellite-agent-destination-42]

exten => s,1,NoOp(Satellite Agent destination 42)

 same => n,Set(__AGENT_DESTINATION_ID=42)
 same => n,Set(__AGENT_TYPE=builtin_internal)
 same => n,Set(__AGENT_FLOW=Internal)

 same => n,Set(__AGENT_ORIGINAL_CALLER=${CALLERID(num)})
 same => n,Set(__AGENT_ORIGINAL_CALLER_NAME=${CALLERID(name)})
 same => n,Set(__AGENT_ORIGINAL_DID=${FROM_DID})

 same => n,Set(__AGENT_LINKEDID=${CHANNEL(linkedid)})
 same => n,Set(__AGENT_ROUTING_REVISION=<generated routing identity>)
 same => n,Set(__AGENT_EXIT_REASON=unavailable)

 same => n,Stasis(
     satellite-agent,
     caller,
     42,
     builtin_internal
 )

 same => n,GotoIf($["${AGENT_EXIT_REASON}"="completed"]?end)
 same => n,Goto(<resolved failure fallback>)
 same => n(end),Hangup()
```

This is illustrative: produce single-line applications and validate all targets.
Satellite assigns `AGENT_SESSION_ID`/provider-leg nonce before provider origination.
For setup/runtime failures it sets the failure outcome and continues the caller
at the failure path. For normal completion it uses `completed` and hangs up;
it must not send a completed conversation to fallback. A committed basic handoff
continues directly at its trusted target and never runs this fallback path.
Caller hangup only triggers cleanup. Missing ARI application or readiness uses
the failure fallback. Use one terminal decision to avoid competing continuations.

---

# 60. Provider Local leg

Satellite originates:

```text
Local/<session-id>@satellite-agent-provider/n
```

Generated context:

```ini
[satellite-agent-provider]

exten => _.,1,NoOp(Create Agent provider leg)

 same => n,Dial(
     PJSIP/${AGENT_PROVIDER_TRUNK}/sip:${AGENT_PROVIDER_USER}@${AGENT_PROVIDER_HOST}:5061\;transport=tls,
     ,
     b(satellite-agent-add-headers^s^1)
 )

 same => n,Hangup()
```

Set variables through ARI origination before entering the context.

All three provider values come from a validated binding snapshot, never from
model arguments or the webhook. Set session, leg, and inherited caller metadata
on the Local channel too. Preallocate and track channel IDs before origination
so a fast webhook can match the pending leg even before it answers. Apply an
origination timeout; the original caller channel stays owned until setup succeeds
or failure fallback commits.

Satellite controls the ARI-facing half of the Local channel.

The other half executes the normal FreePBX/Asterisk dialplan.

---

# 61. Provider webhook correlation

Preserve CleverAI's existing `X-OS-Session-ID=${CHANNEL(linkedid)}` behavior.
For built-in calls Satellite creates a new unpredictable session ID on each
Agent admission and a separate unpredictable provider-leg nonce before dialing.
Asterisk linkedid remains lineage metadata; it is neither unique per Agent
entry nor proof that an inbound provider call was initiated by Satellite.

Use inherited variables to generate built-in SIP metadata:

```text
X-OS-Agent-ID
X-OS-Session-ID
X-OS-Provider-Leg-ID
X-OS-Agent-Role: caller
X-OS-FLOW
```

Store the pending leg before ARI origination, including destination, binding,
provider/protocol, profile/configuration snapshot, caller channel, origin,
effective permissions, flow, role, deadline, and leg nonce. Match every field
against the authenticated webhook; bind its provider call reference only once.
Do not create sessions from unsolicited webhooks. A retry creates a new leg
nonce and expires the old attempt. Keep the Phase 1 metadata and `isTrunk: 1`.

The shared header helper must use the runtime-assigned `AGENT_SESSION_ID` for
built-in calls, with linkedid fallback only for the existing CleverAI path.
Test actual custom-header propagation through both providers before release.

---

# 62. Call state machine

Use an explicit enum.

Example:

```python
class AgentCallState(str, Enum):
    STARTING = "STARTING"
    WAITING_PROVIDER = "WAITING_PROVIDER"
    CONVERSING = "CONVERSING"

    HANDING_OFF = "HANDING_OFF" # Phase 2 basic terminal handoff

    PREPARING_TRANSFER = "PREPARING_TRANSFER"
    DIALING = "DIALING"
    CONSULTING = "CONSULTING"
    CONNECTING = "CONNECTING"

    RESUMING = "RESUMING"
    HUMAN_CONNECTED = "HUMAN_CONNECTED"

    TERMINATING = "TERMINATING"
    TERMINATED = "TERMINATED"
```

Never infer state implicitly from which channels happen to exist.

All transitions must occur through one method:

```python
call.transition(
    expected=AgentCallState.CONVERSING,
    new=AgentCallState.PREPARING_TRANSFER,
)
```

Increment:

```text
state_revision
```

on each transition.

Phase 2 implements STARTING, WAITING_PROVIDER, CONVERSING, HANDING_OFF,
TERMINATING, and TERMINATED. Transfer/consultation/resumption/human-bridge states
are Phase 3. Every nonterminal setup/handoff state has a deadline. Session state
changes and webhook/tool effects are serialized by a single process owner.

Handle caller/provider hangup, sideband failure, ARI loss, shutdown, and maximum
call duration explicitly. Failures either use the one validated fallback or end
the call according to the terminal outcome. A process restart does not restore
conversations; reconcile and clean up only Agent-owned resources and recover
still-live caller channels to fallback where ARI permits it. Never clean up an
already handed-off caller as if it were still Agent-owned.

---

# 63. Caller provenance

Set call provenance from trusted dialplan state.

Values:

```text
internal
external
unknown
```

Unknown uses external permissions.

Do not infer internal status from:

```text
Caller ID
spoken identity
X-OS header received from outside
```

Ensure external calls remain external after an employee transfers them to the agent.

Use inherited:

```text
__AGENT_CALL_ORIGIN
```

through the call lineage.

Initialize provenance at trusted PBX ingress/internal origination, before IVRs,
queues, redirects, or transfers. Clear externally supplied Agent metadata.
Prove propagation across blind/attended transfers, Local channels, forwarding,
and Agent re-entry; inherited variables alone are not proof across every bridge
replacement. Preserve external lineage when it merges with an internal call.
If trusted lineage cannot be recovered, classify it as unknown and apply the
External ceiling, even when Builtin Internal was selected.

---

# Advanced voice track — Transfer and consultation (original Phase 3)

Keep the following voice design as a specialized capability. Its delivery order
relative to the broader application milestones is decided after Phase 2 (section
101); completing consultation is not a prerequisite for APIs, files, or workflow
authoring. Use the common tool dispatcher and execution events. The voice state
machine owns channels and transfer attempts, while an application workflow sees
versioned operations and outcomes.

# 64. Destination lookup

The model says something such as:

```text
"I need technical support."
```

Tool:

```text
directory.find_destinations
```

returns:

```json
{
  "matches": [
    {
      "id": "queue:600",
      "name": "Technical Support",
      "description": "Technical support for existing customers"
    }
  ]
}
```

The model then requests:

```json
{
  "destination_id": "queue:600",
  "mode": "supervised",
  "reason": "The caller requires technical support"
}
```

The backend maps:

```text
queue:600
```

to the actual FreePBX destination.

Never allow:

```json
{
  "dialplan": "from-internal,0039123456789,1"
}
```

---

# 65. Supervised transfer

Required behavior:

```text
Caller ↔ AI

AI:
"I'll try to connect you."

Caller → local hold

Satellite originates target

If target succeeds:
    caller ↔ target

If busy/no answer/error:
    caller ↔ original AI session
```

The original provider session must remain alive until the transfer commits.

---

# 66. Destination Local leg

Originate:

```text
Local/<attempt-id>@satellite-agent-target/n
```

Provide variables:

```text
AGENT_TARGET
AGENT_ATTEMPT_ID
AGENT_SESSION_ID
```

The target context sends the Local dialplan half into the appropriate FreePBX destination.

Do not allow arbitrary model-generated context/exten/priority values.

---

# 67. Destination-specific semantics

### Extension

Success:

```text
target extension actually answers
```

Handle separately:

```text
BUSY
NOANSWER
CHANUNAVAIL
voicemail
call forwarding
```

### Queue

Entering `Queue()` is **not** transfer completion.

Wait until an actual queue member connects.

Use an appropriate queue event such as the Asterisk `AgentConnect` event and correlate it to the active attempt.

If required, extend Satellite with an AMI event listener specifically for queue state.

Do not remove the queue call from normal Queue() execution just to simplify ARI control.

### IVR

An IVR cannot "accept" a consultation.

Treat it as an application handoff.

If resumption is required, create an explicit return-to-agent destination inside the IVR.

---

# 68. Consultative transfer

Required topology:

```text
BEFORE

Caller C ↔ Primary Agent A
```

During consultation:

```text
Caller C → hold

Recipient D ↔ Consultation Agent B

Primary Agent A remains alive but isolated
```

Acceptance:

```text
Caller C ↔ Recipient D

Agent A terminated
Agent B terminated
```

Rejection:

```text
Recipient D disconnected
Consultation Agent B terminated

Caller C ↔ Primary Agent A
```

The original conversation resumes.

---

# 69. Consultation example

Expected dialogue:

```text
Caller:
"I'd like to speak with Mario Rossi."

Primary Agent:
"I'll check whether Mario is available."

Caller is placed on hold.

Consultation Agent:
"Hello. I am the virtual receptionist.
A customer is calling about invoice 123.
Would you like to speak with them?"

Mario:
"No. Tell them to email me."

Consultation Agent:
"Understood."

Consultation leg closes.

Primary Agent:
"Mario asked you to send him an email."
```

The message must be relayed as data.

It must not be treated as a command.

For example:

```text
"Tell him to email me"
```

does **not** authorize the agent to send an email.

---

# 70. Separate consultation provider session

Do not reuse the caller's provider conversation for the recipient.

Create:

```text
caller_session
consultation_session
```

The consultation session receives only:

```text
caller display identity
short reason for call
requested recipient
accept/reject instructions
```

Do not send the complete caller transcript.

---

# 71. Consultation SIP metadata

Consultation provider leg should include:

```text
X-OS-Agent-ID
X-OS-Session-ID
X-OS-FLOW
X-OS-Agent-Role: consultation
X-OS-Transfer-Attempt-ID
```

Normal caller session:

```text
X-OS-Agent-Role: caller
```

---

# 72. Consultation decision tool

Strict input:

```json
{
  "decision": "reject",
  "message_to_caller": "Please ask them to email me."
}
```

Schema:

```json
{
  "type": "object",
  "additionalProperties": false,

  "required": [
    "decision"
  ],

  "properties": {
    "decision": {
      "type": "string",
      "enum": [
        "accept",
        "reject"
      ]
    },

    "message_to_caller": {
      "type": [
        "string",
        "null"
      ],
      "maxLength": 1000
    }
  }
}
```

The model cannot specify:

```text
call ID
recipient ID
target channel
attempt ID
```

Those are bound by the server execution context.

---

# 73. DTMF consultation control

Also support deterministic:

```text
1 → accept
2 → reject
```

DTMF captured from the recipient telephone is authoritative.

If a DTMF decision has already committed the operation, ignore a later speech-derived tool invocation.

Exactly one decision may win.

---

# 74. Consultation state machine

```text
CONVERSING
    │
    ▼
PREPARING_TRANSFER
    │
    ▼
DIALING
    │
    ├── busy/no answer ────────┐
    │                          │
    ▼                          │
CONSULTING                     │
    │                          │
    ├── reject ────────────────┤
    │                          │
    ├── timeout ───────────────┤
    │                          │
    ▼                          │
ACCEPTED_PENDING_CONNECT       │
    │                          │
    ▼                          │
CONNECTING                     │
    │                          │
    ├── failure ───────────────┘
    │
    ▼
HUMAN_CONNECTED

Failure path:

RESUMING
    │
    ▼
CONVERSING
```

Every nonterminal state requires a deadline.

---

# 75. Keep Satellite in control after successful human connection

For the first implementation, it is acceptable for Satellite to continue owning the ARI bridge after:

```text
Caller ↔ Human
```

until the human call ends.

Do not make the first implementation depend on handing the channels back into FreePBX dialplan after consultation.

Once connected:

```text
hang up AI provider legs
retain caller + human bridge
monitor hangup
clean state
```

A later improvement may implement dialplan handoff if required.

---

# 76. Agent resumption

On failed transfer:

1. Tear down target attempt.
2. Ensure caller still exists.
3. Ensure original provider leg still exists.
4. Remove hold.
5. Re-add caller and original provider leg to the conversation bridge.
6. Inject a structured operation result into the agent conversation.

Example:

```json
{
  "event": "transfer.failed",
  "destination": "Mario Rossi",
  "reason": "declined",
  "message_to_caller": "Please ask them to email me."
}
```

Do not restart the conversation with a new greeting.

---

# 77. Built-in webhook/provider adapter API

Define a normalized **voice provider** interface for the SIP/sideband lifecycle.
It is a specialized capability, not the universal interface for every future
model or execution backend. Normalize tool invocations/results at the shared
registry boundary. A future non-voice model adapter must not implement fake
`accept_call` methods to use the same tools.

Example:

```python
class ProviderAdapter:
    async def accept_call(
        self,
        provider_call,
        profile,
    ):
        raise NotImplementedError

    async def connect_sideband(
        self,
        provider_call,
    ):
        raise NotImplementedError

    async def send_tool_result(
        self,
        invocation,
        result,
    ):
        raise NotImplementedError

    async def close_call(
        self,
        provider_call,
    ):
        raise NotImplementedError
```

Provider-specific event names must not leak into the transfer controller.

---

# 78. OpenAI adapter

Phase 2 uses the Realtime API only: `realtime.call.incoming`, its `call_id`,
Realtime accept, and the sideband connection for that accepted call. Keep Live
out of the Phase 2 subscription and adapter. Select and validate supported
model/voice settings for this API; do not infer protocol from the model string.

Responsibilities:

```text
parse incoming SIP webhook
obtain call/session reference
accept call
open sideband WebSocket
configure instructions/model/voice/tools
receive tool calls
send tool results
observe closure
```

Any future Live support uses a separate protocol implementation inside the
provider boundary; it must not compete with Realtime for call acceptance.

Do not spread OpenAI-specific event names through generic code.

---

# 79. Grok adapter

Keep Grok's webhook/WebSocket setup sequence distinct from OpenAI's explicit
Realtime accept. Configure the session and tools before starting the greeting.
Require a confirmed configured sideband/session before moving the call to
`CONVERSING`; global service readiness does not require an active call.

Responsibilities:

```text
parse realtime.call.incoming
obtain call_id
connect wss://api.x.ai/v1/realtime?call_id=...
send session.update
register tools
receive tool invocations
send results
observe session state
```

xAI's current Direct SIP API uses this webhook + WebSocket model.

---

# 80. Provider REFER must not implement consultative transfer

Both providers have provider-side call transfer capabilities, but the consultative feature requires NethVoice to control:

```text
caller hold
recipient call
private consultation
accept/reject
reconnection
```

Therefore provider REFER may be available as a future simple/blind-transfer optimization, but it must not be the fundamental implementation of consultative transfer.

---

# 81. Webhooks page in Phase 2

Readiness is derived from configured binding/secret, usable credentials,
acknowledged runtime configuration, ARI connection, and the relevant loaded
dialplan. Distinguish Not configured, Pending synchronization/reload, Ready,
and Error. Local readiness cannot prove the remote webhook or media path is
working; expose those checks separately and retain real-call release validation.

The Webhooks page now contains two sections.

## CleverAI

Read-only:

```text
CLEVERAI_WEBHOOK
```

Show CleverAI trunks.

## Built-in Satellite

Read-only public endpoint:

```text
https://<NETHVOICE_HOST>/freepbx/satellite/index.php
```

Show built-in trunks and signing-secret status.

Example:

| Trunk | Provider | Runtime | Webhook | Signature |
|---|---|---|---|---|
| OpenAI Clever | OpenAI | CleverAI | CLEVERAI_WEBHOOK | Managed by CleverAI |
| OpenAI Builtin | OpenAI | Satellite | `/freepbx/satellite/index.php` | Configured |
| Grok Builtin | Grok | Satellite | `/freepbx/satellite/index.php` | Configured |

The user never types an arbitrary built-in webhook URL.

---

# 82. Webhook secret handling for built-in bindings

For built-in provider bindings, provide:

```text
Webhook signing secret
```

on the Webhooks page.

It is stored encrypted.

The field behaves like a password:

```text
Configured: Yes
Current value: ********
```

Submitting an empty field leaves the existing secret unchanged.

Provide explicit:

```text
Replace secret
Remove secret
```

actions.

A built-in trunk without a signing secret is not Ready.

---

# 83. No cross-agent automatic failover

If CleverAI fails:

```text
do not automatically start Builtin External
```

unless a future feature explicitly configures cross-agent failover.

Use the configured telephone fallback.

Likewise, if Satellite is unavailable, do not send the same provider session to CleverAI automatically.

This prevents two runtimes from controlling one AI call.

---

# Shared lifecycle requirements and former Phase 4 scope

Sections 84–88 and the basic serialization, idempotency, and timeout requirements
in 90–92 are Phase 2 foundations, extended for advanced transfers in Phase 3.
The former Phase 4 bucket is distributed across draft application milestones
M1 (monitoring), M2 (connectors/tools), and M5 (production hardening) in section
101. It does not postpone correctness of the initial runtime.

# 84. Deletion rules

Cannot delete a trunk if referenced by:

```text
CleverAI destination
Builtin Internal profile
Builtin External profile
```

Cannot delete:

```text
Satellite Agent Internal
Satellite Agent External
```

Cannot delete a destination referenced by another FreePBX feature.

Treat per-profile fallbacks and Visualplan references as usages. Disallow
provider binding mutation/deletion that would invalidate a pending call, or
retain the admitted snapshot/verification material until that bounded attempt
has drained. Removing a graph node must not remove its shared destination.

---

# 85. Apply/reload behavior

These require:

```text
fwconsole reload
```

or FreePBX `needreload()`:

```text
add/edit/delete trunk
add/edit/delete destination
change agent_type
change CleverAI flow
change built-in profile trunk/fallback
```

These do not inherently require an Asterisk reload:

```text
prompt
tool enable/disable
permission change
company information
calendar configuration
```

Instead they increment:

```text
config_revision
```

and synchronize Satellite.

Use the global configuration revision from section 54. Profile trunk changes
also change effective call routing, require the corresponding reload/sync, and
cannot be treated as prompt-only updates. FreePBX directory/schedule changes
must invalidate and republish the affected snapshot even if no Agent profile
form was edited.

---

# 86. Configuration revisions

Each runtime-affecting configuration mutation:

```text
revision++
```

Satellite persists the latest accepted revision.

The revision belongs to the complete snapshot, not just an individual profile.
Follow section 54 for atomic acceptance, desired/accepted state, and restore
watermark invalidation. Do not expose an ordinary API option to force a lower
revision over an active runtime.

Reject:

```text
revision < current_revision
```

Idempotently accept:

```text
revision == current_revision
```

when payload hash matches.

Reject as conflict if the same revision has a different payload.

---

# 87. Backup/restore

Authoritative configuration resides in:

```text
FreePBX MariaDB
passwords.env
```

Satellite's copy is runtime state/cache.

After restore:

```text
FreePBX restored
    ↓
Agent runtime cache/revision watermark invalidated by restore lifecycle
    ↓
Satellite starts
    ↓
agent configuration resynchronized
```

Do not restore active calls or transfer attempts.

Preserve `SATELLITE_AGENT_CONFIG_KEY` and signing secrets with the database.
Do not generate a replacement encryption key over restored encrypted data.
Test restart and restore with transcription disabled. Backup/restore correctness
and upgrade migration belong to Phase 2; remote-provider drift diagnostics can
be expanded in monitoring/production milestones M1 and M5.

Webhook binding IDs and signing secrets must survive backup if stored locally.

The Webhooks page must detect remote-provider drift after restore.

---

# 88. Logging

Emit the structured execution events from section 2.6 through a bounded sink.
They form the later monitoring contract; the UI must not reconstruct execution
by parsing provider logs. Add `schema_version`, `event_id`, `run_id`, agent and
definition revision, per-run ordering, timestamps/duration, and redacted outcome
codes. Voice-specific IDs below are optional correlations for generic runs.
Full history storage, searching, metrics aggregation, and monitoring pages are
milestone M1. Keep business payloads and secrets out of default event records.

Use `run_id` and `event_id` as common execution correlation keys. Include the
following additional IDs only when applicable to the event/run type; non-voice
runs must not fabricate telephone session, destination, or provider call IDs:

```text
agent_session_id
agent_destination_id
provider_call_id
transfer_attempt_id
tool_invocation_id
```

Example:

```text
agent_session=1743520001.42
destination=12
provider=openai
flow=Internal
state=CONSULTING
attempt=tr_8f92
```

Never log:

```text
API keys
SIP passwords
webhook secrets
full Authorization headers
```

---

# 89. Metrics/diagnostics

The list below covers the voice integration; it is not the complete future
monitoring model. Add run, step, connector invocation, context source, and
workflow-version views in their application milestones. Count only implemented
capabilities: consultation metrics start with the advanced voice track.

Phase 2 emits the underlying events and keeps existing readiness diagnostics.
Milestone M1 delivers the first monitoring interface with bounded history.

Expose for the voice capability as it becomes available:

```text
active Agent calls
active CleverAI destinations
active built-in calls
provider connection failures
webhook verification failures
tool execution failures
transfer attempts
transfer successes
transfer failures
consultations accepted
consultations rejected
consultations timed out
```

Webhooks page should show a bounded diagnostic history, not an unlimited database log.

---

# 90. Concurrency

All call operations for one:

```text
AgentSession
```

must be serialized.

Use:

```python
asyncio.Lock()
```

per session.

Example:

```python
async with call.operation_lock:
    if call.state != AgentCallState.CONVERSING:
        raise InvalidCallState()

    ...
```

Do not allow two simultaneous transfer tools to create two recipient calls.

---

# 91. Idempotency

Each tool invocation receives:

```text
invocation_id
```

Each transfer receives:

```text
attempt_id
```

Persist enough state to recognize duplicate provider tool invocations.

Example result:

```json
{
  "invocation_id": "inv_123",
  "status": "accepted",
  "operation_id": "transfer_456"
}
```

A duplicate invocation returns the existing result.

It must not create another call.

---

# 92. Timeout policy

Define explicit defaults:

```text
provider webhook wait: 10 s
provider sideband establishment: 10 s
extension ring: 25 s
queue wait: configurable, default 60 s
consultation initial response: 20 s
consultation total duration: 60 s
tool HTTP call: 5 s
custom tool maximum: 15 s
```

These should be configuration constants rather than magic values spread through code.

---

# 93. Test strategy

Testing is mandatory at four levels.

## PHP unit tests

Test:

```text
flow validation
secret encryption/decryption
destination naming
destination serialization
agent selection
profile serialization
header generation
webhook signature verification
```

## FreePBX integration tests

After:

```text
fwconsole reload
```

verify:

```bash
asterisk -rx 'dialplan show satellite-agent-destination-1'
asterisk -rx 'dialplan show satellite-agent-add-headers'
pjsip show endpoints
pjsip show endpoint AgentTrunk_1
```

## SIP tests

Capture:

```bash
sngrep
```

or:

```bash
tcpdump
```

and verify actual INVITEs.

## End-to-end provider tests

Real OpenAI and Grok calls are required before release.

---

# 94. Mandatory Phase 1 end-to-end scenarios

Test:

```text
CleverAI_1 flow=foo
CleverAI_2 flow=bar
CleverAI_3 flow=sales
```

Verify:

```text
same OpenAI trunk
different X-OS-FLOW values
same CLEVERAI_WEBHOOK
correct CleverAI behavior
```

Repeat with Grok.

Test concurrency:

```text
10 calls
10 distinct session IDs (Agent ID identifies the selected destination)
10 correct flows
no flow crossing
```

---

# 95. Mandatory Phase 2 scenarios

Run these during implementation/release validation; this plan review itself
does not execute tests or alter a live instance.

- Upgrade the shipped Phase 1 schema twice; preserve IDs, saved graphs, fallback
  references, and user profile/runtime edits. Auto-create each system row once.
- Select built-ins from native destination pickers and the existing Visualplan
  Agent block; load/save old CleverAI graphs without changing routing IDs.
- Run built-in calls with both transcription flags off and no Deepgram key,
  then regress existing transcription/TTS when their configuration is present.
- Exercise both provider adapters through the actual proxy, verifying every
  correlation header, signature, flow, bidirectional audio, and tool result.
- Change destination/profile/trunk configuration during provider setup; the
  admitted call keeps its snapshot and a new call uses the applied revision.
- Reject unsigned/direct Agent API calls, invalid signatures, mismatched
  binding/leg IDs, replayed events, and duplicate tool requests without effects.
- Test provider timeout, sideband/ARI loss, daemon restart, absent token,
  failed sync, and restore of an older revision. No leaked provider/Local legs;
  exactly one failure fallback; normal completion does not trigger fallback.
- Test basic handoff to an allowed extension, queue, and IVR; forbidden or stale
  targets stay in the conversation with a tool error. After committed handoff,
  normal FreePBX busy/no-answer/voicemail/queue behavior applies and AI does not
  resume. Duplicate handoff and late events must not create or terminate calls.
- Compare the hours tool with FreePBX time groups/time conditions around
  overnight ranges, DST, exceptions, and manual overrides; unavailable or stale
  data returns unknown rather than a fabricated opening time.
- Concurrent calls to one destination have distinct session/leg IDs and no
  crossed webhooks, flows, tools, or permissions. Destination ID stays shared.

Test automatic destinations:

```text
Satellite Agent Internal
Satellite Agent External
```

Verify:

```text
Internal → X-OS-FLOW: Internal
External → X-OS-FLOW: External
```

Test existing destination runtime changes:

```text
CleverAI_4
    CleverAI
      ↓
Builtin Internal
      ↓
Builtin External
      ↓
CleverAI
```

The FreePBX destination remains:

```text
satellite-agent-destination-4,s,1
```

throughout the test.

Its original CleverAI flow remains unchanged.

---

# 96. Permission tests

For external profile:

```text
directory.extensions = deny
directory.queues = allow
```

Ask:

```text
"Connect me to extension 203."
```

Expected:

```text
tool cannot return/use extension:203
```

Then:

```text
"Connect me to technical support."
```

Expected:

```text
queue:600 returned
basic handoff allowed in Phase 2; advanced transfer tested in Phase 3
```

Prompt injection must not change this.

---

# 97. Consultative transfer tests

Test all of:

```text
recipient accepts by speech
recipient accepts by DTMF 1

recipient rejects by speech
recipient rejects by DTMF 2

recipient rejects with message

recipient does not answer
recipient is busy
recipient hangs up during consultation

caller hangs up during consultation

caller requests cancellation while waiting

provider WebSocket disconnects
Satellite ARI reconnects
late tool result arrives
duplicate decision arrives
```

After rejection:

```text
caller must resume original Agent conversation
```

without losing conversation context.

---

# 98. Security tests

Attempt:

```text
CR/LF in X-OS-FLOW
very long flow
invalid destination ID
unsigned webhook
bad webhook signature
stale webhook timestamp
replayed webhook
spoofed X-OS-Agent-ID
unknown provider
unauthorized tool
tool in invalid state
arbitrary SIP URI injection
arbitrary dialplan destination injection
```

All must fail without performing telephone side effects.

---

# 99. Phase boundaries

## Phase 1 — CleverAI connectivity

Implement:

```text
two FreePBX pages, with Destinations and Agent Trunks tabs
Agent Trunks management
OpenAI trunk support
Grok trunk support
encrypted provider credentials
CLEVERAI_WEBHOOK display/validation
unlimited CleverAI_<ID> destinations
native FreePBX destination registration
X-OS-FLOW per destination
X-OS metadata headers
CleverAI E2E validation
```

Satellite agent runtime is not part of this phase.

### Phase 1 output example

```text
Agent Trunks

  OpenAI Production
  Grok Production


Agents

  CleverAI_1
    trunk: OpenAI Production
    X-OS-FLOW: foo

  CleverAI_2
    trunk: OpenAI Production
    X-OS-FLOW: bar

  CleverAI_3
    trunk: Grok Production
    X-OS-FLOW: sales


Webhooks

  CleverAI webhook:
  CLEVERAI_WEBHOOK
```

---

## Phase 2 — Built-in Satellite agents

Implement:

```text
Satellite Agent Internal automatic destination
Satellite Agent External automatic destination

Agent dropdown on user destinations:
  CleverAI
  Builtin Internal
  Builtin External

Agents page tabs:
  Destinations
  Agent Trunks
  Builtin Internal
  Builtin External

permissions as radio buttons
tools as radio buttons

prompt
voice/model
company information
calendar
directory policy

local /freepbx/satellite/index.php webhook
provider webhook signature validation

FreePBX → Satellite Option A HTTP API
satellite-agent ARI application
OpenAI Realtime / Grok built-in provider adapters
strict tool registry and policy enforcement
basic terminal handoff to allowed FreePBX destinations
FreePBX time-group/time-condition opening-hours integration
Visualplan Agent support for built-in and existing destinations
mandatory bearer token on new Agent API routes
complete revisioned configuration, retry, and restart/restore synchronization
pending call snapshots, signed event deduplication, deadlines, and cleanup
service/process lifetime independent of transcription/Deepgram
coordinated Satellite runtime image and NS8 integration
```

### Phase 2 output example

```text
Destination: CleverAI_1
Agent: CleverAI
Flow: foo

Destination: CleverAI_2
Agent: Builtin Internal
Effective flow: Internal

Destination: CleverAI_3
Agent: Builtin External
Effective flow: External


Destination: Satellite Agent Internal
Agent: Builtin Internal
Flow: Internal


Destination: Satellite Agent External
Agent: Builtin External
Flow: External
```

---

## Advanced voice track — Original Phase 3

Scope retained; delivery order is set at the post-Phase-2 planning gate alongside
the application roadmap. It is not a dependency of general workflows or tools.

Implement:

```text
supervised transfer
failed-transfer recovery
caller hold
queue/extension answer and failure tracking beyond Phase 2 handoff

consultative transfer
second temporary Agent session
accept/reject
DTMF acceptance
message relay
conversation resumption
```

Start consultative transfer with extensions.

Enable queue consultation only after its lifecycle and reporting behavior are tested.

IVR consultation is not meaningful; IVR remains an application handoff.

---

## Broader application — Draft milestones after Phase 2

The former Phase 4 is replaced by the explicit milestones in section 101.
Monitoring, connectors/tool calls, file context, and workflow authoring now have
their own outcomes. Existing Phase 2 migration, authentication, synchronization,
timeout, idempotency, and cleanup requirements remain release prerequisites.

These are draft milestone boundaries. Detailed scope, ordering against the
advanced voice track, estimates, and implementation choices are planned only
after Phase 2 is implemented.

---

# 100. Definition of done for the original voice-integration scope

This section describes the complete voice integration, including the advanced
voice track originally called Phase 3. It is not the Phase 2 release gate or the
definition of completion for the broader application. Phase 2 acceptance is in
section 95 plus the modularity checks in section 2.6. Future application milestone
outcomes are drafted in section 101 and will be detailed after Phase 2.

The original voice-integration scope is complete when the following are true.

An administrator can create:

```text
CleverAI_1 → foo
CleverAI_2 → bar
CleverAI_3 → sales
...
CleverAI_N → arbitrary configured flow
```

and every destination is independently selectable anywhere FreePBX accepts a destination.

All Phase 1 calls use:

```text
CLEVERAI_WEBHOOK
```

and CleverAI receives the correct:

```text
X-OS-FLOW
```

for each call.

After upgrading to Phase 2, the system automatically provides:

```text
Satellite Agent Internal
Satellite Agent External
```

without changing or deleting existing CleverAI destinations.

Each user-created destination can switch among:

```text
CleverAI
Builtin Internal
Builtin External
```

without changing the FreePBX destination string referenced by routes.

The Internal and External tabs independently define:

```text
prompt
model
voice
permissions
tools
directory visibility
company information
calendar access
transfer behavior
consultation behavior
```

with explicit radio-button policy.

The built-in runtime executes in the existing Satellite service through:

```text
satellite-agent
```

and FreePBX communicates with it using:

```text
http://127.0.0.1:${SATELLITE_HTTP_PORT}/api/agent/v1/...
Authorization: Bearer ${SATELLITE_API_TOKEN}
```

without changing Satellite's existing general authentication or listener behavior.

Finally, the built-in agent can place a caller on hold, privately ask a recipient whether they want the call, connect the parties after acceptance, or reconnect the caller to the original Agent conversation after rejection and relay only the message explicitly intended for the caller.


---

# 101. Draft roadmap for the broader Agent application

**Status: M1 is now planned as Phase 3; M2–M5 and V remain a draft roadmap.**
The owner confirmed the monitoring-first release scope on 4 October 2026.
See [the Phase 3 implementation plan](satellite/phase3-plan.md) for its
milestones, contracts, ownership, retention, validation and deployment gates.
This does not expand Phase 2 or authorize implementation of the later features.
Detailed estimates, workflow/ingestion technology and later service topology
are decided when each following increment is planned.

Each milestone ships the access controls, retention, resource limits, and
side-effect safeguards required by the capability it introduces. M5 expands
production coverage; it is not permission to defer those basic requirements.

## 101.1 Confirmed product direction

The project owner confirmed:

| Choice | Direction | Consequence for the draft |
|---|---|---|
| Application scope | Broader application dedicated to NethVoice | Authoring, API integration, file context, and monitoring are NethVoice capabilities; no standalone product/extraction milestone |
| First workflow model | Explicit steps and branches containing bounded agent decisions and tool calls | Publish a versioned executable definition; autonomous multi-agent coordination is a possible later extension |
| Delivery priority | Monitoring, API integrations, file context, then workflow authoring | M1–M4 follow this priority; advanced voice transfers do not block them |

Keep runtime components modular within NethVoice. API-triggered work need not
have a telephone call, but still executes inside the NethVoice application's
identity, policy, and resource scope. This direction does not imply multi-tenant
SaaS, arbitrary customer code execution, or a specific visual-editor technology.

## 101.2 Milestone map

| Milestone | User-visible outcome | Dependencies | Evidence for the later milestone review |
|---|---|---|---|
| M0 — Review Phase 2 and design the application increment | An agreed next release scope and ownership model based on the implemented runtime | Phase 2 complete | Validate the boundaries against real calls/tools, apply the confirmed NethVoice scope/priorities, and produce a detailed plan for M1 |
| M1 — Application shell and monitoring | Operators can inspect agent runs, tool invocations, errors, and voice outcomes in one interface | M0; Phase 2 execution events | Trace a run from admission to completion/failure; enforce access and retention; expose telemetry gaps |
| M2 — Reusable connectors, tool calls, and integration API | An agent can use an authorized external API; an external system can start and observe an allowed run | M1; shared dispatcher/configuration contracts | Complete a representative integration with scoped credentials, validated inputs/results, idempotent effects, and a visible trace |
| M3 — Files as managed context | Authorized users can attach approved file resources to agents and obtain grounded results | M1; context-access boundary; connector APIs reused where relevant | Upload/version a supported file, observe ingestion status, retrieve only permitted content with provenance, and verify revocation/deletion |
| M4 — Workflow definitions and authoring | Users can define, validate, publish, and run a workflow containing agent, tool, context, and branch steps | M1–M3 for the complete first workflow release | Run a versioned example through explicit branches, inspect step outcomes, cancel/fail predictably, and keep in-flight runs pinned to their version |
| M5 — Production operation and extension contracts | Workflows and integrations are manageable under failures, upgrades, and real load | M2–M4; advanced voice capabilities included when enabled | Demonstrate supported recovery semantics, upgrades/restore, access controls, bounded resource use, and operational documentation |
| V — Advanced voice control (original Phase 3) | Supervised/consultative transfer, recipient decisions, and caller resumption | Phase 2 voice controller and tools/events | Existing sections 64–80 and 97; no dependency on the workflow editor |

Proposed main sequence: `Phase 2 → M0 → M1 → M2 → M3 → M4 → M5`.
Preserve the confirmed delivery priority M1 → M2 → M3 → M4. Preparatory work for
M2/M3 may overlap once their shared contracts are agreed, without changing that
user-visible priority. Track V is retained behind the M1–M4 application priorities
by default; decide its exact slot alongside M5 at the later planning gate. It is
not an implicit prerequisite for the main sequence.

## 101.3 M0 — Post-Phase-2 planning gate

Use implementation evidence rather than designing the whole future platform now:

- Inspect the actual configuration, provider/tool, voice, and event boundaries;
  record small follow-up refactors only where the implementation needs them.
- Choose one initial user journey and real API/file examples for the application.
  Define the intended operators/authors and access scope before selecting UI or
  identity technology. Schedule the advanced voice track within the confirmed
  application priorities.
- Decide integration with the NethVoice management UI and authentication, source
  repository boundaries, data ownership, supported API-triggered execution/model
  capability, and any authoring transition from Phase 2's FreePBX authority.
  Keep the product NethVoice-specific and identify migration/rollback needs.
- Agree operational limits and acceptance outcomes for the next milestone.
  Select frameworks, storage, ingestion approach, and job execution technology
  only when the next increment requires those choices.

Do not make detailed estimates for all milestones a prerequisite to completing
Phase 2. Refine the roadmap as evidence arrives.

## 101.4 M1 — Monitoring and the first application surface

Provide a NethVoice application surface for authorized operators, starting with
runs and agents already delivered. Show active/recent runs, status, timing, definition
revision, tool invocations, errors, and voice-specific correlation where present.
A run detail view provides an ordered timeline and links to related operations.
Search/filter by agent, time, outcome, and correlation ID.

Use the structured event contract with bounded persisted history and pagination.
Make missing/delayed events visible; a telemetry gap must not be presented as a
successful run. Report provider usage/cost only where measured or clearly marked
as an estimate. Establish roles and retention for this surface. Display redacted
summaries by default; content recording/transcripts require a separate explicit
policy and are not implicit in enabling monitoring.

Keep monitoring views/API separate from FreePBX rendering internals while
integrating them into the NethVoice experience. FreePBX retains its integration
pages and can deep-link to monitoring. Choose the actual hosting, NethVoice
authentication integration, and UI approach at M0. The first shell can be read-only
and leaves configuration ownership unchanged. Editing agent configuration later
requires the explicit owner/cutover decision in section 101.9. Do not provide
replay/resume controls before their operation semantics exist.

## 101.5 M2 — External APIs and reusable tool calls

Cover two distinct directions:

- **Outbound connectors:** configure approved external services and expose their
  operations as versioned tools. Store connector configuration and credentials
  separately from agent definitions; grant specific operations to agents/runs.
  Start with bounded HTTP APIs and one representative business integration.
- **Inbound integration API:** let an authenticated external system start an
  authorized agent run, inspect status/results, and request cancellation.
  Choose the first non-voice execution adapter here based on M0's use case.
  Public API scopes and request validation are separate from the private
  FreePBX configuration synchronization and provider-webhook endpoints.

Tools and future workflow steps invoke the same dispatcher. Validate input and
output schemas, enforce endpoint/network policy, resolve secrets server-side,
and apply deadlines and response limits. The model selects an allowed operation
and its arguments; configuration owns URLs and credentials. Distinguish read-only
operations from side effects, and define retry/idempotency policy per operation.
An ambiguous remote write must be reported for reconciliation, not blindly
repeated. Replaying a trace must not reissue business actions automatically.

Provide configuration and an explicit test-run experience for authorized users,
plus invocation status/errors in monitoring. Decide whether and where consequential
operations require confirmation from the intended user as part of detailed tool
policy. Avoid a generic unrestricted HTTP/shell/SQL tool.

M2 completion includes an API-triggered NethVoice run through the common executor
without requiring a telephone call, and one end-to-end business API integration.
It does not require a workflow engine or autonomous multi-agent scheduling.

## 101.6 M3 — File resources and context

Introduce managed resources with stable IDs, immutable versions, ownership and
access grants. Users can upload supported file types, see processing status,
attach authorized versions/collections to an agent, and replace/revoke/delete
resources. Define supported formats, size limits, extraction quality, storage,
and retention during detailed planning; OCR and large document collections are
not assumed in the first increment.

Ingestion and indexing are asynchronous, bounded jobs with visible progress and
failure reasons. Do not perform document parsing/index building on a live-call
path. Expose processed content through the context-access boundary, using bounded
selection/retrieval appropriate to the actual files. Choose direct context,
retrieval, or a combination after evaluating the use case; the existing profile
`knowledge_json` is not a binary file store or a substitute for resource lifecycle.

Enforce resource access before retrieval and before material reaches a provider.
Carry resource/version and passage provenance into results, and expose useful
source references to the operator/user where supported. File content is data;
it cannot change permissions, workflow definitions, connector endpoints, or tool
grants. Pin the context versions used by a run and record that provenance.

Define revocation behavior for active runs and remove deleted content from stored
files, derived indexes, and caches according to the chosen retention policy.
Verify isolation and stale-index behavior, including missing sources and failed
ingestion. Exact storage and retrieval implementation are deferred to this
milestone's detailed design.

## 101.7 M4 — Agentic workflow definitions and authoring

Start with an explicit executable definition containing typed inputs/outputs,
agent steps, calls to registered tools, context bindings, conditions/branches,
and terminal outcomes. An agent step can make bounded decisions and choose among
its granted tools; workflow structure and policy remain controlled by the
published definition. Autonomous multi-agent coordination is a later candidate,
not part of the confirmed first workflow model.

Provide reusable agent definitions beyond the two seeded voice profiles and
reference their published versions from workflow steps. Preserve the existing
Internal/External bindings while adding authoring for new agents.

Offer create/edit/validate, draft/publish, version history, and controlled test
execution for agents and workflows in the application. The workflow definition is the canonical executable
artifact; a future visual graph or form editor edits that artifact. Select the
first editing experience after Phase 2 rather than tying the executor to a UI
library or reusing FreePBX Visualplan graphs as general workflow definitions.
Visualplan continues to route telephone calls to stable Agent destinations.

Each run pins a published definition and approved agent/tool/context versions.
Define transitions, error paths, cancellation, bounded loops, execution budgets,
and side-effect deduplication. Monitoring shows parent run/step relationships,
chosen branches, and redacted operation results. Checkpoint/restart behavior must
be specified and evidenced before advertising resumable workflows; call sessions
retain their distinct telephony failure rules.

First complete example: accept a request, consult an authorized document, call a
business API, choose an explicit branch, return a result or request a permitted
handoff, and inspect the full execution in monitoring. Exercise both a non-voice
API entrypoint and a NethVoice voice binding to the published workflow. Changes
to a draft must not alter an active run.

Decide the first reusable workflow templates, editor style, and need for human
approval/wait steps during detailed planning. Schedules, long human waits,
arbitrary code steps, autonomous agent teams, and third-party tool protocols are
follow-on candidates rather than automatic M4 commitments.

## 101.8 M5 — Production operation and extension compatibility

Consolidate role-based access, quotas, bounded concurrency, retry/reconciliation,
backup/restore, migration and rollback, resource retention/deletion, and operational
alerts for the application features actually shipped. Establish contract/version
compatibility for definitions, connectors, context sources, events, and APIs.
Retain Phase 2's correctness guarantees throughout; this milestone expands their
coverage rather than postponing them.

Use representative load and failure scenarios across provider sessions, external
API failures, file ingestion, and workflow execution. Document supported recovery
and exactly which actions cannot be replayed safely. Separate slow/background
work from latency-sensitive voice execution if measurements require it; decide
worker/process/queue topology at that point and preserve ownership and idempotency
across restarts. Multi-tenancy and distributed high availability require explicit
scope decisions and are not implicit in the term production.

## 101.9 Configuration ownership and migration direction

Phase 2 keeps FreePBX authoritative. When broader authoring is introduced, agree
one authoritative owner per resource:

| Resource | Phase 2 owner | Proposed later owner/boundary |
|---|---|---|
| PBX routes, Agent destinations, managed SIP trunks, directory, time conditions | FreePBX | FreePBX/NethVoice integration |
| General agent definitions and workflow versions | FreePBX for the two initial profiles; workflows absent | Application, with an explicit import/cutover for existing profiles |
| External API connector definitions and secret references | Absent | Application connector/secret services |
| Files, derived context, grants, retention | Absent | Application resource service |
| Execution state/history and tool outcomes | Satellite runtime, bounded Phase 2 records | Runtime/application execution and event stores |

Preserve existing destination IDs and the Internal/External binding aliases at
cutover. Define which editor becomes read-only or delegates writes through the
new owner; do not synchronize competing mutable copies in both directions.
FreePBX-owned resources are exposed through a versioned integration contract.
Provider/trunk credentials remain behind their owning integration until a
specific credential migration is designed.

This is a proposed division of ownership within NethVoice, not a product
extraction. Decide whether FreePBX-backed repositories remain sufficient or a
NethVoice application-owned repository is needed when adding authoring. Final
schemas, migration mechanics, and recovery procedure are post-Phase-2 work, not
an extra Phase 2 storage migration. No component becomes a second writer merely
because a new UI is introduced.


---

# 102. Phase 3 planning decisions — 2026-10-04

Phase 3 implements **M1: NethVoice Agents monitoring**. The owner confirmed:

| Decision | Confirmed direction |
|---|---|
| Release scope | Monitoring first; APIs and file context in later phases |
| Interface | Dedicated NethVoice Agents area, existing login, FreePBX links |
| Audience | NethVoice administrators only |
| Stored content | Execution metadata by default; transcripts opt-in per agent |
| Default retention | Metadata 30 days; enabled transcripts 7 days; configurable |

Implementation sequence:

1. P3.0: contract, provider capability and Phase 2 acceptance review.
2. P3.1: durable event/run history, gaps, reconciliation and retention.
3. P3.2: authenticated NethVoice monitoring interface and native links.
4. P3.3: optional transcripts, protected storage and deletion.
5. P3.4: lifecycle/compatibility validation, coordinated CI deployment and report.

[The detailed Phase 3 plan](satellite/phase3-plan.md) records the inspected
Phase 2 boundaries, UI and API design, ownership, operational limits,
acceptance scenarios and follow-on decisions. No implementation, deployment
or test execution was performed by the planning update.

Phase 3 source implementation is now present; validation and deployment remain
pending. See [the implementation report](satellite/phase3-development.md) and
[the monitoring contract](satellite/monitoring-api-contract.md).
