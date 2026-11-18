---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /defaults

## Simple query

Get the default values of known variables.

    GET /defaults

(empty request body)

Success response:

    Status: 200 OK

```json
{
    "var1": "value1",
    "var2": "value2"
}
```

Each entity attribute represents a **variable** for phones and models templates.
