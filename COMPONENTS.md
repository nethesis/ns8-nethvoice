# Components — ns8-nethvoice

<!-- SCHEMA: Every component entry under "## Components" MUST use this template.
     Fields appear in this exact order. Required fields are always present.
     Optional fields are omitted entirely when not applicable (never write "None" for optional fields).

### component-id
- **Type**: service | ns8-module | ui | integration | db | test-suite | external-module
- **Path**: `repo/relative/dir/` | `(pulled-only)` | `(external)`
- **Image**: `ghcr.io/nethesis/...`                         [optional]
- **Base image**: `docker.io/library/...:tag`                [optional]
- **Upstream repo**: https://github.com/...                  [optional]
- **Docs**: https://...                                      [optional]
- **Purpose**: One sentence.
- **Why**: Documented intent (cite source). Or "Why (inferred): ..." with evidence.
- **Used by**:
  - `path/to/file` — one-line description
- **External references**:
  - https://... — context
-->

## Quick Reference

| ID | Type | Path | Image | Upstream Repo |
|---|---|---|---|---|
| `nethvoice` | ns8-module | `imageroot/`, `ui/` | `ghcr.io/nethesis/nethvoice` | — |
| `nethvoice-proxy` | external-module | `(external)` | — | https://github.com/NethServer/ns8-nethvoice-proxy |
| `asterisk` | service | `freepbx/` (embedded) | `ghcr.io/nethesis/nethvoice-freepbx` | https://github.com/asterisk/asterisk |
| `freepbx` | service | `freepbx/` | `ghcr.io/nethesis/nethvoice-freepbx` | https://github.com/FreePBX |
| `mariadb` | db | `mariadb/` | `ghcr.io/nethesis/nethvoice-mariadb` | — |
| `janus` | service | `janus/` | `ghcr.io/nethesis/nethvoice-janus` | https://github.com/meetecho/janus-gateway |
| `phonebook` | service | `phonebook/` | `ghcr.io/nethesis/nethvoice-phonebook` | — |
| `nethcti-server` | service | `nethcti-server/` | `ghcr.io/nethesis/nethvoice-cti-server` | https://github.com/nethesis/nethcti-server |
| `cti-ui` | ui | `(pulled-only)` | `ghcr.io/nethesis/nethvoice-cti-ui` | https://github.com/nethesis/nethvoice-cti |
| `cti-middleware` | service | `(pulled-only)` | `ghcr.io/nethesis/nethvoice-cti-middleware` | https://github.com/nethesis/nethcti-middleware |
| `tancredi` | service | `tancredi/` | `ghcr.io/nethesis/nethvoice-tancredi` | https://github.com/nethesis/tancredi |
| `reports-api` | service | `reports/` | `ghcr.io/nethesis/nethvoice-reports-api` | https://github.com/nethesis/nethvoice-report |
| `reports-ui` | ui | `reports/` | `ghcr.io/nethesis/nethvoice-reports-ui` | https://github.com/nethesis/nethvoice-report |
| `satellite` | service | `satellite/` | `ghcr.io/nethesis/nethvoice-satellite` | https://github.com/nethesis/satellite |
| `nethhotel` | service | `freepbx/` (submodule) | — | — |
| `sftp` | service | `sftp/` | `ghcr.io/nethesis/nethvoice-sftp` | — |
| `notify` | integration | `imageroot/` (runtime) | — | — |
| `tests` | test-suite | `tests/` | — | — |

---

## Components

### nethvoice
- **Type**: ns8-module
- **Path**: `imageroot/`, `ui/`
- **Image**: `ghcr.io/nethesis/nethvoice`
- **Base image**: `docker.io/library/node:24.11.0-slim` (build) → `scratch` (dist)
- **Purpose**: Orchestrates the NethVoice telephony stack on NethServer 8.
- **Why**: Delivers the telephony-services application for the NS8 suite, paired with NethVoice Proxy. (Source: README.md)
- **Used by**:
  - `imageroot/actions/create-module/` — module creation lifecycle
  - `imageroot/actions/configure-module/` — module configuration lifecycle
  - `imageroot/actions/destroy-module/` — module teardown lifecycle
  - `imageroot/actions/restore-module/` — backup restore lifecycle
  - `imageroot/actions/clone-module/` — module clone lifecycle
  - `imageroot/actions/import-module/` — NS7→NS8 migration import
  - `imageroot/actions/transfer-state/` — live state transfer between nodes
  - `imageroot/update-module.d/` — update scripts
  - `Containerfile` — image build definition
  - `build-images.sh` — builds all container images
  - `ui/src/` — Vue.js admin wizard UI
