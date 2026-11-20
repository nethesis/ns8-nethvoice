<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Update the labels of the phone keys that point to a reassigned extension against a fake Tancredi.

function check($condition, $message) {
    if (!$condition) throw new RuntimeException($message);
}

class FakeTancredi {
    public array $reads = [];
    public array $writes = [];
    public array $failRead = [];
    public array $failWrite = [];

    public function __construct(public array $scopes) {}

    public function get($path) {
        $this->reads[] = $path;
        if (in_array($path, $this->failRead, true)) throw new RuntimeException('HTTP 500');
        return $this->scopes[$path];
    }

    public function getMany(array $paths) {
        $results = [];
        foreach ($paths as $path) {
            $this->reads[] = $path;
            $results[$path] = in_array($path, $this->failRead, true) ? null : ($this->scopes[$path] ?? null);
        }
        return $results;
    }

    public function patch($path, array $body) {
        if (in_array($path, $this->failWrite, true)) throw new RuntimeException('HTTP 500');
        $this->writes[] = [$path, $body];
        $this->scopes[$path]['variables'] = array_merge($this->scopes[$path]['variables'], $body['variables']);
    }
}

function scopes() {
    return [
        'phones' => [['mac' => 'AA-BB-CC-00-00-01'], ['mac' => 'AA-BB-CC-00-00-02'], ['mac' => 'AA-BB-CC-00-00-03']],
        'models' => [['name' => 'yealink-T46S'], ['name' => 'fanvil-X3SG-PRO'], ['name' => 'yealink-T46S-Reception']],
        'phones/AA-BB-CC-00-00-01' => ['variables' => [
            'linekey_type_1' => 'blf', 'linekey_value_1' => '201', 'linekey_label_1' => 'Alice Rossi',
            'linekey_type_2' => 'blf', 'linekey_value_2' => '201', 'linekey_label_2' => 'alice rossi',
            'linekey_type_3' => 'blf', 'linekey_value_3' => '201', 'linekey_label_3' => 'Alice (reception)',
            'linekey_type_4' => 'blf', 'linekey_value_4' => '201', 'linekey_label_4' => '',
            'linekey_type_5' => 'blf', 'linekey_value_5' => '202', 'linekey_label_5' => 'Alice Rossi',
            'linekey_type_6' => 'speed_dial', 'linekey_value_6' => '201', 'linekey_label_6' => ' Alice Rossi ',
            'expkey_type_1' => 'blf', 'expkey_value_1' => '201', 'expkey_label_1' => 'Alice Rossi',
            'expkey_type_2' => 'blf', 'expkey_value_2' => '2010', 'expkey_label_2' => 'Alice Rossi',
            'softkey_type_1' => 'speed_dial', 'softkey_value_1' => '201', 'softkey_label_1' => 'Alice Rossi',
            'account_display_name_1' => 'Alice Rossi',
        ]],
        'phones/AA-BB-CC-00-00-02' => ['variables' => [
            'linekey_type_1' => 'blf', 'linekey_value_1' => '202', 'linekey_label_1' => 'Dave Verdi',
        ]],
        'phones/AA-BB-CC-00-00-03' => ['variables' => []],
        'models/yealink-T46S' => ['variables' => ['linekey_type_1' => 'blf', 'linekey_value_1' => '201', 'linekey_label_1' => 'Alice Rossi']],
        'models/fanvil-X3SG-PRO' => ['variables' => ['linekey_type_1' => 'blf', 'linekey_value_1' => '201', 'linekey_label_1' => 'Alice Rossi']],
        'models/yealink-T46S-Reception' => ['variables' => [
            'linekey_type_10' => 'blf', 'linekey_value_10' => '201', 'linekey_label_10' => 'Alice Rossi',
            'expkey_type_40' => 'blf', 'expkey_value_40' => '201', 'expkey_label_40' => 'Front desk',
        ]],
    ];
}

$amp_conf = ['AMPWEBROOT' => '/nonexistent'];
require __DIR__.'/../var/www/html/freepbx/rest/lib/libPhoneKeyLabels.php';

