#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import re
import subprocess
from urllib.parse import urlparse


def fetch(url, resolve_hosts=()):
    """Fetch the IdP metadata; hosts served by the local Traefik are resolved
    to 127.0.0.1 (hairpin NAT). Raises CalledProcessError on failure."""
    host = urlparse(url).hostname or ''
    cmd = ['curl', '-fsS', '--max-time', '15']
    if host and host in resolve_hosts:
        cmd += ['--resolve', f'{host}:443:127.0.0.1']
    cmd.append(url)
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout


def parse_branding(xml):
    """IdP entityID, display name and logo from the metadata (MDUI extension,
    Organization as fallback); empty strings when the IdP does not publish them."""
    def pick(tag):
        entries = []
        for attrs, value in re.findall(r'<' + tag + r'([^>]*)>([^<]+)<', xml):
            lang = re.search(r'xml:lang="([^"]*)"', attrs)
            entries.append((lang.group(1) if lang else '', value.strip()))
        for lang in ('it', 'en'):
            for l, v in entries:
                if l == lang:
                    return v
        return entries[0][1] if entries else ''

    entity = re.search(r'entityID="([^"]+)"', xml)
    return {
        'entity_id': entity.group(1) if entity else '',
        'display_name': pick('mdui:DisplayName') or pick('(?:md:)?OrganizationDisplayName'),
        'logo_url': pick('mdui:Logo'),
    }
