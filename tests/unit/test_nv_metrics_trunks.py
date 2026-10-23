#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import subprocess
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import runner, trunks  # noqa: E402
from nvmetrics.runner import CheckUnavailable  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
# rl1 test trunks: NvTestSend (send, bypassing the proxy, fake provider),
# NvTestRecv (receive), NvTestIp (none, fake provider), NvTestProxy (send
# through the proxy, fake provider)
ASTERISK_METRICS = (FIXTURES / "asterisk_metrics_rl1.txt").read_text()
TRUNKS_TSV = (FIXTURES / "trunks_rl1.tsv").read_text()
# "pjsip show contacts": rl1 (NvTestIp does not answer OPTIONS) and
# demo-heron (Asterisk cannot qualify "Retel GNR": NonQual, calls work)
CONTACTS_RL1 = (FIXTURES / "pjsip_contacts_rl1.txt").read_text()
CONTACTS_HERON = (FIXTURES / "pjsip_contacts_heron.txt").read_text()
ENV = {"PROXY_IP": "10.5.4.1", "PROXY_PORT": "5060"}
# "pjsip show aor" of an IP trunk through the proxy (demo-heron, other address)
AOR_IP_TRUNK = """#AOR Ip_Proxy
      Aor:  <Aor..............................................>  <MaxContact>
    Contact:  <Aor/ContactUri............................> <Hash....> <Status> <RTT(ms)..>
==========================================================================================

      Aor:  Ip_Proxy                                             0
    Contact:  Ip_Proxy/sip:203.0.113.5:5060                b6230fe36e Avail        36.694


 ParameterName        : ParameterValue
 =============================================
 authenticate_qualify : false
 contact              : sip:203.0.113.5:5060
 default_expiration   : 3600
 outbound_proxy       : sip:10.5.4.1:5060
"""


def trunk(name, **settings):
    values = dict.fromkeys(trunks.KEYWORDS, "")
    values.update(settings, name=name, trunk_name=name)
    return values


def endpoints(*states):
    lines = ["# TYPE asterisk_endpoints_state gauge"]
    for name, state in states:
        lines.append(
            'asterisk_endpoints_state{eid="e",id="PJSIP/%s",tech="PJSIP",resource="%s"} %d' % (name, name, state)
        )
    return "\n".join(lines) + "\n"


class ParseRowsTest(unittest.TestCase):
    def test_rl1_trunks(self):
        rows = trunks.parse_rows(TRUNKS_TSV)
        self.assertEqual([t["name"] for t in rows], ["NvTestSend", "NvTestRecv", "NvTestIp", "NvTestProxy"])
        self.assertEqual([t["registration"] for t in rows], ["send", "receive", "none", "send"])
        self.assertEqual(rows[3]["outbound_proxy"], "sip:10.5.4.1:5060;lr")

    def test_channelid_when_trunk_name_is_missing(self):
        line = "\t".join(["Chan1"] + [""] * len(trunks.KEYWORDS))
        self.assertEqual(trunks.parse_rows(line)[0]["name"], "Chan1")

    def test_escaped_fields(self):
        line = "\t".join(["T"] + ["a\\tb\\\\c"] + [""] * (len(trunks.KEYWORDS) - 1))
        self.assertEqual(trunks.parse_rows(line)[0]["name"], "a\tb\\c")


class ReadTrunksTest(unittest.TestCase):
    def test_password_stays_in_the_container(self):
        calls = []

        def run(args, **kwargs):
            calls.append(args)
            return subprocess.CompletedProcess(args, 0, TRUNKS_TSV, "")

        rows = trunks.read_trunks({"AMPDBNAME": "asterisk"}, run)
        self.assertEqual(len(rows), 4)
        args = calls[0]
        self.assertEqual(args[:4], ["podman", "exec", "mariadb", "sh"])
        self.assertIn('MYSQL_PWD="$MARIADB_ROOT_PASSWORD"', args[5])
        self.assertEqual(args[7:], ["asterisk", trunks.query()])


