#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Run the export-metrics collectors one by one.

A collector is a function that returns metrics in the Prometheus text format.
A failing collector is logged and reported by
nethvoice_exporter_collector_up{collector}; the others are still exported.
"""

import sys
import threading
import time

# The node kills export-metrics after 30 seconds and keeps the previous
# output (ns8-core refresh-module-metrics): stop waiting well before that
DEADLINE = 20


class CheckUnavailable(Exception):
    """The collector cannot check its target right now (not an alert)."""


def _collect(name, collect, results):
    try:
        results[name] = collect()
    except Exception as ex:
        print("%s: %s" % (name, ex), file=sys.stderr)


def run(collectors, deadline=DEADLINE):
    """collectors: [(name, function or None when disabled)]

    The collectors run in parallel. A collector still running after deadline
    seconds is reported as failed and its thread is abandoned.
    """
    results = {}
    threads = []
    for name, collect in collectors:
        if collect is None:
            continue
        thread = threading.Thread(target=_collect, args=(name, collect, results), daemon=True)
        thread.start()
        threads.append((name, thread))
    end = time.monotonic() + deadline
    output = []
    status = []
    for name, thread in threads:
        thread.join(max(0, end - time.monotonic()))
        if thread.is_alive():
            print("%s: no result after %d seconds" % (name, deadline), file=sys.stderr)
            text = None
        else:
            text = results.get(name)
        if text is not None:
            output.append(text)
        status.append('nethvoice_exporter_collector_up{collector="%s"} %d' % (name, text is not None))
    lines = [
        "# HELP nethvoice_exporter_collector_up 1 if the collector ran, 0 if it failed",
        "# TYPE nethvoice_exporter_collector_up gauge",
        *status,
    ]
    return "".join(output) + "\n".join(lines) + "\n"


def once(function):
    """Return a function that calls function only the first time.

    Later calls return the same result, or raise the same exception: a page
    used by more collectors is read once per run, also when the collectors
    ask for it at the same time.
    """
    outcome = []
    lock = threading.Lock()

    def wrapper():
        with lock:
            if not outcome:
                try:
                    outcome.append((True, function()))
                except Exception as ex:
                    outcome.append((False, ex))
        ok, value = outcome[0]
        if ok:
            return value
        raise value

    return wrapper
