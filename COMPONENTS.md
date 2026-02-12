# Components — ns8-nethvoice

## Overview

This repository packages **NethVoice** for **NethServer 8 (NS8)**. In the NS8 suite, NethVoice is the application providing VoIP telephony services, while **NethVoice Proxy** manages SIP and RTP connections. :contentReference[oaicite:0]{index=0}

Key repo entrypoints (top-level dirs): `freepbx/`, `janus/`, `mariadb/`, `nethcti-server/`, `phonebook/`, `reports/`, `satellite/`, `sftp/`, `tancredi/`, `ui/`. :contentReference[oaicite:1]{index=1}

Published container images associated with this repo include (non-exhaustive): `nethvoice`, `nethvoice-asterisk`, `nethvoice-freepbx`, `nethvoice-mariadb`, `nethvoice-janus`, `nethvoice-phonebook`, `nethvoice-cti-server`, `nethvoice-cti-ui`, `nethvoice-cti-middleware`, `nethvoice-tancredi`, `nethvoice-reports-api`, `nethvoice-reports-ui`, `nethvoice-flexisip`, `nethvoice-sftp`, `nethvoice-satellite`. :contentReference[oaicite:2]{index=2}

---

## Component index

| Component ID | Type | Repo path | Primary purpose | Main consumers (“who uses it”) |
|---|---|---|---|---|
| `nethvoice` | NS8 module | (root) | Orchestrates the NethVoice stack on NS8 | NS8 admins (cluster-admin), SIP endpoints, related NS8 modules :contentReference[oaicite:3]{index=3} |
| `nethvoice-proxy` | NS8 module (external) | (separate repo) | SIP/RTP edge proxy for NethVoice | SIP endpoints, NethVoice module :contentReference[oaicite:4]{index=4} |
| `asterisk` | Service | `imageroot/` (and image `nethvoice-asterisk`) | PBX/telephony engine | FreePBX, CTI server, SIP stack :contentReference[oaicite:5]{index=5} |
| `freepbx` | Service | `freepbx/` | Web-based PBX management layer for Asterisk | Admins (PBX config), provisioning workflows :contentReference[oaicite:6]{index=6} |
| `mariadb` | Service | `mariadb/` | Database backend for stack components | FreePBX, CTI, phonebook, reports (depending on deployment) :contentReference[oaicite:7]{index=7} |
| `janus` | Service | `janus/` | WebRTC server/gateway used to establish WebRTC media sessions | Web clients / CTI UI (WebRTC softphone), stack media path :contentReference[oaicite:8]{index=8} |
| `phonebook` | Service + NS8 API surface | `phonebook/` | Central phonebook service; exposes credentials via role/action; emits change event | Other NS8 modules, CTI UI, admins :contentReference[oaicite:9]{index=9} |
| `nethcti-server` | Service | `nethcti-server/` | Switchboard APIs + WebSocket event stream (Asterisk-focused) | CTI UI, operators, integrations :contentReference[oaicite:10]{index=10} |
| `cti-ui` | Service/UI | `ui/` (and image `nethvoice-cti-ui`) | Web client for CTI / WebRTC calling / phonebook/queues | End users (operators), supervisors :contentReference[oaicite:11]{index=11} |
| `cti-middleware` | Service | (repo path not confirmed; image exists) | Middleware layer for CTI (auth/bridge patterns) | CTI UI / integrations :contentReference[oaicite:12]{index=12} |
| `tancredi` | Service | `tancredi/` | Phone provisioning engine for SIP devices | Admins (provisioning), phones/gateways :contentReference[oaicite:13]{index=13} |
| `reports-api` | Service | `reports/` (and image `nethvoice-reports-api`) | Queue/CDR/cost reporting backend | Admins, supervisors, reports UI :contentReference[oaicite:14]{index=14} |
| `reports-ui` | Service/UI | `reports/` (and image `nethvoice-reports-ui`) | Frontend for reporting | Admins, supervisors :contentReference[oaicite:15]{index=15} |
| `flexisip` | Service | (repo path not confirmed; image exists) | SIP server components (proxy/presence/conference/push patterns) | Softphone/mobile-related scenarios (when enabled) :contentReference[oaicite:16]{index=16} |
| `sftp` | Service | `sftp/` | SFTP-based file access channel (purpose depends on deployment) | Admins, integrations (file exchange) :contentReference[oaicite:17]{index=17} |
| `satellite` | Service | `satellite/` | Realtime speech-to-text bridge: connects Asterisk ARI -> RTP -> Deepgram, publishes transcriptions to MQTT; optional Postgres persistence and OpenAI enrichment. | Stack services and integrations; see "Used by" paths below. |
| `nethhotel` | Service / FreePBX module | `freepbx/` + `mariadb/docker-entrypoint-initdb.d/` | Hotel management for PBX: guest check-in/out, wake-up calls, billing, FIAS (PMS) integration, minibar/extras, reports. | FreePBX UI, FIAS bridge, database schemas and migration scripts (see "Used by" below). |
| `notify` | Integration mechanism | `notify/` (runtime dir) | File-based signaling to restart/reload services after config apply | Containers within stack (producer), watcher unit (consumer) :contentReference[oaicite:19]{index=19} |
| `tests` | Test suite | `tests/` + `test-module.sh` | Robot Framework-based module tests | CI, maintainers :contentReference[oaicite:20]{index=20} |

