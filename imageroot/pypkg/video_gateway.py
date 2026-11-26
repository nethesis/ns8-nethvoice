#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Ports and addresses of the video gateway (MediaMTX, NethServer/dev#7535).

The gateway needs three loopback TCP ports (WHEP behind traefik, control
API, local RTSP listener) and one public ICE port, opened on both UDP and
TCP. The TCP ports come from the instance TCP range on new installs and from
single allocations on existing ones. The ICE UDP port is ALWAYS a separate
allocation, kept out of UDP_PORTS_RANGE: changing the size of that block
would make update-module.d/20allocate_ports move every RTP/SIP port of the
instance.
"""

# Loopback TCP ports, in the order of their index in TCP_PORTS_RANGE on new
# installs (create-module/05setenvs), then the public ICE TCP port.
TCP_PORT_VARS = (
    "MEDIAMTX_WHEP_PORT",
    "MEDIAMTX_API_PORT",
    "MEDIAMTX_RTSP_PORT",
    "MEDIAMTX_ICE_TCP_PORT",
)
UDP_PORT_VAR = "MEDIAMTX_ICE_UDP_PORT"
# First index of TCP_PORT_VARS in the TCP_PORTS_RANGE of a new install
TCP_RANGE_OFFSET = 42


def ice_env(srv):
    """Return the ICE environment from the nethvoice-proxy sip service record.

    MEDIAMTX_PUBLIC_IP is the address the devices see the PBX coming from:
    the customer restricts the RTSP port-forward to it. MEDIAMTX_ICE_HOSTS are
    the addresses announced to the WebRTC clients: the public one and, behind
    NAT, the private one for clients on the same LAN.
    """
    public = (srv.get("public_address") or srv.get("address") or "").strip()
    hosts = []
    for host in (public, (srv.get("address") or "").strip()):
        if host and host not in hosts and host not in ("127.0.0.1", "::1"):
            hosts.append(host)
    return {
        "MEDIAMTX_PUBLIC_IP": public if public not in ("127.0.0.1", "::1") else "",
        "MEDIAMTX_ICE_HOSTS": ",".join(hosts),
    }


def missing_port_vars(env):
    """Names of the gateway port variables not set yet."""
    return [name for name in TCP_PORT_VARS + (UDP_PORT_VAR,) if not env.get(name)]


def allocate_missing_ports(agent, env, log):
    """Allocate the gateway ports missing from env, keeping every existing
    allocation of the instance (keep_existing=True). Return the new
    variables; never touch UDP_PORTS_RANGE nor the RTP/SIP variables."""
    allocated = {}
    tcp_missing = [name for name in TCP_PORT_VARS if not env.get(name)]
    if tcp_missing:
        start, end = agent.allocate_ports(len(tcp_missing), "tcp", keep_existing=True)
        for offset, name in enumerate(tcp_missing):
            allocated[name] = str(int(start) + offset)
            # Record each allocation at once: a later failure must not leak it
            agent.set_env(name, allocated[name])
        log(f"New TCP ports allocated for the video gateway: {start}-{end}")
    if not env.get(UDP_PORT_VAR):
        start, _end = agent.allocate_ports(1, "udp", keep_existing=True)
        allocated[UDP_PORT_VAR] = str(start)
        agent.set_env(UDP_PORT_VAR, allocated[UDP_PORT_VAR])
        log(f"New UDP port allocated for the video gateway ICE: {start}")
    return allocated


def firewall_ports(env):
    """Public firewall entries of the gateway: only the ICE ports."""
    ports = []
    if env.get("MEDIAMTX_ICE_UDP_PORT"):
        ports.append(f"{env['MEDIAMTX_ICE_UDP_PORT']}/udp")
    if env.get("MEDIAMTX_ICE_TCP_PORT"):
        ports.append(f"{env['MEDIAMTX_ICE_TCP_PORT']}/tcp")
    return ports
