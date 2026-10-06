<?php
namespace Psr\Http\Message {
    interface ResponseFactoryInterface {}
    interface ResponseInterface {}
    interface ServerRequestInterface {}
}
namespace Psr\Http\Server {
    interface MiddlewareInterface {}
    interface RequestHandlerInterface {}
}
namespace {
    require __DIR__ . '/../../freepbx/var/www/html/freepbx/rest/lib/AuthMiddleware.php';
    class FreePBX {
        public static function Database() { return new class {
            public function prepare($sql) { return new class {
                public function execute($args) {}
                public function fetch($mode) { return array('username' => 'admin', 'password_sha1' => 'synthetic-password-hash'); }
            }; }
        }; }
    }
    class TestResponse implements \Psr\Http\Message\ResponseInterface {
        public $status;
        public function getBody() { return new class { public function write($value) {} }; }
        public function withHeader($name, $value) { return $this; }
        public function withStatus($status) { $this->status = $status; return $this; }
    }
    class TestRequest implements \Psr\Http\Message\ServerRequestInterface {
        public $path; public $headers; public $attributes = array();
        public function __construct($path, $headers) { $this->path = $path; $this->headers = $headers; }
        public function getUri() { return new class($this->path) {
            private $path; public function __construct($path) { $this->path = $path; }
            public function getPath() { return $this->path; }
        }; }
        public function getMethod() { return 'GET'; }
        public function hasHeader($name) { return isset($this->headers[$name]); }
        public function getHeaderLine($name) { return $this->headers[$name] ?? ''; }
        public function withAttribute($name, $value) { $next = clone $this; $next->attributes[$name] = $value; return $next; }
    }
    $factory = new class implements \Psr\Http\Message\ResponseFactoryInterface {
        public function createResponse() { return new TestResponse(); }
    };
    $handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
        public $request;
        public function handle($request) { $this->request = $request; return (new TestResponse())->withStatus(200); }
    };
    $auth = new AuthMiddleware('synthetic-salt', $factory);
    foreach (array('/freepbx/rest/agents/runs/testauth', '/freepbx/rest/agents/application/workflows/runs/testauth') as $path) {
        $response = $auth->process(new TestRequest($path, array('User' => 'admin')), $handler);
        if ($response->status !== 403) { throw new \RuntimeException('Suffix bypassed administrator authentication'); }
    }
    $auth->process(new TestRequest('/freepbx/rest/testauth', array('User' => 'admin')), $handler);
    if (isset($handler->request->attributes['nethvoice_admin'])) { throw new \RuntimeException('Testauth granted administrator identity'); }
    $hash = sha1('admin' . 'synthetic-password-hash' . 'synthetic-salt');
    $auth->process(new TestRequest('/freepbx/rest/agents/runs/testauth', array('User' => 'admin', 'Secretkey' => $hash)), $handler);
    if (($handler->request->attributes['nethvoice_admin'] ?? null) !== 'admin') { throw new \RuntimeException('Verified admin identity missing'); }
    echo "Exact testauth route and verified administrator identity passed\n";
}
