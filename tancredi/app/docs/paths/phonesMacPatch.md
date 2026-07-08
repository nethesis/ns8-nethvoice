---
parent: Paths
grand_parent: Tancredi API v1
---

# PATCH /phones/{mac}

## Change variable values

Change the `variables` attribute value, and merge them with scope variables. Null variables are removed from scope.

    PATCH /tancredi/api/v1/phones/01-23-45-67-89-AB

```json
{
    "variables": {
        "var1": "value1/changed",
        "var2": "value2"
    }
}
```

Success response:

    Status: 200 OK

```json
{
    "mac": "01-23-45-67-89-AB",
    "short_mac": "0123456789ab",
    "model": "acme-19.2",
    "display_name": "Acme",
    "tok1": "3cb63010-6e80-41ff-9437-c4b1413975db",
    "tok2": "88eebf1d-b860-498f-8bfa-4947e170873b",
    "model_url": "/tancredi/api/v1/models/acme-19.2",
    "provisioning_url1": "https://myexample.com/provisioning/3cb63010-6e80-41ff-9437-c4b1413975db/%MACD.xml",
    "provisioning_url2": "https://myexample.com/provisioning/88eebf1d-b860-498f-8bfa-4947e170873b/%MACD.xml",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
```

## Change the model

Change the `model` value

    PATCH /tancredi/api/v1/phones/01-23-45-67-89-AB

```json
{
    "model": "acme-19.2-custom"
}
```

Success response:

    Status: 200 OK

```json
{
    "mac": "01-23-45-67-89-AB",
    "short_mac": "0123456789ab",
    "model": "acme-19.2-custom",
    "display_name": "Acme",
    "tok1": "3cb63010-6e80-41ff-9437-c4b1413975db",
    "tok2": "88eebf1d-b860-498f-8bfa-4947e170873b",
    "provisioning_url1": "https://myexample.com/provisioning/3cb63010-6e80-41ff-9437-c4b1413975db/%MACD.xml",
    "provisioning_url2": "https://myexample.com/provisioning/88eebf1d-b860-498f-8bfa-4947e170873b/%MACD.xml",
    "model_url": "/tancredi/api/v1/models/acme-19.2-custom",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
```

The `model_url` changes with `model` automatically, so the new resource state
is returned in the response. Also `provisioning_url1` and `provisioning_url2` 
can be changed accordingly.

## Read only attributes

Attributes `mac`, `short_mac`, `tok1`, `tok2`, `provisioning_url1`, `provisioning_url2` are
read-only. Attempt to change their values causes the whole request to fail.

    PATCH /tancredi/api/v1/phones/01-23-45-67-89-AB

```json
{
    "mac": "doesn't work",
    "short_mac": "doesn't work",
    "model_url": "doesn't work",
    "tok1": "doesn't work",
    "tok2": "doesn't work",
    "provisioning_url1": "doesn't work",
    "provisioning_url2": "doesn't work",
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
