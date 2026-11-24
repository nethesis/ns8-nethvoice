<?php namespace Tancredi\Entity;

/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - nethserver@nethesis.it
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see COPYING.
 */

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\StreamFactory;
use Slim\Psr7\Response;

class NethVoiceAuth implements MiddlewareInterface
{
    private const SUPERADMIN_FIELDS = ['ldap_password', 'tok1', 'tok2', 'provisioning_url1', 'provisioning_url2'];
    private const PHONES_FIELDS = ['adminpw', 'userpw'];
    private const SUPERADMIN_WRITE_FIELDS = ['hostname', 'lcd_logo_url'];
    private const SUPERADMIN_WRITE_PATTERN = '/^outbound_proxy2?_\d+$/D';
    private const USERS_READABLE_PATHS = ['/phones', '/models', '/defaults', '/macvendors'];

    private $config;

    /**
     * @throws \RuntimeException
     */
    public function __construct($config)
    {
        if ( ! is_array($config)
            || ! $config['secret']
            || ! $config['static_token']
            ) {
            throw new \RuntimeException('Bad NethVoiceAuth configuration', 1574245361);
        }
        $this->config = $config;
    }

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($request->getMethod() === 'OPTIONS') {
            return $handler->handle($request);
        } elseif ($request->hasHeader('Authentication')) {
            if($request->getHeaderLine('Authentication') === ('static ' . $this->config['static_token'])
                && ($request->getHeaderLine('HTTP_HOST') === '127.0.0.1' || $request->getHeaderLine('HTTP_HOST') === 'localhost')
            ) {
                // Local autentication for NethCTI success
                return $handler->handle($request);
            } else {
                return $this->createForbiddenResponse();
            }
        } elseif ($request->hasHeader('Secretkey') && $request->hasHeader('User')) {
            $user = $this->findUser($request->getHeaderLine('User'));

            if (!empty($user) && self::isPhonesAdministrator($user[0]['sections'] ?? '')) {
                $password_sha1 = $user[0]['password_sha1'];
                $username = $user[0]['username'];

                if (isset($username, $password_sha1) && hash_equals(sha1($username . $password_sha1 . $this->config['secret']), $request->getHeaderLine('Secretkey'))) {
                    $sections = $user[0]['sections'] ?? '';
                    if (self::isSuperAdministrator($sections)) {
                        return $handler->handle($request);
                    }
                    if (!self::sectionMayRequest($sections, $request->getMethod(), $request->getUri()->getPath())) {
                        return $this->createForbiddenResponse('Missing permission for this resource');
                    }
                    $hidden = self::hiddenFields($sections);
                    if (self::refusedFields(self::requestFields($request), $hidden)) {
                        return $this->createForbiddenResponse('Missing permission for this field');
                    }

                    return self::withoutFields($handler->handle($request), $hidden);
                }
            }

            return $this->createForbiddenResponse();
        } elseif ($request->getUri()->getPath() === 'macvendors') {
            return $handler->handle($request);
        } else {
            return $this->createForbiddenResponse('Invalid NethVoiceAuth authentication headers');
        }
    }

    protected function findUser(string $username): array
    {
        $dbh = new \PDO(
            'mysql:dbname=asterisk;host='.($this->config['auth_nethvoice_dbhost'] ?? 'localhost').';port='.($this->config['auth_nethvoice_dbport'] ?? '3306'),
            ($this->config['auth_nethvoice_dbuser'] ?? 'tancredi'),
            $this->config['auth_nethvoice_dbpass']
        );
        $stmt = $dbh->prepare("SELECT * FROM ampusers WHERE username = ?");
        $stmt->execute(array($username));

        return $stmt->fetchAll();
    }

    public static function isPhonesAdministrator($sections): bool
    {
        $entries = self::sectionEntries($sections);
        if (in_array('*', $entries, true)) {
            return true;
        }

        return (bool) array_intersect(['nethvoice:superadmin', 'nethvoice:phones', 'nethvoice:users'], $entries);
    }

    public static function isSuperAdministrator($sections): bool
    {
        return (bool) array_intersect(['*', 'nethvoice:superadmin'], self::sectionEntries($sections));
    }

    public static function sectionMayRequest($sections, string $method, string $path): bool
    {
        $method = strtoupper($method);
        $resource = self::resourcePath($path);
        if (in_array('nethvoice:phones', self::sectionEntries($sections), true)) {
            return in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) || !preg_match('#^/phones/[^/]+/tok1$#', $resource);
        }

        return in_array($method, ['GET', 'HEAD', 'OPTIONS'], true) && in_array($resource, self::USERS_READABLE_PATHS, true);
    }

    private static function resourcePath(string $path): string
    {
        $path = rtrim(preg_replace('#/+#', '/', rawurldecode($path)), '/');

        return preg_match('#^.*?/api/v1(/.*)?$#D', $path, $matches) ? ($matches[1] ?? '') : $path;
    }

    public static function refusedFields(array $fields, array $hidden): array
    {
        return array_values(array_filter($fields, fn($field) => in_array($field, $hidden, true)
            || in_array($field, self::SUPERADMIN_WRITE_FIELDS, true)
            || preg_match(self::SUPERADMIN_WRITE_PATTERN, $field) === 1));
    }

    public static function hiddenFields($sections): array
    {
        if (in_array('nethvoice:phones', self::sectionEntries($sections), true)) {
            return self::SUPERADMIN_FIELDS;
        }

        return array_merge(self::SUPERADMIN_FIELDS, self::PHONES_FIELDS);
    }

    public static function requestFields(ServerRequestInterface $request): array
    {
        $bodies = [$request->getParsedBody()];
        $stream = $request->getBody();
        $contents = (string) $stream;
        if ($stream->isSeekable()) {
            $stream->rewind();
        }
        $type = strtolower(trim(explode(';', $request->getHeaderLine('Content-Type'))[0]));
        if ($type === 'application/x-www-form-urlencoded') {
            parse_str($contents, $form);
            $bodies[] = $form;
        } else {
            $bodies[] = json_decode($contents, true);
        }
        $fields = [];
        foreach ($bodies as $body) {
            self::collectFields($body, $fields);
        }

        return array_keys($fields);
    }

    private static function collectFields($data, array &$fields): void
    {
        if (is_object($data)) {
            $data = get_object_vars($data);
        }
        if (!is_array($data)) {
            return;
        }
        foreach ($data as $key => $value) {
            $fields[(string) $key] = true;
            self::collectFields($value, $fields);
        }
    }

    public static function withoutFields(ResponseInterface $response, array $hidden): ResponseInterface
    {
        $contents = (string) $response->getBody();
        if ($contents === '') {
            return $response;
        }
        $data = json_decode($contents);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return $response;
        }
        $flags = defined('JSON_FLAGS') ? JSON_FLAGS : (JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $response
            ->withoutHeader('Content-Length')
            ->withBody((new StreamFactory())->createStream(json_encode(self::stripFields($data, $hidden), $flags)));
    }

    private static function stripFields($data, array $hidden)
    {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = self::stripFields($value, $hidden);
            }
        } elseif (is_object($data)) {
            foreach (get_object_vars($data) as $key => $value) {
                if (str_starts_with((string) $key, 'account_password_') || in_array((string) $key, $hidden, true)) {
                    unset($data->$key);
                } else {
                    $data->$key = self::stripFields($value, $hidden);
                }
            }
        }

        return $data;
    }

    private static function sectionEntries($sections): array
    {
        return array_map('trim', explode(';', (string) $sections));
    }

    private function createForbiddenResponse($detail = 'Invalid client credentials'): ResponseInterface
    {
        $results = array(
            'type' => 'https://nethesis.github.io/tancredi/problems#forbidden',
            'title' => 'Access to resource is forbidden with current client privileges',
            'detail' => $detail
        );

        $response = new Response();
        $response->getBody()->write(json_encode($results));
        return $response
            ->withStatus(403)
            ->withHeader('Content-Type', 'application/problem+json')
            ->withHeader('Content-Language', 'en');
    }
}