- **External references**:
  - https://makako.nethesis.it/nethvoice/ — wizard entrypoint

---

### nethvoice-proxy
- **Type**: external-module
- **Path**: `(external)`
- **Upstream repo**: https://github.com/NethServer/ns8-nethvoice-proxy
- **Purpose**: SIP/RTP edge proxy (Kamailio + RTPengine) enabling multiple NethVoice instances on a single host.
- **Why**: "NS8 NethVoice proxy module, a SIP and RTP proxy allows multiple instances of NethVoice to be hosted on the same Node." (Source: ns8-nethvoice-proxy README)
- **Used by**:
  - `imageroot/actions/configure-module/60sip_proxy` — discovers proxy, sets NETHVOICE_PROXY_FQDN/PROXY_IP/PROXY_PORT, calls add-route
  - `imageroot/actions/configure-module/61ice_enforce` — reads proxy SRV records for ICE settings
  - `imageroot/actions/destroy-module/60sip_proxy` — removes proxy route on destroy
  - `imageroot/actions/get-defaults/10defaults` — surfaces proxy install/status in module defaults
  - `imageroot/update-module.d/10env` — populates PROXY_IP/PROXY_PORT env vars
  - `imageroot/events/nethvoice-proxy-settings-changed/20configure_proxy` — reconfigures proxy routes on settings change
  - `imageroot/events/nethvoice-proxy-settings-changed/80start_services` — restarts services after proxy change
  - `ui/src/components/first-configuration/ProxyStep.vue` — wizard step to instantiate proxy
  - `freepbx/var/www/html/freepbx/admin/modules/nethcti3/Nethcti3.class.php` — TOPOS/SRTP header references
  - `tests/00_nethvoice_install_dependencies.robot` — installs proxy in CI
  - `tests/99_nethvoice_remove-modules.robot` — removes proxy in CI
- **External references**:
  - https://github.com/NethServer/ns8-nethvoice-proxy — upstream module repo

---

### asterisk
- **Type**: service
- **Path**: `freepbx/` (embedded inside freepbx container)
- **Image**: `ghcr.io/nethesis/nethvoice-freepbx` (Asterisk runs inside this image)
- **Base image**: `docker.io/library/php:7.4-apache` (runtime stage of freepbx/Containerfile)
- **Upstream repo**: https://github.com/asterisk/asterisk
- **Purpose**: Core PBX/telephony engine providing call processing, extensions, trunks, IVR, queues.
- **Why**: Foundational open-source PBX layer that FreePBX manages. (Source: freepbx/Containerfile — downloads Asterisk 18.x)
- **Used by**:
  - `imageroot/bin/asterisk` — helper: podman exec freepbx asterisk $@
  - `imageroot/bin/fwconsole` — helper: podman exec freepbx fwconsole $@
  - `imageroot/systemd/user/freepbx.service` — ExecStartPost waits for core show version
  - `imageroot/actions/create-module/05setenvs` — allocates ASTERISK_RTPSTART/RTPEND, ASTERISK_SIP_PORT
  - `imageroot/actions/create-module/90firewall` — opens SIP/IAX/RTP UDP ports
  - `imageroot/actions/clone-module/22set_db_services_ports` — updates asterisk DB tables with new ports
  - `imageroot/actions/restore-module/71set_db_services_ports` — same for restore
  - `imageroot/actions/import-module/40mysql` — inserts Asterisk Manager port into freepbx_settings
  - `imageroot/bin/module-dump-state` — backs up astdb and custom sounds
  - `imageroot/etc/state-include.conf` — includes volumes/ dirs for asterisk data
  - `freepbx/Containerfile` — builds Asterisk from source (v18.x with PJSIP)
- **External references**:
  - https://downloads.asterisk.org/pub/telephony/asterisk/ — Asterisk source tarball
  - http://downloads.digium.com/pub/telephony/ — Digium codec binaries (opus, silk, siren7, siren14)

---

