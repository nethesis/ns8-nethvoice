<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;
require_once __DIR__.'/ProviderCatalog.php';

/** Standalone validator for the supported JSON Schema vocabulary. */
final class PublishedContract
{
    public static function validate(array $snapshot): array
    {
        $version=$snapshot['contract_version']??0;
        if ($version!==8) throw new \InvalidArgumentException('invalid_snapshot');
        $schema = json_decode(file_get_contents(__DIR__ . '/contracts/published-v8.schema.json'), true, 512, JSON_THROW_ON_ERROR);
        if (strlen(json_encode($snapshot, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) > 65536 ||
            !self::matches($snapshot, $schema) ||
            $snapshot['destination_id'] !== 'agent:' . $snapshot['agent_id']) {
            throw new \InvalidArgumentException('invalid_snapshot');
        }
        $ids=array_column($snapshot['tool_bindings'],'tool_id');
        if (count($ids)!==count(array_unique($ids))) throw new \InvalidArgumentException('invalid_snapshot');
        foreach ($snapshot['tool_bindings'] as $binding) if (!is_int($binding['tool_version'])) throw new \InvalidArgumentException('invalid_snapshot');
        if ($snapshot['debug']['transcription_enabled'] && $snapshot['provider']!=='openai') throw new \InvalidArgumentException('invalid_snapshot');
        ProviderCatalog::validateConversation($snapshot['provider'],$snapshot['conversation']);
        foreach ($snapshot['tool_bindings'] as $binding) {
            $descriptions=$binding['config']['descriptions']??[];
            if (count(array_column($descriptions,'destination_id'))!==count(array_unique(array_column($descriptions,'destination_id')))) throw new \InvalidArgumentException('invalid_snapshot');
        }
        return $snapshot;
    }

    public static function matches($value, array $schema): bool
    {
        if (isset($schema['oneOf'])) {
            $matched=0;
            foreach ($schema['oneOf'] as $alternative) if (self::matches($value,$alternative)) $matched++;
            if ($matched!==1) return false;
        }
        if (isset($schema['const']) && $value !== $schema['const']) return false;
        if (isset($schema['enum']) && !in_array($value, $schema['enum'], true)) return false;
        switch ($schema['type'] ?? '') {
            case 'object':
                if (!is_array($value) || array_is_list($value)) return false;
                foreach ($schema['required']??[] as $key) if (!array_key_exists($key, $value)) return false;
                foreach ($value as $key => $child) {
                    if (!isset($schema['properties'][$key]) || !self::matches($child, $schema['properties'][$key])) return false;
                }
                break;
            case 'array':
                if (!is_array($value) || !array_is_list($value) || count($value) > ($schema['maxItems']??PHP_INT_MAX) || count($value)<($schema['minItems']??0)) return false;
                if (($schema['uniqueItems']??false) && count(array_unique($value, SORT_REGULAR)) !== count($value)) return false;
                foreach ($value as $child) if (!self::matches($child, $schema['items'])) return false;
                break;
            case 'string':
                if (!is_string($value)) return false;
                if (isset($schema['minLength']) && mb_strlen($value, 'UTF-8') < $schema['minLength']) return false;
                if (isset($schema['maxLength']) && mb_strlen($value, 'UTF-8') > $schema['maxLength']) return false;
                if (isset($schema['pattern']) && preg_match('~' . $schema['pattern'] . '~D', $value) !== 1) return false;
                break;
            case 'integer':
                if (!is_int($value) || $value < $schema['minimum'] || $value > $schema['maximum']) return false;
                break;
            case 'boolean':
                if (!is_bool($value)) return false;
                break;
            case 'null':
                if ($value !== null) return false;
                break;
            case '':
                break;
            default:
                return false;
        }
        return true;
    }
}
