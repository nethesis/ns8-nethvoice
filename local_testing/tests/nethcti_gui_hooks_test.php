<?php
// Standalone regression: php local_testing/tests/nethcti_gui_hooks_test.php
// Exercise the GUI hooks without a FreePBX installation or database writes.

interface BMO {}
class FreePBX_Helpers {}

require __DIR__ . '/../../freepbx/var/www/html/freepbx/admin/modules/nethcti3/Nethcti3.class.php';

class TestNethctiGuiHooks extends \FreePBX\modules\Nethcti3 {
    public $settings = [];
    public $lookups = [];

    public function __construct() {}

    public function getConfig($key, $trunkid = null) {
        $this->lookups[] = [$key, $trunkid];
        return $this->settings[$key] ?? null;
    }
}

class moduleHook {
    public $hookHtml = '<div id="existing-core-hook"></div>';
    private static $instance;

    public static function create() {
        return self::$instance ?? (self::$instance = new self());
    }
}

function check($condition, $message) {
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

// Core's comparison is harmless when config.php's hook is in scope, but fails
// when GuiHooks::getOutput() includes the page in a separate method scope.
function renderInConfigScope($page) {
    $module_hook = moduleHook::create();
    include $page;
}

class InterceptScope {
    public function render($page) {
        include $page;
    }
}

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$page = tempnam(sys_get_temp_dir(), 'nethcti-gui-');
file_put_contents($page, '<?php $module_hook == moduleHook::create(); echo $module_hook->hookHtml; ?>'
    . '<form><div id="pjsip"><div id="outbound-proxy"></div><!--END OUTBOUND PROXY-->'
    . '<div id="next-option"></div></div></form>');
$initialLevel = ob_get_level();

try {
    $hooks = TestNethctiGuiHooks::myGuiHooks();
    check(in_array('core', $hooks, true), 'Regular Core GUI hook missing');
    check(!in_array('modules/core/page.trunks.php', $hooks['INTERCEPT'], true), 'Trunks still use interception');
    check(in_array('modules/core/page.routing.php', $hooks['INTERCEPT'], true), 'Routing interception missing');

    try {
        (new InterceptScope())->render($page);
        throw new RuntimeException('Original interception did not reproduce the warning');
    } catch (ErrorException $e) {
        check(strpos($e->getMessage(), 'Undefined variable $module_hook') !== false, 'Unexpected baseline error');
    }

    $component = null;
    $cti = new TestNethctiGuiHooks();
    foreach ([[], ['disable_topos_header' => 1, 'disable_srtp_header' => 0]] as $settings) {
        $cti->settings = $settings;
        $cti->lookups = [];
        $_REQUEST = ['display' => 'trunks', 'tech' => 'PJSIP', 'extdisplay' => $settings ? 'OUT_7' : ''];

        ob_start(); // Collect the response after the NethCTI output handler runs.
        $cti->doGuiHook($component, 'core');
        // Nested view buffers must not consume the NethCTI response buffer.
        ob_start();
        renderInConfigScope($page);
        echo ob_get_clean();
        ob_end_flush();
        $html = ob_get_clean();

        check(ob_get_level() === $initialLevel, 'Output buffer leaked');
        check(strpos($html, 'id="existing-core-hook"') !== false, 'Existing Core hook lost');
        check(substr_count($html, '<!--DISABLE TOPOS-->') === 1, 'TOPOS controls missing or duplicated');
        check(substr_count($html, '<!--DISABLE SRTP-->') === 1, 'SRTP controls missing or duplicated');
        check(strpos($html, '<!--END OUTBOUND PROXY-->') < strpos($html, '<!--DISABLE TOPOS-->')
            && strpos($html, '<!--END DISABLE SRTP-->') < strpos($html, 'id="next-option"'), 'Controls inserted outside the proxy section');
        $toposId = $settings ? 'disable_topos_headeryes' : 'disable_topos_headerno';
        check(strpos($html, 'id="' . $toposId . '" value="' . ($settings ? 'yes' : 'no') . '" CHECKED') !== false, 'TOPOS selection changed');
        check(strpos($html, 'id="disable_srtp_headerno" value="no" CHECKED') !== false, 'SRTP selection changed');
        check($cti->lookups === [
            ['disable_topos_header', $settings ? '7' : ''],
            ['disable_srtp_header', $settings ? '7' : ''],
        ], 'Wrong trunk configuration read');
    }

    foreach ([[], ['display' => 'trunks'], ['display' => 'trunks', 'tech' => 'SIP'], ['display' => 'routing']] as $request) {
        $_REQUEST = $request;
        $cti->lookups = [];
        $cti->doGuiHook($component, 'core');
        check(ob_get_level() === $initialLevel, 'Unrelated page was buffered');
        check($cti->lookups === [], 'Unrelated page read trunk configuration');
    }

    $_REQUEST = ['display' => 'routing'];
    $routing = '<input type="radio" name="notification_on" id="call" value="call">' . "\n"
        . '<input type="radio" name="notification_on" id="pattern" value="pattern">';
    $cti->doGuiIntercept('modules/core/page.routing.php', $routing);
    check(strpos($routing, 'id="call" value="call" disabled>') !== false, 'Call notification restriction lost');
    check(strpos($routing, 'id="pattern" value="pattern" checked>') !== false, 'Pattern notification default lost');
    echo "PASS: scope regression, PJSIP fields, saved selections, other pages, routing hooks\n";
} finally {
    while (ob_get_level() > $initialLevel) {
        ob_end_clean();
    }
    unlink($page);
    restore_error_handler();
}
