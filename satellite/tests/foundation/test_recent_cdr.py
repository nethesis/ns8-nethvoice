import copy
import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from voice_agent.recent_cdr import qualify, number_variants

NOW = datetime(2026, 10, 20, 12, tzinfo=timezone.utc)
NUMBER = '+390212345678'
DEVICES = [{'device_id': '203', 'tech': 'PJSIP', 'destination_id': 'extension:203'}]
TRUNKS = [{'tech': 'PJSIP', 'peer': 'outbound-test'}]


def row(**kwargs):
    return dict({'calldate': NOW.replace(tzinfo=None) - timedelta(hours=2), 'dst': NUMBER,
                 'channel': 'PJSIP/203-00000001', 'dstchannel': 'PJSIP/outbound-test-00000002',
                 'lastapp': 'Dial', 'lastdata': f'PJSIP/{NUMBER}@outbound-test,30',
                 'disposition': 'ANSWERED', 'linkedid': 'attempt', 'uniqueid': 'leg'}, **kwargs)


def resolve(records, *, rules=(), zone=ZoneInfo('UTC'), now=NOW):
    return qualify(records, DEVICES, TRUNKS, NUMBER, rules, zone, now-timedelta(days=7), now)


@pytest.mark.parametrize('disposition', ['ANSWERED', 'NO ANSWER', 'BUSY'])
def test_answered_and_missed_calls_use_real_device_and_trunk(disposition):
    result = resolve([row(disposition=disposition, dstchannel='')])
    assert result == [{'destination_id': 'extension:203', 'called_at': NOW-timedelta(hours=2)}]


@pytest.mark.parametrize('changes', [
    {'channel': 'PJSIP/999-00000001'}, {'channel': 'Local/203@from-internal-00000001;1'},
    {'lastdata': 'PJSIP/+390212345678@not-a-trunk'}, {'dst': '212345678'},
    {'lastdata': 'PJSIP/+490212345678@outbound-test'}, {'disposition': 'CONGESTION'},
    {'calldate': NOW.replace(tzinfo=None)-timedelta(days=7, seconds=1)},
    {'calldate': NOW.replace(tzinfo=None)+timedelta(seconds=1)},
])
def test_ambiguous_spoofed_similar_numbers_and_old_attempts_fail(changes):
    assert resolve([row(**changes)]) == []


def test_local_legs_require_device_origin_and_no_incoming_trunk():
    origin = row(lastdata=f'Local/{NUMBER}@from-internal/n,30', dstchannel='Local/test-00000000;1')
    outbound = row(channel='Local/test-00000000;2', uniqueid='local-leg')
    assert len(resolve([origin, outbound])) == 1
    incoming = row(channel='PJSIP/outbound-test-00000003', dst='203', uniqueid='inbound')
    assert resolve([origin, outbound, incoming]) == []
    # A removed/disabled inbound trunk must not disappear from the evidence
    # merely because it is absent from the current active trunk inventory.
    incoming['channel'] = 'PJSIP/removed-trunk-00000003'
    assert resolve([origin, outbound, incoming]) == []


def test_number_rules_are_explicit_and_trunk_specific():
    rules = [{'prefix': '9', 'pattern': 'X.', 'prepend': '+39', 'tech': '', 'peer': ''}]
    assert '90212345678' in number_variants(NUMBER, rules)
    assert len(resolve([row(dst='90212345678')], rules=rules)) == 1
    # The route may explain CDR dst, but cannot authorize a different actual dial.
    assert resolve([row(lastdata='PJSIP/90212345678@outbound-test')], rules=rules) == []
    trunk_rule = dict(rules[0], tech='PJSIP', peer='outbound-test')
    assert len(resolve([row(lastdata='PJSIP/90212345678@outbound-test')], rules=[trunk_rule])) == 1
    # An outbound access prefix is never evidence about an incoming identity.
    assert resolve([dict(incoming(), src='90212345678')], rules=[trunk_rule]) == []
    assert len(resolve([incoming()], rules=[trunk_rule])) == 1


def test_timezone_lookback_boundary_and_dst_ambiguity():
    zone = ZoneInfo('Europe/Rome')
    at = (NOW-timedelta(days=7)).astimezone(zone).replace(tzinfo=None)
    assert resolve([row(calldate=at)], zone=zone)[0]['called_at'] == NOW-timedelta(days=7)
    assert resolve([row(calldate=at-timedelta(seconds=1))], zone=zone) == []
    ambiguous = datetime(2026, 10, 25, 2, 30)
    assert resolve([row(calldate=ambiguous)], zone=zone, now=datetime(2026,10,26,tzinfo=timezone.utc)) == []


