---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /models/{name}

## Simple query

Get a model with the given `name`

    GET /tancredi/api/v1/models/acme-19.2

(empty request body)

Success response:

    Status: 200 OK

```json
{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "variables": {
        "var1": "value1",
        "var2": "value2"
    }
}
```

Failed response:

    Status: 404 Not found
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#not-found",
    "title": "Resource not found"
}
```

## Get inherited variables

Get the model `acme-19.2` with inherited variables values, by adding `inherit=1`
parameter to the query string:

    GET /tancredi/api/v1/models/acme-19.2?inherit=1

(empty request body)

Success response:

    Status: 200 OK

```json
{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "variables": {
        "var1": "value1",
        "var2": "value2",
        "var3": "inherited from defaults",
        "var4": "inherited from defaults"
    }
}
```

## Get a past version of a model resource

As a model resource gets modified by subsequent PATCH requests, its past states
could be still available and retrieved from the `version` secondary collection.

Get the version "original" of model `acme-19.2`

    GET /tancredi/api/v1/models/acme-19.2/version/original

(empty request body)

Success response:

    Status: 200 OK

```json
{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "variables": {
        "var1": "original value1",
    }
}
```

Failed response:

    Status: 404 Not found
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#not-found",
    "title": "Resource not found"
}
```
