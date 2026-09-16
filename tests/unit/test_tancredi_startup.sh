#!/bin/bash
# Build tancredi/ first, then run with the local image name as the argument.
set -euo pipefail

podman run --rm -i "${1:-localhost/nethvoice-tancredi:lldp-8167}" /bin/bash -se <<'CONTAINER'
cat > /tmp/lldp-startup-check.php <<'PHP'
<?php
require '/usr/share/tancredi/vendor/autoload.php';
$logger = new \Psr\Log\NullLogger();
$storage = new \Tancredi\Entity\FileStorage($logger, $GLOBALS['config']);
$scope = function ($id) use ($storage, $logger) {
    return new \Tancredi\Entity\Scope($id, $storage, $logger);
};
$check = function ($id, $value) use ($scope) {
    if ($scope($id)->getVariables()['lldp_enable'] !== $value) {
        throw new RuntimeException("Unexpected LLDP value for $id");
    }
};
switch ($argv[1]) {
    case 'fresh':
        $check('defaults', '1');
        $check('yealink-T46', '1');
        $check('fanvil-X5', '1');
        if ($scope('defaults')->metadata['version'] !== '16') {
            throw new RuntimeException('Fresh defaults must skip compatibility migration');
        }
        break;
    case 'seed-upgrade':
        $defaults = $scope('defaults');
        $defaults->metadata['version'] = 4;
        $defaults->setVariables(['lldp_enable' => null]);
        foreach (['old-phone' => 'yealink-T46', 'old-fanvil' => 'fanvil-X5'] as $id => $model) {
            $phone = $scope($id);
            $phone->metadata = ['scopeType' => 'phone', 'inheritFrom' => $model];
            $phone->setVariables();
        }
        break;
    case 'upgraded':
        $check('defaults', '0');
        $check('old-phone', '0');
        $check('old-fanvil', '1');
        break;
    case 'change':
        $scope('defaults')->setVariables(['lldp_enable' => '1']);
        $scope('fanvil-X5')->setVariables(['lldp_enable' => '0']);
        $scope('old-phone')->setVariables(['lldp_enable' => '0']);
        break;
    case 'restarted':
        $check('defaults', '1');
        $check('old-phone', '0');
        $check('old-fanvil', '0');
        break;
    case 'seed-failure':
        $defaults = $scope('defaults');
        $defaults->metadata['version'] = 4;
        $defaults->setVariables();
        $bad = $scope('invalid-inheritance');
        $bad->metadata = ['scopeType' => 'model', 'inheritFrom' => 'invalid-inheritance'];
        $bad->setVariables();
        break;
}
PHP

php /tmp/lldp-startup-check.php fresh
runuser -u www-data -- php /tmp/lldp-startup-check.php seed-upgrade
if ! /entrypoint.sh true > /tmp/lldp-upgrade.log 2>&1; then
    cat /tmp/lldp-upgrade.log
    exit 1
fi
php /tmp/lldp-startup-check.php upgraded
runuser -u www-data -- php /tmp/lldp-startup-check.php change
if ! /entrypoint.sh true > /tmp/lldp-restart.log 2>&1; then
    cat /tmp/lldp-restart.log
    exit 1
fi
php /tmp/lldp-startup-check.php restarted
runuser -u www-data -- php /tmp/lldp-startup-check.php seed-failure
if /entrypoint.sh touch /tmp/lldp-service-started > /tmp/lldp-failure.log 2>&1; then
    echo 'Startup unexpectedly succeeded with a failed migration' >&2
    exit 1
fi
test ! -e /tmp/lldp-service-started
echo 'Passed Tancredi fresh startup, upgrade, restart, and migration failure checks'
CONTAINER
