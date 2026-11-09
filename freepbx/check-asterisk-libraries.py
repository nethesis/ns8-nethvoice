#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Fail image builds if an Asterisk binary or module has missing libraries."""
from pathlib import Path
import subprocess
import sys

paths = [Path('/usr/sbin/asterisk'),
         *sorted(Path('/usr/lib/asterisk/modules').glob('*.so')),
         *sorted(Path('/usr/lib').glob('libasterisk*.so*'))]
failed = False
for path in paths:
    result = subprocess.run(['ldd', str(path)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if result.returncode or 'not found' in result.stdout:
        print(f'{path}:\n{result.stdout}', file=sys.stderr)
        failed = True
if failed:
    sys.exit(1)
print(f'Asterisk shared libraries verified for {len(paths)} binaries and modules')
