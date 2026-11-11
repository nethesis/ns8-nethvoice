<?php
// Standalone regression: php local_testing/tests/nethcti_gui_hooks_test.php
// Exercise the GUI hooks without a FreePBX installation or database writes.

if (!function_exists('_')) { function _($value) { return $value; } }

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

class InterceptScope {
    public function render($page) {
        if (class_exists('FreePBX\\GuiHooks')) {
            $hooks = (new ReflectionClass('FreePBX\\GuiHooks'))->newInstanceWithoutConstructor();
            return (new ReflectionMethod($hooks, 'getOutput'))->invoke($hooks, $page);
        }
        ob_start();
        include $page;
        $output = ob_get_contents();
        ob_end_clean();
        return $output;
    }
}

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$page = tempnam(sys_get_temp_dir(), 'nethcti-gui-');
$hookInit = '$module_hook = moduleHook::create();';
if (isset($argv[1])) {
    check(preg_match('/^\s*(\$module_hook\s*={1,2}\s*moduleHook::create\(\);)/m', file_get_contents($argv[1]), $matches) === 1, 'Core trunk hook initializer missing');
    $hookInit = $matches[1];
}
if (isset($argv[2])) {
    require $argv[2];
}
file_put_contents($page, '<?php '.$hookInit.' echo $module_hook->hookHtml; ?>'
    . '<form><div id="pjsip"><div id="outbound-proxy"></div><!--END OUTBOUND PROXY-->'
    . '<div id="next-option"></div></div></form>');
$initialLevel = ob_get_level();

try {
    $hooks = TestNethctiGuiHooks::myGuiHooks();
    check(in_array('core', $hooks, true), 'Regular Core GUI hook missing');
    check(in_array('modules/core/page.trunks.php', $hooks['INTERCEPT'], true), 'Trunk interception missing');
    check(in_array('modules/core/page.routing.php', $hooks['INTERCEPT'], true), 'Routing interception missing');

    $component = null;
    $cti = new TestNethctiGuiHooks();
    foreach (['normal', 'popover', 'quiet'] as $mode) {
        foreach ([[], ['disable_topos_header' => 1, 'disable_srtp_header' => 0], ['disable_topos_header' => 0, 'disable_srtp_header' => 1]] as $settings) {
            $cti->settings = $settings;
            $cti->lookups = [];
            $_REQUEST = ['display' => 'trunks', 'tech' => 'PJSIP', 'extdisplay' => $settings ? 'OUT_7' : ''];

            ob_start(); // Collect the final response.
            ob_start(); // config.php's page buffer.
            $cti->doGuiHook($component, 'core');
            // Views are nested inside config.php's page buffer.
            $output = (new InterceptScope())->render($page);
            $cti->doGuiIntercept('modules/core/page.trunks.php', $output);
            echo $output;
            // Normal and popover responses capture first, then clean the buffer.
            if ($mode === 'quiet') {
                ob_end_flush();
            } else {
                $pageContent = ob_get_contents();
                ob_end_clean();
                echo '<html>'.$pageContent.'</html>';
            }
            $html = ob_get_clean();

            check(ob_get_level() === $initialLevel, 'Output buffer leaked');
            check(strpos($html, 'id="existing-core-hook"') !== false, 'Existing Core hook lost');
            check(substr_count($html, '<!--DISABLE TOPOS-->') === 1, 'TOPOS controls missing or duplicated');
            check(substr_count($html, '<!--DISABLE SRTP-->') === 1, 'SRTP controls missing or duplicated');
            check(strpos($html, '<!--END OUTBOUND PROXY-->') < strpos($html, '<!--DISABLE TOPOS-->')
                && strpos($html, '<!--END DISABLE SRTP-->') < strpos($html, 'id="next-option"'), 'Controls inserted outside the proxy section');
            foreach (['disable_topos_header', 'disable_srtp_header'] as $key) {
                $value = !empty($settings[$key]) ? 'yes' : 'no';
                check(strpos($html, 'id="'.$key.$value.'" value="'.$value.'" CHECKED') !== false, $key.' selection changed');
            }
            check($cti->lookups === [
                ['disable_topos_header', $settings ? '7' : ''],
                ['disable_srtp_header', $settings ? '7' : ''],
            ], 'Wrong trunk configuration read');
        }
    }

    foreach ([[], ['display' => 'trunks'], ['display' => 'trunks', 'tech' => 'SIP'], ['display' => 'routing']] as $request) {
        $_REQUEST = $request;
        $cti->lookups = [];
        $cti->doGuiHook($component, 'core');
        if (($request['display'] ?? '') === 'trunks') {
            $output = '<!--END OUTBOUND PROXY-->';
            $cti->doGuiIntercept('modules/core/page.trunks.php', $output);
            check($output === '<!--END OUTBOUND PROXY-->', 'Non-PJSIP trunk was modified');
        }
        check(ob_get_level() === $initialLevel, 'Unrelated page was buffered');
        check($cti->lookups === [], 'Unrelated page read trunk configuration');
    }

    $_REQUEST = ['display' => 'routing'];
    $routing = '<input type="radio" name="notification_on" id="call" value="call">' . "\n"
        . '<input type="radio" name="notification_on" id="pattern" value="pattern">';
    $cti->doGuiIntercept('modules/core/page.routing.php', $routing);
    check(strpos($routing, 'id="call" value="call" disabled>') !== false, 'Call notification restriction lost');
    check(strpos($routing, 'id="pattern" value="pattern" checked>') !== false, 'Pattern notification default lost');
    echo "PASS: intercepted scope, normal/popover/quiet buffers, PJSIP fields, saved selections, other pages, routing hooks\n";
} finally {
    while (ob_get_level() > $initialLevel) {
        ob_end_clean();
    }
    unlink($page);
    restore_error_handler();
}
