---
parent: Paths
grand_parent: Tancredi API v1
---

# PATCH /models/{name}

## Change the resource attributes

Change the `variables` attribute value, and merge them with scope variables. Null variables are removed from scope.
Also display_name is changed.

    PATCH /tancredi/api/v1/models/acme-19.2

```json
{
    "display_name": "Acme IP phone v19 rev. 2 (changed)",
    "variables": {
        "var1": "value1-changed",
        "var2": "value2"
    }
}
```

Success response:

    Status: 200 OK

```json
{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2 (changed)",
    "variables": {
        "var1": "value1-changed",
        "var2": "value2"
    }
}
```

## Read only attributes

The attribute `name` is read-only. Attempt to change its value causes the whole
request to fail.

    PATCH /tancredi/api/v1/models/acme-19.2

```json
{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2 (allowed, but not applied)"
}
```

Failed response:

    Status: 403 Forbidden
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#read-only-attribute",
    "title": "Cannot change a read-only attribute"
}
```
