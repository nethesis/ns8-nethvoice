---
nav_exclude: true
---

# Problems

This is the reference index of error types, as required by [RFC
7807](https://tools.ietf.org/html/rfc7807).

## Phone exists

    The phone mac address is already registered

## Not found

    Resource not found

## Read only attribute

    Cannot change a read-only attribute

## Resource in use

    The resource is in use by other resources and cannot be deleted

## Model exists

    The model name is already registered

## Malformed data

    Data provided are wrong
    Missing MAC Address in POST /phones
    Missing model name in POST /models
    Illega characters in mode name in POST /models. Only [a-z], [A-Z], [0-9], "_", "-" and "." are allowed

## Forbidden

    Access to resource is forbidden with current client privileges

See the `detail` attribute for detailed failure reason. For instance

    "Wrong credentials"

## Invalid file name

    The uploaded file name contains invalid characters.
    Only letters, numbers and the following symbols are allowed:
    "_", "-", "(", ")", "."
