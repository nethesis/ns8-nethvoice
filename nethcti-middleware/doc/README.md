# Documentation and examples files

## OpenAPI spec

`openapi.yaml` documents the HTTP API exposed by the middleware. It includes authentication endpoints, 2FA flows, phonebook operations (including import endpoints), and administrative endpoints such as `/admin/phonebook/import`.


## Profiles

`../store/default_profiles.json` is the authoritative reference for roles and permissions used by the middleware. Each profile entry describes a named role (for example `Base`, `Standard`, `Advanced`) and provides a `macro_permissions` object grouping feature toggles and granular permissions.

Structure (high level):

- `id` (string): Numeric identifier for the profile.
- `name` (string): Human readable profile name.
- `macro_permissions` (object): Groups of feature flags. Each group contains a `value` boolean and a `permissions` array with permission objects having `id`, `name`, and `value`.

Example snippet from `profiles.json`:

```
"3": {
	"id": "3",
	"name": "Advanced",
	"macro_permissions": {
		"settings": { "value": true, "permissions": [ {"id":"2","name":"dnd","value":true} ] },
		"phonebook": { "value": true, "permissions": [ {"id":"12","name":"ad_phonebook","value":true} ] }
	}
}
```

Notes:

- Use `profiles.json` as the canonical permissions reference when checking or adding new capabilities.
- Each permission `id` can be used programmatically to gate UI features or API behaviors.

## Users

`users.json` contains sample user profiles keyed by username. Each user entry includes personal metadata and a `profile_id` that references a profile in `profiles.json`.

Structure (high level):

- Key: username (string)
- `name` (string): Full name.
- `endpoints` (object): Phone endpoint definitions and credentials (e.g., `extension`, `webrtc` credentials, `email`, `jabber`, `cellphone`).
- `profile_id` (string): References a profile `id` from `profiles.json`.

Example snippet from `users.json`:

```
"giacomo": {
	"name": "Giacomo Rossi",
	"endpoints": { "extension": { "201": { "type": "webrtc", "user": "201" } } },
	"profile_id": "3"
}
```

The `profile_id` must match an existing profile in `profiles.json` or behavior may be undefined.



