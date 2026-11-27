---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /models

## Retrieve all models

Retrieve the complete (phone) models collection.

    GET /tancredi/api/v1/models

(empty request body)

Response:

    Status: 200 OK

```json
[{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "model_url": "/tancredi/api/v1/models/acme-19.2",
    "last_edit_time": 1795167778
},{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "model_url": "/tancredi/api/v1/models/acme-19.2",
    "last_edit_time": null
}]
```

`last_edit_time` is the Unix timestamp, in seconds, of the last change written
to the model itself (POST, PATCH or an upgrade script). Changes to the defaults
are not counted. It is `null` when the model was never changed, such as a
shipped model used as it is.

## Collection filtering

### Filter by usage

Select the models that are referenced by phone instances (The phone attribute
`model` is equal to the model `name` attribute).

    GET /tancredi/api/v1/models?filter[used]

(empty request body)

Response:

    Status: 200 OK

```json
[]
```
