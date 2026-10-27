#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Resolution of the NethVoice public names on the resolver of the node.

Used by the NethVoiceDnsFailure and NethVoiceDnsSlow alerts
(etc/metrics/alert-rules/nethvoice-dns.yml):

- nethvoice_dns_resolves{name,role}: 1 if the name has A records, 0 if the
  resolver says it does not exist
- nethvoice_dns_proxy_ip_match{name,expected,records}: 1 if the proxy name
  points to one of the proxy addresses (public or private, for split DNS),
  0 otherwise
- nethvoice_dns_response_seconds{name,role}: time taken by the resolver to
  answer. A resolver that does not answer is reported as LIFETIME, and the
  name has no nethvoice_dns_resolves series.

The resolver is the one of the node (/etc/resolv.conf).
"""

import os
import time

# (environment variable, role label)
NAMES = (
    ("NETHVOICE_HOST", "nethvoice"),
    ("NETHCTI_UI_HOST", "cti"),
    ("NETHVOICE_PROXY_FQDN", "proxy"),
)
# Seconds to wait for each name. Names are resolved one by one, so all of
# them must fit in the runner deadline (runner.DEADLINE)
LIFETIME = 5


class NameNotFound(Exception):
    """The resolver answered: the name has no A record."""


class ResolverUnreachable(Exception):
    """The resolver did not answer."""


def dns_query(name):
    """Return the A records of name, asking the resolver of the node."""
    import dns.exception
    import dns.resolver

    resolver = dns.resolver.Resolver()
    try:
        answer = resolver.resolve(name, "A", lifetime=LIFETIME)
    except dns.resolver.NoNameservers as ex:
        # Also raised when the query cannot be sent (e.g. no route to the
        # resolver): that is not an answer
        if any(isinstance(error[3], OSError) for error in ex.kwargs.get("errors") or ()):
            raise ResolverUnreachable() from ex
        raise NameNotFound() from ex
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer) as ex:
        raise NameNotFound() from ex
    except (dns.exception.Timeout, OSError) as ex:
        raise ResolverUnreachable() from ex
    return [record.address for record in answer]


def lookup(name, query=dns_query, clock=time.monotonic):
    """Return (A records, seconds): records are [] if the name does not
    exist, None if the resolver did not answer."""
    start = clock()
    try:
        records = query(name)
    except NameNotFound:
        records = []
    except ResolverUnreachable:
        return None, LIFETIME
    return records, clock() - start


def proxy_addresses(fqdn, providers):
    """Return the public and private IPs of the proxy with this FQDN, from its sip service record."""
    for provider in providers:
        if fqdn and provider.get("fqdn") == fqdn:
            # Behind NAT "address" is the private IP: split DNS may return it
            addresses = [provider.get("public_address") or "", provider.get("address") or ""]
            return [address for address in dict.fromkeys(addresses) if address]
    return []


def render(env, query, proxy_ips, clock=time.monotonic):
    """Return the metrics in the Prometheus text format."""
    resolves = []
    ip_match = []
    response = []
    resolved = {}
    for variable, role in NAMES:
        name = env.get(variable, "")
        if not name:
            continue
        # A name used by more roles is resolved and reported once, but the
        # proxy IPs are compared also when the proxy shares its name
        repeated = name in resolved
        if not repeated:
            resolved[name], seconds = lookup(name, query, clock)
            response.append('nethvoice_dns_response_seconds{name="%s",role="%s"} %.3f' % (name, role, seconds))
        records = resolved[name]
        if records is None:
            continue
        if not repeated:
            resolves.append('nethvoice_dns_resolves{name="%s",role="%s"} %d' % (name, role, 1 if records else 0))
        if role == "proxy" and proxy_ips and records:
            ip_match.append(
                'nethvoice_dns_proxy_ip_match{expected="%s",name="%s",records="%s"} %d'
                % (",".join(proxy_ips), name, ",".join(sorted(records)), 1 if set(proxy_ips) & set(records) else 0)
            )
    lines = [
        "# HELP nethvoice_dns_resolves 1 if the public name resolves on the resolver of the node",
        "# TYPE nethvoice_dns_resolves gauge",
        *resolves,
        "# HELP nethvoice_dns_proxy_ip_match 1 if the proxy name points to a proxy IP",
        "# TYPE nethvoice_dns_proxy_ip_match gauge",
        *ip_match,
        "# HELP nethvoice_dns_response_seconds Time taken by the resolver of the node to answer",
        "# TYPE nethvoice_dns_response_seconds gauge",
        *response,
    ]
    return "\n".join(lines) + "\n"


def enabled(env=os.environ):
    return bool(env.get("NETHVOICE_HOST"))


def collect():
    import agent

    fqdn = os.environ.get("NETHVOICE_PROXY_FQDN", "")
    providers = agent.list_service_providers(agent.redis_connect(use_replica=True), "sip", "tcp", {"fqdn": fqdn}) if fqdn else []
    return render(os.environ, dns_query, proxy_addresses(fqdn, providers))
