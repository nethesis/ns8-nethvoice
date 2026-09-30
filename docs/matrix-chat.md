# Embedded Matrix chat

Each NethVoice instance owns PostgreSQL, Synapse and the Acrobits Application
Service. Enable chat in Settings with one distinct Matrix hostname after the
NethVoice wizard is complete. DNS must point to the NS8 node, and the hostname
must have a trusted TLS certificate.

Only NethVoice users with `nethvoice_cti.chat` can authenticate. Middleware is
the credential and capability authority. Matrix password login does not require
NethVoice OTP in this phase; normal CTI JWT login retains its existing OTP flow.
Internal APIs use a separate loopback listener and a generated service token.
They are never routed through Traefik. PostgreSQL and both HTTP backends also
listen on private instance ports.

Matrix IDs are `@<lowercase-nethvoice-username>:<matrix-host>`. Password login
and the first mobile action provision the same account through supported
Application Service registration. Numeric usernames are supported. The provider
is installed in the pinned Synapse image, with no LDAP authentication or local
password fallback. Public registration and federation are disabled.

Mobile chat uses private, unencrypted one-to-one text rooms. Group rooms,
encrypted rooms and file transfer are outside the mobile integration. Supported
Matrix client APIs remain available for QA. Capability removal blocks new
password logins and every new Acrobits request; existing ordinary Matrix client
access tokens are not revoked automatically.

Acrobits discovers messaging through JWT-authenticated `/api/chat`. A failed
discovery preserves SIP provisioning and omits messaging fields. QR and legacy
token accounts omit chat because the bridge requires password credentials.
Push callbacks use a persistent random gateway key per device, separate from
the actual mobile push token. Prototype installations must register push tokens
again to acquire these keys.

## Persistence and identity

Disabling Matrix removes its routes and disables/stops all three services while
retaining data. Enabling it again uses the same credentials and signing key.
Once initialized, the Matrix hostname cannot change: stored Matrix identities
must not be rewritten.

Normal NS8 backup includes a compressed logical PostgreSQL dump, Synapse media
and signing key, Matrix identity/secrets, and a consistent bridge SQLite
snapshot. Chat writers are briefly stopped together for the database snapshots
and restored to their previous service state even on failure. The live raw
PostgreSQL directory is not the primary backup. Runtime configuration is
regenerated from the restored NS8 environment and `passwords.env`.

Restore and move preserve the Matrix hostname, users, rooms, history and device
state. An independent NS8 clone (`replace:false`) starts with chat disabled,
an empty hostname, fresh secrets and fresh Matrix data. A replacement move
(`replace:true`) preserves the identity. Configure a new hostname on a fresh
independent clone; do not rewrite the original database.

