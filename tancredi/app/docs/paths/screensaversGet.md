---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /screensavers

## Simple query

Get the list of screensaver files uploaded by the user

```text
GET /screensavers
```

(empty request body)

Success response:

    Status: 200 OK

```json
[
    {"name": "screen.jpeg", "size": 38491164, "mtime": 1568203320 },
    {"name": "screen2.png", "size": 42174822, "mtime": 1568203320 },
    {"name": "screen2.jpeg", "size": 103237501, "mtime": 1568203320 }
]
```
