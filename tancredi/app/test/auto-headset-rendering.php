<?php

// Run through test/run.sh, or with tancredi_conf pointing to a test config.
require_once __DIR__ . '/../vendor/autoload.php';

$root = dirname(__DIR__);
$twig = new \Twig\Environment(new \Twig\Loader\FilesystemLoader($root . '/data/templates'), ['autoescape' => false]);
$twig->addFilter(new \Twig\TwigFilter('preg_replace', function ($subject, $pattern, $replacement) {
    return preg_replace($pattern, $replacement, $subject);
}));
$defaults = parse_ini_file($root . '/data/scopes/defaults.ini', true);
if ($defaults['data']['auto_headset'] !== '0') {
    throw new \RuntimeException('Fresh defaults must disable auto_headset');
}
$models = ['fanvil-X5', 'fanvil-V67', 'nethesis-NPX5'];
$setting = 'P1 Auto Headset       :%s';
$checks = 0;
foreach ($models as $model) {
    $scope = parse_ini_file($root . '/data/scopes/' . $model . '.ini', true);
    $variables = array_merge($defaults['data'], $scope['data'], [
        'mac' => '00-00-00-00-00-01',
        'short_mac' => '000000000001',
        'hostname' => 'voice.example.test',
        'provisioning_url_path' => '/provisioning/',
        'tok2' => 'test-token',
    ]);
    foreach (['1', '0', '', '2', 1, null] as $value) {
        $variables['auto_headset'] = $value;
        if ($value === null) {
            unset($variables['auto_headset']);
        }
        $output = $twig->render($variables['tmpl_phone'], $variables);
        $effective_value = $value === '1' ? '1' : '0';
        foreach (['1', '0'] as $candidate) {
            $expected = sprintf($setting, $candidate);
            if (str_contains($output, $expected) !== ($effective_value === $candidate)) {
                throw new \RuntimeException("Unexpected Auto Headset output for $model, value " . var_export($value, true) . ": $expected");
            }
            ++$checks;
        }
    }
}
echo "Passed $checks Auto Headset template assertions across " . count($models) . " template variants\n";
