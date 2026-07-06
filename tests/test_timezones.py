import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ACTIONS_LIB = Path(__file__).resolve().parents[1] / "imageroot" / "actions" / "lib"
sys.path.insert(0, str(ACTIONS_LIB))

import timezones


class TimezoneHelperTest(unittest.TestCase):
    def test_get_accepted_timezones_uses_zoneinfo(self):
        with patch.object(
            timezones,
            "available_timezones",
            return_value={"Europe/Rome", "UTC"},
        ):
            zones = timezones.get_accepted_timezones()

        self.assertEqual(["Europe/Rome", "UTC"], zones)

    def test_get_accepted_timezones_scans_zoneinfo_if_zoneinfo_fails(self):
        messages = []

        with tempfile.TemporaryDirectory() as tmpdir:
            zoneinfo_dir = Path(tmpdir)
            (zoneinfo_dir / "Europe").mkdir()
            (zoneinfo_dir / "Europe" / "Rome").write_text("rome")
            (zoneinfo_dir / "posix").mkdir()
            (zoneinfo_dir / "posix" / "UTC").write_text("posix utc")
            (zoneinfo_dir / "zone.tab").write_text("metadata")

            with patch.object(
                timezones,
                "available_timezones",
                side_effect=RuntimeError("zoneinfo unavailable"),
            ):
                zones = timezones.get_accepted_timezones(
                    log=messages.append,
                    zoneinfo_dir=zoneinfo_dir,
                )

        self.assertEqual(["Europe/Rome", "UTC"], zones)
        self.assertTrue(messages)

    def test_get_accepted_timezones_returns_utc_if_all_sources_fail(self):
        messages = []

        with tempfile.TemporaryDirectory() as tmpdir:
            missing_zoneinfo_dir = Path(tmpdir) / "missing"
            with patch.object(
                timezones,
                "available_timezones",
                side_effect=RuntimeError("zoneinfo unavailable"),
            ):
                zones = timezones.get_accepted_timezones(
                    log=messages.append,
                    zoneinfo_dir=missing_zoneinfo_dir,
                )

        self.assertEqual(["UTC"], zones)
        self.assertTrue(messages)

    def test_get_local_timezone_uses_localtime_symlink(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            zoneinfo_dir = root / "zoneinfo"
            localtime_path = root / "localtime"
            (zoneinfo_dir / "Europe").mkdir(parents=True)
            (zoneinfo_dir / "Europe" / "Rome").write_text("rome")
            os.symlink(zoneinfo_dir / "Europe" / "Rome", localtime_path)

            timezone = timezones.get_local_timezone(
                accepted_timezones=["Europe/Rome", "UTC"],
                localtime_path=localtime_path,
                zoneinfo_dir=zoneinfo_dir,
            )

        self.assertEqual("Europe/Rome", timezone)

    def test_get_local_timezone_matches_copied_localtime(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            zoneinfo_dir = root / "zoneinfo"
            localtime_path = root / "localtime"
            (zoneinfo_dir / "Europe").mkdir(parents=True)
            (zoneinfo_dir / "Europe" / "Rome").write_bytes(b"rome")
            (zoneinfo_dir / "UTC").write_bytes(b"utc")
            localtime_path.write_bytes(b"rome")

            timezone = timezones.get_local_timezone(
                accepted_timezones=["Europe/Rome", "UTC"],
                localtime_path=localtime_path,
                zoneinfo_dir=zoneinfo_dir,
            )

        self.assertEqual("Europe/Rome", timezone)

    def test_get_local_timezone_prefers_utc_for_copied_utc_localtime(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            zoneinfo_dir = root / "zoneinfo"
            localtime_path = root / "localtime"
            (zoneinfo_dir / "Africa").mkdir(parents=True)
            (zoneinfo_dir / "Africa" / "Abidjan").write_bytes(b"utc")
            (zoneinfo_dir / "UTC").write_bytes(b"utc")
            localtime_path.write_bytes(b"utc")

            timezone = timezones.get_local_timezone(
                accepted_timezones=["Africa/Abidjan", "UTC"],
                localtime_path=localtime_path,
                zoneinfo_dir=zoneinfo_dir,
            )

        self.assertEqual("UTC", timezone)

    def test_get_local_timezone_uses_timedatectl_when_localtime_is_unavailable(self):
        def fake_run(*args, **kwargs):
            return SimpleNamespace(stdout="Europe/Rome\n")

        with tempfile.TemporaryDirectory() as tmpdir:
            timezone = timezones.get_local_timezone(
                accepted_timezones=["Europe/Rome", "UTC"],
                localtime_path=Path(tmpdir) / "missing",
                run=fake_run,
            )

        self.assertEqual("Europe/Rome", timezone)

    def test_get_local_timezone_falls_back_to_utc_on_timedatectl_timeout(self):
        messages = []

        def timeout_run(args, **kwargs):
            raise subprocess.TimeoutExpired(args, kwargs["timeout"])

        with tempfile.TemporaryDirectory() as tmpdir:
            timezone = timezones.get_local_timezone(
                accepted_timezones=["Europe/Rome", "UTC"],
                log=messages.append,
                localtime_path=Path(tmpdir) / "missing",
                run=timeout_run,
                timedatectl_timeout=1,
            )

        self.assertEqual("UTC", timezone)
        self.assertTrue(messages)


if __name__ == "__main__":
    unittest.main()
