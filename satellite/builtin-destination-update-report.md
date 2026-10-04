# Built-in destination fallback editing — 4 October 2026

Target: `nethvoice51`, node 1 on `makako.sf.nethserver.net` (Rocky Linux 9.8).
The user authorized changing built-in destinations and updating this instance
immediately. The change allows editing their fallback connections in VisualPlan
and through the FreePBX destination form. Built-in identity, destination IDs,
deletion protection, and fallback cycle validation are retained.

## Installed source and deployment

- Repository baseline: `1e3a1069`, branch `agent`; changes remain in the workspace.
- Installed NethVoice: `ghcr.io/nethesis/nethvoice:agent`, module digest
  `sha256:80145e5b8c46ff4b62b3fca2426975486a0fa10960c4ce4a577982a64b90e40b`.
- Node-local proxy: `nethvoice-proxy1`, `1.7.3-testing.6`.
- Runtime: PHP 8.2.34, Asterisk 22.10.0.
- Installed module actions were inspected; none provides a source-only update.
  Five authoritative PHP files were updated inside the running FreePBX container.
  Each original SHA-256 matched the repository baseline before deployment.
  Staged PHP syntax passed, owner/mode/context were preserved, replacements were
  atomic per file, and all resulting hashes matched the workspace source.
- No module upgrade, service restart, dialplan reload, route change, test call,
  or persistent configuration write was performed. This direct source hotfix
  has no NS8 API mutation/audit row. It must be included in a rebuilt image to
  survive container recreation; the installed image digest is unchanged.

## Verification

The Agent save service, VisualPlan graph, VisualPlan visualization, and Agent
dialplan suites passed locally. Added regressions cover built-in fallback edits
and clearing, preservation of identity, and rejection of cyclic fallbacks.
Read-only live checks passed for both built-in agents: service validation,
VisualPlan fallback connections, identity protection, cycle rejection, and
destination form rendering. PHP timestamp cache validation is enabled.

FreePBX and Satellite remain active with `NRestarts=0`; Asterisk uptime and last
reload confirm no restart/reload occurred. Both before and after checks reported
zero active calls and channels. All application containers remained running and
the configured web host was present in Traefik routes. Journal entries after the
patch were existing FreePBX deprecated-function notices; no Satellite errors
were found. An optional certificate query was rejected by automatic approval
review because its response might include private key material; it was omitted.
No credentials, recordings, transcripts, or call records were retrieved.

## Rollback

Verified original files, source hash manifest, installer, and read-only live
check script are retained in the root-only directory
`/var/tmp/nethvoice51-builtin-destinations-20261004/` on the node.
Rollback is unused and available through:

```sh
python3 /var/tmp/nethvoice51-builtin-destinations-20261004/deploy.py --rollback
```

The rollback verifies all installed hashes against this patch before replacing
files, validates the saved PHP source, preserves file metadata, and verifies
the restored original hashes. It aborts if subsequent changes altered the files.
