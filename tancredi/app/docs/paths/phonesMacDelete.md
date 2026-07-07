---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /phones/{mac}

## Delete a phone

Remove a phone from the inventory.

    DELETE /tancredi/api/v1/phones/01-23-45-67-89-AB

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

