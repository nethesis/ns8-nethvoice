---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /ringtones

## Simple query

Get the list of ringtone files uploaded by the user

```text
GET /ringtones
```

(empty request body)

Success response:

    Status: 200 OK

```json
[
    {"name": "Kabuto.mp3", "size": 38491164, "mtime": 1568203320 },
    {"name": "InFlames.mp3", "size": 42174822, "mtime": 1568203320 },
    {"name": "ringring.wav", "size": 103237501, "mtime": 1568203320 }
]
```