class RegistrationUrisTest(unittest.TestCase):
    def test_built_from_server_and_username(self):
        t = trunk("Prov", username="0123", authentication="outbound", sip_server="sip.example.com", sip_server_port="5060")
        self.assertEqual(trunks.registration_uris(t), ("sip:0123@sip.example.com:5060", "sip:sip.example.com:5060"))

    def test_trunk_name_with_inbound_auth_or_no_username(self):
        t = trunk("Prov", username="0123", authentication="both", sip_server="sip.example.com")
        self.assertEqual(trunks.registration_uris(t), ("sip:Prov@sip.example.com", "sip:sip.example.com"))
        t = trunk("Prov", authentication="outbound", sip_server="sip.example.com")
        self.assertEqual(trunks.registration_uris(t)[0], "sip:Prov@sip.example.com")

    def test_explicit_uris(self):
        t = trunk("Prov", client_uri="sip:a@b", server_uri="sip:b;transport=tcp", sip_server="x")
        self.assertEqual(trunks.registration_uris(t), ("sip:a@b", "sip:b;transport=tcp"))


class RenderTest(unittest.TestCase):
    def test_rl1_trunks(self):
        text = trunks.render(trunks.parse_rows(TRUNKS_TSV), ASTERISK_METRICS, ENV)
        for line in (
            'nethvoice_trunk_endpoint_state{trunk="NvTestSend",via_proxy="false",registration="send"} 1',
            'nethvoice_trunk_endpoint_state{trunk="NvTestRecv",via_proxy="false",registration="receive"} 1',
            'nethvoice_trunk_endpoint_state{trunk="NvTestIp",via_proxy="false",registration="none"} 1',
            'nethvoice_trunk_endpoint_state{trunk="NvTestProxy",via_proxy="true",registration="send"} 2',
            # Rejected by the fake provider
            'nethvoice_trunk_registration_up{trunk="NvTestSend"} 0',
        ):
            self.assertIn(line + "\n", text)
        # The proxy checks the registrations it forwards
        self.assertNotIn('registration_up{trunk="NvTestProxy"}', text)
        self.assertNotIn("anonymous", text)

    def test_registered(self):
        page = (
            '# TYPE asterisk_pjsip_outbound_registration_status gauge\n'
            'asterisk_pjsip_outbound_registration_status{eid="e",username="sip:0123@sip.example.com:5060",'
            'domain="sip:sip.example.com:5060",channel_type="PJSIP"} 1\n'
        )
        t = trunk("Direct2", registration="send", username="0123", sip_server="sip.example.com", sip_server_port="5060")
        self.assertIn('nethvoice_trunk_registration_up{trunk="Direct2"} 1\n', trunks.render([t], page, ENV))

    def test_registration_not_loaded_is_not_exported(self):
        t = trunk("Direct2", registration="send", sip_server="sip.example.com")
        self.assertNotIn('registration_up{', trunks.render([t], endpoints(("Direct2", 1)), ENV))

    def test_missing_registration_setting_is_send(self):
        t = trunk("Old", sip_server="sip.example.com")
        text = trunks.render([t], endpoints(("Old", 2)), ENV)
        self.assertIn('nethvoice_trunk_endpoint_state{trunk="Old",via_proxy="false",registration="send"} 2\n', text)

    def test_trunk_without_endpoint_is_not_exported(self):
        t = trunk("Gw1", registration="receive")
        self.assertNotIn('trunk="Gw1"', trunks.render([t], endpoints(("201", 2)), ENV))

    def test_label_values_are_escaped(self):
        t = trunk('a"b', registration="none")
        page = 'asterisk_endpoints_state{tech="PJSIP",resource="a\\"b"} 1\n'
        self.assertIn('trunk="a\\"b"', trunks.render([t], page, ENV))

    def test_reserved_labels_are_never_set(self):
        text = trunks.render(trunks.parse_rows(TRUNKS_TSV), ASTERISK_METRICS, ENV)
        self.assertNotRegex(text, r"(module|module_id|instance)=")


