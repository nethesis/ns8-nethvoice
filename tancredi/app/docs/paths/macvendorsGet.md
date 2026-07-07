---
parent: Paths
grand_parent: Tancredi API v1
---

# GET /macvendors

A **vendor** is identified by a lower case letters and digits string. It has one or more
MAC address prefixes, configured in the `[macvendors]` section of `tancredi.conf`.

## Get list of MAC prefixes associated with vendors

Starting from a phone MAC address it is possible to obtain a list of suitable phone models, before
creating a new _phone_ instance.

    GET /tancredi/api/v1/macvendors

(empty request body)

Response:

    Status: 200 OK

```json
{
    "00A859":"fanvil",
    "0C383E":"fanvil",
    "7C2F80":"gigaset",
    "589EC6":"gigaset",
    "005058":"sangoma",
    "000413":"snom",
    "001565":"yealink",
    "805E0C":"yealink",
    "805EC0":"yealink"
}
```
