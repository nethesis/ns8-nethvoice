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

                    return self::withoutLinePasswords($handler->handle($request));
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
        if (in_array(strtoupper($method), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return true;
        }
        if (preg_match('#/defaults/*$#', rawurldecode($path))) {
            return in_array('nethvoice:phones', self::sectionEntries($sections), true);
        }

        return true;
    }

    public static function withoutLinePasswords(ResponseInterface $response): ResponseInterface
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
            ->withBody((new StreamFactory())->createStream(json_encode(self::stripLinePasswords($data), $flags)));
    }

    private static function stripLinePasswords($data)
    {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = self::stripLinePasswords($value);
            }
        } elseif (is_object($data)) {
            foreach (get_object_vars($data) as $key => $value) {
                if (str_starts_with((string) $key, 'account_password_')) {
                    unset($data->$key);
                } else {
                    $data->$key = self::stripLinePasswords($value);
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

