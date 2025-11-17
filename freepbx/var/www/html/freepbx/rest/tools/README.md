# test_openapi_endpoints.py

Small helper script to exercise the FreePBX REST OpenAPI endpoints.

Purpose
 - Load an OpenAPI YAML file and call every path+method defined in it.
 - Print the request payload (when available) and the response status/body.

Requirements
 - Python 3.8+
 - PyYAML
 - requests

Install dependencies:

```bash
pip3 install pyyaml requests
```

Location
 - Script: `tools/test_openapi_endpoints.py`
 - Default OpenAPI spec: `../var/www/html/freepbx/rest/openapi.yaml` (relative to the tools folder)

Usage
```bash
python3 tools/test_openapi_endpoints.py --base-url https://your-host/freepbx/rest
```

Example:
```bash
python test_openapi_endpoints.py --base-url https://voice.gs.nethserver.net/freepbx/rest --spec ../openapi.yaml --auth-username admin --auth-password Nethesis,1234 --auth-secret uRraJcbZSAFyVZhxNT3xAQU3QAc6fD14
```

The auth-secret is the `NETHVOICESECRETKEY` environment variable found inside the `passwords.env` file.
To retrieve it, 
```bash
runagent -m nethvoice1 grep NETHVOICESECRETKEY passwords.env | cut -d '=' -f2
```


Options
 - `--base-url` (required): Base URL where the API is hosted (example: `https://10.0.0.5/freepbx/rest`).
 - `--spec`: Path to the OpenAPI YAML file (defaults to the repository location).
 - `--no-verify`: Do not verify TLS certificates (useful for self-signed test servers).
 - `--header "Name: value"`: Add one or more HTTP headers to every request (repeatable).
 - `--auth-username`, `--auth-password`, `--auth-secret`: Compute header-based FreePBX auth. When all three are provided the script will compute the `Secretkey` header as SHA1(user + SHA1(password) + secret) and add both `User` and `Secretkey` headers to every request.
Note: cookie-based login via `GET /login` is intentionally not performed by this script. Use header-based auth with `--auth-username/--auth-password/--auth-secret` or add custom headers with `--header`.

Examples

Run against a local test server where FreePBX REST is mounted:

```bash
python3 tools/test_openapi_endpoints.py --base-url https://localhost/freepbx/rest --no-verify
```

Run while supplying authentication headers (example):

```bash
python3 tools/test_openapi_endpoints.py \
  --base-url https://10.0.0.5/freepbx/rest \
  --auth-username admin --auth-password 'password' --auth-secret 'sharedsecret' \
  --no-verify
```

Safety notes
 - The script invokes every endpoint defined in the OpenAPI file, including POST, PATCH and DELETE methods. That may modify or delete data on the target system.
 - Do NOT run this against production servers unless you understand the effects or restrict the run (e.g., by editing the spec or using a test-only copy).
 - If you only want to exercise safe endpoints, run the script against a copy of the spec trimmed to only the desired paths or modify the script to skip non-GET methods.

Implementation details
 - The script generates simple sample values for path parameters (e.g. `1` for ids, `127.0.0.1` for ip-like names, `001122334455` for mac-like names).
 - For request bodies it prefers `application/json` and builds a minimal JSON payload from the schema `type`/`properties` when available.

If you want me to:
 - Add a `--safe-only` flag to skip non-GET methods,
 - Add an auth helper (e.g., call `/testauth` and automatically set headers), or
 - Produce curl commands instead of executing them,
say which and I will add it.
