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
from nvmetrics.runner import CheckUnavailable  # noqa: E402

ENV = {
    "NETHVOICE_HOST": "voice.example.com",
    "NETHCTI_UI_HOST": "cti.example.com",
    "NETHVOICE_PROXY_FQDN": "proxy.example.com",
}


def fake_query(answers):
    """answers: {(name, resolver): list of IPs | NameNotFound | ResolverUnreachable}"""
    calls = []

    def query(name, resolver):
        calls.append((name, resolver))
        answer = answers.get((name, resolver), dnscheck.ResolverUnreachable())
        if isinstance(answer, Exception):
            raise answer
        return answer

    query.calls = calls
    return query


def everywhere(name, answer):
    return {(name, resolver): answer for resolver in dnscheck.RESOLVERS}


class LookupTest(unittest.TestCase):
    def test_first_answering_resolver_wins(self):
        query = fake_query({("a.example.com", "8.8.8.8"): ["1.2.3.4"]})
        self.assertEqual(dnscheck.lookup("a.example.com", query), ["1.2.3.4"])
        self.assertEqual(query.calls, [("a.example.com", "1.1.1.1"), ("a.example.com", "8.8.8.8")])

    def test_name_not_found_is_an_answer(self):
        query = fake_query(everywhere("a.example.com", dnscheck.NameNotFound()))
        self.assertEqual(dnscheck.lookup("a.example.com", query), [])
        self.assertEqual(len(query.calls), 1)

    def test_no_resolver_answers(self):
        self.assertIsNone(dnscheck.lookup("a.example.com", fake_query({})))


class RenderTest(unittest.TestCase):
    def render(self, answers, env=ENV, proxy_ip="203.0.113.5"):
        return dnscheck.render(env, fake_query(answers), proxy_ip)

    def test_all_names_resolve(self):
        answers = {}
        answers.update(everywhere("voice.example.com", ["203.0.113.1"]))
        answers.update(everywhere("cti.example.com", ["203.0.113.1"]))
        answers.update(everywhere("proxy.example.com", ["203.0.113.5"]))
        text = self.render(answers)
        self.assertIn('nethvoice_public_dns_resolves{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn('nethvoice_public_dns_resolves{name="cti.example.com",role="cti"} 1\n', text)
        self.assertIn('nethvoice_public_dns_resolves{name="proxy.example.com",role="proxy"} 1\n', text)
        self.assertIn(
            'nethvoice_public_dns_proxy_ip_match{expected="203.0.113.5",name="proxy.example.com",records="203.0.113.5"} 1\n',
            text,
        )

    def test_nxdomain_is_failure(self):
        answers = everywhere("voice.example.com", dnscheck.NameNotFound())
        answers.update(everywhere("cti.example.com", ["203.0.113.1"]))
        answers.update(everywhere("proxy.example.com", dnscheck.NameNotFound()))
        text = self.render(answers)
        self.assertIn('nethvoice_public_dns_resolves{name="voice.example.com",role="nethvoice"} 0\n', text)
        # A name that does not resolve is not compared with the proxy IP
        self.assertNotIn("nethvoice_public_dns_proxy_ip_match{", text)

    def test_proxy_ip_mismatch(self):
        answers = everywhere("proxy.example.com", ["198.51.100.9", "198.51.100.1"])
        text = self.render(answers, env={"NETHVOICE_PROXY_FQDN": "proxy.example.com"})
        self.assertIn(
            'nethvoice_public_dns_proxy_ip_match{expected="203.0.113.5",name="proxy.example.com",records="198.51.100.1,198.51.100.9"} 0\n',
            text,
        )

    def test_proxy_ip_unknown_is_not_compared(self):
        answers = everywhere("proxy.example.com", ["198.51.100.9"])
        text = self.render(answers, env={"NETHVOICE_PROXY_FQDN": "proxy.example.com"}, proxy_ip="")
        self.assertNotIn("nethvoice_public_dns_proxy_ip_match{", text)

    def test_unreachable_name_is_skipped(self):
        answers = everywhere("voice.example.com", ["203.0.113.1"])
        text = self.render(answers)
        self.assertIn('name="voice.example.com"', text)
        self.assertNotIn('name="cti.example.com"', text)

    def test_all_resolvers_unreachable_is_unavailable(self):
        with self.assertRaises(CheckUnavailable):
            self.render({})

    def test_empty_and_duplicate_names_are_skipped(self):
        env = {"NETHVOICE_HOST": "voice.example.com", "NETHCTI_UI_HOST": "voice.example.com", "NETHVOICE_PROXY_FQDN": ""}
        query = fake_query(everywhere("voice.example.com", ["203.0.113.1"]))
        text = dnscheck.render(env, query, "")
        self.assertEqual(text.count("nethvoice_public_dns_resolves{"), 1)
        self.assertEqual(query.calls, [("voice.example.com", "1.1.1.1")])

    def test_proxy_sharing_the_nethvoice_name_is_compared(self):
        env = {"NETHVOICE_HOST": "voice.example.com", "NETHVOICE_PROXY_FQDN": "voice.example.com"}
        query = fake_query(everywhere("voice.example.com", ["198.51.100.9"]))
        text = dnscheck.render(env, query, "203.0.113.5")
        self.assertEqual(text.count("nethvoice_public_dns_resolves{"), 1)
        self.assertIn('nethvoice_public_dns_resolves{name="voice.example.com",role="nethvoice"} 1\n', text)
        self.assertIn(
            'nethvoice_public_dns_proxy_ip_match{expected="203.0.113.5",name="voice.example.com",records="198.51.100.9"} 0\n',
            text,
        )
        self.assertEqual(query.calls, [("voice.example.com", "1.1.1.1")])

    def test_reserved_labels_are_never_set(self):
        text = self.render(everywhere("voice.example.com", ["203.0.113.1"]))
        self.assertNotRegex(text, r"(module|module_id|instance)=")


class ProxyIpTest(unittest.TestCase):
    def test_public_address_of_the_proxy_with_the_fqdn(self):
        providers = [
            {"fqdn": "other.example.com", "public_address": "198.51.100.1"},
            {"fqdn": "proxy.example.com", "public_address": "203.0.113.5", "address": "203.0.113.6"},
        ]
        self.assertEqual(dnscheck.proxy_public_ip("proxy.example.com", providers), "203.0.113.5")

    def test_unknown(self):
        self.assertEqual(dnscheck.proxy_public_ip("proxy.example.com", []), "")

    def test_private_address_is_never_compared(self):
        providers = [{"fqdn": "proxy.example.com", "public_address": "", "address": "10.5.4.1"}]
        self.assertEqual(dnscheck.proxy_public_ip("proxy.example.com", providers), "")


@unittest.skipIf(importlib.util.find_spec("dns") is None, "dnspython is required")
class DnsQueryTest(unittest.TestCase):
    def query_raising(self, error):
        import dns.message
        import dns.resolver

        failure = dns.resolver.NoNameservers(
            request=dns.message.make_query("a.example.com", "A"),
            errors=[("1.1.1.1", False, 53, error, None)],
        )
        with mock.patch.object(dns.resolver.Resolver, "resolve", side_effect=failure):
            dnscheck.dns_query("a.example.com", "1.1.1.1")

    def test_query_not_sent_is_unreachable(self):
        with self.assertRaises(dnscheck.ResolverUnreachable):
            self.query_raising(OSError("Network is unreachable"))

    def test_servfail_is_not_found(self):
        with self.assertRaises(dnscheck.NameNotFound):
            self.query_raising(Exception("SERVFAIL"))


if __name__ == "__main__":
    unittest.main()
