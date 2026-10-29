#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
sources=${1:?Usage: tools/test-freepbx.sh SOURCE_DIRECTORY}
for test in "$repo_root"/freepbx/tests/*.php; do
    case $(basename "$test") in
        paging_transfer_test.php) php "$test" "$sources/paging" "$sources/core" "$sources/framework" ;;
        forward_context_test.php|forward_identity_test.php|missing_device_dial_test.php|profile_pickup_test.php|recallonbusy_return_test.php) php "$test" "$sources/core" "$sources/framework" ;;
        unknown_peer_rejection_test.php) php "$test" "$sources/core" ;;
        *) php "$test" ;;
    esac
done
for test in "$repo_root"/local_testing/tests/*.php; do php "$test"; done
