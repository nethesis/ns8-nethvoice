---
nav_order: 3
---

# Provisioning flow and security

Tancredi serves provisioning payloads and token-protected assets through
`public/provisioning.php`. The public URL prefix is controlled by
`provisioning_url_path` and defaults to `/provisioning/`.

## Routes

The provisioning entrypoint exposes these routes:

- `GET /check/ping`: returns the configuration file modification time as JSON.
- `GET /{token}/{filename}`: render a provisioning payload for a phone.
- `GET /{token}/{filetype}/{filename}`: serve a protected asset where
  `filetype` is one of `backgrounds`, `firmware`, `ringtones` or
  `screensavers`.
- `GET /{filename}`: tokenless bootstrap path for vendors that fetch an initial
  configuration before they can store the tokenized URL.

## Request resolution

For provisioning payload requests, Tancredi resolves the response in five
steps:

1. Match the requested filename against the rules from
  `rw_dir/patterns.d/*.ini` and then `ro_dir/patterns.d/*.ini`, with writable
  files taking precedence over shipped files with the same name.
1. Read the selected rule `scopeid`, template variable name and content type.
1. Load the scope and merge variables in the order `defaults` → `model` →
   `phone`.
1. Apply any configured runtime filters.
1. Render the selected Twig template, checking `rw_dir/templates-custom/`
   before `ro_dir/templates/`.

If no pattern matches, Tancredi returns `404 Not Found`.

## Token model

Each phone has two provisioning tokens:

- `tok1`: first-access token, stored as a file under
  `rw_dir/first_access_tokens/`.
- `tok2`: steady-state token, stored as a file under `rw_dir/tokens/`.

Both tokens are created when the phone is added through the administrative API.

When a request authenticated with `tok2` succeeds, Tancredi invalidates any
remaining `tok1` for that phone. This is the mechanism that marks the device as
fully provisioned.

The phone API exposes both token values and the derived URLs:

- `provisioning_url1`: URL built with `tok1`.
- `provisioning_url2`: URL built with `tok2`.

If you need to restart first-access provisioning, call
`POST /phones/{mac}/tok1`. That rotates only `tok1`; `tok2` remains unchanged.

## Tokenless bootstrap behavior

Some vendors first fetch a configuration file without presenting a token. The
tokenless `GET /{filename}` path is intentionally restricted:

- All variables whose name contains `account_`, `adminpw` or `userpw` are
  blanked before rendering.
- The render context forces `tok2 = tok1`, so the generated bootstrap payload
  can direct the phone to the first-access tokenized URL.
- `provisioning_complete` is left empty.

This path is security-sensitive. It is designed to bootstrap the phone without
leaking line credentials or administrative passwords.

## Runtime variables added during provisioning

Tancredi injects additional variables immediately before rendering:

- `provisioning_complete`: `1` only when the current request is authenticated
  with `tok2`; otherwise it is empty.
- `provisioning_user_agent`: the HTTP user agent sent by the phone.

These variables are not persisted in scope files.

## Protected asset delivery

Assets under `backgrounds/`, `firmware/`, `ringtones/` and `screensavers/` are
served only through the tokenized route. Tancredi checks
`rw_dir/{filetype}/` first and falls back to `ro_dir/{filetype}/`, so packaged
assets can be served while writable overrides still take precedence. Invalid
tokens and missing files both result in `404 Not Found`.

The administrative API continues to upload and delete only the writable copy
under `rw_dir/`.

The `file_reader` configuration controls how files are returned:

- `native`: stream the file from PHP.
- `apache`: return an `X-Sendfile` header.
- `nginx`: return an `X-Accel-Redirect` header.

When `file_reader` is `apache` or `nginx`, the web server must be configured
to serve protected assets from both `rw_dir/{filetype}/` and
`ro_dir/{filetype}/`. Since Tancredi now falls back to packaged assets under
`ro_dir/`, an Apache `XSendFilePath` allowlist or nginx internal redirect
mapping that covers only `rw_dir/` can cause `403` or `404` responses for
existing packaged files.

For Apache with `mod_xsendfile`, add `XSendFilePath` entries for every
protected asset directory under both roots, for example:

```apache
XSendFilePath /usr/share/tancredi/data/backgrounds
XSendFilePath /usr/share/tancredi/data/firmware
XSendFilePath /usr/share/tancredi/data/ringtones
XSendFilePath /usr/share/tancredi/data/screensavers
XSendFilePath /var/lib/tancredi/data/backgrounds
XSendFilePath /var/lib/tancredi/data/firmware
XSendFilePath /var/lib/tancredi/data/ringtones
XSendFilePath /var/lib/tancredi/data/screensavers
```

For nginx with `X-Accel-Redirect`, define internal locations or aliases that
cover the equivalent directories under both `ro_dir/` and `rw_dir/`.