---
has_children: true
has_toc: false
nav_order: 4
---

# Tancredi API v1

Tancredi exposes an administrative API that manages defaults, models, phones
and uploaded provisioning assets.

The API base path is controlled by the `api_url_path` configuration key and is
`/tancredi/api/v1/` by default.

## Data model

The main entities are **defaults**, **model** and **phone**.

Each entity stores a `variables` object used while generating provisioning
payloads. Variable values are serialized as JSON strings in API requests and
responses.

A phone inherits from a model, and models inherit from defaults.

Besides defaults, models and phones, the API also exposes a **vendor** view to
discover supported vendors from MAC prefixes, plus asset collections for
backgrounds, firmware, ringtones and screensavers.

When a phone is created, Tancredi automatically generates:

- `tok1`: first-access provisioning token.
- `tok2`: steady-state provisioning token.
- `provisioning_url1`: provisioning URL using `tok1`.
- `provisioning_url2`: provisioning URL using `tok2`.

## Phone variables inheritance

Defaults, models and phones act as provisioning scopes. At render time,
variables are merged in this order:

1. defaults
2. model
3. phone

The optional `inherit=1` query parameter on scope reads expands inherited
variables in the response.

See [Templates]({{ '/templates' | relative_url }}) for the render pipeline.

## Authentication

Tancredi does not ship a built-in authentication system for the administrative
API. If `auth_class` is configured, the class is loaded from `src/Entity/` and
added as Slim middleware to every API request.

See [API authentication]({{ '/auth' | relative_url }}).

## Media types

If not otherwise stated assume `application/json` media type for both request
and response.

Error responses use media type `application/problem+json` as defined by [RFC
7807](https://tools.ietf.org/html/rfc7807). See also the
[problem types list]({{ '/problems' | relative_url }}).

## String formats

* EUI-48/MAC address (IEEE 802) six groups of two hexadecimal digits, separated
  by hyphens (-) in transmission order (e.g. `01-23-45-67-89-AB`)

## Write restrictions

The API treats these phone attributes as read-only and rejects attempts to
patch them:

- `mac`
- `short_mac`
- `model_url`
- `tok1`
- `tok2`
- `provisioning_url1`
- `provisioning_url2`

To restart first-access provisioning for a phone, use
[POST /phones/{mac}/tok1]({{ '/paths/phonesTok1Post' | relative_url }}) instead
of patching token values directly.
