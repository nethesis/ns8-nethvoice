---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /backgrounds

## Simple query

Get the list of background files uploaded

```text
GET /backgrounds
```

(empty request body)

Success response:

    Status: 200 OK

```json
[
    {"name": "mountains.png", "size": 38491164, "mtime": 1568203320 },
    {"name": "cat.jpg", "size": 42174822, "mtime": 1568203320 }
]
```
