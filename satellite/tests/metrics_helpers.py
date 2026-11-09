"""
Helpers to read single samples out of the Prometheus text exposition.
"""
from typing import Optional

from prometheus_client.parser import text_string_to_metric_families

import metrics


def sample_value(name: str, text: Optional[str] = None, **labels) -> str:
    """Return the sample value formatted like "-1", "0" or "2"."""
    if text is None:
        text = metrics.render()
    for family in text_string_to_metric_families(text):
        for sample in family.samples:
            if sample.name == name and sample.labels == labels:
                return format(sample.value, "g")
    raise AssertionError(f"sample not found: {name}{labels}")