class QualifyTest(unittest.TestCase):
    def test_parse_contacts(self):
        self.assertEqual(
            trunks.parse_contacts(CONTACTS_RL1),
            {
                "91201": ["Avail"],
                "NvTestIp": ["Unavail"],
                "NvTestProxy": ["Avail"],
                "NvTestSend": ["Unavail"],
                "test_opensoultion_marchio": ["Avail"],
            },
        )
        self.assertEqual(trunks.parse_contacts(CONTACTS_HERON), {"201": ["Avail"], "Retel GNR": ["NonQual"]})

    def test_ip_trunk_without_answer(self):
        text = trunks.render(trunks.parse_rows(TRUNKS_TSV), ASTERISK_METRICS, ENV, trunks.parse_contacts(CONTACTS_RL1))
        self.assertIn('nethvoice_trunk_qualify_up{trunk="NvTestIp"} 0\n', text)
        # Only IP trunks
        self.assertNotIn('qualify_up{trunk="NvTestSend"}', text)
        self.assertNotIn('qualify_up{trunk="NvTestProxy"}', text)

    def test_ip_trunk_through_the_proxy_is_left_to_the_proxy(self):
        # Kamailio answers 408 for a silent provider: Asterisk shows it Avail
        t = trunk("Retel_GNR", registration="none", outbound_proxy="sip:10.5.4.1:5060;lr")
        contacts = {"Retel_GNR": ["Avail"]}
        self.assertNotIn("nethvoice_trunk_qualify_up{", trunks.render([t], endpoints(("Retel_GNR", 2)), ENV, contacts))
        trunks.collect(lambda: endpoints(("Retel_GNR", 2)), ENV, lambda: [t], self.fail, lambda names: {})

    def test_not_qualified_is_not_exported(self):
        t = trunk("Retel GNR", registration="none")
        text = trunks.render([t], endpoints(("Retel GNR", 1)), ENV, trunks.parse_contacts(CONTACTS_HERON))
        self.assertIn('nethvoice_trunk_endpoint_state{trunk="Retel GNR",via_proxy="false",registration="none"} 1\n', text)
        self.assertNotIn("nethvoice_trunk_qualify_up{", text)

    def test_any_answering_contact_is_up(self):
        self.assertEqual(trunks.qualify_up(["Unavail", "Avail"]), 1)
        self.assertEqual(trunks.qualify_up(["Unavail", "NonQual"]), 0)
        self.assertIsNone(trunks.qualify_up(["NonQual", "Unknown"]))
        self.assertIsNone(trunks.qualify_up([]))

    def test_contacts_command(self):
        def run(args, **kwargs):
            self.assertEqual(args, ["podman", "exec", "freepbx", "asterisk", "-rx", "pjsip show contacts"])
            return subprocess.CompletedProcess(args, 0, stdout=CONTACTS_HERON)

        self.assertEqual(trunks.read_contacts(run), {"201": ["Avail"], "Retel GNR": ["NonQual"]})


class ProxyInfoTest(unittest.TestCase):
    def test_parse_aor_contacts(self):
        self.assertEqual(trunks.parse_aor_contacts(AOR_IP_TRUNK), {"Ip_Proxy": ["sip:203.0.113.5:5060"]})
        text = "#AOR A\n contact : sip:a.example.com, sip:b.example.com:5070\n#AOR B\n contact : \n"
        self.assertEqual(
            trunks.parse_aor_contacts(text), {"A": ["sip:a.example.com", "sip:b.example.com:5070"], "B": []}
        )

    def test_aor_command(self):
        def run(args, **kwargs):
            self.assertEqual(args[:4], ["podman", "exec", "freepbx", "sh"])
            self.assertIn('asterisk -rx "pjsip show aor $aor"', args[5])
            self.assertEqual(args[6:], ["sh", "Ip_Proxy", "Ip2"])
            return subprocess.CompletedProcess(args, 0, stdout=AOR_IP_TRUNK)

        self.assertEqual(trunks.read_aor_contacts(["Ip_Proxy", "Ip2"], run), {"Ip_Proxy": ["sip:203.0.113.5:5060"]})

    def test_uri_parts(self):
        self.assertEqual(trunks.uri_parts("sip:0123@sip.example.com:5060;transport=udp"), ("0123", "sip.example.com", "5060"))
        self.assertEqual(trunks.uri_parts("sip:203.0.113.5"), ("", "203.0.113.5", ""))
        self.assertEqual(trunks.uri_parts("sips:[2001:db8::1]:5061"), ("", "[2001:db8::1]", "5061"))

    def test_registration_through_the_proxy(self):
        # Same key as the proxy: "<To user>@<To host>" of the REGISTER
        text = trunks.render(trunks.parse_rows(TRUNKS_TSV), ASTERISK_METRICS, ENV)
        self.assertIn('nethvoice_trunk_proxy_info{trunk="NvTestProxy",proxy_trunk="NvTestProxy@192.0.2.12"} 1\n', text)
        # Trunks that bypass the proxy are not mapped
        self.assertNotIn('proxy_info{trunk="NvTestSend"', text)

    def test_ip_trunk_through_the_proxy(self):
        proxy = "sip:10.5.4.1:5060;lr"
        ip = trunk("Ip_Proxy", registration="none", outbound_proxy=proxy)
        no_port = trunk("Ip2", registration="none", outbound_proxy=proxy)
        with_user = trunk("Ip3", registration="none", outbound_proxy=proxy)
        aors = {
            "Ip_Proxy": ["sip:203.0.113.5:5060"],
            "Ip2": ["sip:ip2.example.com"],
            # The proxy tracks only contacts without user part
            "Ip3": ["sip:Ip3@203.0.113.7:5060"],
        }
        text = trunks.render([ip, no_port, with_user], "", ENV, aor_contacts=aors)
        self.assertIn('nethvoice_trunk_proxy_info{trunk="Ip_Proxy",proxy_trunk="203.0.113.5:5060"} 1\n', text)
        self.assertIn('nethvoice_trunk_proxy_info{trunk="Ip2",proxy_trunk="ip2.example.com:5060"} 1\n', text)
        self.assertNotIn('proxy_info{trunk="Ip3"', text)

    def test_receive_trunk_is_not_mapped(self):
        t = trunk("Gw1", registration="receive", outbound_proxy="sip:10.5.4.1:5060")
        self.assertNotIn("nethvoice_trunk_proxy_info{", trunks.render([t], "", ENV))

    def test_aor_read_only_for_ip_trunks_through_the_proxy(self):
        names = []
        ip = trunk("Ip_Proxy", registration="none", outbound_proxy="sip:10.5.4.1:5060;lr")
        direct = trunk("Ip_Direct", registration="none")
        send = trunk("Prov", registration="send", outbound_proxy="sip:10.5.4.1:5060;lr", sip_server="x")

        def aor_contacts(aors):
            names.extend(aors)
            return trunks.parse_aor_contacts(AOR_IP_TRUNK)

        text = trunks.collect(lambda: "", ENV, lambda: [ip, direct, send], lambda: {}, aor_contacts)
        self.assertEqual(names, ["Ip_Proxy"])
        self.assertIn('proxy_trunk="203.0.113.5:5060"', text)

    def test_aor_error_skips_only_the_ip_trunk_names(self):
        def aor_contacts(aors):
            raise OSError("asterisk not answering")

        ip = trunk("Ip_Proxy", registration="none", outbound_proxy="sip:10.5.4.1:5060;lr")
        err = io.StringIO()
        with redirect_stderr(err):
            text = trunks.collect(lambda: endpoints(("Ip_Proxy", 2)), ENV, lambda: [ip], lambda: {}, aor_contacts)
        self.assertIn('nethvoice_trunk_endpoint_state{trunk="Ip_Proxy"', text)
        self.assertNotIn("nethvoice_trunk_proxy_info{", text)
        self.assertIn("cannot read the AOR contacts", err.getvalue())