### freepbx
- **Type**: service
- **Path**: `freepbx/`
- **Image**: `ghcr.io/nethesis/nethvoice-freepbx`
- **Base image**: `docker.io/library/php:7.4-apache`
- **Docs**: https://www.nethesis.it/soluzioni/nethvoice
- **Purpose**: Web-based PBX management layer that configures and controls Asterisk.
- **Why**: Provides mature admin interface and configuration system for the Asterisk PBX. (Source: freepbx/README.md)
- **Used by**:
  - `imageroot/systemd/user/freepbx.service` — systemd unit running the container
  - `build-images.sh` — builds nethvoice-freepbx image from freepbx/ directory
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/configure-module/80start_services` — enables and starts freepbx.service
  - `imageroot/actions/configure-module/90wait_freepbx` — waits for FreePBX HTTP readiness
  - `imageroot/actions/set-nethvoice-hotel/20apply` — try-restart freepbx.service
  - `imageroot/actions/set-integrations/50manage_service` — try-restart freepbx.service
  - `imageroot/actions/restore-module/72reload_services` — restarts freepbx after restore
  - `imageroot/actions/import-module/04initialize_volumes` — uses NETHVOICE_FREEPBX_IMAGE for volume init
  - `imageroot/actions/destroy-module/20destroy` — removes freepbx traefik route
  - `imageroot/update-module.d/80restart` — restarts freepbx when convenient
  - `imageroot/bin/module-dump-state` — podman exec freepbx backup_astdb; copies sounds
  - `imageroot/bin/install-certificate` — installs TLS cert into freepbx volume
  - `imageroot/events/user-domain-changed/20configure_ldap` — restarts freepbx.service
  - `imageroot/events/smarthost-changed/10reload_services` — try-reload-or-restart freepbx.service
  - `imageroot/events/subscription-changed/80sevice_restart` — try-restart freepbx.service
  - `imageroot/events/nethvoice-proxy-settings-changed/80start_services` — try-restart freepbx
- **External references**:
  - https://github.com/FreePBX — upstream FreePBX module repos (~30 modules pulled in Containerfile)
  - https://github.com/nethesis/freepbx-core — Nethesis fork of FreePBX core
  - https://www.nethesis.it/soluzioni/nethvoice — brand default site

---

### mariadb
- **Type**: db
- **Path**: `mariadb/`
- **Image**: `ghcr.io/nethesis/nethvoice-mariadb`
- **Base image**: `docker.io/library/mariadb:10.11.15`
- **Purpose**: Database backend for stack components (FreePBX, phonebook, CTI, reports, hotel).
- **Why (inferred)**: Central persistence layer for application state and configuration. (Evidence: mariadb/docker-entrypoint-initdb.d/ contains schema scripts for asterisk, cdr, phonebook, fias DBs)
- **Used by**:
  - `imageroot/systemd/user/mariadb.service` — systemd unit running the container
  - `build-images.sh` — assembles nethvoice-mariadb from mariadb/ dir on base image
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — sets NETHVOICE_MARIADB_PORT, generates MARIADB_ROOT_PASSWORD
  - `imageroot/actions/create-module/50mariadb-init` — one-shot init of mariadb container
  - `imageroot/actions/configure-module/80start_services` — enables and starts mariadb.service
  - `imageroot/actions/configure-module/85mysql_background_import` — background SQL restore
  - `imageroot/actions/configure-module/95service_adjust` — queries mariadb for wizard step
  - `imageroot/actions/clone-module/22set_db_services_ports` — executes SQL via podman exec mariadb
  - `imageroot/actions/restore-module/71set_db_services_ports` — port updates during restore
  - `imageroot/actions/restore-module/71update_user_dbconn` — updates DB connection records
  - `imageroot/actions/import-module/40mysql` — DB grants and inserts during import
  - `imageroot/actions/get-facts/10get_facts` — reads MARIADB_ROOT_PASSWORD
  - `imageroot/update-module.d/10env` — migrates MARIADB_ROOT_PASSWORD to passwords.env
  - `imageroot/update-module.d/80restart` — restarts mariadb when convenient
  - `imageroot/update-module.d/85mysql_update` — runs schema updates (roomsdb, fias, providers)
  - `imageroot/bin/mysql` — helper: podman exec mariadb mysql
  - `imageroot/bin/module-dump-state` — dumps all DBs via podman exec mariadb
  - `imageroot/events/support-session-started/10add_support_user` — adds support user
  - `imageroot/events/support-session-stopped/10remove_support_user` — removes support user
  - `imageroot/systemd/user/reports-api.service` — Requires=mariadb.service

---

### janus
- **Type**: service
- **Path**: `janus/`
- **Image**: `ghcr.io/nethesis/nethvoice-janus`
- **Base image**: `debian:bullseye-slim`
- **Upstream repo**: https://github.com/meetecho/janus-gateway
- **Purpose**: WebRTC server/gateway enabling browser-based audio/video media sessions.
- **Why**: Enables browser-based calling (WebRTC softphone) in the communication suite. (Source: janus/README.md)
- **Used by**:
  - `imageroot/systemd/user/janus.service` — systemd unit running the container
  - `build-images.sh` — builds nethvoice-janus from janus/ directory
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — allocates Janus RTP ports, sets JANUS_TRANSPORT_PORT, generates JANUS_ADMIN_SECRET
  - `imageroot/actions/create-module/90firewall` — opens Janus RTP UDP ports
  - `imageroot/actions/configure-module/80start_services` — enables and starts janus.service
  - `imageroot/actions/configure-module/30traefik` — configures Traefik route for /janus
  - `imageroot/actions/destroy-module/20destroy` — removes janus traefik route
  - `imageroot/actions/restore-module/20copyenv` — carries over Janus env vars during restore
  - `imageroot/update-module.d/10env` — migrates JANUS_ADMIN_SECRET to passwords.env
  - `imageroot/update-module.d/80restart` — restarts janus when convenient
  - `imageroot/bin/install-certificate` — installs TLS cert into janus volume
  - `imageroot/events/nethvoice-proxy-settings-changed/80start_services` — try-restart janus
  - `imageroot/events/certificate-changed/50get_certificate` — restarts janus.service on cert change
- **External references**:
  - https://github.com/meetecho/janus-gateway — Janus Gateway source (tag v1.3.1)
  - https://github.com/cisco/libsrtp — libsrtp dependency (v2.3.0)
  - https://gitlab.freedesktop.org/libnice/libnice — libnice dependency (0.1.17)

---

### phonebook
- **Type**: service
- **Path**: `phonebook/`
- **Image**: `ghcr.io/nethesis/nethvoice-phonebook`
- **Base image**: `docker.io/library/alpine:latest`
- **Purpose**: Central phonebook service exposing LDAP interface and NS8 service-discovery credentials.
- **Why**: Provides a centralized, shareable phonebook contract for the NS8 ecosystem. (Source: imageroot/update-module.d/96publish_srv_keys — publishes srv/tcp/phonebook and phonebook-settings-changed event)
- **Used by**:
  - `imageroot/systemd/user/phonebook.service` — systemd unit running the container
  - `imageroot/systemd/user/phonebook-update.service` — runs phonebook source sync via podman exec freepbx
  - `imageroot/systemd/user/phonebook-update.timer` — periodic timer triggering sync
  - `build-images.sh` — builds nethvoice-phonebook from phonebook/ directory
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — generates PHONEBOOK_DB_PASS, PHONEBOOK_LDAP_PASS
  - `imageroot/actions/configure-module/80start_services` — enables phonebook.service and phonebook-update.timer
  - `imageroot/actions/get-phonebook-credentials/` — returns phonebook DB credentials (RBAC-gated)
  - `imageroot/actions/import-module/40mysql` — grants DB access for phonebook user
  - `imageroot/actions/import-module/10setenvs` — imports phonebook_db_password
  - `imageroot/update-module.d/10env` — migrates PHONEBOOK_DB_PASS/PHONEBOOK_LDAP_PASS to passwords.env
  - `imageroot/update-module.d/30grants` — grants get-phonebook-credentials role for pbookreader
  - `imageroot/update-module.d/80restart` — restarts phonebook when convenient
  - `imageroot/update-module.d/96publish_srv_keys` — publishes srv/tcp/phonebook service key and phonebook-settings-changed event
  - `imageroot/bin/install-certificate` — installs TLS cert for phonebook
  - `imageroot/etc/state-include.conf` — includes volumes/phonebookcsv in backup state
  - `imageroot/events/user-domain-changed/20configure_ldap` — restarts phonebook.service
  - `imageroot/events/certificate-changed/50get_certificate` — restarts phonebook.service on cert change

---

### nethcti-server
- **Type**: service
- **Path**: `nethcti-server/`
- **Image**: `ghcr.io/nethesis/nethvoice-cti-server`
- **Base image**: `docker.io/library/node:14.21.1-alpine`
- **Upstream repo**: https://github.com/nethesis/nethcti-server
- **Purpose**: Switchboard APIs and WebSocket event stream for real-time telephony control.
- **Why**: Decouples real-time telephony control/events from the PBX admin layer and exposes them to clients. (Source: nethcti-server/Containerfile — clones nethcti-server branch ns8)
- **Used by**:
  - `imageroot/systemd/user/nethcti-server.service` — systemd unit; Wants=freepbx.service
  - `build-images.sh` — builds nethvoice-cti-server from nethcti-server/ dir (target production)
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/configure-module/80start_services` — enables nethcti-server.service
  - `imageroot/actions/configure-module/95service_adjust` — restarts nethcti-server if wizard step completed
  - `imageroot/actions/configure-module/30traefik` — Traefik routes for CTI server API + WebSocket
  - `imageroot/actions/set-integrations/50manage_service` — try-restart nethcti-server.service
  - `imageroot/actions/set-nethvoice-hotel/20apply` — try-restart nethcti-server.service
  - `imageroot/actions/restore-module/72reload_services` — restarts nethcti-server after restore
  - `imageroot/update-module.d/10env` — migrates NETHCTI_AMI_PASSWORD, NETHCTI_DB_PASSWORD
  - `imageroot/update-module.d/80restart` — restarts nethcti-server when convenient
  - `imageroot/update-module.d/85mysql_update` — cleans up nethcti3 auth records
  - `imageroot/bin/install-certificate` — installs TLS cert for nethcti-server
  - `imageroot/events/subscription-changed/80sevice_restart` — try-restart nethcti-server.service
  - `imageroot/events/certificate-changed/50get_certificate` — restarts nethcti-server.service
