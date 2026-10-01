#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
HELPER = ROOT / 'freepbx/var/www/html/freepbx/rest/lib/phonesRpsResetHelper.php'

# Replace only the helper's external dependencies. Run the actual script in a
# separate PHP process so its early exits and one-shot marker writes are tested.
STUBS = r'''<?php
class PDO { const FETCH_ASSOC = 2; }
$_ENV['NETHVOICE_HOST'] = getenv('TEST_CURRENT_HOST');
$_ENV['NETHVOICESECRETKEY'] = 'test-only';
$state = ['host' => json_decode(getenv('TEST_PREVIOUS_HOST'), true),
          'tokens' => ['00-11-22-33-44-55' => 'existing-token'], 'resets' => 0, 'rps' => 0];
register_shutdown_function(function () {
    global $state;
    file_put_contents(getenv('TEST_STATE'), json_encode($state));
});
class Statement {
    private $sql;
    function __construct($sql) { $this->sql = $sql; }
    function execute($args = []) {
        global $state;
        if (strpos($this->sql, 'INSERT IGNORE') === 0) $state['host'] = $args[0];
    }
    function fetchAll($mode) {
        global $state;
        if (strpos($this->sql, 'SELECT `value`') === 0)
            return $state['host'] === null ? [] : [['value' => $state['host']]];
        if (strpos($this->sql, 'SELECT mac') === 0) return [['mac' => '00:11:22:33:44:55']];
        if (strpos($this->sql, 'SELECT `password_sha1`') === 0) return [['password_sha1' => 'test-only']];
        throw new Exception('Unexpected query: ' . $this->sql);
    }
}
class Database { function prepare($sql) { return new Statement($sql); } }
$db = new Database();
foreach (['CURLOPT_URL', 'CURLOPT_CUSTOMREQUEST', 'CURLOPT_HEADER', 'CURLOPT_HTTPHEADER',
          'CURLOPT_RETURNTRANSFER', 'CURLINFO_HTTP_CODE'] as $index => $constant) define($constant, $index);
function curl_init() { return (object) ['options' => []]; }
function curl_setopt($curl, $option, $value) { $curl->options[$option] = $value; }
function curl_exec($curl) {
    global $state;
    if (isset($curl->options[CURLOPT_CUSTOMREQUEST])) {
        $state['resets']++;
        $state['host_at_reset'] = $state['host'];
        $state['tokens']['00-11-22-33-44-55'] = 'new-token';
        return '';
    }
    return json_encode(['provisioning_url1' => 'https://voice.example.org/new-token']);
}
function curl_errno($curl) { return 0; }
function curl_getinfo($curl, $option) {
    return isset($curl->options[CURLOPT_CUSTOMREQUEST]) ? 204 : 200;
}
function curl_close($curl) {}
function setFalconieriRPS($mac, $url) {
    global $state;
    $state['rps']++;
    return ['httpCode' => 200];
}
'''


@unittest.skipUnless(shutil.which('php'), 'PHP CLI is required')
class ProvisioningHostnameTest(unittest.TestCase):
    def run_helper(self, previous, current):
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            stubs = directory / 'dependencies.php'
            stubs.write_text(STUBS)
            source = HELPER.read_text()
            for include in ('/etc/freepbx_db.conf', '/etc/freepbx.conf',
                            '/var/www/html/freepbx/rest/lib/libExtensions.php'):
                source = source.replace(include, str(stubs))
            script = directory / 'helper.php'
            script.write_text(source)
            state = directory / 'state.json'
            result = subprocess.run(['php', '-n', str(script), '--host-changed'],
                                    env=dict(os.environ, TEST_PREVIOUS_HOST=json.dumps(previous),
                                             TEST_CURRENT_HOST=current, TEST_STATE=str(state)),
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            return json.loads(state.read_text())

    def test_case_only_changes_preserve_tokens(self):
        for previous in ('Voice.Example.org', 'VOICE.EXAMPLE.ORG', 'voice.example.org'):
            with self.subTest(previous=previous):
                state = self.run_helper(previous, 'voice.example.org')
                self.assertEqual(state['host'], 'voice.example.org')
                self.assertEqual(state['tokens']['00-11-22-33-44-55'], 'existing-token')
                self.assertEqual(state['resets'], 0)
                self.assertEqual(state['rps'], 0)

    def test_missing_marker_preserves_tokens(self):
        state = self.run_helper(None, 'voice.example.org')
        self.assertEqual(state['resets'], 0)
        self.assertEqual(state['host'], 'voice.example.org')

    def test_changed_hostname_resets_once_after_saving_marker(self):
        state = self.run_helper('old.example.org', 'voice.example.org')
        self.assertEqual(state['host_at_reset'], 'voice.example.org')
        self.assertEqual(state['resets'], 1)
        self.assertEqual(state['rps'], 1)
        self.assertEqual(state['tokens']['00-11-22-33-44-55'], 'new-token')
        self.assertEqual(self.run_helper(state['host'], 'voice.example.org')['resets'], 0)


if __name__ == '__main__':
    unittest.main()