$tancredi = new FakeTancredi(scopes());
$result = updatePhoneKeyLabels('201', 'Alice Rossi', 'Bob Bianchi', $tancredi);
check($result === ['key_labels_updated' => 4, 'key_labels_incomplete' => false], 'unexpected result '.json_encode($result));
check($tancredi->writes === [
    ['phones/AA-BB-CC-00-00-01', ['variables' => ['linekey_label_1' => 'Bob Bianchi', 'linekey_label_6' => 'Bob Bianchi', 'expkey_label_1' => 'Bob Bianchi']]],
    ['models/yealink-T46S-Reception', ['variables' => ['linekey_label_10' => 'Bob Bianchi']]],
], 'unexpected writes '.json_encode($tancredi->writes));
$phone = $tancredi->scopes['phones/AA-BB-CC-00-00-01']['variables'];
check($phone['linekey_label_2'] === 'alice rossi', 'label with a different case changed');
check($phone['linekey_label_3'] === 'Alice (reception)', 'customized label changed');
check($phone['linekey_label_4'] === '', 'empty label changed');
check($phone['linekey_label_5'] === 'Alice Rossi', 'key of another extension changed');
check($phone['expkey_label_2'] === 'Alice Rossi', 'expansion key of another extension changed');
check($phone['softkey_label_1'] === 'Alice Rossi' && $phone['account_display_name_1'] === 'Alice Rossi', 'variables other than line and expansion keys changed');
check($tancredi->scopes['models/yealink-T46S-Reception']['variables']['expkey_label_40'] === 'Front desk', 'customized expansion key label changed');
check(!array_intersect(['models/yealink-T46S', 'models/fanvil-X3SG-PRO'], $tancredi->reads), 'built-in models were read');
check(count($tancredi->reads) === 6, 'scopes read more than once: '.json_encode($tancredi->reads));

$result = updatePhoneKeyLabels('201', 'Alice Rossi', 'Bob Bianchi', $tancredi);
check($result === ['key_labels_updated' => 0, 'key_labels_incomplete' => false] && count($tancredi->writes) === 2, 'scopes written when nothing matched');

$tancredi = new FakeTancredi(scopes());
check(updatePhoneKeyLabels('203', 'Alice Rossi', 'Bob Bianchi', $tancredi) === ['key_labels_updated' => 0, 'key_labels_incomplete' => false], 'unexpected result for an extension without keys');
check($tancredi->writes === [], 'scopes written for an extension without keys');

foreach ([['Alice Rossi', 'Alice Rossi'], ['Alice Rossi', ' Alice Rossi '], ['', 'Bob Bianchi'], ['  ', 'Bob Bianchi']] as [$old, $new]) {
    $tancredi = new FakeTancredi(scopes());
    check(updateReassignedKeyLabels('201', $old, $new, $tancredi) === ['key_labels_updated' => 0, 'key_labels_incomplete' => false], 'no-op returned a change for '.json_encode([$old, $new]));
    check($tancredi->reads === [] && $tancredi->writes === [], 'Tancredi called for '.json_encode([$old, $new]));
}

$tancredi = new FakeTancredi(scopes());
$tancredi->failRead = ['models'];
check(updateReassignedKeyLabels('201', 'Alice Rossi', 'Bob Bianchi', $tancredi) === ['key_labels_updated' => 0, 'key_labels_incomplete' => true], 'listing failure not reported');
check($tancredi->writes === [], 'scopes written after a listing failure');

$tancredi = new FakeTancredi(scopes());
$tancredi->failRead = ['phones/AA-BB-CC-00-00-01'];
check(updateReassignedKeyLabels('201', 'Alice Rossi', 'Bob Bianchi', $tancredi) === ['key_labels_updated' => 1, 'key_labels_incomplete' => true], 'read failure of one phone not reported');
check(count($tancredi->writes) === 1 && $tancredi->writes[0][0] === 'models/yealink-T46S-Reception', 'other scopes not updated after a read failure');

$tancredi = new FakeTancredi(scopes());
$tancredi->failWrite = ['phones/AA-BB-CC-00-00-01'];
check(updateReassignedKeyLabels('201', 'Alice Rossi', 'Bob Bianchi', $tancredi) === ['key_labels_updated' => 1, 'key_labels_incomplete' => true], 'write failure not reported');

check(updateReassignedKeyLabels('201', 'Alice Rossi', 'Bob Bianchi') === ['key_labels_updated' => 0, 'key_labels_incomplete' => true], 'missing Tancredi credentials not reported');

check(isCustomPhoneModelName('yealink-T46S-Reception') && isCustomPhoneModelName('snom-D785-desk-2'), 'custom model not recognized');
check(!isCustomPhoneModelName('yealink-T46S') && !isCustomPhoneModelName('fanvil-X3SG-PRO') && !isCustomPhoneModelName('defaults'), 'built-in model taken as custom');

echo "PASS: phone key labels of a reassigned extension\n";
