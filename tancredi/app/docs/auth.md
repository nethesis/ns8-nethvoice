---
parent: Tancredi API v1
---

# API authentication

The Tancredi administrative API does not implement authentication by itself,
but it can load a custom middleware class.

1. In the configuration file, set `auth_class` to the PHP class name placed in
   `src/Entity/`. For example:

   ```ini
   auth_class = "MyAuth"
   ```

1. Create `src/Entity/MyAuth.php`. The class can implement PSR-15 middleware,
   which matches the current Slim 4 stack:

   ```php
   <?php

   namespace Tancredi\Entity;

   use Psr\Http\Message\ResponseInterface;
   use Psr\Http\Message\ServerRequestInterface;
   use Psr\Http\Server\MiddlewareInterface;
   use Psr\Http\Server\RequestHandlerInterface;
   use Slim\Psr7\Response;

   class MyAuth implements MiddlewareInterface
   {
       public function __construct(private array $config = [])
       {
       }

       public function process(
           ServerRequestInterface $request,
           RequestHandlerInterface $handler
       ): ResponseInterface {
           if ($request->getHeaderLine('foo') === 'bar') {
               return $handler->handle($request);
           }

           $response = new Response(403);
           $response->getBody()->write(json_encode([
               'type' => 'https://nethesis.github.io/tancredi/problems/#forbidden',
               'title' => 'Access to resource is forbidden with current client privileges',
               'detail' => 'Wrong credentials',
           ]));

           return $response
               ->withHeader('Content-Type', 'application/problem+json')
               ->withHeader('Content-Language', 'en');
       }
   }
   ```

The configured middleware is applied only to the administrative API entrypoint.
Provisioning requests are not protected by `auth_class`; they rely on the
token-based mechanism documented in [Provisioning flow and security]({{ '/provisioning' | relative_url }}).
