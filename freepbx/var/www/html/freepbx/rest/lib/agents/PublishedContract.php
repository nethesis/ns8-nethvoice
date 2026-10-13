<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

/** Standalone validator for the deliberately small v1 JSON Schema vocabulary. */
final class PublishedContract
{
    public static function validate(array $snapshot): array
    {
        $schema = json_decode(file_get_contents(__DIR__ . '/contracts/published-v1.schema.json'), true, 512, JSON_THROW_ON_ERROR);
        if (strlen(json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) > 65536 ||
            !self::matches($snapshot, $schema) ||
            $snapshot['destination_id'] !== 'agent:' . $snapshot['agent_id']) {
            throw new \InvalidArgumentException('invalid_snapshot');
        }
        return $snapshot;
    }

    private static function matches($value, array $schema): bool
    {
        if (isset($schema['const']) && $value !== $schema['const']) return false;
        if (isset($schema['enum']) && !in_array($value, $schema['enum'], true)) return false;
        switch ($schema['type'] ?? '') {
            case 'object':
                if (!is_array($value) || array_is_list($value)) return false;
                foreach ($schema['required'] as $key) if (!array_key_exists($key, $value)) return false;
                foreach ($value as $key => $child) {
                    if (!isset($schema['properties'][$key]) || !self::matches($child, $schema['properties'][$key])) return false;
                }
                break;
            case 'array':
                if (!is_array($value) || !array_is_list($value) || count($value) > $schema['maxItems']) return false;
                if (count(array_unique($value, SORT_REGULAR)) !== count($value)) return false;
                foreach ($value as $child) if (!self::matches($child, $schema['items'])) return false;
                break;
            case 'string':
                if (!is_string($value)) return false;
                if (isset($schema['maxLength']) && mb_strlen($value, 'UTF-8') > $schema['maxLength']) return false;
                if (isset($schema['pattern']) && preg_match('~' . $schema['pattern'] . '~D', $value) !== 1) return false;
                break;
            case 'integer':
                if (!is_int($value) || $value < $schema['minimum'] || $value > $schema['maximum']) return false;
                break;
        }
        return true;
    }
}