- **External references**:
  - https://github.com/nethesis/nethcti-server — upstream source (branch ns8)

---

### cti-ui
- **Type**: ui
- **Path**: `(pulled-only)`
- **Image**: `ghcr.io/nethesis/nethvoice-cti-ui`
- **Upstream repo**: https://github.com/nethesis/nethvoice-cti
- **Purpose**: Web client for CTI — web phone, call management, phonebook, queues.
- **Why (inferred)**: Provides user-facing telephony UX including WebRTC softphone. (Evidence: systemd unit and traefik routes serve it as the main operator UI)
- **Used by**:
  - `imageroot/systemd/user/nethcti-ui.service` — systemd unit running the container
  - `imageroot/systemd/user/nethcti-ui-restart.service` — oneshot: try-restart for timezone updates
  - `imageroot/systemd/user/nethcti-ui-restart.timer` — weekly timer for UI restart
  - `build-images.sh` — pulls ghcr.io/nethesis/nethvoice-cti → commits as nethvoice-cti-ui
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/configure-module/80start_services` — enables nethcti-ui.service and nethcti-ui-restart.timer
  - `imageroot/actions/configure-module/15configure_main_routes` — Traefik route on NETHCTI_UI_HOST
  - `imageroot/actions/set-rebranding/10setenvs` — try-restart nethcti-ui.service after branding change
  - `imageroot/update-module.d/70enable` — enables nethcti-ui-restart.timer
  - `imageroot/update-module.d/80restart` — restarts nethcti-ui when convenient
  - `imageroot/update-module.d/60traefik` — reconfigures routes using NETHCTI_UI_HOST
- **External references**:
  - https://github.com/nethesis/nethvoice-cti — upstream UI source

---

### cti-middleware
- **Type**: service
- **Path**: `(pulled-only)`
- **Image**: `ghcr.io/nethesis/nethvoice-cti-middleware`
- **Upstream repo**: https://github.com/nethesis/nethcti-middleware
- **Purpose**: Middleware layer bridging CTI UI to backend services (auth/session/API proxy).
- **Why (inferred)**: Centralizes auth/session/bridging concerns between CTI UI and CTI server. (Evidence: systemd unit has Wants=nethcti-server.service; traefik routes proxy middleware API paths)
- **Used by**:
  - `imageroot/systemd/user/nethcti-middleware.service` — systemd unit; Wants=nethcti-server.service
  - `build-images.sh` — pulls ghcr.io/nethesis/nethcti-middleware → commits as nethvoice-cti-middleware
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/configure-module/80start_services` — enables nethcti-middleware.service
  - `imageroot/actions/configure-module/30traefik` — configures middleware API route on NETHCTI_UI_HOST
  - `imageroot/actions/destroy-module/20destroy` — removes middleware-cti-server-api traefik route
  - `imageroot/actions/restore-module/72reload_services` — restarts nethcti-middleware
  - `imageroot/update-module.d/70enable` — enable --now nethcti-middleware.service
  - `imageroot/update-module.d/80restart` — restarts when convenient
  - `imageroot/update-module.d/10env` — sets NETHVOICE_MIDDLEWARE_V1_API_ENDPOINT / _WS_ENDPOINT
  - `imageroot/bin/install-certificate` — installs TLS cert for nethcti-middleware
  - `imageroot/events/subscription-changed/80sevice_restart` — try-restart nethcti-middleware.service
  - `imageroot/events/certificate-changed/50get_certificate` — restarts nethcti-middleware.service