---

## Runtime orchestration and interfaces

### Installation / lifecycle (NS8)
- Install via: `add-module ghcr.io/nethesis/nethvoice:latest 1` and uninstall via `remove-module --no-preserve <instance>`. :contentReference[oaicite:21]{index=21}
- Designed to be paired with **ns8-nethvoice-proxy** as SIP proxy. :contentReference[oaicite:22]{index=22}

### Configuration surfaces
- Configured from **cluster-admin** (NS8 UI). :contentReference[oaicite:23]{index=23}
- README mentions manual environment settings to make provisioning/RPS work with “Falconieri”: set `SUBSCRIPTION_SECRET` and `SUBSCRIPTION_SYSTEMID` in `~/.config/state/environment` and restart the `freepbx` container; also configure `PUBLIC_IP`. :contentReference[oaicite:24]{index=24}
- Wizard entrypoint referenced by README: `https://makako.nethesis.it/nethvoice/`. :contentReference[oaicite:25]{index=25}

### Notify/reload mechanism (file-based)
- After FreePBX applies configuration, some containers must be restarted/reloaded.
- `watcher.path` looks for files named `<action>_<service>` inside a shared `notify` directory. Containers mount it (e.g., `--volume=./notify:/notify`) and create marker files like `restart_nethcti-server`. :contentReference[oaicite:26]{index=26}

### Phonebook service contract (NS8 module-to-module)
- Defines role `pbookreader` exposing action `get-phonebook-credentials` (host/port/user/pass).
- Provides service `<module_id>/srv/tcp/phonebook`.
- Emits event `phonebook-settings-changed` with payload `{module_id,node_id,module_uuid,reason}`; consumers re-fetch credentials via the action. :contentReference[oaicite:27]{index=27}

---

## Component details

## 1) `nethvoice` (NS8 module orchestrator)
**What it does**
- Packages and orchestrates the NethVoice application stack on NS8. :contentReference[oaicite:28]{index=28}

**Who uses it**
- NS8 administrators via cluster-admin.
- SIP endpoints and users indirectly through the telephony service.
- Other NS8 modules via exposed services/roles (e.g., phonebook). :contentReference[oaicite:29]{index=29}

**Why it exists**
- Delivers the “telephony services” half of the NS8 NethVoice suite (paired with NethVoice Proxy). :contentReference[oaicite:30]{index=30}

**Key interfaces**
- NS8 module lifecycle (`add-module`, `remove-module`). :contentReference[oaicite:31]{index=31}
- Phonebook service/event contract. :contentReference[oaicite:32]{index=32}
- Notify/reload mechanism. :contentReference[oaicite:33]{index=33}

---

## 2) `nethvoice-proxy` (external NS8 module)
**What it does**
- SIP and RTP edge proxy for the NethVoice suite. Implements a Kamailio + RTPengine stack and provides service discovery/route management so multiple NethVoice instances can share a single host network. (Source: upstream ns8-nethvoice-proxy README)

**Who uses it**
- SIP endpoints (phones, softphones) and public SIP peers.
- The `nethvoice` NS8 module and its helper scripts/tasks which register routes and read proxy SRV records.

