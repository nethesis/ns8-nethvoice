#!/usr/bin/env python3
"""
test_openapi_endpoints.py

Simple script to exercise every endpoint in the OpenAPI specification.

Usage:
  python3 test_openapi_endpoints.py --base-url https://myhost/freepbx/rest [--spec path/to/openapi.yaml] [--no-verify]

The script will:
 - load the OpenAPI YAML (default: ../var/www/html/freepbx/rest/openapi.yaml relative to this script)
 - for each path+method build a URL replacing path parameters with sample values
 - send a request using the requests library and print request/response payloads

Notes:
 - This is intended to be run manually against a real server. It does not authenticate by default.
 - You can pass headers via the --header 'Name: value' option multiple times.

"""
import argparse
import base64
import json
import os
import re
import sys
from urllib.parse import urljoin

try:
    import yaml
except Exception:
    print("PyYAML is required. Install with: pip install pyyaml")
    raise

try:
    import requests
except Exception:
    print("requests is required. Install with: pip install requests")
    raise

DEFAULT_SPEC = os.path.join(os.path.dirname(__file__), '..', 'var', 'www', 'html', 'freepbx', 'rest', 'openapi.yaml')


def sample_value_for_schema(schema):
    """Return a simple sample value for a given OpenAPI schema object."""
    if not schema:
        return None
    t = schema.get('type')
    if t == 'string':
        fmt = schema.get('format')
        if fmt == 'date' or fmt == 'date-time':
            return '2020-01-01T00:00:00Z'
        return schema.get('example') or 'sample'
    if t == 'integer':
        return schema.get('example') or 1
    if t == 'number':
        return schema.get('example') or 1.0
    if t == 'boolean':
        return schema.get('example') or False
    if t == 'array':
        item = schema.get('items') or {}
        return [sample_value_for_schema(item)]
    if t == 'object' or 'properties' in schema:
        props = schema.get('properties', {})
        obj = {}
        for k, v in props.items():
            obj[k] = sample_value_for_schema(v)
        return obj
    # fallback
    return schema.get('example') or 'sample'


def build_sample_body(request_body):
    if not request_body:
        return None, None
    # prefer application/json
    content = request_body.get('content', {})
    if 'application/json' in content:
        schema = content['application/json'].get('schema') or {}
        return 'application/json', sample_value_for_schema(schema) or {}
    # fallback to first content type
    for ctype, v in content.items():
        schema = v.get('schema') or {}
        return ctype, sample_value_for_schema(schema) or {}
    return None, None


def replace_path_params(path):
    # replace {param} with sample values
    def repl(m):
        name = m.group(1)
        # heuristics: id or _id -> 1, mac -> 00:11:22:33:44:55, ip -> 127.0.0.1
        lname = name.lower()
        if 'mac' in lname:
            return '001122334455'
        if 'ip' in lname:
            return '127.0.0.1'
        if 'id' in lname or 'extension' in lname or re.match(r'.*id$', lname):
            return '1'
        return 'sample'

    return re.sub(r"\{([^}]+)\}", repl, path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', required=True, help='Base URL where the API is hosted, e.g. https://host/freepbx/rest')
    parser.add_argument('--spec', default=DEFAULT_SPEC, help='Path to openapi.yaml')
    parser.add_argument('--no-verify', action='store_true', help='Do not verify TLS certificates')
    parser.add_argument('--header', action='append', help='Additional header(s) to send: "Name: value"', default=[])
    # auth helpers
    parser.add_argument('--auth-username', help='Username to use for FreePBX header-based auth')
    parser.add_argument('--auth-password', help='Password corresponding to the username')
    parser.add_argument('--auth-secret', help='Shared secret used to compute Secretkey (required with username+password)')
    args = parser.parse_args()

    with open(args.spec, 'r') as f:
        spec = yaml.safe_load(f)

    paths = spec.get('paths', {})

    headers = {}
    for h in args.header:
        if ':' in h:
            name, val = h.split(':', 1)
            headers[name.strip()] = val.strip()

    session = requests.Session()
    session.headers.update({'Accept': 'application/json'})
    session.headers.update(headers)
    verify = not args.no_verify

    # If header-based auth is requested, compute Secretkey = sha1(user + sha1(password) + secret)
    if args.auth_username and args.auth_password and args.auth_secret:
        import hashlib

        inner = hashlib.sha1(args.auth_password.encode('utf-8')).hexdigest()
        secretkey = hashlib.sha1((args.auth_username + inner + args.auth_secret).encode('utf-8')).hexdigest()
        session.headers.update({'User': args.auth_username, 'Secretkey': secretkey})
        print(f"Added header auth for user {args.auth_username}, secretkey {secretkey}")

    # Note: cookie-based login via /login is intentionally not performed by default.

    for path, methods in paths.items():
        for method, op in methods.items():
            method_upper = method.upper()
            url_path = replace_path_params(path)
            full_url = urljoin(args.base_url.rstrip('/') + '/', url_path.lstrip('/'))

            req_headers = dict(session.headers)
            content_type, body_sample = build_sample_body(op.get('requestBody'))
            if content_type:
                req_headers['Content-Type'] = content_type

            print('\n---')
            print(f'Calling {method_upper} {full_url}')
            if content_type and body_sample is not None:
                if content_type == 'application/json':
                    # we'll use requests.json= to send this payload
                    data = None
                    print('Request JSON payload:')
                    print(json.dumps(body_sample, indent=2))
                else:
                    # for other content types, stringify dict/list as JSON, otherwise str()
                    if isinstance(body_sample, (dict, list)):
                        data = json.dumps(body_sample)
                    elif isinstance(body_sample, bytes):
                        data = body_sample
                    else:
                        data = str(body_sample)
                    print(f'Request payload (type {content_type}):')
                    print(data)
            else:
                data = None

            try:
                # when we have a JSON sample, prefer requests.json to let requests encode it
                if content_type == 'application/json' and body_sample is not None:
                    resp = session.request(method_upper, full_url, headers=req_headers, json=body_sample, verify=verify, timeout=30)
                else:
                    resp = session.request(method_upper, full_url, headers=req_headers, data=data, verify=verify, timeout=30)
            except Exception as e:
                print(f'Error calling endpoint: {e}')
                continue

            print(f'Response status: {resp.status_code} {resp.reason}')
            ct = resp.headers.get('Content-Type', '')
            if 'application/json' in ct:
                try:
                    j = resp.json()
                    print('Response JSON:')
                    print(json.dumps(j, indent=2))
                except Exception:
                    print('Response body (invalid JSON):')
                    print(resp.text)
            else:
                print('Response body:')
                print(resp.text[:10000])


if __name__ == '__main__':
    main()
