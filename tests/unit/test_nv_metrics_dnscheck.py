#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import importlib.util
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import dnscheck  # noqa: E402

ENV = {
    "NETHVOICE_HOST": "voice.example.com",
    "NETHCTI_UI_HOST": "cti.example.com",
    "NETHVOICE_PROXY_FQDN": "proxy.example.com",
}


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


def fake_query(answers, clock=None, delays=None):
    """answers: {name: list of IPs | NameNotFound | ResolverUnreachable}
    delays: {name: seconds the answer takes on clock}"""
    calls = []

    def query(name):
        calls.append(name)
        if clock is not None:
            clock.now += (delays or {}).get(name, 0.0)
        answer = answers.get(name, dnscheck.ResolverUnreachable())
        if isinstance(answer, Exception):
            raise answer
        return answer

    query.calls = calls
    return query


class LookupTest(unittest.TestCase):
    def test_records_and_response_time(self):
        clock = FakeClock()
        query = fake_query({"a.example.com": ["1.2.3.4"]}, clock, {"a.example.com": 0.25})
        self.assertEqual(dnscheck.lookup("a.example.com", query, clock), (["1.2.3.4"], 0.25))
        self.assertEqual(query.calls, ["a.example.com"])

    def test_name_not_found_is_an_answer(self):
        clock = FakeClock()
        query = fake_query({"a.example.com": dnscheck.NameNotFound()}, clock, {"a.example.com": 4})
        self.assertEqual(dnscheck.lookup("a.example.com", query, clock), ([], 4))

    def test_no_answer_takes_the_whole_lifetime(self):
        self.assertEqual(dnscheck.lookup("a.example.com", fake_query({}), FakeClock()), (None, dnscheck.LIFETIME))


class RenderTest(unittest.TestCase):
    def render(self, answers, env=ENV, proxy_ips=("203.0.113.5",), delays=None):
        clock = FakeClock()
        return dnscheck.render(env, fake_query(answers, clock, delays), list(proxy_ips), clock)

    def test_all_names_resolve(self):
        answers = {
            "voice.example.com": ["203.0.113.1"],
            "cti.example.com": ["203.0.113.1"],
            "proxy.example.com": ["203.0.113.5"],
        }
        text = self.render(answers, delays={"voice.example.com": 0.0125, "cti.example.com": 3.5})
        self.assertIn('nethvoice_dns_resolves{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_dns_resolves{name="cti.example.com",role="cti"} 1\n', text)
        self.assertIn('nethvoice_dns_resolves{name="proxy.example.com",role="proxy"} 1\n', text)
        self.assertIn(
            'nethvoice_dns_proxy_ip_match{expected="203.0.113.5",name="proxy.example.com",records="203.0.113.5"} 1\n',
            text,
        )
        self.assertIn('nethvoice_dns_resolver_up{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_dns_resolver_up{name="cti.example.com",role="cti"} 1\n', text)
        self.assertIn('nethvoice_dns_resolver_up{name="proxy.example.com",role="proxy"} 1\n', text)
        self.assertIn('nethvoice_dns_response_seconds{name="voice.example.com",role="nethvoice"} 0.013\n', text)
        self.assertIn('nethvoice_dns_response_seconds{name="cti.example.com",role="cti"} 3.500\n', text)
        self.assertIn('nethvoice_dns_response_seconds{name="proxy.example.com",role="proxy"} 0.000\n', text)

    def test_nxdomain_is_failure(self):
        answers = {
            "voice.example.com": dnscheck.NameNotFound(),
            "cti.example.com": ["203.0.113.1"],
            "proxy.example.com": dnscheck.NameNotFound(),
        }
        text = self.render(answers)
        self.assertIn('nethvoice_dns_resolves{name="voice.example.com",role="nethvoice"} 0\n', text)
        # The resolver answered: it is up, and the answer has a time
        self.assertIn('nethvoice_dns_resolver_up{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_dns_response_seconds{name="voice.example.com",role="nethvoice"} 0.000\n', text)
        # A name that does not resolve is not compared with the proxy IPs
        self.assertNotIn("nethvoice_dns_proxy_ip_match{", text)

    def test_proxy_ip_mismatch(self):
        answers = {"proxy.example.com": ["198.51.100.9", "198.51.100.1"]}
        text = self.render(answers, env={"NETHVOICE_PROXY_FQDN": "proxy.example.com"}, proxy_ips=("203.0.113.5", "10.5.4.1"))
        self.assertIn(
            'nethvoice_dns_proxy_ip_match{expected="203.0.113.5,10.5.4.1",name="proxy.example.com",records="198.51.100.1,198.51.100.9"} 0\n',
            text,
        )

    def test_proxy_private_ip_matches(self):
        # Split DNS: the resolver of the node returns the private IP
        answers = {"proxy.example.com": ["10.5.4.1"]}
        text = self.render(answers, env={"NETHVOICE_PROXY_FQDN": "proxy.example.com"}, proxy_ips=("203.0.113.5", "10.5.4.1"))
        self.assertIn(
            'nethvoice_dns_proxy_ip_match{expected="203.0.113.5,10.5.4.1",name="proxy.example.com",records="10.5.4.1"} 1\n',
            text,
        )

    def test_proxy_ip_unknown_is_not_compared(self):
        answers = {"proxy.example.com": ["198.51.100.9"]}
        text = self.render(answers, env={"NETHVOICE_PROXY_FQDN": "proxy.example.com"}, proxy_ips=())
        self.assertNotIn("nethvoice_dns_proxy_ip_match{", text)

    def test_unanswered_name_is_resolver_down_not_slow(self):
        answers = {"voice.example.com": ["203.0.113.1"]}
        text = self.render(answers)
        self.assertIn('nethvoice_dns_resolves{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_dns_resolver_up{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_dns_resolver_up{name="cti.example.com",role="cti"} 0\n', text)
        # No answer: no resolves series and no response time, the timeout is not a measurement
        self.assertNotIn('nethvoice_dns_resolves{name="cti.example.com"', text)
        self.assertNotIn('nethvoice_dns_response_seconds{name="cti.example.com"', text)

    def test_resolver_down_is_down_for_every_name(self):
        text = self.render({})
        self.assertNotIn("nethvoice_dns_resolves{", text)
        self.assertNotIn("nethvoice_dns_response_seconds{", text)
        self.assertEqual(text.count("} 0\n"), 3)
        self.assertEqual(text.count("nethvoice_dns_resolver_up{"), 3)
        self.assertIn("# TYPE nethvoice_dns_resolver_up gauge\n", text)

    def test_empty_and_duplicate_names_are_skipped(self):
        env = {"NETHVOICE_HOST": "voice.example.com", "NETHCTI_UI_HOST": "voice.example.com", "NETHVOICE_PROXY_FQDN": ""}
        query = fake_query({"voice.example.com": ["203.0.113.1"]})
        text = dnscheck.render(env, query, [], FakeClock())
        self.assertEqual(text.count("nethvoice_dns_resolves{"), 1)
        self.assertEqual(text.count("nethvoice_dns_response_seconds{"), 1)
        self.assertEqual(query.calls, ["voice.example.com"])

    def test_proxy_sharing_the_nethvoice_name_is_compared(self):
        env = {"NETHVOICE_HOST": "voice.example.com", "NETHVOICE_PROXY_FQDN": "voice.example.com"}
        query = fake_query({"voice.example.com": ["198.51.100.9"]})
        text = dnscheck.render(env, query, ["203.0.113.5"], FakeClock())
        self.assertEqual(text.count("nethvoice_dns_resolves{"), 1)
        self.assertIn('nethvoice_dns_resolves{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn(
            'nethvoice_dns_proxy_ip_match{expected="203.0.113.5",name="voice.example.com",records="198.51.100.9"} 0\n',
            text,
        )
        self.assertEqual(query.calls, ["voice.example.com"])

    def test_reserved_labels_are_never_set(self):
        text = self.render({"voice.example.com": ["203.0.113.1"]})
        self.assertNotRegex(text, r"(module|module_id|instance)=")


