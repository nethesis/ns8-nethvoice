# FreePBX 17 / PHP 8.2 / Asterisk 22 upgrade

## Release notes

This upgrade replaces FreePBX 16 and Asterisk 18. Schedule a maintenance window: existing calls drain before services stop, and new calls are unavailable while the FreePBX modules install. CTI, provisioning and other database consumers resume only after FreePBX finishes installation, user synchronization and its final reload. Asterisk starts without the old generated Macro dialplan. A failed required installation, sync or reload fails service startup and the update action.

Call forwarding now uses the forwarding owner's routing context, including CTI profile and hotel restrictions. A user whose profile cannot call a mobile number cannot bypass that restriction by forwarding to that number. PJSIP, IAX2 and legacy SIP peers resolve their own context; a virtual, custom, missing or unsupported device without a resolvable context rejects forwarding with cause 21. There is no fallback to unrestricted `from-internal`. Explicit external ring-group destinations retain their configured routing. Check CF, CFU, CFB, follow-me, ring groups and hotel extensions before deployment. TIM forwarding retains Answer/Ringing before the forwarding return (#7321).

QueueExit and QueueMetrics retain the queue-log format of the previously pinned releases (0.0.1 and release/2.11.0.3). IVR names and the additional master-branch IVR events are not introduced. Existing MP3 files remain supported by `format_mp3`.

Restoring a backup from version 16 runs the schema/catalog/permission migrations before FreePBX starts. Configure preserves administrator-disabled transports. Allocated SIP/IAX/RTP bindings are reapplied after module installation. Historic SQL imports run in a separate background service; a failed import retains its dump for investigation/retry.

The REST dependencies are locked for PHP 8.2. Anonymous REST access is limited to the exact `/freepbx/rest/testauth` path; other routes return 403 before routing. Boss Secretary group changes require a session CSRF token and deletion uses POST. The cleartext Asterisk HTTP listener binds to loopback; remote metrics clients must use the existing HTTPS listener with certificate verification and Basic Auth.

## Legacy SIP trunk conversion and recovery

Asterisk 22 cannot run chan_sip trunks. Initialization automatically converts them to PJSIP and leaves the converted trunks disabled for administrator review. It uses the same Core converter as `fwconsole trunks --convert2pjsip <all/trunkid>`, then disables each converted trunk in both FreePBX and PJSIP. The compatibility error's `--converttopjsip` spelling is incorrect. Existing PJSIP trunks are not converted or disabled.

Conversion runs after module installation and before user synchronization and the final reload, on upgrades, restores and subsequent starts. It runs independently of `admin.MIGRATION_SCRIPT`, including when that marker is already `2` after an earlier failed initialization. Deploying the fixed image allows those installations to retry conversion during normal startup; do not clear the marker or create `freepbx-ready` by hand. Legacy chan_sip **devices** are outside this trunk migration and still require conversion before FreePBX can reload.

Each trunk keeps its ID and general trunk settings, so route references and order remain intact. Before conversion, its complete original trunk row and legacy SIP rows are saved in `asterisk.nethvoice_legacy_sip_trunks.configuration`, keyed by trunk ID. This includes original credentials, registration strings and settings the upstream converter cannot translate. These records contain secrets and belong in private database backups. Conversion does not rewrite external proxy rules; compare them with the converted trunk's outbound proxy and provider settings before activation.

Conversion, original-settings storage and disabling share one InnoDB transaction per trunk. A failed trunk rolls back; earlier completed trunks remain converted and disabled, and the next initialization retries only remaining legacy trunks. Existing PJSIP settings under a legacy trunk's ID, non-transactional tables, or an unexpected conversion result stop initialization for review rather than overwriting data. A later startup does not disable a converted trunk an administrator has already re-enabled.

**Converted trunks do not register or carry calls until reviewed and enabled.** Routes retain their references, but calls through those trunks remain unavailable or follow configured failover. Review credentials, provider addresses and ports, codecs, caller-ID rules, transport/TLS settings, registration/contact details and outbound proxy against the original records. The pinned converter's registration parser assumes a simple `username:password@host` string; more complex strings and legacy-only options need manual correction. Do not treat successful startup as proof that a converted trunk is ready for calls.

After reviewing a trunk in the NethVoice configuration interface, enable only that trunk and apply changes. The equivalent commands below use an example module ID; replace it and `TRUNK_ID` with the intended values:

```sh
runagent -m nethvoice11 fwconsole trunks --list
runagent -m nethvoice11 fwconsole trunks --enable TRUNK_ID
runagent -m nethvoice11 fwconsole reload
```

Verify registration, inbound/outbound calls, route selection, caller ID and proxy traversal in an authorized test environment. Confirm FreePBX and NethCTI remain running with stable restart counters, phonebook updates succeed, and normal chan_sip `tlsenable` remains `no`. If a conversion fails, retain the upgrade snapshot and original database state for diagnosis; full rollback to the previous release still requires the complete pre-upgrade NS8 backup described below.

## Recovery

Take an NS8 backup before upgrading and verify it can be restored to an isolated instance of the previous release. Downgrading the module image against an already migrated FreePBX 17 database is unsupported. Recovery to version 16 requires restoring the pre-upgrade database **and** persistent files, together with the old module/images.