@pytest.mark.skipif(not os.getenv('M0_TEST_PORT'), reason='disposable MariaDB not selected')
def test_real_cdr_views_query_bounds_and_privileges(monkeypatch):
    import mysql.connector
    import voice_agent.storage as module
    @contextmanager
    def connect(role):
        assert role == 'config'
        db = mysql.connector.connect(host='127.0.0.1', port=int(os.environ['M0_TEST_PORT']), user='m0_reader', password='')
        try: yield db
        finally: db.close()
    monkeypatch.setattr(module, 'database', connect)
    monkeypatch.setenv('VOICE_AGENT_CDR_TIMEZONE', 'UTC')
    found = module.Storage().recent_calls(NUMBER, 7)
    assert len(found) == 1 and found[0]['destination_id'] == 'extension:203'
    assert module.Storage().recent_calls('+390200000000', 7) == []
    conversations = module.Storage().recent_calls('+39 (02) 1234-5679', 7)
    assert len(conversations) == 1 and conversations[0]['destination_id'] == 'extension:203'
    with pytest.raises(ValueError, match='recent_lookup_overflow'):
        module.Storage().recent_calls('+390212340999', 7)
    with pytest.raises(ValueError, match='recent_lookup_overflow'):
        module.Storage().recent_calls('+390212340998', 7)
    with connect('config') as db:
        cursor = db.cursor()
        for sql in ('SELECT * FROM asteriskcdrdb.cdr LIMIT 0',
                    "UPDATE asterisk.voice_agent_recent_cdr SET dst='forged'",
                    'SELECT * FROM asterisk.trunks LIMIT 0'):
            with pytest.raises(mysql.connector.Error):
                cursor.execute(sql)


def incoming(**changes):
    return row(src=NUMBER, dst='203', channel='PJSIP/outbound-test-00000001',
               dstchannel='PJSIP/203-00000002', lastdata='', billsec=30, **changes)


@pytest.mark.parametrize('application', ['Dial', 'Queue'])
def test_caller_initiated_answered_conversation_proposes_actual_recipient(application):
    assert resolve([incoming(lastapp=application)]) == [
        {'destination_id':'extension:203','called_at':NOW-timedelta(hours=2)}]


@pytest.mark.parametrize('changes', [
    {'src':'+390299999999'}, {'src':'212345678'}, {'disposition':'NO ANSWER'},
    {'disposition':'BUSY'}, {'billsec':0}, {'billsec':-1}, {'lastapp':'VoiceMail'},
    {'channel':'PJSIP/203-00000001'}, {'channel':'PJSIP/unknown-trunk-00000001'},
    {'channel':'Local/203@from-internal-00000001;2'},
    {'dstchannel':'PJSIP/999-00000002'}, {'dstchannel':'Local/203@from-internal-00000001;1'},
    {'calldate':NOW.replace(tzinfo=None)-timedelta(days=8)},
])
def test_unanswered_or_unproven_incoming_contacts_are_not_proposed(changes):
    record=incoming();record.update(changes)
    assert resolve([record]) == []


def test_both_directions_use_latest_conversation_without_inventing_local_legs():
    outbound=row(linkedid='outbound')
    inbound=incoming(linkedid='inbound',calldate=NOW.replace(tzinfo=None)-timedelta(hours=1))
    assert resolve([outbound,inbound]) == [
        {'destination_id':'extension:203','called_at':NOW-timedelta(hours=2)},
        {'destination_id':'extension:203','called_at':NOW-timedelta(hours=1)}]
    devices=DEVICES+[{'device_id':'90203','tech':'PJSIP','destination_id':'extension:203'}]
    inbound['dstchannel']='PJSIP/90203-00000002'
    assert qualify([inbound],devices,TRUNKS,NUMBER,(),ZoneInfo('UTC'),NOW-timedelta(days=7),NOW)[0]['destination_id']=='extension:203'


def test_native_attended_handoff_counts_only_the_leg_actually_joined_by_caller():
    peer='Local/203@voice-agent-consult-000000ab;1'
    caller=incoming();caller.update(lastapp='Bridge',lastdata=peer+',x',dstchannel=peer)
    colleague=row(channel=peer[:-1]+'2',dst='203',lastdata='',billsec=50,dstchannel='PJSIP/203-00000003')
    assert resolve([caller,colleague]) == [{'destination_id':'extension:203','called_at':NOW-timedelta(hours=2)}]
    assert resolve([colleague]) == []
    for change in ({'linkedid':'unrelated'},{'channel':'Local/203@voice-agent-consult-000000ac;2'},
                   {'dstchannel':'PJSIP/999-00000003'},{'billsec':0},{'disposition':'NO ANSWER'}):
        wrong=dict(colleague,**change)
        assert resolve([caller,wrong]) == []
    caller['billsec']=0
    assert resolve([caller,colleague]) == []
