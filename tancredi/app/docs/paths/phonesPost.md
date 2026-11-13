---
parent: Paths
grand_parent: Tancredi API v1
---

# POST /phones

## Create a new phone

Create a new phone instance and add it to the phone inventory. The following
properties are assigned automatically and must not be supplied:

* `tok1`
* `tok2`
* `model_url`
* `short_mac`


```text
POST /tancredi/api/v1/phones
```

```json
{
    "mac": "01-23-45-67-89-AB",
    "model": "acme-19.2",
    "display_name": "Acme",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
```

Success response:

    Status: 201 Created
    Location: /tancredi/api/v1/phones/01-23-45-67-89-AB

```json
{
    "mac": "01-23-45-67-89-AB",
    "model": "acme-19.2",
    "display_name": "Acme",
    "tok1": "3cb63010-6e80-41ff-9437-c4b1413975db",
    "tok2": "88eebf1d-b860-498f-8bfa-4947e170873b",
    "model_url": "/tancredi/api/v1/models/acme-19.2",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
```

Failed response:

    Status: 409 Conflict
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#phone-exists",
    "title": "The phone mac address is already registered"
}
```
