---
parent: Paths
grand_parent: Tancredi API v1
---

# PATCH /defaults

Each entity attribute represents a **variable** for phones and models templates.

## Change an existing attribute

To change the value of an existing attribute, just set it to the new value.

    PATCH /defaults

```json
{
    "var2": "new var2 value"
}
```

Success response:

    Status: 204 No Content

Empty response - the new defaults resource differs only by the `var2` value.

## Remove an existing attribute

To remove an existing default value for a attribute set it to `null`.

    PATCH /defaults

```json
{
    "var2": null
}
```

Success response:

    Status: 200 OK

```json
{
    "var1": "value1",
}
```

The new resource state is returned in the response payload.

## Create a new attribute

To create a new attribute, just assign a attribute to it.

    PATCH /defaults

```json
{
    "var3": "new var here!"
}
```

Success response:

    Status: 204 No Content

Empty response - the new defaults resource differs only by the presence of the
`var3` key and its value.
