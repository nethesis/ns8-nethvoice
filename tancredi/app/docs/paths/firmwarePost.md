---
parent: Paths
grand_parent: Tancredi API v1
---

# POST /firmware

## Upload a firmware file

Upload a firmware file that could be used in scopes. The POST payload is `multipart/form-data` (see [HTTP POST method]([HTTP POST method](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)) for details).

Example request:
```text
POST /tancredi/api/v1/firmware HTTP/1.1
User-Agent: curl/7.29.0
Host: 192.168.122.76
Accept-Encoding: deflate, gzip
Accept: application/json, text/plain, */*
User: admin
Secretkey: 71531d20e69d0e9d83a666e9b4fd5fae11dcdbb1
Content-Length: 746285
Expect: 100-continue
Content-Type: multipart/form-data; boundary=--------------------
--------3d6bc1ab5f55

------------------------------3d6bc1ab5f55
Content-Disposition: form-data; name="firmware"; filename="fw.bin"
Content-Type: application/octet-stream

```


```text
POST /firmware
```

Success response:

    Status: 204

Failed response:

    Status: 400

```json
{
    "type": "https://nethesis.github.io/tancredi/problems/#invalid-file-name",
    "title": "Invalid file name"
}
```

Failed response:

    Status: 404

```json
{
    "type": "https://nethesis.github.io/tancredi/problems/#not-found",
    "title": "Resource not found"
}
```
