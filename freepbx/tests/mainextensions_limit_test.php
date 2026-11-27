<?php
// SPDX-License-Identifier: GPL-3.0-or-later
// Run the community users limit of POST /mainextensions against an in-memory PBX.

namespace Psr\Http\Message {
    interface ServerRequestInterface {}
    interface ResponseInterface {}
}

namespace {
    use Psr\Http\Message\ResponseInterface;
    use Psr\Http\Message\ServerRequestInterface;

    function check($condition, $message) {
        if (!$condition) throw new RuntimeException($message);
    }

    class Pbx {
        public static array $users = [];
        public static array $created = [];

        public static function reset($configured) {
            self::$users = [];
            for ($i = 1; $i <= $configured; $i++) {
                self::$users[] = ['username' => "user$i", 'default_extension' => (string) (200 + $i)];
            }
            self::$users[] = ['username' => 'newcomer', 'default_extension' => 'none'];
            self::$created = [];
        }
    }

    class FakeApp {
        public array $routes = [];
        public function get($path, $handler) { $this->routes["GET $path"] = $handler; }
        public function post($path, $handler) { $this->routes["POST $path"] = $handler; }
        public function delete($path, $handler) { $this->routes["DELETE $path"] = $handler; }
        public function put($path, $handler) { $this->routes["PUT $path"] = $handler; }
        public function patch($path, $handler) { $this->routes["PATCH $path"] = $handler; }
    }

    class FakeRequest implements ServerRequestInterface {
        public function __construct(private array $body) {}
        public function getParsedBody() { return $this->body; }
    }

    class FakeResponse implements ResponseInterface {
        public int $status = 200;
        public function withStatus($status) { $this->status = $status; return $this; }
    }

    function getAllUsers($all = "true") { return Pbx::$users; }
    function communityUsersLimit() { return 8; }
    function isExtensionNumber($extension) { return preg_match('/^[0-9]+$/D', (string) $extension) === 1; }
    function nethvoiceRequestIsSuperadmin($request) { return false; }
    function createMainExtensionForUser($username, $mainextension, $outboundcid = '') {
        Pbx::$created[] = [$username, $mainextension];
        return true;
    }
    function jsonResponse($response, $body, $status) { return $response->withStatus($status); }
    $nonMembers = [];
    function usersAdminAssignmentError($username, $caller) { return in_array($username, $GLOBALS['nonMembers'], true) && empty($caller['superadmin']) ? [403, ['code' => 'not_instance_user']] : null; }

    $stubs = sys_get_temp_dir().'/mainextensions_limit_test_'.getmypid();
    @mkdir($stubs.'/lib', 0700, true);
    foreach (['libExtensions.php', 'libUsers.php', 'libMiddleware.php', 'libCTI.php', 'libUsersAdmin.php'] as $lib) {
        file_put_contents("$stubs/lib/$lib", '<?php');
    }
    set_include_path($stubs);
    $previousDir = getcwd();
    chdir($stubs);

    unset($_ENV['SUBSCRIPTION_SYSTEMID'], $_ENV['SUBSCRIPTION_SECRET']);
    $app = new FakeApp();
    require __DIR__.'/../var/www/html/freepbx/rest/modules/mainextensions.php';
    chdir($previousDir);
    foreach (glob("$stubs/lib/*.php") as $file) unlink($file);
    rmdir("$stubs/lib");
    rmdir($stubs);

    $post = function ($username, $extension) use ($app) {
        $handler = $app->routes['POST /mainextensions'];
        return $handler(new FakeRequest(['username' => $username, 'extension' => $extension]), new FakeResponse(), [])->status;
    };

    Pbx::reset(8);
    check(configuredUsersCountExcept(Pbx::$users, 'user1') === 7, 'the user being changed was counted');
    check(configuredUsersCountExcept(Pbx::$users, 'newcomer') === 8, 'configured users were not counted');

    Pbx::reset(8);
    check($post('user1', '301') !== 403, 'changing the extension of a configured user was blocked at the limit');
    check(Pbx::$created === [['user1', '301']], 'the extension was not changed');

    Pbx::reset(8);
    check($post('newcomer', '309') === 403, 'a new extension was allowed beyond the limit');
    check(Pbx::$created === [], 'an extension was created beyond the limit');

    Pbx::reset(7);
    check($post('newcomer', '308') !== 403, 'a new extension was blocked below the limit');

    Pbx::reset(8);
    $_ENV['SUBSCRIPTION_SYSTEMID'] = 'id';
    $_ENV['SUBSCRIPTION_SECRET'] = 'secret';
    check($post('newcomer', '309') !== 403, 'an enterprise system was limited');
    unset($_ENV['SUBSCRIPTION_SYSTEMID'], $_ENV['SUBSCRIPTION_SECRET']);

    Pbx::reset(1);
    $nonMembers = ['newcomer'];
    check($post('newcomer', '305') === 403 && Pbx::$created === [], 'a limited administrator assigned an extension to a user who is not a member');
    check($post('newcomer', '') !== 403 && $post('user1', '306') !== 403, 'a limited administrator was refused a change that is not an assignment to a non member');
    $nonMembers = [];

    echo "PASS: community users limit counts the other configured users only\n";
}
