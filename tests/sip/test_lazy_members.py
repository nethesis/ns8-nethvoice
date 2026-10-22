"""Exercise cancellation through the installed harness, without SIP traffic."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

import queue_test
from lazy_members import LazySuite, TestError


class LazySuiteLifecycleTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        config = dict(owner='nvtest-unit', strategy='ringall', ring_timeout=4,
                      retry=1, ringinuse=False, autopause='no', lazy=True,
                      penalties=[0, 1], extensions=['899901', '899902', '899903'],
                      queue='899910', domain='example.invalid', client_proxy='',
                      sip_base=15101, rtp_base=31000)
        self.events = []
        self.pbx = Mock()
        self.pbx.cli.return_value = ''
        self.pbx.fixture.side_effect = self.fixture
        self.suite = LazySuite(self.pbx, config, root, root / 'report.json', repeats=1)
        self.suite.direct = Mock(return_value={})
        self.suite.member_controls = Mock(return_value={})
        self.suite.queue_call = Mock(side_effect=lambda **kw: self.event('baseline-queue'))
        self.suite.wait_order = Mock(side_effect=lambda order: self.event('all-noanswer'))
        self.suite.visualplan = Mock(side_effect=lambda: self.event('visualplan'))
        self.clients = []
        self.ami = Mock()
        self.ami.cursor.return_value = 0
        self.ami.events_since.return_value = []
        contexts = contextlib.ExitStack()
        self.addCleanup(contexts.close)
        contexts.enter_context(patch.object(queue_test, 'Endpoint', side_effect=self.endpoint))
        contexts.enter_context(patch.object(queue_test, 'AMI', return_value=self.ami))
        contexts.enter_context(contextlib.redirect_stdout(io.StringIO()))

    def event(self, name):
        self.events.append(name)
        return {}

    def fixture(self, operation, config):
        if operation == 'inspect':
            return dict(occupied=False, lazy_configurable=True)
        if operation == 'create':
            return {'accounts': [{'username': ext} for ext in config['extensions']]}
        if operation == 'delete':
            self.events.append('teardown')
        return {}

    def endpoint(self, config, workdir, label):
        client = Mock()
        client.config = config
        client.name = label
        client.sequence = 0
        client.state = dict(alive=True, call='IDLE')
        client.snapshot.return_value = {'events': []}
        self.clients.append(client)
        return client

    def assert_teardown(self):
        self.assertEqual(self.events[-1], 'teardown')
        for client in self.clients:
            client.action.assert_called_once_with('unregister')
            client.close.assert_called_once_with()
        self.ami.close.assert_called_once_with()
        self.assertFalse((self.suite.workdir / 'fixture.json').exists())

    def assert_no_extra_scenarios(self):
        self.suite.wait_order.assert_not_called()
        self.suite.visualplan.assert_not_called()

    def test_extra_scenarios_run_once_after_all_baseline_repetitions(self):
        self.suite.repeats = 2
        self.assertEqual(self.suite.run(), 0)
        self.assertEqual(self.events, ['baseline-queue'] * 4 +
                         ['all-noanswer', 'visualplan', 'baseline-queue', 'teardown'])
        self.suite.wait_order.assert_called_once_with(['A', 'B', 'A', 'B'])
        self.suite.visualplan.assert_called_once_with()
        self.assert_teardown()

    def test_interrupted_baseline_goes_straight_to_teardown(self):
        self.suite.direct.side_effect = KeyboardInterrupt
        self.assertEqual(self.suite.run(), 1)
        self.assert_no_extra_scenarios()
        self.suite.queue_call.assert_not_called()
        self.assert_teardown()

    def test_failed_last_registration_does_not_start_scenarios(self):
        def endpoint(config, workdir, label):
            client = self.endpoint(config, workdir, label)
            if label == 'B':
                client.start.side_effect = TestError('registration failed')
            return client
        with patch.object(queue_test, 'Endpoint', side_effect=endpoint):
            self.assertEqual(self.suite.run(), 1)
        self.assert_no_extra_scenarios()
        self.suite.queue_call.assert_not_called()
        self.assert_teardown()

    def test_interrupted_final_baseline_does_not_start_extra_scenarios(self):
        def queue_call(change_behavior=False):
            if change_behavior:
                raise KeyboardInterrupt
            return {}
        self.suite.queue_call.side_effect = queue_call
        self.assertEqual(self.suite.run(), 1)
        self.assert_no_extra_scenarios()
        self.assert_teardown()

    def test_uncleared_baseline_calls_abort_before_extra_scenarios(self):
        self.suite.clear_calls = Mock(side_effect=[['A'], []])
        self.assertEqual(self.suite.run(), 1)
        self.assert_no_extra_scenarios()
        self.suite.queue_call.assert_not_called()
        self.assert_teardown()

    def test_failed_baseline_skips_extra_scenarios(self):
        self.suite.direct.side_effect = TestError('baseline failed')
        self.assertEqual(self.suite.run(), 1)
        self.assert_no_extra_scenarios()
        self.assert_teardown()

    def test_interrupted_extra_scenario_does_not_save_configuration(self):
        self.suite.wait_order.side_effect = KeyboardInterrupt
        self.assertEqual(self.suite.run(), 1)
        self.suite.wait_order.assert_called_once_with(['A', 'B', 'A', 'B'])
        self.suite.visualplan.assert_not_called()
        self.assertEqual(self.suite.queue_call.call_count, 2)
        self.assert_teardown()

    def test_uncleared_extra_calls_abort_before_configuration_save(self):
        # Nine baseline scenarios, then all-noanswer, then inherited teardown.
        self.suite.clear_calls = Mock(side_effect=[[]] * 9 + [['A'], []])
        self.assertEqual(self.suite.run(), 1)
        self.suite.wait_order.assert_called_once_with(['A', 'B', 'A', 'B'])
        self.suite.visualplan.assert_not_called()
        self.assertEqual(self.suite.queue_call.call_count, 2)
        self.assert_teardown()

    def test_disabled_lazy_members_runs_only_baseline(self):
        self.suite.config['lazy'] = False
        self.assertEqual(self.suite.run(), 0)
        self.assert_no_extra_scenarios()
        self.assertEqual(self.suite.queue_call.call_count, 2)
        self.assert_teardown()


if __name__ == '__main__':
    unittest.main()
