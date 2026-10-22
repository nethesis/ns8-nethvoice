#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Identify this node's old SIP UDP destinations without trusting descriptions."""

import ipaddress
import json
import re
import subprocess


def node_addresses(vpn_address):
    # NethVoice uses host networking. Read addresses actually assigned on this
    # node, including local LAN/service addresses used by manually added routes
    # and trunks. Do not infer ownership from DNS, descriptions or whole subnets.
    addresses = {ipaddress.ip_address(vpn_address)}
    result = subprocess.run(
        ["ip", "-j", "address", "show"], check=True, capture_output=True,
        text=True, timeout=10,
    )
    interfaces = json.loads(result.stdout)
    if not isinstance(interfaces, list):
        raise ValueError("Invalid node interface list")
    for interface in interfaces:
        for address in interface.get("addr_info", []):
            if address.get("local"):
                addresses.add(ipaddress.ip_address(address["local"]))
    return addresses


def repoint_uri(uri, addresses, old_ports, new_port):
    match = re.fullmatch(
        r"sip:(\[[^\]]+\]|[^:;?/@\s]+):(\d+)((?:;[^?\s]*)?(?:\?[^\s]*)?)",
        uri, re.IGNORECASE,
    )
    if not match or match[2] not in old_ports:
        return uri
    try:
        if ipaddress.ip_address(match[1].strip("[]")) not in addresses:
            return uri
    except ValueError:
        return uri
    # Missing transport means UDP for sip:. Preserve explicit TCP/TLS/other
    # transports, sips: URIs, headers and all parameters byte for byte.
    for parameter in match[3].split("?", 1)[0].split(";")[1:]:
        name, separator, value = parameter.partition("=")
        if name.lower() == "transport" and (not separator or value.lower() != "udp"):
            return uri
    return uri[:match.start(2)] + new_port + uri[match.end(2):]