**Used by (concrete file references)**
- [imageroot/actions/configure-module/60sip_proxy](imageroot/actions/configure-module/60sip_proxy) — discovers proxy instance, sets `NETHVOICE_PROXY_FQDN`, `PROXY_IP`, `PROXY_PORT` and calls proxy `add-route` task.
- [imageroot/actions/destroy-module/60sip_proxy](imageroot/actions/destroy-module/60sip_proxy) — removes proxy route on module destroy.
- [imageroot/update-module.d/10env](imageroot/update-module.d/10env) — populates `PROXY_IP`/`PROXY_PORT` env vars when a proxy is installed.
- [imageroot/events/nethvoice-proxy-settings-changed/20configure_proxy](imageroot/events/nethvoice-proxy-settings-changed/20configure_proxy) — event handler that (re)configures proxy routes and envs when proxy settings change.
- [imageroot/actions/configure-module/61ice_enforce](imageroot/actions/configure-module/61ice_enforce) — reads proxy SRV records to set `ICEENFORCE`/ICE-related settings.
- [imageroot/actions/get-defaults/10defaults](imageroot/actions/get-defaults/10defaults) and [imageroot/actions/get-defaults/validate-output.json](imageroot/actions/get-defaults/validate-output.json) — surface proxy install/status in module defaults.
- [ui/src/components/first-configuration/ProxyStep.vue](ui/src/components/first-configuration/ProxyStep.vue) — wizard step that can instantiate a `nethvoice-proxy` module on a selected node.
- [freepbx/var/www/html/freepbx/admin/modules/nethcti3/Nethcti3.class.php](freepbx/var/www/html/freepbx/admin/modules/nethcti3/Nethcti3.class.php) — UI/help text references headers sent to `nethvoice-proxy` (TOPOS, SRTP control) for trunk behavior.
- [tests/00_nethvoice_install_dependencies.robot](tests/00_nethvoice_install_dependencies.robot) and [tests/99_nethvoice_remove-modules.robot](tests/99_nethvoice_remove-modules.robot) — CI/robot tests that install and remove the `nethvoice-proxy` module.

**Why (sourced)**
- From the upstream `ns8-nethvoice-proxy` README: "NS8 NethVoice proxy module, a SIP and RTP proxy allows multiple instances of NethVoice to be hosted on the same Node. The proxy uses Kamailio and rtpengine as core components." This documents the module's intent (edge SIP/RTP proxy, route management, shared-host multi-instance support).

---

## 3) `asterisk` (PBX engine)
**What it does**
- Core telephony framework/engine (PBX toolkit). :contentReference[oaicite:37]{index=37}

**Who uses it**
- Controlled/configured by FreePBX.
- Used by CTI server for switchboard operations/events. :contentReference[oaicite:38]{index=38}

**Why it exists**
- Provides call processing, extensions, trunks, IVR, etc., as the foundational PBX layer. :contentReference[oaicite:39]{index=39}

---

## 4) `freepbx` (PBX management)
**What it does**
- Web-based GUI that controls and manages Asterisk. :contentReference[oaicite:40]{index=40}

**Who uses it**
- Admins (PBX configuration).
- Triggers downstream service reloads via the notify mechanism after applying configs. :contentReference[oaicite:41]{index=41}

**Why it exists**
- Provides a mature admin interface and configuration system for the Asterisk PBX. :contentReference[oaicite:42]{index=42}

---

## 5) `mariadb` (database)
**What it does**
- Database backend image used by the stack. :contentReference[oaicite:43]{index=43}

**Who uses it**
- Stack components that persist configuration/data (commonly FreePBX, phonebook, CTI, reports depending on deployment). :contentReference[oaicite:44]{index=44}

**Why it exists**
- Central persistence layer for application state.

---

## 6) `janus` (WebRTC server/gateway)
**What it does**
- General-purpose WebRTC server enabling media communication setup with browsers/apps. :contentReference[oaicite:45]{index=45}

**Who uses it**
- Web clients (typically via CTI/webphone) to establish WebRTC media sessions.
- Media plane components in the voice/video calling path. :contentReference[oaicite:46]{index=46}

**Why it exists**
- Enables browser-based calling (WebRTC) in the overall communication suite. :contentReference[oaicite:47]{index=47}

---

## 7) `phonebook` (service + NS8 integration contract)
**What it does**
- Exposes a phonebook service to other modules via NS8 service discovery and a role/action to fetch credentials.
- Emits an event when phonebook settings change. :contentReference[oaicite:48]{index=48}

**Who uses it**
- Other NS8 modules needing phonebook access.
- CTI UI and users via the centralized phonebook. :contentReference[oaicite:49]{index=49}

**Why it exists**
- Provides a centralized, shareable phonebook contract for the NS8 ecosystem. :contentReference[oaicite:50]{index=50}