class CollectTest(unittest.TestCase):
    def test_unavailable_when_freepbx_is_not_running(self):
        def page():
            raise CheckUnavailable("freepbx is not running")

        def read_trunks():
            raise AssertionError("must not be called")

        with self.assertRaises(CheckUnavailable):
            trunks.collect(page, ENV, read_trunks)

    def test_unavailable_when_the_proxy_address_is_not_known(self):
        page = lambda: ASTERISK_METRICS  # noqa: E731
        for env in ({}, {"PROXY_IP": "10.5.4.1"}, {"PROXY_IP": "", "PROXY_PORT": "5060"}):
            with self.assertRaises(CheckUnavailable):
                trunks.collect(page, env, lambda: trunks.parse_rows(TRUNKS_TSV))

    def test_page_is_read_once_with_the_asterisk_collector(self):
        calls = []

        def read_page():
            calls.append(1)
            return ASTERISK_METRICS

        page = runner.once(read_page)
        page()
        trunks.collect(page, ENV, lambda: trunks.parse_rows(TRUNKS_TSV), lambda: {})
        self.assertEqual(len(calls), 1)


    def test_contacts_read_only_for_ip_trunks(self):
        def contacts():
            raise AssertionError("must not be called")

        t = trunk("Prov1", registration="send", sip_server="sip.example.com")
        trunks.collect(lambda: endpoints(("Prov1", 2)), ENV, lambda: [t], contacts)

    def test_contacts_error_skips_only_the_qualify_check(self):
        def contacts():
            raise OSError("asterisk not answering")

        t = trunk("Ip1", registration="none")
        err = io.StringIO()
        with redirect_stderr(err):
            text = trunks.collect(lambda: endpoints(("Ip1", 1)), ENV, lambda: [t], contacts)
        self.assertIn('nethvoice_trunk_endpoint_state{trunk="Ip1",via_proxy="false",registration="none"} 1\n', text)
        self.assertNotIn("nethvoice_trunk_qualify_up{", text)
        self.assertIn("cannot read the contacts", err.getvalue())


if __name__ == "__main__":
    unittest.main()