- **External references**:
  - https://github.com/nethesis/nethcti-middleware — upstream source

---

### tancredi
- **Type**: service
- **Path**: `tancredi/`
- **Image**: `ghcr.io/nethesis/nethvoice-tancredi`
- **Base image**: `docker.io/library/php:8-apache`
- **Upstream repo**: https://github.com/nethesis/tancredi
- **Purpose**: Phone provisioning engine for SIP devices (phones, gateways).
- **Why**: Supports modern provisioning workflows; NethVoice documentation references migration to Tancredi-based provisioning. (Source: tancredi/README.md)
- **Used by**:
  - `imageroot/systemd/user/tancredi.service` — systemd unit running the container
  - `build-images.sh` — builds nethvoice-tancredi from tancredi/ directory
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — sets TANCREDIPORT, generates TANCREDI_STATIC_TOKEN
  - `imageroot/actions/configure-module/80start_services` — enables tancredi.service
  - `imageroot/actions/configure-module/30traefik` — Traefik routes for /tancredi and /provisioning
  - `imageroot/actions/destroy-module/20destroy` — removes tancredi traefik route
  - `imageroot/update-module.d/10env` — migrates TANCREDI_STATIC_TOKEN to passwords.env
  - `imageroot/update-module.d/80restart` — restarts tancredi when convenient
  - `imageroot/etc/state-include.conf` — includes volumes/tancredi in backup state
  - `imageroot/events/nethvoice-proxy-settings-changed/80start_services` — try-restart tancredi
  - `imageroot/systemd/user/freepbx.service` — mounts tancredi volume into freepbx container
  - `imageroot/systemd/user/phonebook.service` — mounts tancredi volume into phonebook container
