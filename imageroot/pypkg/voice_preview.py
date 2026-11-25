# SPDX-License-Identifier: GPL-3.0-or-later
import re
import agent


def allocate_agent_ports(env):
    names = ('VOICE_AGENT_HTTP_PORT', 'NETHVOICE_RECIPIENT_SERVICE_PORT', 'VOICE_AGENT_CHAT_PORT')
    occupied = {str(value) for key, value in env.items()
                if key not in names and re.search(r'PORT\d*$', key)}
    missing = []
    for name in names:
        value = str(env.get(name, ''))
        if value.isdecimal() and 0 < int(value) <= 65535 and value not in occupied:
            occupied.add(value)
        else:
            missing.append(name)
    if not missing:
        return
    reserved = re.fullmatch(r'(\d+)-(\d+)', env.get('TCP_PORTS_RANGE', ''))
    ports = {}
    for name in missing:
        if reserved:
            candidate = int(reserved[1]) + 42 + names.index(name)
            if candidate <= int(reserved[2]) and str(candidate) not in occupied:
                ports[name] = str(candidate)
    extra = [name for name in missing if name not in ports]
    if extra:
        first, last = agent.allocate_ports(len(extra), 'tcp', keep_existing=True)
        if last - first + 1 != len(extra):
            raise RuntimeError('Unexpected TCP allocation size')
        ports.update({name: str(first + offset) for offset, name in enumerate(extra)})
    agent.mset_env(ports)
    env.update(ports)