**Interfaces**
- Role: `pbookreader`
- Action: `get-phonebook-credentials`
- Service: `<module_id>/srv/tcp/phonebook`
- Event: `phonebook-settings-changed` (+ payload) :contentReference[oaicite:51]{index=51}

---

## 8) `nethcti-server` (CTI backend)
**What it does**
- Daemon providing APIs for switchboard operations + a WebSocket streaming channel for events; supports Asterisk PBX. :contentReference[oaicite:52]{index=52}

**Who uses it**
- CTI UI (operators/switchboard users).
- Integrations that need real-time call events. :contentReference[oaicite:53]{index=53}

**Why it exists**
- Decouples real-time telephony control/events from the PBX admin layer and exposes them to clients. :contentReference[oaicite:54]{index=54}

---

## 9) `cti-ui` (CTI frontend)
**What it does**
- Web application for CTI: web phone, call management, phonebook, queues, etc. :contentReference[oaicite:55]{index=55}

**Who uses it**
- End users (operators), supervisors, call-center users.

**Why it exists**
- Provides user-facing telephony UX (including WebRTC softphone patterns). :contentReference[oaicite:56]{index=56}

---

## 10) `cti-middleware` (CTI middleware layer)
**What it does**
- Container image exists in this repo’s package set. :contentReference[oaicite:57]{index=57}

**Who uses it**
- CTI UI and/or CTI backend integrations (exact wiring depends on deployment).

**Why it exists**
- Middleware typically centralizes auth/session/bridging concerns between UI and backend.

---

## 11) `tancredi` (provisioning)
**What it does**
- Phone provisioning engine (Tancredi). :contentReference[oaicite:58]{index=58}

**Who uses it**
- Admins provisioning phones/gateways.
- SIP endpoints consuming provisioning profiles.

**Why it exists**
- Supports modern provisioning workflows; NethVoice documentation explicitly references migration to a Tancredi-based provisioning approach. :contentReference[oaicite:59]{index=59}

---

## 12) `reports-api` and `reports-ui` (reporting)
**What they do**
- Reporting backend and UI containers exist in this repo’s package set. :contentReference[oaicite:60]{index=60}
- NethVoice reporting scope includes queue and CDR/costs reports (from the reporting project description). :contentReference[oaicite:61]{index=61}

**Who uses them**
- Admins and supervisors (monitoring KPIs, queues, call detail records).

**Why they exist**
- Provide operational visibility and historical reporting for PBX/call-center usage. :contentReference[oaicite:62]{index=62}

---

## 13) `flexisip` (SIP server components)
**What it does**
- Flexisip is described as a complete SIP server for real-time communications (calling/chat/video) and supports large deployments. :contentReference[oaicite:63]{index=63}
- Container image exists in this repo’s package set. :contentReference[oaicite:64]{index=64}

**Who uses it**
- Deployments that need additional SIP server functions (presence/push/conference patterns) beyond basic PBX signaling.

**Why it exists**
- Extends SIP-side capabilities in scenarios where such features are required. :contentReference[oaicite:65]{index=65}

---

## 14) `sftp` (file transfer)
**What it does**
- Container image exists in this repo’s package set. :contentReference[oaicite:66]{index=66}

**Who uses it**
- Admins/integrations needing file exchange (exact purpose depends on deployment).

**Why it exists**
- Provides a standard SFTP channel for data exchange in the stack.

---

## 15) `satellite` (integration)
**What it does**
- Realtime speech-to-text (STT) bridge for NethVoice. Connects to Asterisk ARI, creates snoop channels and external-media RTP endpoints, streams audio to Deepgram for transcription, and publishes interim/final transcriptions to an MQTT broker. Optionally persists transcripts + embeddings to Postgres (pgvector) and runs OpenAI-based enrichment/summaries. Source: `satellite/README.md` (upstream nethesis/satellite). 

