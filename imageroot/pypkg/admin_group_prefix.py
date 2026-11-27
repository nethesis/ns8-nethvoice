#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import os
import re
import sys

import agent


PREFIX_VARIABLE = "NETHVOICE_ADMIN_GROUP_PREFIX"
DEFAULT_PREFIX = "nethvoice"
PREFIX_PATTERN = re.compile(r"nethvoice([a-z0-9-]{0,22}[a-z0-9])?")


def is_valid(prefix):
    return bool(prefix) and PREFIX_PATTERN.fullmatch(prefix) is not None


def module_number(module_id):
    match = re.fullmatch(r"nethvoice(\d+)", module_id or "")
    return int(match.group(1)) if match else None


def choose_prefix(module_id, current, others):
    claimed = {prefix for _, prefix in others if prefix}
    if is_valid(current) and current not in claimed:
        return current
    number = module_number(module_id)
    lower_unset = any(
        not prefix
        and number is not None
        and module_number(other) is not None
        and module_number(other) < number
        for other, prefix in others
    )
    if DEFAULT_PREFIX not in claimed and not lower_unset:
        return DEFAULT_PREFIX
    base = DEFAULT_PREFIX + (str(number) if number is not None else "-" + re.sub(r"[^a-z0-9]", "", (module_id or "").lower())[:12])
    candidate = base
    suffix = 2
    while candidate in claimed or not is_valid(candidate):
        candidate = f"{base[:20]}-{suffix}"
        suffix += 1
    return candidate


def other_instances(rdb, module_id, domain):
    others = []
    for key in rdb.scan_iter(match="module/*/environment"):
        other = key.split("/")[1]
        if other == module_id:
            continue
        environment = rdb.hgetall(key)
        if agent.get_image_name_from_url(environment.get("IMAGE_URL", "")) != "nethvoice":
            continue
        if environment.get("USER_DOMAIN", "") != domain:
            continue
        others.append((other, environment.get(PREFIX_VARIABLE, "")))
    return sorted(others)


def read_environment():
    return agent.read_envfile(os.path.join(os.environ["AGENT_STATE_DIR"], "environment"))


def configure(rdb=None):
    environment = read_environment()
    domain = environment.get("USER_DOMAIN", "")
    current = environment.get(PREFIX_VARIABLE, "")
    if not domain:
        return current
    module_id = os.environ["MODULE_ID"]
    rdb = rdb or agent.redis_connect(use_replica=True)
    prefix = choose_prefix(module_id, current, other_instances(rdb, module_id, domain))
    if prefix != current:
        agent.set_env(PREFIX_VARIABLE, prefix)
        print(f"Administrator groups prefix set to {prefix}", file=sys.stderr)
    return prefix


def claimed_by_others(prefix, rdb=None):
    environment = read_environment()
    module_id = os.environ["MODULE_ID"]
    rdb = rdb or agent.redis_connect(use_replica=True)
    others = other_instances(rdb, module_id, environment.get("USER_DOMAIN", ""))
    return prefix in {other_prefix for _, other_prefix in others if other_prefix}
