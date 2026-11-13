---
parent: Paths
grand_parent: Tancredi API v1
---

# DELETE /models/{mac}

## Delete a model

Delete a model.

    DELETE /tancredi/api/v1/model/acme-19.2

(empty request body)

Success response:

    Status: 204 No Content

Failed response 1:

    Status: 409 Conflict
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#resource-in-use",
    "title": "The resource is in use by other resources and cannot be deleted"
}
```

Failed response 2:

    Status: 404 Not found
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems#not-found",
    "title": "Resource not found"
}
```
