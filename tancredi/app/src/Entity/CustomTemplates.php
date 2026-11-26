<?php namespace Tancredi\Entity;

/*
 * Copyright (C) 2026 Nethesis S.r.l.
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

class CustomTemplates
{
    public const MAX_SIZE = 524288;
    private const NAME_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9_.-]{0,94}\.tmpl$/D';

    private $config;
    private $storage;

    public function __construct($config, $storage)
    {
        $this->config = $config;
        $this->storage = $storage;
    }

    public static function createEnvironment($config): \Twig\Environment
    {
        $loader = new \Twig\Loader\ChainLoader([
            new \Twig\Loader\FilesystemLoader($config['rw_dir'] . 'templates-custom/'),
            new \Twig\Loader\FilesystemLoader($config['ro_dir'] . 'templates/'),
        ]);
        $preg_replace_filter = new \Twig\TwigFilter('preg_replace', function($subject, $pattern, $replacement) {
            return preg_replace($pattern, $replacement, $subject);
        });
        $twig = new \Twig\Environment($loader, ['autoescape' => false]);
        $twig->addFilter($preg_replace_filter);
        return $twig;
    }

    public static function isValidName($name): bool
    {
        return is_string($name) && preg_match(self::NAME_PATTERN, $name) === 1;
    }

    public function list(): array
    {
        $results = array();
        foreach (scandir($this->directory()) ?: [] as $name) {
            if (self::isValidName($name) && is_file($this->directory() . $name)) {
                $results[] = $this->describe($name);
            }
        }
        usort($results, fn($a, $b) => strcmp($a['name'], $b['name']));
        return $results;
    }

    public function exists($name): bool
    {
        return self::isValidName($name) && is_file($this->directory() . $name);
    }

    public function validate($name, $content, $replace): ?array
    {
        if (!self::isValidName($name)) {
            return $this->problem(400, 'invalid-file-name', 'Invalid template file name');
        }
        if (!is_string($content) || $content === '') {
            return $this->problem(400, 'malformed-data', 'Missing template content');
        }
        if (strlen($content) > self::MAX_SIZE) {
            return $this->problem(413, 'file-too-large', 'The template is too large');
        }
        if (preg_match('//u', $content) !== 1 || str_contains($content, "\0")) {
            return $this->problem(400, 'invalid-encoding', 'The template is not UTF-8 text');
        }
        if (is_file($this->config['ro_dir'] . 'templates/' . $name)) {
            return $this->problem(409, 'shipped-template', 'A shipped template has the same name');
        }
        if (!$replace && $this->exists($name)) {
            return $this->problem(409, 'template-exists', 'A custom template has the same name');
        }
        try {
            $twig = self::createEnvironment($this->config);
            $twig->parse($twig->tokenize(new \Twig\Source($content, $name)));
        } catch (\Twig\Error\Error $e) {
            $problem = $this->problem(400, 'template-syntax-error', 'The template has a syntax error');
            $problem['detail'] = $e->getRawMessage();
            $problem['line'] = $e->getTemplateLine();
            return $problem;
        }
        return null;
    }

    public function save($name, $content): array
    {
        $temporary = tempnam($this->directory(), '.upload-');
        if ($temporary === false) {
            throw new \RuntimeException('Cannot create the template file');
        }
        if (file_put_contents($temporary, $content) !== strlen($content)
            || !chmod($temporary, 0644)
            || !rename($temporary, $this->directory() . $name)) {
            @unlink($temporary);
            throw new \RuntimeException('Cannot write the template file');
        }
        clearstatcache(true, $this->directory() . $name);
        return $this->describe($name);
    }

    public function usedBy($name): array
    {
        $scopes = array();
        foreach ($this->storage->listScopes() as $scope) {
            $data = $this->storage->storageRead($scope)['data'] ?? [];
            foreach ($data as $variable => $value) {
                if (str_starts_with((string) $variable, 'tmpl_') && $value === $name) {
                    $scopes[] = $scope;
                    break;
                }
            }
        }
        sort($scopes);
        return $scopes;
    }

    public function delete($name): bool
    {
        return $this->exists($name) && unlink($this->directory() . $name);
    }

    private function directory(): string
    {
        return $this->config['rw_dir'] . 'templates-custom/';
    }

    private function describe($name): array
    {
        $stats = stat($this->directory() . $name);
        return array(
            'name' => $name,
            'size' => $stats['size'],
            'mtime' => $stats['mtime'],
        );
    }

    private function problem($status, $type, $title): array
    {
        return array(
            'status' => $status,
            'type' => $type,
            'title' => $title,
        );
    }
}
