<?php namespace Tancredi;

/*
 * Copyright (C) 2020 Nethesis S.r.l.
 * http://www.nethesis.it - sviluppo@nethesis.it
 *
 * This script is part of Tancredi.
 *
 * Tancredi is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License,
 * or any later version.
 *
 * Tancredi is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tancredi.  If not, see COPYING.
 */

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Log\LoggerInterface;

/**
 * Send a debug message to logger for each request
 */
class LoggingMiddleware implements MiddlewareInterface
{
    private $logger;
    
    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
    }
    
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);
        $context = [
            'method' => $request->getMethod(),
            'uri' => (string) $request->getUri(),
            'status' => $response->getStatusCode(),
            'request' => $this->formatPayload($this->sanitizePayload((string) $request->getBody())),
            'response' => $this->formatPayload($this->sanitizePayload((string) $response->getBody())),
        ];
        $this->logger->debug('{method} {uri} ({status}) [{request}, {response}]', $context);
        return $response;
    }

    protected function formatPayload($payload) 
    {
        if( ! is_string($payload)) {
            return 'null';
        }
        if(strlen($payload) == 0) {
            return '""';
        }
        if(strlen($payload) <= 128) {
            return $payload;
        }
        return sprintf('%s ...(total length %s)', substr($payload, 0, 128), strlen($payload));
    }

    /**
     * Sanitize sensitive data from payload before logging
     * 
     * @param string $payload The payload to sanitize
     * @return string The sanitized payload with sensitive data masked
     */
    protected function sanitizePayload(string $payload): string
    {
        if (empty($payload)) {
            return $payload;
        }

        // Try to decode as JSON to sanitize structured data
        $decoded = json_decode($payload, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $sanitized = $this->sanitizeArray($decoded);
            return json_encode($sanitized);
        }

        // For non-JSON payloads, use regex to mask sensitive patterns
        // This handles query strings and other formatted data
        $sensitiveFields = [
            'password', 'passwd', 'pwd', 'secret',
            'adminpw', 'userpw',
            'token', 'tok1', 'tok2',
            'account_[a-z0-9_]*'
        ];
        
        $pattern = '/(["\']?(?:' . implode('|', $sensitiveFields) . ')["\']?\s*[:=]\s*["\']?)([^"\'&\s,}]+)(["\']?)/i';
        $payload = preg_replace($pattern, '$1***REDACTED***$3', $payload);

        return $payload;
    }

    /**
     * Recursively sanitize sensitive data from arrays
     * 
     * @param array $data The array to sanitize
     * @return array The sanitized array with sensitive values masked
     */
    protected function sanitizeArray($data)
    {
        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->sanitizeArray($value);
            } elseif ($this->isSensitiveKey($key)) {
                $data[$key] = '***REDACTED***';
            }
        }
        return $data;
    }

    /**
     * Check if a key represents sensitive data
     * 
     * @param string $key The key to check
     * @return bool True if the key is sensitive, false otherwise
     */
    protected function isSensitiveKey(string $key): bool
    {
        $key_lower = strtolower($key);
        
        // Check for exact matches or patterns
        $sensitivePatterns = [
            'password',
            'passwd',
            'pwd',
            'secret',
            'adminpw',
            'userpw',
            'token',
            'tok1',
            'tok2',
            'credential',
            'auth',
        ];

        foreach ($sensitivePatterns as $pattern) {
            if (strpos($key_lower, $pattern) !== false) {
                return true;
            }
        }

        // Check for account_* pattern
        if (strpos($key_lower, 'account_') === 0) {
            return true;
        }

        return false;
    }
}
