import asyncio
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location(
    "provider", pathlib.Path(__file__).parents[1] / "nethvoice_auth_provider.py"
)
provider = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provider)

CONFIG = {
    "middleware_auth_url": "http://127.0.0.1:1234/internal/matrix/auth",
    "internal_auth_token": "internal-secret",
    "homeserver_url": "http://127.0.0.1:1235",
    "as_token": "as-secret",
}


class API:
    def __init__(self):
        self.users = set()
        self.callbacks = None

    def register_password_auth_provider_callbacks(self, **kwargs):
        self.callbacks = kwargs

    def get_qualified_user_id(self, user):
        return "@" + user + ":matrix.example.org"

    async def check_user_exists(self, user):
        return user if user in self.users else None


class FakeProvider(provider.NethVoiceAuthProvider):
    def __init__(self, api):
        super().__init__(CONFIG, api)
        self.calls = []
        self.authenticated = True
        self.auth_error = None
        self.register_error = None
        self.register_count = 0

    async def _post_json(self, url, payload, token):
        self.calls.append((url, payload, token))
        await asyncio.sleep(0)
        if url == CONFIG["middleware_auth_url"]:
            if self.auth_error:
                raise self.auth_error
            return {"authenticated": self.authenticated, "username": payload["username"]}
        self.register_count += 1
        expected = self.api.get_qualified_user_id(payload["username"])
        if self.register_error:
            raise self.register_error
        if expected in self.api.users:
            raise provider.HTTPFailure(400, "M_USER_IN_USE")
        self.api.users.add(expected)
        return {"user_id": expected}


class AuthenticationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.api = API()
        self.module = FakeProvider(self.api)

    async def login(self, name="alice", password="secret"):
        return await self.module.check_auth(name, "m.login.password", {"password": password})

    async def test_login_registers_without_device_and_repeats_identity(self):
        expected = ("@alice:matrix.example.org", None)
        self.assertEqual(await self.login(), expected)
        self.assertEqual(await self.login("Alice"), expected)
        self.assertEqual(self.module.register_count, 1)
        self.assertEqual(self.module.calls[1][1], {
            "type": "m.login.application_service", "username": "alice", "inhibit_login": True,
        })
        self.assertEqual(self.module.calls[1][2], "as-secret")

    async def test_numeric_and_mobile_created_users(self):
        self.assertEqual(await self.login("201"), ("@201:matrix.example.org", None))
        self.api.users.add("@bob:matrix.example.org")
        self.assertEqual(await self.login("bob"), ("@bob:matrix.example.org", None))
        self.assertEqual(self.module.register_count, 1)

    async def test_credentials_capability_and_backend_fail_closed(self):
        for error in (provider.HTTPFailure(401), provider.HTTPFailure(403),
                      provider.HTTPFailure(503), TimeoutError("secret must not be logged")):
            self.module.auth_error = error
            with self.assertLogs(provider.logger, "WARNING") as captured:
                self.assertIsNone(await self.login())
            self.assertNotIn("secret", " ".join(captured.output))
        self.assertEqual(self.api.users, set())
        self.assertEqual(self.module.register_count, 0)

    async def test_false_result_never_registers(self):
        self.module.authenticated = False
        self.assertIsNone(await self.login())
        self.assertEqual(self.module.register_count, 0)

    async def test_foreign_reserved_invalid_or_missing_user_inputs(self):
        for name in ("@alice:foreign.example", "_acrobits_proxy", "bad:name", "", "alice@example.org"):
            self.assertIsNone(await self.login(name))
        self.assertIsNone(await self.login(password=""))
        self.assertEqual(self.module.calls, [])
        self.assertEqual(await self.login("@alice:matrix.example.org"), ("@alice:matrix.example.org", None))

    async def test_concurrent_registration(self):
        results = await asyncio.gather(self.login(), self.login())
        self.assertEqual(results, [("@alice:matrix.example.org", None)] * 2)
        self.assertEqual(self.api.users, {"@alice:matrix.example.org"})

    async def test_unavailable_synapse_does_not_authenticate(self):
        self.module.register_error = TimeoutError()
        with self.assertLogs(provider.logger, "WARNING"):
            self.assertIsNone(await self.login())
        self.assertEqual(self.module.register_count, 2)

    async def test_different_existing_case_is_not_adopted(self):
        async def wrong_case(user):
            return "@Alice:matrix.example.org"
        self.api.check_user_exists = wrong_case
        with self.assertLogs(provider.logger, "WARNING"):
            self.assertIsNone(await self.login())


class ConfigurationTests(unittest.TestCase):
    def test_rejects_remote_credentials_query_and_non_loopback(self):
        for url in ("https://remote.example:443", "http://0.0.0.0:8080", "http://user:pass@127.0.0.1:80",
                    "http://127.0.0.1:80?token=secret", "http://localhost:80"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                provider.NethVoiceAuthProvider.parse_config({**CONFIG, "middleware_auth_url": url})

    def test_rejects_empty_service_tokens(self):
        for key in ("as_token", "internal_auth_token"):
            with self.assertRaises(ValueError):
                provider.NethVoiceAuthProvider.parse_config({**CONFIG, key: ""})


if __name__ == "__main__":
    unittest.main()