- **External references**:
  - https://github.com/nethesis/tancredi — Tancredi source (tag 1.5.0)
  - https://github.com/nethesis/nethserver-tancredi/ — NethServer Tancredi integration (firmware files)

---

### reports-api
- **Type**: service
- **Path**: `reports/`
- **Image**: `ghcr.io/nethesis/nethvoice-reports-api`
- **Base image**: `docker.io/library/golang:1.19.9-alpine` (build) → `docker.io/library/alpine:3.17.3` (runtime)
- **Upstream repo**: https://github.com/nethesis/nethvoice-report
- **Purpose**: Queue/CDR/cost reporting backend API.
- **Why**: Provides operational visibility and historical reporting for PBX/call-center usage. (Source: reports/README.md)
- **Used by**:
  - `imageroot/systemd/user/reports-api.service` — systemd unit; Requires=mariadb.service reports-redis.service
  - `imageroot/systemd/user/reports-redis.service` — Redis cache for reports (redis:7.0.10-alpine)
  - `imageroot/systemd/user/reports-scheduler.service` — oneshot: runs cdr/cost/views/queries tasks
  - `imageroot/systemd/user/reports-scheduler.timer` — timer triggering the scheduler
  - `build-images.sh` — builds nethvoice-reports-api (target api-production) from reports/
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — sets REPORTS_REDIS_PORT, REPORTS_API_PORT, generates REPORTS_PASSWORD/API_KEY/SECRET
  - `imageroot/actions/configure-module/71reports_api` — sets REPORTS_INTERNATIONAL_PREFIX, Traefik route
  - `imageroot/actions/configure-module/80start_services` — enables reports-api.service, reports-scheduler.timer
  - `imageroot/actions/destroy-module/20destroy` — removes reports-api traefik route
  - `imageroot/actions/restore-module/70configure_module` — carries over REPORTS_INTERNATIONAL_PREFIX
  - `imageroot/actions/get-configuration/20read` — returns reports prefix
  - `imageroot/update-module.d/80restart` — restarts reports-api, reports-redis when convenient
  - `imageroot/events/subscription-changed/80sevice_restart` — try-restart reports-api.service
