#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Read and forward pages in the Prometheus text format.

Asterisk and satellite expose their own /metrics pages, which Prometheus
does not scrape: export-metrics copies their families into the node
textfile instead. Only the families of the application are copied: the
process_*, python_* and go_* families are already exported by
node_exporter, and a family with other label names would break the whole
node scrape.
"""

import re
import urllib.error
import urllib.request

from .aikeys import USER_AGENT
from .runner import CheckUnavailable

TIMEOUT = 4

# Set by the node (module) and by Prometheus (module_id, instance)
RESERVED_LABELS = frozenset(("module", "module_id", "instance"))
_NAME_RE = re.compile(r"[a-zA-Z_:][a-zA-Z0-9_:]*")
_LABEL_RE = re.compile(r'\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"((?:[^"\\\n]|\\.)*)"\s*(,?)')
_UNESCAPE_RE = re.compile(r"\\(.)")


def fetch(url, authorization, source):
    """Return the metrics page of source; raise CheckUnavailable when it cannot be read.

    authorization is the Authorization header value: it is never logged.
    """
    request = urllib.request.Request(url, headers={"Authorization": authorization, "User-Agent": USER_AGENT})
    # The page is local: an HTTP proxy of the environment must never get the credentials
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(request, timeout=TIMEOUT) as response:
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as ex:
        ex.close()
        raise CheckUnavailable("%s /metrics answered HTTP %d" % (source, ex.code)) from None
    except (OSError, ValueError) as ex:
        reason = getattr(ex, "reason", None) or type(ex).__name__
        raise CheckUnavailable("%s /metrics not reachable: %s" % (source, reason)) from None


def parse_sample(line):
    """Return (name, [(label, escaped value)], value) of a sample line, or None if it is not valid."""
    match = _NAME_RE.match(line)
    if not match:
        return None
    name = match.group()
    rest = line[match.end():]
    labels = []
    if rest.startswith("{"):
        position = 1
        while True:
            while rest[position:position + 1].isspace():
                position += 1
            if rest[position:position + 1] == "}":
                rest = rest[position + 1:]
                break
            label = _LABEL_RE.match(rest, position)
            if not label:
                return None
            labels.append((label.group(1), label.group(2)))
            position = label.end()
            if not label.group(3) and rest[position:position + 1] != "}":
                return None
    fields = rest.split()
    # The optional timestamp is dropped: the node textfile must not have one
    if len(fields) not in (1, 2):
        return None
    try:
        float(fields[0])
    except ValueError:
        return None
    return name, labels, fields[0]


def unescape(value):
    return _UNESCAPE_RE.sub(lambda m: "\n" if m.group(1) == "n" else m.group(1), value)


def samples(text, name):
    """Return [({label: value}, float value)] of the samples of the metric name."""
    found = []
    for line in text.splitlines():
        sample = parse_sample(line.strip())
        if sample and sample[0] == name:
            found.append(({label: unescape(value) for label, value in sample[1]}, float(sample[2])))
    return found


def forward(text, prefix):
    """Return the samples, HELP and TYPE lines of the families whose name starts with prefix.

    Samples carrying a reserved label are dropped, timestamps are removed.
    """
    lines = []
    seen = set()
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#"):
            fields = line.split(None, 3)
            if len(fields) >= 3 and fields[1] in ("HELP", "TYPE") and fields[2].startswith(prefix):
                # One HELP and one TYPE line per family
                if (fields[1], fields[2]) not in seen:
                    seen.add((fields[1], fields[2]))
                    lines.append(" ".join(fields))
            continue
        sample = parse_sample(line)
        if not sample or not sample[0].startswith(prefix):
            continue
        name, labels, value = sample
        if any(label in RESERVED_LABELS for label, _ in labels):
            continue
        if labels:
            name += "{%s}" % ",".join('%s="%s"' % label for label in labels)
        lines.append("%s %s" % (name, value))
    return "\n".join(lines) + "\n" if lines else ""


def escape(value):
    """Escape a label value."""
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
