<?php

// Run through test/run.sh, or with tancredi_conf pointing to a test config.
require_once __DIR__ . '/../vendor/autoload.php';

$root = dirname(__DIR__);
$twig = new \Twig\Environment(new \Twig\Loader\FilesystemLoader($root . '/data/templates'), ['autoescape' => false]);
$twig->addFilter(new \Twig\TwigFilter('preg_replace', function ($subject, $pattern, $replacement) {
    return preg_replace($pattern, $replacement, $subject);
}));
$defaults = parse_ini_file($root . '/data/scopes/defaults.ini', true);
if ($defaults['data']['lldp_enable'] !== '1' || $defaults['metadata']['version'] !== '16') {
    throw new \RuntimeException('Fresh defaults must enable LLDP and skip the NethVoice compatibility migration');
}
$models = [
    'yealink-T46' => ['static.network.lldp.enable = %s'],
    'snom-D120' => ['<lldp_enable perm="">%s</lldp_enable>'],
    'snom-D862' => ['<lldp_enable perm="">%s</lldp_enable>'],
    'gigaset-P710' => ['<lldp_enable perm="">%s</lldp_enable>'],
    'gigaset-P810' => ['<lldp_enable perm="">%s</lldp_enable>'],
    'akuvox-SPR50P' => ['Config.Network.LLDP.LLDPEnable = %s'],
    'akuvox-WP410' => ['Config.Network.LLDP.LLDPEnable = %s'],
    'akuvox-WP480' => ['Config.Network.LLDP.LLDPEnable = %s'],
    'fanvil-X3' => ['LLDP Transmit      :%s', 'LLDP Learn Policy  :%s'],
    'fanvil-X5' => ['LLDP Transmit      :%s', 'LLDP Learn Policy  :%s'],
    'fanvil-V67' => ['LLDP Transmit      :%s', 'LLDP Learn Policy  :%s'],
    'nethesis-NPX5' => ['LLDP Transmit      :%s', 'LLDP Learn Policy  :%s'],
    'sangoma-S500' => ['<P5438 para="Active">%s</P5438>'],
];
$legacy_defaults = [
    'yealink-T46' => '0',
    'snom-D120' => '0',
    'snom-D862' => '0',
    'gigaset-P710' => '0',
    'gigaset-P810' => '0',
    'akuvox-SPR50P' => '0',
    'akuvox-WP410' => '0',
    'akuvox-WP480' => '0',
    'fanvil-X3' => '1',
    'fanvil-X5' => '1',
    'fanvil-V67' => '1',
    'nethesis-NPX5' => '1',
    'sangoma-S500' => '1',
];
$checks = 0;
foreach ($models as $model => $settings) {
    $scope = parse_ini_file($root . '/data/scopes/' . $model . '.ini', true);
    $variables = array_merge($defaults['data'], $scope['data'], [
        'mac' => '00-00-00-00-00-01',
        'short_mac' => '000000000001',
        'hostname' => 'voice.example.test',
        'provisioning_url_path' => '/provisioning/',
        'tok2' => 'test-token',
    ]);
    foreach (['1', '0', '', '2', 1, null] as $value) {
        $variables['lldp_enable'] = $value;
        if ($value === null) {
            unset($variables['lldp_enable']);
        }
        $output = $twig->render($variables['tmpl_phone'], $variables);
        $effective_value = $value === '0' || $value === '1' ? $value : $legacy_defaults[$model];
        foreach ($settings as $setting) {
            $is_xml_boolean = strpos($setting, '<lldp_enable') === 0;
            foreach (['1', '0'] as $candidate) {
                $encoded = $is_xml_boolean ? ($candidate === '1' ? 'on' : 'off') : $candidate;
                $expected = sprintf($setting, $encoded);
                if (str_contains($output, $expected) !== ($effective_value === $candidate)) {
                    throw new \RuntimeException("Unexpected LLDP output for $model, value " . var_export($value, true) . ": $expected");
                }
                ++$checks;
            }
        }
    }
}
echo "Passed $checks LLDP template assertions across " . count($models) . " template variants\n";
