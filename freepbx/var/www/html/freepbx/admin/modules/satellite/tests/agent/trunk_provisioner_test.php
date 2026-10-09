<?php

require_once __DIR__ . '/../../lib/AgentTrunkProvisioner.php';

function check($condition, $message)
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function failsWith($callback, $message)
{
    try {
        $callback();
    } catch (Throwable $error) {
        check(strpos($error->getMessage(), $message) !== false, $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected failure: ' . $message);
}

class TestPjsipDriver
{
    public $transports = array(
        array('value' => '', 'text' => 'Auto'),
        array('value' => '0.0.0.0-udp', 'text' => 'UDP'),
        array('value' => '192.0.2.1-tls', 'text' => 'TLS'),
    );

    public function getActiveTransports()
    {
        return $this->transports;
    }
}

class TestCore
{
    public $driver;
    public $trunks = array();
    public $calls = array();
    public $nextId = 10;
    public $failAdd = false;
    public $failNextAdds = 0;
    public $partialOnFailure = false;

    public function __construct()
    {
        $this->driver = new TestPjsipDriver();
    }

    public function getDriver($name)
    {
        return $name === 'pjsip' ? $this->driver : false;
    }

    public function listTrunks()
    {
        return $this->trunks;
    }

    public function addTrunk($name, $tech, $base, $edit = false)
    {
        $this->calls[] = array('add', $name, $tech, $base, $_POST, $edit);
        $id = $edit ? $base['trunknum'] : $this->nextId++;
        $row = array(
            'trunkid' => $id,
            'channelid' => $base['channelid'],
            'tech' => $tech,
            'provider' => $base['provider'],
        );
        if ($this->failAdd || $this->failNextAdds > 0) {
            if ($this->failNextAdds > 0) {
                $this->failNextAdds--;
            }
            if ($this->partialOnFailure) {
                $this->trunks[$id] = $row;
            }
            throw new RuntimeException('Core add failed');
        }
        $this->trunks[$id] = $row;
        return $id;
    }

    public function deleteTrunk($id, $tech, $edit = false)
    {
        $this->calls[] = array('delete', $id, $tech, $edit);
        unset($this->trunks[$id]);
        return true;
    }
}

class TestCrypto
{
    public function decryptSecret($encoded)
    {
        if ($encoded === 'encrypted-newline') {
            return "bad\npass";
        }
        return $encoded === 'encrypted-sip-pass' ? 'sip-pass' : '';
    }
}

$core = new TestCore();
$provisioner = new AgentTrunkProvisioner($core, new TestCrypto());
$_ENV['PROXY_IP'] = '192.0.2.10';
$_ENV['PROXY_PORT'] = '5060';
$_POST = array('api_key' => 'must never reach PJSIP', 'form_action' => 'save');
$originalPost = $_POST;

$openai = array('id' => 1, 'provider' => 'openai', 'runtime_owner' => 'cleverai',
    'openai_project_id' => 'proj_example-1', 'enabled' => 1, 'api_key' => 'secret');
check($provisioner->validateManagedTrunk($openai) === true, 'OpenAI validation');
$id = $provisioner->createManagedTrunk($openai);
check($id === 10, 'create returned Core ID');
check($_POST === $originalPost, 'POST restored after create');
check($core->calls[0][1] === 'AgentTrunk_1', 'generated trunk name');
check($core->calls[0][3]['provider'] === 'satellite-agent', 'module ownership marker');
check($core->calls[0][4]['trunk_name'] === 'AgentTrunk_1', 'PJSIP endpoint name');
check($core->calls[0][4]['transport'] === '0.0.0.0-udp', 'proxy-facing UDP transport selected');
check($core->calls[0][4]['outbound_proxy'] === 'sip:192.0.2.10:5060;lr', 'NethVoice outbound proxy');
check($core->calls[0][4]['sip_server_port'] === '5061', 'OpenAI SIP server port');
check($core->calls[0][4]['aor_contact'] === 'sip:sip.api.openai.com:5061;transport=tls', 'OpenAI contact');
check($core->calls[0][4]['authentication'] === 'none', 'OpenAI has no SIP auth');
check(!isset($core->calls[0][4]['api_key']), 'HTTP API key excluded from PJSIP');

$openai['freepbx_trunk_id'] = $id;
$openai['freepbx_trunk_name'] = 'AgentTrunk_1';
$openai['enabled'] = 0;
check($provisioner->updateManagedTrunk($openai) === $id, 'update retained Core ID');
check($core->calls[1] === array('delete', $id, 'pjsip', true), 'edit mode delete');
check($core->calls[2][5] === true && $core->calls[2][3]['disabletrunk'] === 'on', 'disabled edit');
check($_POST === $originalPost, 'POST restored after edit');
check($provisioner->deleteManagedTrunk($openai) === true, 'delete managed trunk');

$grok = array('id' => 2, 'provider' => 'grok', 'grok_phone_number' => '+390721123456',
    'sip_auth_mode' => 'digest', 'sip_auth_username' => 'sip-user', 'sip_auth_password_encrypted' => 'encrypted-sip-pass');
check($provisioner->createManagedTrunk($grok) === 11, 'create Grok trunk');
$settings = $core->calls[4][4];
check($settings['aor_contact'] === 'sip:+390721123456@sip.voice.x.ai:5061;transport=tls', 'Grok contact');
check($settings['transport'] === '0.0.0.0-udp'
    && $settings['sip_server_port'] === '5061'
    && $settings['outbound_proxy'] === 'sip:192.0.2.10:5060;lr', 'Grok proxy routing');
check($settings['authentication'] === 'outbound' && $settings['secret'] === 'sip-pass', 'Grok SIP digest');
check($_POST === $originalPost, 'POST restored after Grok create');

failsWith(function () use ($provisioner, $openai) {
    $openai['openai_project_id'] = 'bad';
    $provisioner->validateManagedTrunk($openai);
}, 'Invalid OpenAI project ID');
failsWith(function () use ($provisioner, $grok) {
    $grok['sip_auth_password_encrypted'] = '';
    $provisioner->validateManagedTrunk($grok);
}, 'digest username and password');
failsWith(function () use ($provisioner, $grok) {
    $grok['sip_auth_password_encrypted'] = 'encrypted-newline';
    $provisioner->validateManagedTrunk($grok);
}, 'digest username and password');
failsWith(function () use ($provisioner, $grok) {
    $grok['freepbx_trunk_id'] = 10;
    $provisioner->deleteManagedTrunk($grok);
}, 'was not found');

$core->driver->transports = array(array('value' => '192.0.2.1-udp', 'text' => 'UDP'));
failsWith(function () use ($provisioner, $openai) {
    $provisioner->validateManagedTrunk($openai);
}, 'PJSIP transport 0.0.0.0-udp is not active');

$core->driver->transports[] = array('value' => '0.0.0.0-udp', 'text' => 'UDP');
$_ENV['PROXY_PORT'] = '0';
failsWith(function () use ($provisioner, $openai) {
    $provisioner->validateManagedTrunk($openai);
}, 'NethVoice SIP proxy address and port are required');
$_ENV['PROXY_PORT'] = '5060';
$core->failAdd = true;
failsWith(function () use ($provisioner) {
    $provisioner->createManagedTrunk(array('id' => 3, 'provider' => 'openai', 'openai_project_id' => 'proj_test'));
}, 'Core add failed');
check($_POST === $originalPost, 'POST restored after Core exception');

$rollbackCore = new TestCore();
$rollbackProvisioner = new AgentTrunkProvisioner($rollbackCore, new TestCrypto());
$previous = array('id' => 4, 'provider' => 'openai', 'openai_project_id' => 'proj_before', 'enabled' => 1);
$previous['freepbx_trunk_id'] = $rollbackProvisioner->createManagedTrunk($previous);
$previous['freepbx_trunk_name'] = 'AgentTrunk_4';
$replacement = $previous;
$replacement['openai_project_id'] = 'proj_after';
$replacement['enabled'] = 0;
$rollbackCore->failNextAdds = 1;
$rollbackCore->partialOnFailure = true;
failsWith(function () use ($rollbackProvisioner, $replacement, $previous) {
    $rollbackProvisioner->updateManagedTrunk($replacement, $previous);
}, 'Core add failed');
check($rollbackCore->calls[1] === array('delete', 10, 'pjsip', true), 'rollback test removed old trunk');
check($rollbackCore->calls[3] === array('delete', 10, 'pjsip', true), 'rollback removed partial replacement');
check($rollbackCore->calls[4][4]['aor_contact'] === 'sip:sip.api.openai.com:5061;transport=tls'
    && $rollbackCore->calls[4][3]['disabletrunk'] === 'off', 'rollback restored previous settings');
check(isset($rollbackCore->trunks[10]), 'rollback restored original ID');
check($_POST === $originalPost, 'POST restored after rollback');

$rollbackCore->failNextAdds = 2;
failsWith(function () use ($rollbackProvisioner, $replacement, $previous) {
    $rollbackProvisioner->updateManagedTrunk($replacement, $previous);
}, 'rollback failed: Core add failed');
check($_POST === $originalPost, 'POST restored after failed rollback');

echo "Agent trunk provisioner tests passed\n";