- **External references**:
  - https://github.com/nethesis/nethvoice-report — upstream report project
  - https://github.com/h5bp/server-configs-nginx — Nginx config templates (used by reports-ui)

---

### reports-ui
- **Type**: ui
- **Path**: `reports/`
- **Image**: `ghcr.io/nethesis/nethvoice-reports-ui`
- **Base image**: `docker.io/library/node:14.21.2-alpine` (build) → `docker.io/library/nginx:1.29.3-alpine` (runtime)
- **Upstream repo**: https://github.com/nethesis/nethvoice-report
- **Purpose**: Frontend for queue/CDR/cost reporting.
- **Why**: Provides visual reporting interface for admins and supervisors. (Source: reports/README.md)
- **Used by**:
  - `imageroot/systemd/user/reports-ui.service` — systemd unit; Requires=reports-api.service
  - `build-images.sh` — builds nethvoice-reports-ui (target ui-production) from reports/
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/configure-module/72reports_ui` — Traefik route for reports-ui
  - `imageroot/actions/configure-module/80start_services` — enables reports-ui.service
  - `imageroot/actions/destroy-module/20destroy` — removes reports-ui traefik route
  - `imageroot/update-module.d/80restart` — restarts reports-ui when convenient
- **External references**:
  - https://github.com/nethesis/nethvoice-report — upstream report project

---

### satellite
- **Type**: service
- **Path**: `satellite/`
- **Image**: `ghcr.io/nethesis/nethvoice-satellite`
- **Base image**: `ghcr.io/nethesis/satellite:0.0.8` (pulled directly)
- **Upstream repo**: https://github.com/nethesis/satellite
- **Purpose**: Realtime speech-to-text bridge: connects Asterisk ARI → RTP → Deepgram, publishes transcriptions to MQTT.
- **Why**: Provide realtime and voicemail transcription capabilities for calls handled by the PBX. (Source: satellite/README.md)
- **Used by**:
  - `imageroot/systemd/user/satellite.service` — systemd unit running the STT bridge
  - `imageroot/systemd/user/satellite-mqtt.service` — MQTT broker (mosquitto) for satellite
  - `imageroot/systemd/user/satellite-pgsql.service` — PostgreSQL with pgvector for transcript persistence
  - `imageroot/systemd/user/satellite-recordings-cleanup.service` — cleans up recordings via podman exec freepbx
  - `imageroot/systemd/user/satellite-recordings-cleanup.timer` — timer for cleanup
  - `build-images.sh` — builds nethvoice-satellite from ghcr.io/nethesis/satellite base
  - `imageroot/actions/create-module/05setenvs` — sets SATELLITE_* env vars, allocates RTP/HTTP/MQTT ports
  - `imageroot/actions/configure-module/80start_services` — enables satellite services (conditional)
  - `imageroot/actions/get-integrations/20read` — reads SATELLITE integration flags and keys
  - `imageroot/actions/set-integrations/50manage_service` — enable/disable/restart satellite and satellite-mqtt
  - `imageroot/update-module.d/20allocate_ports` — allocates satellite ports
  - `imageroot/update-module.d/10env` — sets satellite env vars
  - `imageroot/update-module.d/80restart` — restarts satellite when convenient
  - `imageroot/bin/satellite-mqtt-gen-config` — creates mosquitto password/config for satellite MQTT
  - `mariadb/docker-entrypoint-initdb.d/50_asterisk.rest_cti_permissions.sql` — adds satellite_stt permission
- **External references**:
  - https://github.com/nethesis/satellite — upstream satellite repo

---

### nethhotel
- **Type**: service
- **Path**: `freepbx/` (submodule within FreePBX)
- **Docs**: https://docs.nethvoice.com/docs/administrator-manual/nethhotel
- **Purpose**: Hotel management for PBX: guest check-in/out, wake-up calls, billing, FIAS (PMS) integration.
- **Why**: Provide hotel-specific telephony features and PMS integration for hospitality deployments. (Source: NethVoice Administrator manual — NethHotel)
- **Used by**:
  - `freepbx/var/www/html/freepbx/admin/modules/nethhotel/` — FreePBX module code and UI (Nethhotel.class.php, page.nethhotel.php, functions.inc.php, module.xml)
  - `freepbx/usr/share/neth-hotel-fias/` — FIAS bridge scripts (dispatcher.php, gi2pbx.php, gc2pbx.php, re2pms.php, minibar.php)
  - `mariadb/docker-entrypoint-initdb.d/00_fias-schema-create.sql` — FIAS database schema
  - `mariadb/docker-entrypoint-initdb.d/40_fias.*.sql` — FIAS seed data
  - `mariadb/docker-entrypoint-initdb.d/90_users.sh` — grants DB permissions for FIAS
  - `imageroot/update-module.d/85mysql_update` — creates/updates fias DB and rooms db during update
  - `imageroot/systemd/user/nethvoice-hotel-alarms.service` — wake-up call alarm service
  - `imageroot/systemd/user/nethvoice-hotel-alarms.timer` — timer for alarm checks
  - `imageroot/actions/get-nethvoice-hotel/20read` — reads hotel configuration
  - `imageroot/actions/set-nethvoice-hotel/20apply` — applies hotel configuration, restarts services
  - `freepbx/README.md` — documents NETHVOICE_HOTEL and NETHVOICE_HOTEL_FIAS_* env vars
- **External references**:
  - https://docs.nethvoice.com/docs/administrator-manual/nethhotel — NethHotel admin docs
  - https://github.com/nethesis/ns8-nethvoice/pull/436 — feat: Port NethHotel from NethVoice14
  - https://github.com/NethServer/nethserver-ns8-migration/pull/115 — migrate NethHotel database on upgrade
  - https://github.com/NethServer/dev/issues/7425 — NethHotel porting tracking issue

---

### sftp
- **Type**: service
- **Path**: `sftp/`
- **Image**: `ghcr.io/nethesis/nethvoice-sftp`
- **Base image**: `alpine:latest`
- **Purpose**: SFTP server for accessing call recordings and audio files.
- **Why (inferred)**: Provides standard SFTP-based file access to PBX audio assets (recordings, MoH, sounds). (Evidence: sftp.service mounts moh, sounds, spool volumes from asterisk)
- **Used by**:
  - `imageroot/systemd/user/sftp.service` — systemd unit; mounts moh, sounds, spool volumes
  - `build-images.sh` — builds nethvoice-sftp from sftp/ directory
  - `Containerfile` — listed in org.nethserver.images label
  - `imageroot/actions/create-module/05setenvs` — sets ASTERISK_RECORDING_SFTP_PORT
  - `imageroot/actions/create-module/90firewall` — opens SFTP TCP port in firewall
  - `imageroot/update-module.d/20allocate_ports` — allocates/migrates SFTP port during updates

---

### notify
- **Type**: integration
- **Path**: `imageroot/` (runtime mechanism)
- **Purpose**: File-based signaling to restart/reload services after FreePBX applies configuration.
- **Why (inferred)**: Makes post-configuration service synchronization explicit and container-friendly. (Evidence: watcher.path monitors notify/ directory; adjust-services processes action files)
- **Used by**:
  - `imageroot/systemd/user/watcher.path` — systemd path unit watching %S/state/notify/*_*
  - `imageroot/systemd/user/watcher.service` — triggered by watcher.path; runs runagent adjust-services
  - `imageroot/bin/adjust-services` — reads files named action_service from notify/ and runs systemctl --user action service
  - `imageroot/actions/create-module/80process_notifier` — creates notify/ directory
  - `imageroot/actions/configure-module/80start_services` — enable --now watcher.path
  - `imageroot/actions/transfer-state/49stop_services` — strips watcher.path from service list during transfer
  - `imageroot/systemd/user/freepbx.service` — mounts ./notify:/notify:z into freepbx container

---

### tests
- **Type**: test-suite
- **Path**: `tests/`
- **Purpose**: Robot Framework-based module tests for install/config/runtime validation.
- **Why**: Regression coverage for module lifecycle flows. (Source: test-module.sh — entry point running Robot Framework)
- **Used by**:
  - `test-module.sh` — entry point: runs Robot Framework in a Playwright container
  - `tests/pythonreq.txt` — declares robotframework and robotframework-sshlibrary dependencies
  - `tests/__init__.robot` — suite init file
  - `tests/00_nethvoice_install_dependencies.robot` — installs test dependencies (nethvoice-proxy)
  - `tests/01_nethvoice_add-module.robot` — tests module installation
  - `tests/99_nethvoice_remove-modules.robot` — tests module removal
  - `tests/api.resource` — shared Robot Framework resource file
  - `tests/10_nethvoice_actions/` — action-level integration tests
