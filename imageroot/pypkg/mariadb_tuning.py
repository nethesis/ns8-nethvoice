#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

# The InnoDB buffer pool of the NethVoice MariaDB. The MariaDB default (128M)
# keeps only a small part of a large CDR in memory, and the history and report
# queries then read it from disk. The node runs other modules too, so the pool
# takes a share of its memory, within bounds.

MIB = 1024 * 1024
SHARE_OF_MEMORY = 8  # 1/8 of the node memory
MIN_SIZE = 128 * MIB
MAX_SIZE = 2048 * MIB
STEP = 128 * MIB


def read_memory_total(meminfo='/proc/meminfo'):
    """Returns the memory of the node in bytes, or None if unknown."""
    try:
        with open(meminfo) as f:
            for line in f:
                if line.startswith('MemTotal:'):
                    return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        pass
    return None


def default_buffer_pool_size(memory_total=None):
    """Returns the buffer pool size for the node, e.g. "896M"."""
    if memory_total is None:
        memory_total = read_memory_total()
    if not memory_total:
        return str(MIN_SIZE // MIB) + 'M'
    size = memory_total // SHARE_OF_MEMORY // STEP * STEP
    size = max(MIN_SIZE, min(MAX_SIZE, size))
    return str(size // MIB) + 'M'
