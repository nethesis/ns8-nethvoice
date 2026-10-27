#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""State of the PJSIP trunks, read from Asterisk.

Used by the NethVoiceTrunkUnreachable and NethVoiceTrunkNotMonitored alerts
(etc/metrics/alert-rules/nethvoice-telephony.yml):

- nethvoice_trunk_endpoint_state{trunk,via_proxy,registration}: state of the
  trunk endpoint (asterisk_endpoints_state): 0 unknown, 1 offline, 2 online.
  "registration" is the FreePBX trunk setting: send (NethVoice registers to
  the provider), receive (the remote side registers to NethVoice, e.g. a
  gateway) or none (IP trunk, checked with OPTIONS).
- nethvoice_trunk_registration_up{trunk}: 1 if Asterisk is registered to the
  provider, 0 otherwise. Only for registration=send trunks that do not use
  the NethVoice proxy: the proxy checks the registrations it forwards.
- nethvoice_trunk_qualify_up{trunk}: 1 if the provider answers the OPTIONS
  of Asterisk (contact Avail), 0 if it does not (Unavail). Only for
  registration=none trunks (IP trunks) that do not use the NethVoice proxy:
  through the proxy Asterisk gets a 408 from Kamailio when the provider is
  silent and counts it as an answer, so the proxy checks those. Not exported
  when Asterisk did not qualify the contact (NonQual, Unknown): the endpoint
  state is then offline too, but calls can still work.
- nethvoice_trunk_proxy_info{trunk,proxy_trunk}: always 1. Maps a trunk that
  uses the NethVoice proxy to the "trunk" label of the proxy series: the
  registration AOR "<user>@<host>" (registration=send) or the contact
  address "<host>:<port>" (registration=none). The proxy alerts look up the
  trunk name with it.
- nethvoice_trunk_name_invalid{trunk}: 1 when an IP or receive trunk has a
  name that is not a valid SIP user and no From User: Asterisk cannot send
  OPTIONS to it. Trunks with registration=send are left out: their
  registration is checked instead. Used by the NethVoiceTrunkNotMonitored
  alert.

