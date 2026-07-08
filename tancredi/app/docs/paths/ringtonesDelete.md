---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /ringtones/{file}

## Delete a ringtones file

Remove a ringtones file previously uploaded

```text
DELETE /ringtones/Kabuto.mp3
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