**Who uses it (Used by — concrete file paths)**
- Image build and packaging: `build-images.sh` (builds `nethvoice-satellite` from ghcr.io/nethesis/satellite). 
- Module/service orchestration and restarts: `imageroot/update-module.d/80restart` (restart list includes `satellite`).
- Environment and port allocation: `imageroot/update-module.d/20allocate_ports`, `imageroot/update-module.d/10env`, `imageroot/actions/create-module/05setenvs` (sets `SATELLITE_*` env vars and allocates RTP/HTTP/MQTT ports).
- Integration config surface: `imageroot/actions/get-integrations/20read` (reads SATELLITE integration flags and keys).
- Service management actions: `imageroot/actions/configure-module/80start_services`, `imageroot/actions/set-integrations/50manage_service` (enable/disable/restart satellite and satellite-mqtt systemd user services).
- MQTT password/config generator: `imageroot/bin/satellite-mqtt-gen-config` (creates mosquitto password/config for satellite MQTT).
- Database permissions / feature flags: `mariadb/docker-entrypoint-initdb.d/50_asterisk.rest_cti_permissions.sql` (adds `satellite_stt` permission).

**Why it exists**
- Provide realtime and voicemail transcription capabilities for calls handled by the PBX, expose transcriptions to other components via MQTT and (optionally) persist them for enrichment/search. Source: `satellite/README.md` (https://github.com/nethesis/satellite/).

## 16) `nethhotel` (hotel management)
**What it does**
- Manages hotel-style extensions and guest workflows inside the PBX: check-in/check-out, wake-up calls, room groups, billing (call rates, extras/minibar), reporting and integration with Property Management Systems via the FIAS protocol. See the NethVoice docs: https://docs.nethvoice.com/docs/administrator-manual/nethhotel

**Who uses it (Used by — concrete file paths)**
- FreePBX module code and UI: `freepbx/var/www/html/freepbx/admin/modules/nethhotel/` (Nethhotel.class.php, page.nethhotel.php, functions.inc.php, module.xml, i18n, htdocs/*).
- FIAS bridge and helper scripts: `freepbx/usr/share/neth-hotel-fias/` (dispatcher.php, gi2pbx.php, gc2pbx.php, re2pms.php, minibar.php, functions.inc.php, fias-client-README).
- Database schema and grants: `mariadb/docker-entrypoint-initdb.d/00_fias-schema-create.sql`, `mariadb/docker-entrypoint-initdb.d/40_fias.*.sql`, and related `90_users.sh` for granting permissions.
- Module lifecycle / DB updates: `imageroot/update-module.d/85mysql_update` (creates/updates `fias` DB and rooms db during update/install).
- Runtime/config flags and docs: `freepbx/README.md` (documents `NETHVOICE_HOTEL` and `NETHVOICE_HOTEL_FIAS_*` env vars and FIAS configuration file `/etc/asterisk/fias.conf`).

**Why it exists**
- Provide hotel-specific telephony features and PMS integration for hospitality deployments: automated guest lifecycle, billing integration, and operational features (wake-up, room status) that integrate with the PBX. Primary documentation: NethVoice Administrator manual — NethHotel (https://docs.nethvoice.com/docs/administrator-manual/nethhotel).

**Relevant upstream work / references**
- Porting effort and merge: `nethesis/ns8-nethvoice` PR #436 (feat: Port NethHotel from NethVoice14) — adds module files, DB migration and configuration. https://github.com/nethesis/ns8-nethvoice/pull/436
- Migration support for NS8 upgrades: `NethServer/nethserver-ns8-migration` PR #115 (migrate NethHotel database on upgrade). https://github.com/NethServer/nethserver-ns8-migration/pull/115
- Issue tracking porting work and test cases: `NethServer/dev` issue #7425 (NethHotel: port old NethHotel from NethVoice14). https://github.com/NethServer/dev/issues/7425

---

## 16) `notify` (reload signaling)
**What it does**
- Implements a file-based signaling convention (`<action>_<service>`) monitored by `watcher.path` units to restart/reload services after configuration changes. :contentReference[oaicite:68]{index=68}

**Who uses it**
- Producer: containers that need other services restarted/reloaded.
- Consumer: host-level watcher units and the targeted services. :contentReference[oaicite:69]{index=69}

**Why it exists**
- Makes post-configuration synchronization explicit and container-friendly.

---

## 17) `tests` (Robot Framework)
**What it does**
- Provides module tests driven by `test-module.sh`, using Robot Framework. :contentReference[oaicite:70]{index=70}

**Who uses it**
- Maintainers/CI to validate module behavior. :contentReference[oaicite:71]{index=71}

**Why it exists**
- Regression coverage for install/config/runtime flows.

---

## Update workflow for this file

1. Inventory components (name + paths).
2. For each component, collect consumers ("Used by") via workspace search.
3. Extract "Why" from docs/ADRs/README/comments; otherwise infer and mark
4. Update this file.