The trunk list comes from the FreePBX database, the states from the Asterisk
metrics page. asterisk_pjsip_outbound_registration_status identifies a
registration by its client and server URI, not by its name: the URIs are
built from the trunk settings as FreePBX does when it writes
pjsip.registration.conf.
"""

import os
import re
import subprocess
import sys

from . import promtext
from .runner import CheckUnavailable

TIMEOUT = 8
# pjsip table keywords, in the order of the query columns
KEYWORDS = (
    "trunk_name",
    "registration",
    "outbound_proxy",
    "client_uri",
    "server_uri",
    "username",
    "authentication",
    "sip_server",
    "sip_server_port",
    "from_user",
)
# Values of asterisk_pjsip_outbound_registration_status: 0 unregistered, 1 registered, 2 rejected
REGISTERED = 1
# "pjsip show contacts" line: "Contact:  <aor>/<uri> <hash> <status> <rtt>"
_CONTACT_RE = re.compile(r"^\s*Contact:\s+(.+?)/sips?:\S*\s+\S+\s+(\S+)\s+\S+\s*$")
# "pjsip show aor" parameter line: "contact : <uri>[,<uri>...]"
_AOR_CONTACT_RE = re.compile(r"^\s*contact\s*:\s*(.*?)\s*$")
# Marker printed before each "pjsip show aor" output
_AOR_MARK = "#AOR "
# Valid SIP user: ASCII letters, digits and the RFC 3261 unreserved marks
NAME_RE = re.compile(r"^[A-Za-z0-9_.+!~*'()-]+$")


def query():
    columns = ",\n".join(
        "COALESCE(MAX(CASE WHEN p.keyword = '%s' THEN p.data END), '')" % keyword for keyword in KEYWORDS
    )
    return (
        "SELECT t.channelid,\n%s\n"
        "FROM trunks t LEFT JOIN pjsip p ON p.id = t.trunkid\n"
        "WHERE t.tech = 'pjsip' AND t.disabled = 'off'\n"
        "GROUP BY t.trunkid, t.channelid" % columns
    )


def unescape_field(value):
    """Undo the escaping of the mariadb batch output."""
    escapes = {"t": "\t", "n": "\n", "0": "\0", "\\": "\\"}
    result = []
    chars = iter(value)
    for char in chars:
        if char == "\\":
            following = next(chars, "")
            result.append(escapes.get(following, following))
        else:
            result.append(char)
    return "".join(result)


def parse_rows(text):
    """Return one dict per trunk from the tab separated query output."""
    trunks = []
    for line in text.splitlines():
        if not line:
            continue
        fields = [unescape_field(field) for field in line.split("\t")]
        if len(fields) != len(KEYWORDS) + 1:
            continue
        trunk = dict(zip(KEYWORDS, fields[1:]))
        # The Asterisk endpoint and registration are named after trunk_name
        trunk["name"] = trunk["trunk_name"] or fields[0]
        trunks.append(trunk)
    return trunks


def read_trunks(env=os.environ, run=subprocess.run):
    """Return the enabled PJSIP trunks of the FreePBX database."""
    # The password stays in the container environment, the query is $2
    script = 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" exec mariadb -uroot -BN "$1" -e "$2"'
    result = run(
        ["podman", "exec", "mariadb", "sh", "-c", script, "sh", env.get("AMPDBNAME") or "asterisk", query()],
        check=True,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
    )
    return parse_rows(result.stdout)


def read_contacts(run=subprocess.run):
    """Return {AOR name: [contact status]} from "pjsip show contacts"."""
    result = run(
        ["podman", "exec", "freepbx", "asterisk", "-rx", "pjsip show contacts"],
        check=True,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
    )
    return parse_contacts(result.stdout)


def parse_contacts(text):
    contacts = {}
    for line in text.splitlines():
        match = _CONTACT_RE.match(line)
        if match and not match.group(1).startswith("<"):
            contacts.setdefault(match.group(1), []).append(match.group(2))
    return contacts


def read_aor_contacts(names, run=subprocess.run):
    """Return {AOR name: [contact URI]} of the static contacts of the AORs.

    "pjsip show contacts" cuts long URIs, the parameter list of "pjsip show
    aor" does not.
    """
    script = 'for aor; do echo "%s$aor"; asterisk -rx "pjsip show aor $aor"; done' % _AOR_MARK
    result = run(
        ["podman", "exec", "freepbx", "sh", "-c", script, "sh", *names],
        check=True,
        capture_output=True,
        text=True,
        timeout=TIMEOUT,
    )
    return parse_aor_contacts(result.stdout)


def parse_aor_contacts(text):
    contacts = {}
    aor = None
    for line in text.splitlines():
        if line.startswith(_AOR_MARK):
            aor = line[len(_AOR_MARK):]
            continue
        match = _AOR_CONTACT_RE.match(line)
        if aor is not None and match:
            contacts[aor] = [uri.strip() for uri in match.group(1).split(",") if uri.strip()]
    return contacts


def uri_parts(uri):
    """Return (user, host, port) of a SIP URI; port is "" when missing."""
    rest = re.sub(r"^sips?:", "", uri.strip()).split(";")[0].split("?")[0]
    user, _, hostport = rest.rpartition("@")
    if hostport.startswith("["):
        host, _, port = hostport.partition("]")
        host += "]"
        port = port[1:]
    else:
        host, _, port = hostport.partition(":")
    return user, host, port


def proxy_trunks(trunk, aor_contacts):
    """Return the "trunk" labels of the proxy series of a trunk that uses the proxy.

    Same values as the Kamailio htable keys: "<To user>@<To host>" of the
    REGISTER (To = client URI), "<host>:<port>" of the OPTIONS To URI (the
    contact, port 5060 when missing; contacts with a user part are not
    tracked by the proxy).
    """
    if registration(trunk) == "send":
        user, host, _ = uri_parts(registration_uris(trunk)[0])
        return [user + "@" + host]
    if registration(trunk) == "none":
        addresses = []
        for uri in aor_contacts.get(trunk["name"], []):
            user, host, port = uri_parts(uri)
            if host and not user:
                addresses.append("%s:%s" % (host, port if port not in ("", "0") else "5060"))
        return addresses
    return []


def qualify_up(statuses):
    """Return 1 if a contact answers OPTIONS, 0 if every checked contact does not, None if not checked."""
    if "Avail" in statuses:
        return 1
    if "Unavail" in statuses:
        return 0
    return None


def registration(trunk):
    # FreePBX sends registrations when the setting is missing
    return trunk["registration"] or "send"


def name_invalid(trunk):
    """Return True if Asterisk cannot send OPTIONS to the trunk.

    Without From User the endpoint name is the From user of the OPTIONS: a
    name that is not a valid SIP user gives an invalid URI. A send trunk is
    checked through its registration, which does not use the endpoint name.
    """
    return (
        not NAME_RE.fullmatch(trunk["name"])
        and trunk["from_user"].strip() == ""
        and registration(trunk) != "send"
    )


def via_proxy(trunk, env=os.environ):
    proxy = "sip:%s:%s" % (env.get("PROXY_IP", ""), env.get("PROXY_PORT", ""))
    return trunk["outbound_proxy"].split(";")[0] == proxy


def registration_uris(trunk):
    """Return (client URI, server URI) of the trunk registration, as FreePBX writes them."""
    port = trunk["sip_server_port"]
    server = trunk["server_uri"]
    if not server:
        server = "sip:" + trunk["sip_server"] + (":" + port if port else "")
    client = trunk["client_uri"]
    if not client:
        username = trunk["username"]
        if trunk["authentication"] in ("inbound", "both") or not username:
            username = trunk["name"]
        client = "sip:%s@%s" % (username, trunk["sip_server"]) + (":" + port if port else "")
    return client, server


def render(trunks, page, env=os.environ, contacts=None, aor_contacts=None):
    """Return the metrics in the Prometheus text format.

    contacts: {AOR name: [contact status]}, None when they cannot be read.
    aor_contacts: {AOR name: [contact URI]} of the IP trunks that use the proxy.
    """
    endpoints = {
        labels.get("resource"): value
        for labels, value in promtext.samples(page, "asterisk_endpoints_state")
        if labels.get("tech") == "PJSIP"
    }
    registrations = {
        (labels.get("username"), labels.get("domain")): value
        for labels, value in promtext.samples(page, "asterisk_pjsip_outbound_registration_status")
    }
    states = []
    registered = []
    qualified = []
    mapped = []
    invalid = []
    for trunk in trunks:
        name = promtext.escape(trunk["name"])
        bypass = not via_proxy(trunk, env)
        if trunk["name"] in endpoints:
            states.append(
                'nethvoice_trunk_endpoint_state{trunk="%s",via_proxy="%s",registration="%s"} %d'
                % (name, "false" if bypass else "true", promtext.escape(registration(trunk)), endpoints[trunk["name"]])
            )
        if registration(trunk) == "send" and bypass:
            status = registrations.get(registration_uris(trunk))
            if status is not None:
                registered.append('nethvoice_trunk_registration_up{trunk="%s"} %d' % (name, status == REGISTERED))
        if registration(trunk) == "none" and bypass and contacts is not None:
            # The AOR has the same name as the endpoint
            up = qualify_up(contacts.get(trunk["name"], []))
            if up is not None:
                qualified.append('nethvoice_trunk_qualify_up{trunk="%s"} %d' % (name, up))
        if not bypass:
            for proxy_trunk in proxy_trunks(trunk, aor_contacts or {}):
                mapped.append(
                    'nethvoice_trunk_proxy_info{trunk="%s",proxy_trunk="%s"} 1' % (name, promtext.escape(proxy_trunk))
                )
        if name_invalid(trunk):
            invalid.append('nethvoice_trunk_name_invalid{trunk="%s"} 1' % name)
    lines = [
        "# HELP nethvoice_trunk_endpoint_state State of the trunk endpoint in Asterisk: 0 unknown, 1 offline, 2 online",
        "# TYPE nethvoice_trunk_endpoint_state gauge",
        *states,
        "# HELP nethvoice_trunk_registration_up 1 if Asterisk is registered to the trunk provider, 0 otherwise",
        "# TYPE nethvoice_trunk_registration_up gauge",
        *registered,
        "# HELP nethvoice_trunk_qualify_up 1 if the IP trunk provider answers OPTIONS, 0 if it does not",
        "# TYPE nethvoice_trunk_qualify_up gauge",
        *qualified,
        "# HELP nethvoice_trunk_proxy_info Maps a trunk to the trunk label of the NethVoice proxy series",
        "# TYPE nethvoice_trunk_proxy_info gauge",
        *mapped,
        "# HELP nethvoice_trunk_name_invalid 1 when an IP or receive trunk has a name that is not a valid SIP user"
        " and no From User: Asterisk cannot send OPTIONS to it",
        "# TYPE nethvoice_trunk_name_invalid gauge",
        *invalid,
    ]
    return "\n".join(lines) + "\n"


def collect(page, env=os.environ, trunks=read_trunks, contacts=read_contacts, aor_contacts=read_aor_contacts):
    # The page is read first: while freepbx is down there is nothing to check
    text = page()
    if not env.get("PROXY_IP") or not env.get("PROXY_PORT"):
        # A trunk through the proxy would look like a trunk that bypasses it
        raise CheckUnavailable("the proxy address is not known")
    trunk_list = trunks()
    contact_list = None
    if any(registration(trunk) == "none" and not via_proxy(trunk, env) for trunk in trunk_list):
        try:
            contact_list = contacts()
        except Exception as ex:
            # Only the IP trunk check is skipped
            print("trunks: cannot read the contacts: %s" % ex, file=sys.stderr)
    aor_list = None
    names = [trunk["name"] for trunk in trunk_list if registration(trunk) == "none" and via_proxy(trunk, env)]
    if names:
        try:
            aor_list = aor_contacts(names)
        except Exception as ex:
            # Only the trunk names of the proxy alerts are missing
            print("trunks: cannot read the AOR contacts: %s" % ex, file=sys.stderr)
    return render(trunk_list, text, env, contact_list, aor_list)