The update additionally retains a private recovery snapshot under the module state directory, `upgrade-backups/pre-freepbx-*`: all MariaDB databases (compressed SQL), generated Asterisk configuration, AGI scripts, AstDB and CTI configuration, plus running image identities and active services. `complete` means the snapshot finished before migration; `succeeded` means initialization and consumer startup completed. These snapshots contain credentials and are mode 0700/0600. They are supplementary recovery data, not full NS8 backups, and are not automatically removed or restored. Review disk usage and remove successful snapshots after acceptance. On failure keep consumers stopped and use the pre-upgrade NS8 backup to restore the old instance, or repair the failed initialization before retrying. Do not retry an update as a substitute for restoring the old schema.

Inspect failures with `systemctl --user status freepbx` and `journalctl --user -u freepbx`. In the container, `/var/run/nethvoice/freepbx-failed` indicates a required startup step failed; `/var/run/nethvoice/freepbx-ready` exists only after successful initialization. Background imports use `nethvoice-restore-background.service` and retain failed SQL files.

## Acceptance test on a disposable NS8 cluster

These checks require a real version-16 instance, an old backup and test SIP trunks/phones. They are not replaced by mocked lifecycle tests or image smoke tests. Record image identifiers, timestamps, action results and redacted logs. Do not deploy until the following checks pass.

1. Configure a version-16 instance with two PJSIP users, a restricted CTI profile, an IAX peer, virtual/custom extensions, a ring group, a queue, a gateway, voicemail, custom MP3 audio and hotel settings. Disable TCP or TLS explicitly. Save database bindings, transport enablement and a full NS8 backup.
2. Place an internal and a trunk call, start the upgrade and verify both existing calls survive until hangup. Measure the outage from the last accepted call until `freepbx-ready`. Confirm that CTI/provisioning consumers stay stopped during module installation and that no old `Macro()` dialplan handles calls in Asterisk 22.
3. Verify the recovery snapshot was completed before SQL migration. After readiness compare `sipsettings`, `iaxsettings`, `kvstore_Sipsettings` and generated transport/RTP files against allocated ports. Disabled transports must stay disabled. Check that `endpointman` is no longer enabled.
4. Exercise inbound/outbound calls, CF/CFU/CFB, follow-me and ring groups with permitted and forbidden external numbers, missing peers and hotel contexts. Confirm restricted forwards fail, permitted IAX/PJSIP forwards work, and TIM forwards produce the expected Answer/Ringing response. Exercise pickup, paging transfers, RecallOnBusy, PINs with leading zeroes, lazy queue members and streaming clients.
5. Inject a required module installation failure and then a reload failure in separate disposable restores. Verify startup/update fail, downstream services remain stopped and recovery files remain. Restore the pre-upgrade NS8 backup to the old release and verify calls, credentials, files and database contents; never just switch the image tag back.
6. Restore the old backup directly into the new release. Verify provider/gateway catalogs, `rest_pjsip_trunks_custom_flags`, phonebook permissions 10/14 and bindings. Run configure a second time and confirm it neither re-enables transports nor re-grants administrator-revoked permissions. Verify historic CDR import does not block the action.
7. Complete the wizard and exercise gateway create/edit/push failure, notification write failure, CSV sync failure, users without extensions, and physical-device line selection. Test REST without headers on `/users/testauth`, `/trunks/testauth` and PUT `/cti/customer_card/template/testauth`: all must return 403. Test valid auth, invalid auth, JSON errors and OPTIONS. Check Boss Secretary POST/CSRF, malicious labels and group IDs, queue reports, MP3 playback and authenticated HTTPS metrics.
8. Restore synthetic enabled and disabled chan_sip trunks with credentials, registration, inbound/outbound routes and proxy configuration. Verify initialization converts both to PJSIP with the same IDs, disables them in both trunk settings, retains the original configuration records, and leaves existing PJSIP trunks unchanged. Repeat with `MIGRATION_SCRIPT=2` and after a failed initialization. Inject a conversion failure and verify rollback of that trunk, then retry without duplicating earlier conversions. Review and enable one converted trunk, restart, and verify it stays enabled. Compare credentials, routes and proxy settings, then complete the service, phonebook, registration and call checks above. Confirm remaining chan_sip devices still trigger FreePBX's compatibility check.

## Automated checks

Run `python3 -m unittest discover -s tests/unit -v`, prepare pinned sources with `python3 tools/prepare-freepbx-test-sources.py /tmp/freepbx-test-sources`, and run `sh tools/test-freepbx.sh /tmp/freepbx-test-sources` with PHP 8.2 and locked REST dependencies installed. The source downloader verifies the image's SHA-256 pins and applies patches with `--fuzz=0`. Run `tools/check-php.sh` for syntax and PHPCompatibility. The image build workflow runs `runtime_compatibility_test.sh` and `prometheus_test.sh` in isolated containers.

With a disposable MariaDB accepting root with an empty password, run `php local_testing/legacy_sip_trunks_test.php 'mysql:host=127.0.0.1;port=3306' /tmp/freepbx-test-sources`. It creates and removes its own test database, refuses to overwrite an existing database, and exercises the pinned Core converter, PJSIP driver and key/value writer with real transactions. It checks disabling, original settings, credentials, proxy settings, route references, a failure after legacy-row deletion, retry and repeat execution with an existing migration marker.
