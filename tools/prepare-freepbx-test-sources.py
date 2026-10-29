#!/usr/bin/env python3
"""Download the same checksum-verified FreePBX sources used by the image."""
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import tarfile
import urllib.request

root = Path(__file__).resolve().parents[1]
dest = Path(sys.argv[1]).resolve()
dest.mkdir(parents=True, exist_ok=True)
containerfile = (root / 'freepbx/Containerfile').read_text()
checksums = dict(line.split()[::-1] for line in (root / 'freepbx/remote-artifacts.sha256').read_text().splitlines())
for module in ('core', 'framework', 'paging', 'iaxsettings'):
    url = re.search(r'install_module ' + module + r' (\S+)', containerfile)[1]
    version = url.removesuffix('.tar.gz').rsplit('/', 1)[1]
    archive = dest / f'{module}-{version}.tar.gz'
    # codeload serves the same GitHub archive without the redirect/rate limit.
    download = url.replace('https://github.com/', 'https://codeload.github.com/').replace('/archive/refs/tags/', '/tar.gz/refs/tags/').removesuffix('.tar.gz')
    if not archive.exists():
        urllib.request.urlretrieve(download, archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != checksums[archive.name]:
        raise RuntimeError(f'Checksum mismatch: {archive.name}')
    target = dest / module
    target.mkdir(exist_ok=True)
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            member.name = '/'.join(member.name.split('/')[1:])
            if member.name:
                tar.extract(member, target, filter='data')
    patches = sorted((root / 'freepbx/patches').glob('freepbx-core-821*.patch')) + [root / 'freepbx/patches/freepbx-core-bindaddress.patch'] if module == 'core' else {
        'paging': [root / 'freepbx/patches/freepbx-paging-transfers.patch'],
        'iaxsettings': [root / 'freepbx/patches/freepbx-iaxsettings-preserve.patch'],
    }.get(module, [])
    for patch in patches:
        subprocess.run(['patch', '--batch', '--fuzz=0', '-p1', '-d', str(target), '-i', str(patch)], check=True)
