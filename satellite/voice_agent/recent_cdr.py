"""Conservative qualification of native CDR legs; no suffix-based identities."""
import re
from datetime import timezone

from .recent_callers import normalize_number


def pattern_matches(number, pattern):
    # Native digit patterns only. Unsupported patterns fail closed.
    if not re.fullmatch(r'[0-9XZN]*\.?', pattern or ''):
        return False
    regex = ''.join({'X': '[0-9]', 'Z': '[1-9]', 'N': '[2-9]', '.': '[0-9]+'}.get(c, c) for c in pattern)
    return bool(re.fullmatch(regex, number))


def number_variants(number, rules):
    variants = {number}
    for rule in rules:
        prefix, prepend = rule['prefix'], rule['prepend']
        if not re.fullmatch(r'[0-9]*', prefix) or not re.fullmatch(r'\+?[0-9]*', prepend):
            continue
        if number.startswith(prepend):
            rest = number[len(prepend):]
            if rest and pattern_matches(rest, rule['pattern']):
                variants.add(prefix + rest)
        if number.startswith(prefix):
            rest = number[len(prefix):]
            if rest and pattern_matches(rest, rule['pattern']):
                variants.add(prepend + rest)
    if len(variants) > 16:
        raise ValueError('recent_lookup_overflow')
    return variants


def channel_peer(channel):
    match = re.fullmatch(r'(PJSIP|SIP|IAX2)/([A-Za-z0-9_.-]+)-[a-fA-F0-9]{8,}', channel or '')
    return (match[1], match[2]) if match else None


def qualify(rows, devices, trunks, caller, rules, zone, earliest, now):
    """Qualify outbound callbacks and answered inbound conversations.

    Local legs may corroborate the same attempt, but cannot establish identity.
    Outbound callbacks reject mixed groups and multiple device origins. Incoming
    conversations require the actual answered trunk-to-device leg, not a linkedid guess.
    """
    peers = {}
    for device in devices:
        key = (device['tech'].upper(), device['device_id'])
        peers.setdefault(key, set()).add(device['destination_id'])
    trunk_peers = {(t['tech'].upper(), t['peer']) for t in trunks}
    variants = number_variants(caller, rules)
    groups = {}
    for row in rows:
        groups.setdefault(row.get('linkedid') or row['uniqueid'], []).append(row)
    result = []
    for group in groups.values():
        origins = set()
        outbound = []
        incoming = False
        for row in group:
            channel = row.get('channel') or ''
            source = channel_peer(channel)
            if (source in trunk_peers or (source is not None and source not in peers)
                    or (source is None and not channel.startswith('Local/'))):
                incoming = True
            origins.update(peers.get(source, ()))
            at = row['calldate']
            # Native CDR wall times cannot identify either occurrence at DST.
            first, second = at.replace(tzinfo=zone, fold=0), at.replace(tzinfo=zone, fold=1)
            if first.utcoffset() != second.utcoffset():
                continue
            at = first.astimezone(timezone.utc)
            if not earliest <= at <= now:
                continue
            recipient = peers.get(channel_peer(row.get('dstchannel')), set())
            if row.get('lastapp') == 'Bridge':
                peer = (row.get('lastdata') or '').split(',')[0]
                match = re.fullmatch(r'Local/([0-9]{1,20})@voice-agent-consult-[a-fA-F0-9]+;1', peer)
                recipient = set()
                if match:
                    # An exact native handoff proves the caller joined this
                    # answered leg; a private consultation by itself does not.
                    for leg in group:
                        target = peers.get(channel_peer(leg.get('dstchannel')), set())
                        if (leg.get('channel') == peer[:-1] + '2' and leg.get('lastapp') == 'Dial'
                                and leg.get('disposition') == 'ANSWERED' and leg.get('billsec', 0) > 0
                                and target == {'extension:' + match[1]}):
                            recipient.update(target)
            if (source in trunk_peers and normalize_number(row.get('src')) == caller
                    and row.get('lastapp') in ('Dial', 'Queue', 'Bridge') and row.get('disposition') == 'ANSWERED'
                    and type(row.get('billsec')) is int and row['billsec'] > 0 and len(recipient) == 1):
                result.append({'destination_id': next(iter(recipient)), 'called_at': at})
            if normalize_number(row.get('dst')) not in variants:
                continue
            if row.get('lastapp') != 'Dial' or row.get('disposition') not in {'ANSWERED', 'NO ANSWER', 'BUSY'}:
                continue
            dial = (row.get('lastdata') or '').split(',')[0]
            # PJSIP/number@trunk and SIP/trunk/number are native forms. Do
            # not parse arbitrary custom trunk URIs, credentials or dial strings.
            match = re.fullmatch(r'(PJSIP|SIP|IAX2)/(\+?[0-9]+)@([A-Za-z0-9_.-]+)', dial)
            if match:
                tech, number, peer = match[1], match[2], match[3]
            else:
                match = re.fullmatch(r'(PJSIP|SIP|IAX2)/([A-Za-z0-9_.-]+)/(\+?[0-9]+)', dial)
                if not match:
                    continue
                tech, peer, number = match[1], match[2], match[3]
            # Route prefixes help locate original CDR dst values, but only
            # this actual trunk's transformations can explain its dialed number.
            dial_variants = number_variants(caller, [r for r in rules if (r.get('tech'), r.get('peer')) == (tech, peer)])
            if (tech, peer) not in trunk_peers or number not in dial_variants:
                continue
            destination_peer = channel_peer(row.get('dstchannel'))
            if destination_peer and destination_peer != (tech, peer):
                continue
            outbound.append(at)
        if not incoming and len(origins) == 1 and outbound:
            result.append({'destination_id': next(iter(origins)), 'called_at': max(outbound)})
    return result
