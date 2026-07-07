---
parent: Paths
grand_parent: Tancredi API v1
---

# POST /phones/{mac}/tok1

## Create a new Token 1 for the phone

Create a new token 1 for the device, that can be used to start again the provisioning process from the RPS

```text
POST /tancredi/api/v1/phones/01-23-45-67-89-AB/tok1
```

Success response:

    Status: 204 


Failed response:

    Status: 404 Resource not found
    Content-Type: application/problem+json
    Content-Language: en

```json
{
    "type": "https://nethesis.github.io/tancredi/problems/#not-found",
    "title": "Resource not found"
}
```
