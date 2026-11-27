#!/bin/sh
set -eu
repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
sources=${1:?Usage: tools/test-freepbx.sh SOURCE_DIRECTORY}
for test in "$repo_root"/freepbx/tests/*.php; do
    case $(basename "$test") in
        outbound_trunk_dialplan.php) ;; # Executed by outbound_trunk_test.sh in the FreePBX image.
        paging_transfer_test.php) php "$test" "$sources/paging" "$sources/core" "$sources/framework" ;;
        callerid_language_test.php|forward_context_test.php|forward_identity_test.php|forward_progress_test.php|missing_device_dial_test.php|profile_pickup_test.php|recallonbusy_return_test.php|srtp_headers_test.php) php "$test" "$sources/core" "$sources/framework" ;;
        unknown_peer_rejection_test.php) php "$test" "$sources/core" ;;
        sip_nat_upgrade_test.php) php "$test" "$sources/sipsettings" "$sources/core" ;;
        userman_sync_test.php) php "$test" "$sources/userman" "$sources/framework" ;;
        transfer_profile_test.php|returnontransfer_settings_test.php) php "$test" "$sources/framework" ;;
        *) php "$test" ;;
    esac
done
for test in "$repo_root"/local_testing/tests/*.php; do
    case $(basename "$test") in
        nethcti_gui_hooks_test.php) php "$test" "$sources/core/page.trunks.php" "$sources/framework/amp_conf/htdocs/admin/libraries/BMO/GuiHooks.class.php" ;;
        *) php "$test" ;;
    esac
done
