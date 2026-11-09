#!/usr/bin/env python3
"""Lazy Members scenarios using the installed nethvoice-admin SIP harness.

Put the installed skill's scripts directory on PYTHONPATH. All arguments are
provided by queue_test.py, including its mandatory host/module/authorization
checks. No credentials, endpoint implementation or fixture harness live here.
"""
import json
import time
import queue_test
from queue_test import Suite, PBX, TestError, checked

class LazyPBX(PBX):
    def fixture(self, operation, config):
        if operation in ('inspect', 'create', 'configure'):
            result = super().fixture(operation, dict(config, lazy=False))
            result['lazy_configurable'] = True
            if operation != 'inspect':
                self.extra('lazy-save', config)
                result['settings']['lazymembers'] = bool(config['lazy'])
            return result
        if operation in ('visualplan-save', 'effective'):
            return self.extra(operation, config)
        return super().fixture(operation, config)
    def extra(self, operation, config):
        helper = r'''
        error_reporting(E_ERROR); ob_start();
        $r=json_decode(file_get_contents('php://stdin'),true); require '/etc/freepbx.conf';
        $q=queues_get($r['queue']);
        if (!$q || $q['name'] !== $r['owner']) throw new Exception('owner');
        if ($r['operation']==='lazy-save') {
            $_REQUEST=['action'=>'edit','account'=>$r['queue'],'extdisplay'=>$r['queue'],'LazyMembers'=>empty($r['lazy'])?'':'1'];
            FreePBX::Queueoptions()->doConfigPageInit('queues'); needreload();
        } elseif ($r['operation']==='visualplan-save') {
            $source=file_get_contents('/var/www/html/freepbx/admin/modules/visualplan/htdocs/create.php');
            eval(substr($source,strpos($source,'function nethvplan_randomPassword(')));
            $currentCreated=$returnedIdArray=[];
            $_REQUEST=[];
            $v=['id'=>'ext-queues%'.$r['queue'],'userData'=>[
                'name'=>$r['owner'],'extension'=>$r['queue'],'staticExt'=>'','dynamicExt'=>'',
                'strategy'=>$r['strategy'],'timeout'=>$r['ring_timeout'],'maxwait'=>$r['maxwait']],
                'entities'=>array_fill(0,9,['id'=>'test-output'])];
            nethvplan_switchCreate('ext-queues',$v,[]); needreload();
        }
        $actual=queues_get($r['queue']);
        $conf=file_get_contents('/etc/asterisk/queues_additional.conf');
        preg_match('/^\\['.preg_quote($r['queue'],'/').'\\]\\n(.*?)(?=^\\[|\\z)/ms',$conf,$m);
        $result=['stored_lazy'=>$actual['lazymembers']??null,'generated'=>trim($m[1]??'')];
        ob_end_clean(); echo json_encode($result);
        '''
        return json.loads(checked(['podman','exec','-i',self.container,'php','-r',helper],input=json.dumps(dict(config,operation=operation))))

class LazySuite(Suite):
    def wait_order(self, expected, timeout=30):
        self.add_members()
        starts = {key: endpoint.sequence for key, endpoint in self.endpoints.items()}
        cursor = self.ami.cursor()
        offset = self.pbx.log_size()
        self.endpoints['caller'].action('call', destination=self.config['queue'])
        enter = self.ami.wait(lambda event: event['Event'] == 'QueueCallerJoin', cursor, 15)
        self.pending_evidence = {
            'uniqueid': enter['Uniqueid'],
            'effective': self.pbx.fixture('effective', self.config),
        }
        deadline = time.monotonic() + timeout
        try:
            while True:
                invites = sorted([
                    event for key in ('A', 'B')
                    for event in self.endpoints[key].snapshot()['events']
                    if event['kind'] == 'invite' and event['seq'] > starts[key]
                ], key=lambda event: event['time'])
                order = [event['endpoint'] for event in invites]
                self.pending_evidence['ring_sequence'] = order
                if order != expected[:len(order)]:
                    raise TestError('unexpected ring sequence: ' + ' -> '.join(order))
                if len(order) >= len(expected):
                    return self.pending_evidence
                if time.monotonic() >= deadline:
                    raise TestError('selection timeout: ' + ' -> '.join(order))
                with self.ami.condition:
                    self.ami.condition.wait(.1)
        finally:
            self.pending_evidence['queue_log'] = self.pbx.queue_log(offset, self.config['queue'])

    def scenario(self, name, expected, action):
        super().scenario(name, expected, action)
        # The installed harness has no post-scenario hook. Extend its final
        # baseline scenario only after it returns with cleared calls. Exceptions
        # and cancellation go straight to the harness's inherited teardown.
        if (name == f'queue-live-behavior-{self.repeats}' and self.config['lazy']
                and all(case['status'] == 'PASS' for case in self.report['scenarios'])):
            super().scenario('all-noanswer', 'A -> B -> A -> B; cycles restart',
                             lambda: self.wait_order(['A', 'B', 'A', 'B']))
            super().scenario('visualplan-preserves-lazy', 'saved option survives VisualPlan', self.visualplan)
            super().scenario('visualplan-ring-sequence', 'A -> B after VisualPlan save', self.queue_call)

    def visualplan(self):
        before = self.pbx.fixture('effective', self.config)
        self.pbx.fixture('visualplan-save', self.config)
        self.pbx.reload()
        after = self.pbx.fixture('effective', self.config)
        self.pending_evidence = {'before': before, 'after': after}
        if after['stored_lazy'] != 'yes' or 'lazymembers=yes' not in after['generated']:
            raise TestError('VisualPlan removed lazymembers=yes')
        return self.pending_evidence


if __name__ == '__main__':
    queue_test.PBX = LazyPBX
    queue_test.Suite = LazySuite
    raise SystemExit(queue_test.main())
