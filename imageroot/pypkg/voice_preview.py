# SPDX-License-Identifier: GPL-3.0-or-later
import re

from video_gateway import TCP_RANGE_OFFSET as VIDEO_GATEWAY_TCP_RANGE_OFFSET, UDP_PORT_VAR


TCP_PORT_VARS = ('VOICE_AGENT_HTTP_PORT', 'NETHVOICE_RECIPIENT_SERVICE_PORT', 'VOICE_AGENT_CHAT_PORT')
TCP_RANGE_OFFSET = 46
NON_TCP_PORT_VARS = (
    UDP_PORT_VAR, 'UDP_PORT', 'ASTERISK_IAX_PORT', 'ASTERISK_SIP_UDP_PORT', 'SATELLITE_RTP_PORT', 'STUNPORT',
)


def allocate_agent_ports(env):
    import agent

    occupied = {str(value) for key, value in env.items()
                if key not in TCP_PORT_VARS + NON_TCP_PORT_VARS and re.search(r'PORT\d*$', key)}
    missing = []
    for name in TCP_PORT_VARS:
        value = str(env.get(name, ''))
        if value.isdecimal() and 0 < int(value) <= 65535 and value not in occupied:
            occupied.add(value)
        else:
            missing.append(name)
    if not missing:
        return
    reserved = re.fullmatch(r'(\d+)-(\d+)', env.get('TCP_PORTS_RANGE', ''))
    ports = {}
    if reserved:
        start, end = map(int, reserved.groups())
        for name in missing:
            candidate = start + TCP_RANGE_OFFSET + TCP_PORT_VARS.index(name)
            if candidate <= end and str(candidate) not in occupied:
                ports[name] = str(candidate)
                occupied.add(str(candidate))

        # Pre-MediaMTX installs can have reserved slots that MediaMTX never used.
        end = min(end, start + TCP_RANGE_OFFSET + len(TCP_PORT_VARS) - 1)
        available = (str(port) for port in range(start + VIDEO_GATEWAY_TCP_RANGE_OFFSET, end + 1)
                     if str(port) not in occupied)
        ports.update(zip((name for name in missing if name not in ports), available))
    extra = [name for name in missing if name not in ports]
    if extra:
        first, last = agent.allocate_ports(len(extra), 'tcp', keep_existing=True)
        if last - first + 1 != len(extra):
            raise RuntimeError('Unexpected TCP allocation size')
        ports.update({name: str(first + offset) for offset, name in enumerate(extra)})
    agent.mset_env(ports)
    env.update(ports)
