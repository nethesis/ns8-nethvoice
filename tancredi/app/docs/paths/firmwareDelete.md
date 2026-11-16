---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /firmware/{file}

## Delete a firmware file

Remove a firmware file from previously uploaded firmware

```text
DELETE /firmware/fw500.rom
```

(empty request body)

Success response:

    Status: 204 No Content

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

or:

    Status: 400

```json
{
    "type": "https://nethesis.github.io/tancredi/problems/#malformed-data",
    "title": "Invalid file name"
}
```
