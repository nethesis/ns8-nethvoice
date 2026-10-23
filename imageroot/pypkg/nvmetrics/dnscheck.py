#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

"""Resolution of the NethVoice public names on public DNS servers.

Used by the NethVoicePublicDnsFailure alert (etc/metrics/alert-rules/nethvoice-dns.yml):

- nethvoice_public_dns_resolves{name,role}: 1 if the name has A records, 0 if
  the public resolvers say it does not exist
- nethvoice_public_dns_proxy_ip_match{name,expected,records}: 1 if the proxy
  name points to the proxy public IP, 0 otherwise

Names that no resolver answers for are not exported: blocked public DNS is
"check unavailable", not a DNS failure.
"""

import os

from .runner import CheckUnavailable

# (environment variable, role label)
NAMES = (
    ("NETHVOICE_HOST", "nethvoice"),
    ("NETHCTI_UI_HOST", "cti"),
    ("NETHVOICE_PROXY_FQDN", "proxy"),
)
RESOLVERS = ("1.1.1.1", "8.8.8.8")
LIFETIME = 2


class NameNotFound(Exception):
    """The resolver answered: the name has no A record."""


class ResolverUnreachable(Exception):
    """The resolver did not answer."""


def dns_query(name, resolver_ip):
    """Return the A records of name, asking only resolver_ip."""
    import dns.exception
    import dns.resolver

    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = [resolver_ip]
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


def lookup(name, query=dns_query):
    """Return the A records ([] if the name does not exist), or None if no resolver answered."""
    for resolver_ip in RESOLVERS:
        try:
            return query(name, resolver_ip)
        except NameNotFound:
            return []
        except ResolverUnreachable:
            continue
    return None


def proxy_public_ip(fqdn, providers):
    """Return the public IP of the proxy with this FQDN, from its sip service record."""
    for provider in providers:
        if fqdn and provider.get("fqdn") == fqdn:
            # Not "address": behind NAT it is the private IP, never in public DNS
            return provider.get("public_address") or ""
    return ""


def render(env, query, proxy_ip):
    """Return the metrics in the Prometheus text format."""
    resolves = []
    ip_match = []
    resolved = {}
    for variable, role in NAMES:
        name = env.get(variable, "")
        if not name:
            continue
        # A name used by more roles is resolved and reported once, but the
        # proxy IP is compared also when the proxy shares its name
        repeated = name in resolved
        if not repeated:
            resolved[name] = lookup(name, query)
        records = resolved[name]
        if records is None:
            continue
        if not repeated:
            resolves.append('nethvoice_public_dns_resolves{name="%s",role="%s"} %d' % (name, role, 1 if records else 0))
        if role == "proxy" and proxy_ip and records:
            ip_match.append(
                'nethvoice_public_dns_proxy_ip_match{expected="%s",name="%s",records="%s"} %d'
                % (proxy_ip, name, ",".join(sorted(records)), 1 if proxy_ip in records else 0)
            )
    if resolved and all(records is None for records in resolved.values()):
        raise CheckUnavailable("no public DNS resolver answered")
    lines = [
        "# HELP nethvoice_public_dns_resolves 1 if the public name resolves on public DNS servers",
        "# TYPE nethvoice_public_dns_resolves gauge",
        *resolves,
        "# HELP nethvoice_public_dns_proxy_ip_match 1 if the proxy name points to the proxy public IP",
        "# TYPE nethvoice_public_dns_proxy_ip_match gauge",
        *ip_match,
    ]
    return "\n".join(lines) + "\n"


def enabled(env=os.environ):
    return bool(env.get("NETHVOICE_HOST"))


def collect():
    import agent

    fqdn = os.environ.get("NETHVOICE_PROXY_FQDN", "")
    providers = agent.list_service_providers(agent.redis_connect(use_replica=True), "sip", "tcp", {"fqdn": fqdn}) if fqdn else []
    return render(os.environ, dns_query, proxy_public_ip(fqdn, providers))
