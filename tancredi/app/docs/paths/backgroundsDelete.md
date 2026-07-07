---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /backgrounds/{file}

## Delete a backgrounds file

Remove a backgrounds file previously uploaded

```text
DELETE /backgrounds/mountains.png
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
