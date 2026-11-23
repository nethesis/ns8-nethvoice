---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /screensavers/{file}

## Delete a screensavers file

Remove a screensavers file from previously uploaded screensavers

```text
DELETE /screensavers/screen.jpeg
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
