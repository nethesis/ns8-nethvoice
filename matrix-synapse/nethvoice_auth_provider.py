"""Synapse password authentication backed exclusively by NethVoice middleware."""

import io
import ipaddress
import json
import logging
import re
from urllib.parse import urlsplit

logger = logging.getLogger(__name__)
LOCALPART = re.compile(r"^[a-z0-9._=/\-]+$")
RESERVED_USER = "_acrobits_proxy"


class HTTPFailure(Exception):
    """Safe HTTP failure: do not retain or log a credential-bearing response."""

    def __init__(self, status, errcode=None):
        super().__init__("Matrix integration HTTP request failed")
        self.status = status
        self.errcode = errcode


def loopback_url(value, name):
    parsed = urlsplit(value)
    try:
        loopback = ipaddress.ip_address(parsed.hostname).is_loopback
        port = parsed.port
    except (ValueError, TypeError):
        loopback = False
        port = None
    if (parsed.scheme != "http" or not loopback or not port or parsed.username
            or parsed.password or parsed.query or parsed.fragment):
        raise ValueError(name + " must be an HTTP loopback URL with a port")
    return value.rstrip("/")


class NethVoiceAuthProvider:
    @staticmethod
    def parse_config(config):
        result = dict(config)
        for name in ("internal_auth_token", "as_token"):
            value = result.get(name)
            if not isinstance(value, str) or not value or "\r" in value or "\n" in value:
                raise ValueError(name + " must be a nonempty service credential")
        for name in ("middleware_auth_url", "homeserver_url"):
            result[name] = loopback_url(result.get(name, ""), name)
        timeout = result.get("request_timeout_seconds", 5)
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 30:
            raise ValueError("request_timeout_seconds must be between 0 and 30")
        result["request_timeout_seconds"] = timeout
        return result

    def __init__(self, config, api):
        self.config = self.parse_config(config)
        self.api = api
        api.register_password_auth_provider_callbacks(
            auth_checkers={("m.login.password", ("password",)): self.check_auth}
        )

    async def _post_json(self, url, payload, token):
        # post_json_get_json logs its complete JSON body at DEBUG, including
        # passwords. Use the lower-level supported client instead.
        from twisted.internet import reactor
        from twisted.internet.defer import ensureDeferred
        from twisted.web.http_headers import Headers
        from synapse.http.client import read_body_with_max_size

        async def request():
            response = await self.api.http_client.request(
                "POST", url,
                data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
                headers=Headers({
                    b"Content-Type": [b"application/json"],
                    b"Accept": [b"application/json"],
                    b"Authorization": [b"Bearer " + token.encode("utf-8")],
                }),
            )
            body = io.BytesIO()
            await read_body_with_max_size(response, body, 65536)
            try:
                result = json.loads(body.getvalue())
            except (ValueError, UnicodeError):
                raise HTTPFailure(response.code) from None
            if not isinstance(result, dict):
                raise HTTPFailure(response.code)
            if not 200 <= response.code < 300:
                raise HTTPFailure(response.code, result.get("errcode"))
            return result

        operation = ensureDeferred(request())
        operation.addTimeout(self.config["request_timeout_seconds"], reactor)
        return await operation

    def _username(self, user):
        if not isinstance(user, str):
            return None
        if user.startswith("@"):
            localpart, separator, server = user[1:].partition(":")
            if not separator or self.api.get_qualified_user_id(localpart) != user:
                return None
            user = localpart
        username = user.lower()
        if not LOCALPART.fullmatch(username) or username == RESERVED_USER:
            return None
        return username

    async def _ensure_user(self, username):
        expected = self.api.get_qualified_user_id(username)
        existing = await self.api.check_user_exists(expected)
        if existing:
            return existing == expected
        url = self.config["homeserver_url"] + "/_matrix/client/v3/register"
        for attempt in range(2):
            try:
                response = await self._post_json(url, {
                    "type": "m.login.application_service",
                    "username": username,
                    "inhibit_login": True,
                }, self.config["as_token"])
                return response.get("user_id") == expected
            except HTTPFailure as error:
                if error.errcode != "M_USER_IN_USE":
                    return False
                return await self.api.check_user_exists(expected) == expected
            except Exception:
                # Registration may commit before a transport timeout. Never
                # accept a different casing or an unrelated existing identity.
                if await self.api.check_user_exists(expected) == expected:
                    return True
                if attempt:
                    return False
        return False

    async def check_auth(self, user, login_type, login_dict):
        username = self._username(user)
        password = login_dict.get("password")
        if login_type != "m.login.password" or not username or not isinstance(password, str) or not password:
            return None
        try:
            response = await self._post_json(self.config["middleware_auth_url"], {
                "username": username, "password": password,
            }, self.config["internal_auth_token"])
            if response.get("authenticated") is not True or response.get("username") != username:
                return None
            if not await self._ensure_user(username):
                logger.warning("NethVoice Matrix account provisioning failed")
                return None
            return self.api.get_qualified_user_id(username), None
        except Exception:
            # Never log the exception, response, request body, or credentials.
            logger.warning("NethVoice Matrix authentication failed")
            return None
