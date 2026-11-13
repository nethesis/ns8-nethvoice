#!/usr/bin/env bats

@test "Auto Headset renders valid values and the disabled fallback for Fanvil and NethPhone templates" {
    run php "${TANCREDI_APP_ROOT}/test/auto-headset-rendering.php"
    if [[ "$status" -ne 0 ]]; then
        echo "$output" >&2
        return 1
    fi
}
