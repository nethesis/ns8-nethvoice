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
},{
    "name": "acme-19.2",
    "display_name": "Acme IP phone v19 rev. 2",
    "model_url": "/tancredi/api/v1/models/acme-19.2",
}]
```

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
