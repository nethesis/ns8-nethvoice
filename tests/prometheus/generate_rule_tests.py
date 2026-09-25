#!/usr/bin/env python3

#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Generate fixtures from the shipped rules for `promtool test rules tests.yml`."""

import argparse
import importlib.machinery
import importlib.util
import sys
import types
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[2]
sys.modules["agent"] = types.ModuleType("agent")
loader = importlib.machinery.SourceFileLoader("alert_publisher", str(ROOT / "imageroot/bin/prometheus-alert-rules"))
spec = importlib.util.spec_from_loader(loader.name, loader)
publisher = importlib.util.module_from_spec(spec)
loader.exec_module(publisher)


def labels(module="nethvoice1"):
    # Deliberately share instance across modules to exercise the module_id join.
    return {"instance": "10.5.4.1:20137", "module_id": module, "node": "1",
            "target_type": "systemd", "job": "providers"}


def series(metric, values, module="nethvoice1", **extra):
    dimensions = ",".join(f'{key}="{value}"' for key, value in dict(labels(module), **extra).items())
    return {"series": f"{metric}{{{dimensions}}}", "values": values}


def expected(rule, module="nethvoice1"):
    return {
        "exp_labels": dict(labels(module), **rule["labels"]),
        "exp_annotations": {key: value.replace("{{ $labels.module_id }}", module).replace("{{ $labels.node }}", "1")
                            for key, value in rule["annotations"].items()},
    }


def test_at(rule, time, modules=()):
    return {"eval_time": time, "alertname": rule["alert"], "exp_alerts": [expected(rule, m) for m in modules]}


def generate(output):
    output.mkdir(parents=True, exist_ok=True)
    services = publisher.CORE_SERVICES + publisher.CTI_SERVICES + publisher.SATELLITE_SERVICES + (publisher.SATELLITE_DATABASE,)
    rules = [publisher.service_rule(*service) for service in services] + [publisher.exporter_rule()]
    (output / "rules.yml").write_text(publisher.rule_document("test", rules))
    freepbx = rules[0]
    exporter = rules[-1]
    tests = [{
        "name": "Healthy services and exporter",
        "interval": "1m",
        "input_series": [series("up", "1+0x10")] + [
            series("systemd_unit_state", "1+0x10", name=f"{service}.service", state="active")
            for service, _ in services
        ],
        "alert_rule_test": [test_at(rule, "10m") for rule in rules],
    }]
    for state in ("inactive", "failed", "activating", "deactivating"):
        tests.append({
            "name": f"{state} for five minutes then recovery",
            "interval": "1m",
            "input_series": [
                series("up", "1+0x10"),
                series("systemd_unit_state", "0+0x5 1+0x4", name="freepbx.service", state="active"),
                series("systemd_unit_state", "1+0x5 0+0x4", name="freepbx.service", state=state),
            ],
            "alert_rule_test": [test_at(freepbx, "4m"), test_at(freepbx, "5m", ["nethvoice1"]),
                                test_at(freepbx, "6m"), test_at(exporter, "5m")],
        })
    tests.extend([
        {
            "name": "Brief restart does not alert",
            "interval": "1m",
            "input_series": [series("up", "1+0x10"),
                             series("systemd_unit_state", "1 0 0 1+0x7", name="freepbx.service", state="active")],
            "alert_rule_test": [test_at(freepbx, f"{minute}m") for minute in range(11)],
        },
        {
            "name": "Missing expected unit is unavailable",
            "interval": "1m",
            "input_series": [series("up", "1+0x6")],
            "alert_rule_test": [test_at(freepbx, "4m"), test_at(freepbx, "5m", ["nethvoice1"])],
        },
        {
            "name": "Disappearing unit alerts after five minutes",
            "interval": "1m",
            "input_series": [series("up", "1+0x10"),
                             series("systemd_unit_state", "1 stale", name="freepbx.service", state="active")],
            "alert_rule_test": [test_at(freepbx, "5m"), test_at(freepbx, "6m", ["nethvoice1"])],
        },
        {
            "name": "Exporter outage suppresses service alerts and recovers",
            "interval": "1m",
            "input_series": [series("up", "0+0x5 1+0x4")],
            "alert_rule_test": [test_at(exporter, "4m"), test_at(exporter, "5m", ["nethvoice1"]),
                                test_at(exporter, "6m"), test_at(freepbx, "5m"), test_at(freepbx, "10m")],
        },
        {
            "name": "Healthy module cannot suppress another module on the same instance",
            "interval": "1m",
            "input_series": [series("up", "1+0x6"), series("up", "1+0x6", module="nethvoice2"),
                             series("systemd_unit_state", "1+0x6", name="freepbx.service", state="active")],
            "alert_rule_test": [test_at(freepbx, "5m", ["nethvoice2"])],
        },
        {
            "name": "One service recovery does not clear another service alert",
            "interval": "1m",
            "input_series": [series("up", "1+0x10"),
                             series("systemd_unit_state", "0+0x5 1+0x4", name="freepbx.service", state="active")],
            "alert_rule_test": [test_at(freepbx, "6m"), test_at(rules[1], "6m", ["nethvoice1"])],
        },
    ])
    (output / "tests.yml").write_text(yaml.safe_dump({
        "rule_files": ["rules.yml"], "evaluation_interval": "1m", "tests": tests,
    }, sort_keys=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    generate(parser.parse_args().output)
