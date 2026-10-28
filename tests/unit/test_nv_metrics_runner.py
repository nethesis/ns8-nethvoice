#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import io
import sys
import threading
import time
import unittest
from contextlib import redirect_stderr
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "imageroot" / "pypkg"))

from nvmetrics import runner  # noqa: E402


def ok():
    return 'a_metric{x="1"} 1\n'


def unavailable():
    raise runner.CheckUnavailable("resolvers unreachable")


def broken():
    raise ValueError("boom")


class RunTest(unittest.TestCase):
    def run_collectors(self, collectors):
        err = io.StringIO()
        with redirect_stderr(err):
            text = runner.run(collectors)
        return text, err.getvalue()

    def test_output_of_working_collector_and_status(self):
        text, _ = self.run_collectors([("a", ok)])
        self.assertIn('a_metric{x="1"} 1\n', text)
        self.assertIn('nethvoice_exporter_collector_up{collector="a"} 1\n', text)

    def test_failing_collector_does_not_stop_the_others(self):
        text, err = self.run_collectors([("a", broken), ("b", ok)])
        self.assertIn('nethvoice_exporter_collector_up{collector="a"} 0\n', text)
        self.assertIn('nethvoice_exporter_collector_up{collector="b"} 1\n', text)
        self.assertIn('a_metric{x="1"} 1\n', text)
        self.assertIn("a: boom", err)

    def test_unavailable_check_has_no_samples(self):
        text, err = self.run_collectors([("dns", unavailable)])
        self.assertIn('nethvoice_exporter_collector_up{collector="dns"} 0\n', text)
        self.assertIn("dns: resolvers unreachable", err)

    def test_disabled_collector_is_silent(self):
        text, _ = self.run_collectors([("a", None)])
        self.assertNotIn('collector="a"', text)

    def test_collectors_run_in_parallel(self):
        def slow():
            time.sleep(0.5)
            return ok()

        started = time.monotonic()
        text, _ = self.run_collectors([("a", slow), ("b", slow), ("c", slow)])
        self.assertLess(time.monotonic() - started, 1.2)
        self.assertEqual(text.count('a_metric{x="1"} 1\n'), 3)

    def test_collector_over_the_deadline_is_failed(self):
        def hung():
            time.sleep(5)
            return 'late_metric 1\n'

        err = io.StringIO()
        started = time.monotonic()
        with redirect_stderr(err):
            text = runner.run([("slow", hung), ("a", ok)], deadline=0.3)
        self.assertLess(time.monotonic() - started, 2)
        self.assertNotIn("late_metric", text)
        self.assertIn('nethvoice_exporter_collector_up{collector="slow"} 0\n', text)
        self.assertIn('nethvoice_exporter_collector_up{collector="a"} 1\n', text)
        self.assertIn("slow: no result after", err.getvalue())

    def test_output_keeps_the_collector_order(self):
        def late():
            time.sleep(0.2)
            return "first 1\n"

        text, _ = self.run_collectors([("a", late), ("b", lambda: "second 1\n")])
        self.assertLess(text.index("first 1"), text.index("second 1"))
        self.assertLess(text.index('collector="a"'), text.index('collector="b"'))


class OnceTest(unittest.TestCase):
    def test_result_is_reused(self):
        calls = []

        def page():
            calls.append(1)
            return "text"

        cached = runner.once(page)
        self.assertEqual((cached(), cached()), ("text", "text"))
        self.assertEqual(len(calls), 1)

    def test_called_once_by_parallel_callers(self):
        calls = []

        def page():
            calls.append(1)
            time.sleep(0.2)
            return "text"

        cached = runner.once(page)
        results = []
        threads = [threading.Thread(target=lambda: results.append(cached())) for _ in range(3)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(results, ["text"] * 3)
        self.assertEqual(len(calls), 1)

    def test_exception_is_reused(self):
        calls = []

        def page():
            calls.append(1)
            raise runner.CheckUnavailable("down")

        cached = runner.once(page)
        for _ in range(2):
            with self.assertRaises(runner.CheckUnavailable):
                cached()
        self.assertEqual(len(calls), 1)


if __name__ == "__main__":
    unittest.main()