class ProxyAddressesTest(unittest.TestCase):
    def test_addresses_of_the_proxy_with_the_fqdn(self):
        providers = [
            {"fqdn": "other.example.com", "public_address": "198.51.100.1"},
            {"fqdn": "proxy.example.com", "public_address": "203.0.113.5", "address": "10.5.4.1"},
        ]
        self.assertEqual(dnscheck.proxy_addresses("proxy.example.com", providers), ["203.0.113.5", "10.5.4.1"])

    def test_unknown(self):
        self.assertEqual(dnscheck.proxy_addresses("proxy.example.com", []), [])

    def test_empty_and_duplicate_addresses_are_skipped(self):
        providers = [{"fqdn": "proxy.example.com", "public_address": "", "address": "203.0.113.5"}]
        self.assertEqual(dnscheck.proxy_addresses("proxy.example.com", providers), ["203.0.113.5"])
        providers = [{"fqdn": "proxy.example.com", "public_address": "203.0.113.5", "address": "203.0.113.5"}]
        self.assertEqual(dnscheck.proxy_addresses("proxy.example.com", providers), ["203.0.113.5"])


@unittest.skipIf(importlib.util.find_spec("dns") is None, "dnspython is required")
class DnsQueryTest(unittest.TestCase):
    def query_raising(self, error):
        import dns.message
        import dns.resolver

        failure = dns.resolver.NoNameservers(
            request=dns.message.make_query("a.example.com", "A"),
            errors=[("127.0.0.53", False, 53, error, None)],
        )
        with mock.patch.object(dns.resolver.Resolver, "resolve", side_effect=failure):
            dnscheck.dns_query("a.example.com")

    def test_query_not_sent_is_unreachable(self):
        with self.assertRaises(dnscheck.ResolverUnreachable):
            self.query_raising(OSError("Network is unreachable"))

    def test_servfail_is_not_found(self):
        with self.assertRaises(dnscheck.NameNotFound):
            self.query_raising(Exception("SERVFAIL"))

    def test_resolver_of_the_node_is_used(self):
        import dns.resolver

        with mock.patch.object(dns.resolver, "Resolver") as resolver:
            resolver.return_value.resolve.return_value = []
            dnscheck.dns_query("a.example.com")
        resolver.assert_called_once_with()
        resolver.return_value.resolve.assert_called_once_with("a.example.com", "A", lifetime=dnscheck.LIFETIME)


if __name__ == "__main__":
    unittest.main()
