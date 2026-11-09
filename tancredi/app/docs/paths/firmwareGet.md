---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /firmware

## Simple query

Get the list of firmware files uploaded by the user

```text
GET /firmware
```

(empty request body)

Success response:

    Status: 200 OK

```json
[
    {"name": "firmware1", "size": 38491164, "mtime": 1568203320 },
    {"name": "firmware2", "size": 42174822, "mtime": 1568203320 },
    {"name": "firmware3", "size": 103237501, "mtime": 1568203320 }
]
```
