<?php
// SPDX-License-Identifier: GPL-3.0-or-later
namespace NethVoice\Agents;

final class Preview
{
    /** Read one generation per request, including intentionally cleared keys. */
    public static function value(string $name): string
    {
        static $settings;
        if ($settings===null) {
            $path='/run/nethvoice-preview/effective.env';
            if (PHP_SAPI==='cli' && getenv('VOICE_AGENT_SETTINGS_FILE')) $path=getenv('VOICE_AGENT_SETTINGS_FILE');
            $settings=[];
            foreach (@file($path,FILE_IGNORE_NEW_LINES) ?: [] as $line) {
                if (str_contains($line,'=')) {
                    [$key,$value]=explode('=',$line,2);
                    $settings[$key]=$value;
                }
            }
            // Standalone CLI invocations can use process environment in place of the mount.
            if (!is_file($path) && PHP_SAPI==='cli' && !is_dir(dirname($path)) && !getenv('VOICE_AGENT_SETTINGS_FILE')) $settings=false;
        }
        if ($settings===false) return (string)getenv($name);
        return $settings[$name] ?? '';
    }

    public static function enabled(): bool { return strtolower(self::value('VOICE_AGENT_ENABLED'))==='true'; }
    public static function sipEnabled(): bool { return self::enabled() && strtolower(self::value('VOICE_AGENT_SIP_LAB_ENABLED'))==='true'; }
}
