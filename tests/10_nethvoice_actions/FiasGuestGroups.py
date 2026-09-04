#
# Copyright (C) 2026 Nethesis S.r.l.
# SPDX-License-Identifier: GPL-3.0-or-later
#

import base64
import json
import shlex

from robot.libraries.BuiltIn import BuiltIn


REMOTE_CHECK = r'''
import json
import re
import secrets
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor


FIAS_CONFIG = "/etc/asterisk/fias.conf"
GI_SCRIPT = "/usr/share/neth-hotel-fias/gi2pbx.php"
GO_SCRIPT = "/usr/share/neth-hotel-fias/go2pbx.php"
LEGACY_GI_FORMAT = "format=RN_G#_GN_GL_GS_SF_A0_A1_A2_A3"
GG_GI_FORMAT = "format=RN_G#_GN_GL_GG_GS_SF_A0_A1_A2_A3"
LEGACY_RECORD = '1="LR|RIGI|FLRNG#GNGLGSSFA0A1A2A3|"'
GG_RECORD = ';1="LR|RIGI|FLRNG#GNGLGGGSSFA0A1A2A3|"'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(command, input_text=None, timeout=60, check=True):
    result = subprocess.run(
        command,
        input=input_text,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if check and result.returncode != 0:
        detail = (result.stderr.strip() or result.stdout.strip())[-2000:]
        raise RuntimeError(
            "command failed (rc={}): {}{}".format(
                result.returncode,
                " ".join(command[:4]),
                ": " + detail if detail else "",
            )
        )
    return result


def podman_exec(container, *arguments, timeout=60, check=True):
    return run(
        ["podman", "exec", container, *map(str, arguments)],
        timeout=timeout,
        check=check,
    )


def mysql(query):
    result = podman_exec(
        "mariadb",
        "sh",
        "-lc",
        'exec mysql -uroot -p"$MARIADB_ROOT_PASSWORD" --batch --raw --skip-column-names -e "$1"',
        "fias-gg-test",
        query,
    )
    return result.stdout.rstrip("\n")


def rows(query):
    output = mysql(query)
    if not output:
        return []
    return [line.split("\t") for line in output.splitlines()]


def scalar(query, default=""):
    result_rows = rows(query)
    if not result_rows or not result_rows[0]:
        return default
    return result_rows[0][0]


def sql_quote(value):
    return "'{}'".format(str(value).replace("\\", "\\\\").replace("'", "\\'"))


def read_config():
    return podman_exec("freepbx", "cat", FIAS_CONFIG).stdout


def write_config(contents):
    result = run(
        [
            "podman",
            "exec",
            "-i",
            "freepbx",
            "php",
            "-r",
            'exit(file_put_contents("/etc/asterisk/fias.conf", stream_get_contents(STDIN)) === false ? 1 : 0);',
        ],
        input_text=contents,
    )
    require(result.returncode == 0, "cannot update the temporary FIAS test configuration")


def set_gi_format(contents, target_format):
    output = []
    in_gi_section = False
    replacements = 0
    for line in contents.splitlines(keepends=True):
        stripped = line.rstrip("\r\n")
        if stripped == "[GI2PBX]":
            in_gi_section = True
        elif in_gi_section and stripped.startswith("["):
            in_gi_section = False

        if in_gi_section and stripped in (LEGACY_GI_FORMAT, GG_GI_FORMAT):
            ending = line[len(stripped):]
            line = target_format + ending
            replacements += 1
        output.append(line)

    require(replacements == 1, "GI2PBX active format was not found exactly once")
    return "".join(output)


def invoke_gi(room, reservation, guest_name, language, group, share="N", check=True):
    arguments = [
        room,
        reservation,
        guest_name,
        language,
        group,
        share,
        "",
        "",
        "",
        "",
        "",
    ]
    return podman_exec(
        "freepbx", "php", GI_SCRIPT, *arguments, timeout=120, check=check
    )


def invoke_legacy_gi(room, reservation, guest_name, language, share="N"):
    arguments = [
        room,
        reservation,
        guest_name,
        language,
        share,
        "",
        "",
        "",
        "",
        "",
    ]
    podman_exec("freepbx", "php", GI_SCRIPT, *arguments, timeout=120)


def invoke_go(room, reservation, share="N"):
    podman_exec(
        "freepbx",
        "php",
        GO_SCRIPT,
        room,
        reservation,
        share,
        "",
        timeout=120,
    )


def group_note(group_name):
    return "Created from FIAS guest group " + group_name


def find_group(group_name, note):
    result_rows = rows(
        "SELECT id,COALESCE(groupcalls,0),COALESCE(roomscalls,0),COALESCE(externalcalls,0) "
        "FROM roomsdb.room_groups "
        "WHERE name={} AND note={} AND fias_guest_group_number={} ORDER BY id".format(
            sql_quote(group_name), sql_quote(note), sql_quote(group_name)
        )
    )
    return result_rows


def group_assignments(room):
    return [
        int(result[0])
        for result in rows(
            "SELECT group_id FROM roomsdb.groups_rooms WHERE extension={} ORDER BY group_id".format(
                room
            )
        )
    ]


def current_options():
    values = {}
    for variable, value in rows(
        "SELECT variable,value FROM roomsdb.options "
        "WHERE variable IN ('groupcalls','internal_call','externalcalls') ORDER BY variable"
    ):
        values[variable] = int(value or 0)
    return {
        "groupcalls": values.get("groupcalls", 0),
        "roomscalls": values.get("internal_call", 0),
        "externalcalls": values.get("externalcalls", 0),
    }


def insert_manual_group(group_name, note):
    mysql(
        "INSERT INTO roomsdb.room_groups "
        "(name,note,groupcalls,roomscalls,externalcalls) VALUES ({},{},0,0,0)".format(
            sql_quote(group_name), sql_quote(note)
        )
    )
    return int(
        scalar(
            "SELECT id FROM roomsdb.room_groups WHERE name={} AND note={} ORDER BY id DESC LIMIT 1".format(
                sql_quote(group_name), sql_quote(note)
            )
        )
    )


def assign_group(room, group_id):
    mysql(
        "INSERT INTO roomsdb.groups_rooms (group_id,extension) VALUES ({},{})".format(
            group_id, room
        )
    )


def choose_fixture_ids():
    for _attempt in range(30):
        room_base = 8000000 + secrets.randbelow(900000)
        reservation_base = 1500000000 + secrets.randbelow(300000000)
        room_list = [room_base + offset for offset in range(4)]
        reservation_list = [reservation_base + offset for offset in range(8)]
        room_csv = ",".join(map(str, room_list))
        reservation_csv = ",".join(map(str, reservation_list))
        occupied = int(
            scalar(
                "SELECT "
                "(SELECT COUNT(*) FROM roomsdb.rooms WHERE extension IN ({})) + "
                "(SELECT COUNT(*) FROM roomsdb.groups_rooms WHERE extension IN ({})) + "
                "(SELECT COUNT(*) FROM fias.reservations WHERE reservation_number IN ({}))".format(
                    room_csv, room_csv, reservation_csv
                ),
                "0",
            )
        )
        if occupied == 0:
            return room_list, reservation_list
    raise RuntimeError("cannot allocate unused FIAS GG fixture identifiers")


def check_config_contract(original_config):
    require(
        len(re.findall(r"^" + re.escape(LEGACY_RECORD) + r"$", original_config, re.MULTILINE)) == 1,
        "legacy RIGI record is not active exactly once",
    )
    require(
        len(re.findall(r"^" + re.escape(GG_RECORD) + r"$", original_config, re.MULTILINE)) == 1,
        "optional GG RIGI record is not present exactly once",
    )
    require(
        len(re.findall(r"^" + re.escape(LEGACY_GI_FORMAT) + r"$", original_config, re.MULTILINE)) == 1,
        "legacy GI2PBX format is not active exactly once",
    )
    require(
        len(re.findall(r"^;" + re.escape(GG_GI_FORMAT) + r"$", original_config, re.MULTILINE)) == 1,
        "optional GG GI2PBX format is not present exactly once",
    )
    text_length = int(
        scalar(
            "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA='roomsdb' AND TABLE_NAME='rooms' AND COLUMN_NAME='text'",
            "0",
        )
    )
    require(text_length >= 255, "roomsdb.rooms.text is shorter than 255 characters")
    group_key_length = int(
        scalar(
            "SELECT CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA='roomsdb' AND TABLE_NAME='room_groups' "
            "AND COLUMN_NAME='fias_guest_group_number'",
            "0",
        )
    )
    require(group_key_length == 100, "FIAS guest group key is not varchar(100)")
    group_key_nullable = scalar(
        "SELECT IS_NULLABLE FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA='roomsdb' AND TABLE_NAME='room_groups' "
        "AND COLUMN_NAME='fias_guest_group_number'"
    )
    require(group_key_nullable == "YES", "FIAS guest group key is not nullable")
    unique_group_key = int(
        scalar(
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA='roomsdb' AND TABLE_NAME='room_groups' "
            "AND INDEX_NAME='unique_fias_guest_group_number' AND NON_UNIQUE=0 "
            "AND COLUMN_NAME='fias_guest_group_number'",
            "0",
        )
    )
    require(unique_group_key == 1, "FIAS guest group key is not unique")
    return {
        "ok": True,
        "legacy_default": True,
        "gg_opt_in_available": True,
        "room_text_length": text_length,
        "group_key_length": group_key_length,
        "group_key_nullable": True,
        "unique_group_key": True,
    }


def check_create_and_reuse(rooms_list, reservations, group_a, manual_note):
    manual_group_id = insert_manual_group(group_a, manual_note)
    options = current_options()

    invoke_gi(rooms_list[0], reservations[0], "Alpha Guest", "IT", group_a)
    invoke_gi(rooms_list[1], reservations[1], "Beta Guest", "EN", group_a)

    fias_groups = find_group(group_a, group_note(group_a))
    require(len(fias_groups) == 1, "GG did not create exactly one FIAS-managed group")
    fias_group_id = int(fias_groups[0][0])
    require(fias_group_id != manual_group_id, "GG reused a same-name manual group")
    require(
        {
            "groupcalls": int(fias_groups[0][1]),
            "roomscalls": int(fias_groups[0][2]),
            "externalcalls": int(fias_groups[0][3]),
        }
        == options,
        "FIAS group call permissions do not match Hotel options",
    )
    require(group_assignments(rooms_list[0]) == [fias_group_id], "first room has the wrong group")
    require(group_assignments(rooms_list[1]) == [fias_group_id], "second room did not reuse the GG group")
    require(
        int(
            scalar(
                "SELECT COUNT(*) FROM fias.reservations WHERE reservation_number IN ({},{})".format(
                    reservations[0], reservations[1]
                ),
                "0",
            )
        )
        == 2,
        "grouped check-ins did not create both reservations",
    )
    return {
        "ok": True,
        "group_id": fias_group_id,
        "rooms_assigned": 2,
        "manual_collision_avoided": True,
    }


def check_concurrent_create(rooms_list, reservations, group_a):
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(
                invoke_gi,
                rooms_list[0],
                reservations[0],
                "Concurrent Alpha",
                "IT",
                group_a,
            ),
            executor.submit(
                invoke_gi,
                rooms_list[1],
                reservations[1],
                "Concurrent Beta",
                "EN",
                group_a,
            ),
        ]
        for future in futures:
            future.result()

    fias_groups = find_group(group_a, group_note(group_a))
    require(len(fias_groups) == 1, "concurrent GI created duplicate FIAS groups")
    group_id = int(fias_groups[0][0])
    require(
        group_assignments(rooms_list[0]) == [group_id],
        "first concurrent room has the wrong group",
    )
    require(
        group_assignments(rooms_list[1]) == [group_id],
        "second concurrent room has the wrong group",
    )
    return {
        "ok": True,
        "single_group_created": True,
        "both_rooms_assigned": True,
    }


def check_long_group(rooms_list, reservations, long_group, truncated_group):
    require(len(long_group) == 101, "long GG fixture is not 101 characters")
    require(len(truncated_group) == 100, "truncated GG fixture is not 100 characters")

    invoke_gi(rooms_list[0], reservations[0], "Long Group Alpha", "IT", long_group)
    invoke_gi(rooms_list[1], reservations[1], "Long Group Beta", "EN", long_group)

    fias_groups = find_group(truncated_group, group_note(truncated_group))
    require(len(fias_groups) == 1, "truncated GG did not reuse one FIAS group")
    group_id = int(fias_groups[0][0])
    require(
        group_assignments(rooms_list[0]) == [group_id]
        and group_assignments(rooms_list[1]) == [group_id],
        "rooms using a long GG were not assigned to its truncated group",
    )
    return {
        "ok": True,
        "stored_group_length": len(truncated_group),
        "truncated_group_reused": True,
    }


def check_assignment_error(rooms_list, reservations, group_a, trigger_name):
    room = rooms_list[0]
    mysql(
        "USE roomsdb; CREATE TRIGGER `{}` BEFORE INSERT ON groups_rooms "
        "FOR EACH ROW SIGNAL SQLSTATE '45000' "
        "SET MESSAGE_TEXT = 'forced FIAS group assignment failure'".format(trigger_name)
    )

    failed_gi = invoke_gi(
        room,
        reservations[0],
        "Assignment Failure",
        "IT",
        group_a,
        check=False,
    )
    expected_error = "Error assigning room {} to guest group {}".format(room, group_a)
    require(failed_gi.returncode != 0, "setGroup failure did not make GI fail")
    require(expected_error in failed_gi.stderr, "GI did not log its structured assignment error")
    require(group_assignments(room) == [], "failed group assignment left a partial mapping")
    return {
        "ok": True,
        "nonzero_exit": True,
        "structured_error": True,
    }


def check_change_and_empty(rooms_list, reservations, group_a, group_b):
    room = rooms_list[0]
    invoke_gi(room, reservations[0], "First Guest", "IT", group_a)
    first_group_id = int(find_group(group_a, group_note(group_a))[0][0])
    require(group_assignments(room) == [first_group_id], "initial GG assignment failed")

    invoke_gi(room, reservations[1], "Second Guest", "EN", group_b, "Y")
    second_group_id = int(find_group(group_b, group_note(group_b))[0][0])
    require(group_assignments(room) == [second_group_id], "changed GG did not replace the assignment")
    require(len(find_group(group_a, group_note(group_a))) == 1, "previous GG definition was deleted")

    invoke_gi(room, reservations[2], "Third Guest", "EN", "", "Y")
    require(group_assignments(room) == [], "empty GG did not clear the room assignment")
    return {
        "ok": True,
        "group_changed": True,
        "empty_group_cleared": True,
        "old_definition_retained": True,
    }


def check_shared_checkout(rooms_list, reservations, group_a, token):
    room = rooms_list[0]
    first_name = "First Shared Guest " + token
    second_name = "Second Shared Guest " + token
    combined_name = first_name + " - " + second_name
    require(len(combined_name) > 32, "shared-name fixture does not exercise the widened column")

    invoke_gi(room, reservations[0], first_name, "IT", group_a, "Y")
    invoke_gi(room, reservations[1], second_name, "EN", group_a, "Y")
    fias_group_id = int(find_group(group_a, group_note(group_a))[0][0])
    require(group_assignments(room) == [fias_group_id], "shared room lost its GG assignment")
    require(
        scalar("SELECT text FROM roomsdb.rooms WHERE extension={}".format(room)) == combined_name,
        "shared-room guest label was not preserved",
    )
    require(
        int(scalar("SELECT COUNT(*) FROM roomsdb.history WHERE extension={}".format(room), "0")) == 0,
        "second shared check-in forced an unexpected checkout",
    )

    invoke_go(room, reservations[0], "Y")
    require(group_assignments(room) == [fias_group_id], "partial checkout removed the GG assignment")
    require(
        scalar("SELECT clean FROM roomsdb.rooms WHERE extension={}".format(room)) == "0",
        "partial checkout changed room occupancy",
    )
    require(
        scalar("SELECT text FROM roomsdb.rooms WHERE extension={}".format(room)) == second_name,
        "partial checkout did not rebuild the remaining guest label",
    )
    require(
        int(
            scalar(
                "SELECT COUNT(*) FROM fias.reservations WHERE room_number={}".format(room),
                "0",
            )
        )
        == 1,
        "partial checkout removed the wrong number of reservations",
    )

    invoke_go(room, reservations[1], "Y")
    require(group_assignments(room) == [], "final checkout retained the FIAS GG assignment")
    require(
        int(
            scalar(
                "SELECT COUNT(*) FROM fias.reservations WHERE room_number={}".format(room),
                "0",
            )
        )
        == 0,
        "final checkout retained a reservation",
    )
    require(
        int(
            scalar(
                "SELECT COUNT(*) FROM roomsdb.rooms WHERE extension={} AND clean=0".format(room),
                "0",
            )
        )
        == 0,
        "final checkout left the room occupied",
    )
    require(len(find_group(group_a, group_note(group_a))) == 1, "final checkout deleted the reusable GG definition")
    return {
        "ok": True,
        "partial_checkout_preserved_group": True,
        "final_checkout_removed_assignment": True,
        "shared_label_length": len(combined_name),
    }


def check_legacy_manual_group(rooms_list, reservations, manual_group_name, manual_note):
    room = rooms_list[0]
    manual_group_id = insert_manual_group(manual_group_name, manual_note)
    assign_group(room, manual_group_id)

    invoke_legacy_gi(room, reservations[0], "Legacy Guest", "IT")
    require(group_assignments(room) == [manual_group_id], "GI without GG changed a manual group")
    invoke_go(room, reservations[0])
    require(group_assignments(room) == [manual_group_id], "final checkout removed a manual group")
    return {
        "ok": True,
        "legacy_gi_preserved_manual_group": True,
        "checkout_preserved_manual_group": True,
    }


def restore_need_reload(values):
    mysql("DELETE FROM roomsdb.options WHERE variable='needReload'")
    for value in values:
        mysql(
            "INSERT IGNORE INTO roomsdb.options (variable,value) VALUES ('needReload',{})".format(
                sql_quote(value)
            )
        )


def cleanup(rooms_list, reservations, group_names, need_reload_values, trigger_name):
    room_csv = ",".join(map(str, rooms_list))
    reservation_csv = ",".join(map(str, reservations))
    group_csv = ",".join(sql_quote(name) for name in group_names)
    mysql("DROP TRIGGER IF EXISTS roomsdb.`{}`".format(trigger_name))
    mysql("DELETE FROM fias.reservations WHERE reservation_number IN ({})".format(reservation_csv))
    mysql("DELETE FROM roomsdb.groups_rooms WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.alarms WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.alarmcalls WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.extra_history WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.history WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.rooms WHERE extension IN ({})".format(room_csv))
    mysql("DELETE FROM roomsdb.room_groups WHERE name IN ({})".format(group_csv))
    restore_need_reload(need_reload_values)
    remaining = int(
        scalar(
            "SELECT "
            "(SELECT COUNT(*) FROM fias.reservations WHERE reservation_number IN ({})) + "
            "(SELECT COUNT(*) FROM roomsdb.groups_rooms WHERE extension IN ({})) + "
            "(SELECT COUNT(*) FROM roomsdb.rooms WHERE extension IN ({})) + "
            "(SELECT COUNT(*) FROM roomsdb.room_groups WHERE name IN ({}))".format(
                reservation_csv, room_csv, room_csv, group_csv
            ),
            "0",
        )
    )
    require(remaining == 0, "FIAS GG fixture rows remain after cleanup")
    for room in rooms_list:
        podman_exec(
            "freepbx",
            "asterisk",
            "-rx",
            "database del AMPUSER {}/cidname".format(room),
            check=False,
        )


operation = sys.argv[1]
original_config = read_config()
rooms_list, reservations = choose_fixture_ids()
token = secrets.token_hex(5)
group_a = "fias-gg-test-{}-a".format(token)
group_b = "fias-gg-test-{}-b".format(token)
manual_group_name = "fias-gg-test-{}-manual".format(token)
manual_note = "Manual test group " + token
long_group = ("fias-gg-test-{}-".format(token) + ("x" * 101))[:101]
truncated_group = long_group[:100]
assignment_trigger_name = "fias_gg_test_fail_" + token
group_names = [group_a, group_b, manual_group_name, truncated_group]
need_reload_values = [row[0] for row in rows("SELECT value FROM roomsdb.options WHERE variable='needReload'")]
config_changed = False
test_error = None
cleanup_errors = []
result = None

try:
    if operation == "config":
        result = check_config_contract(original_config)
    elif operation == "create-reuse":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_create_and_reuse(rooms_list, reservations, group_a, manual_note)
    elif operation == "concurrent-create":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_concurrent_create(rooms_list, reservations, group_a)
    elif operation == "long-group":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_long_group(
            rooms_list, reservations, long_group, truncated_group
        )
    elif operation == "assignment-error":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_assignment_error(
            rooms_list, reservations, group_a, assignment_trigger_name
        )
    elif operation == "change-empty":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_change_and_empty(rooms_list, reservations, group_a, group_b)
    elif operation == "shared-checkout":
        write_config(set_gi_format(original_config, GG_GI_FORMAT))
        config_changed = True
        result = check_shared_checkout(rooms_list, reservations, group_a, token)
    elif operation == "legacy-manual":
        write_config(set_gi_format(original_config, LEGACY_GI_FORMAT))
        config_changed = True
        result = check_legacy_manual_group(
            rooms_list, reservations, manual_group_name, manual_note
        )
    else:
        raise RuntimeError("unknown FIAS GG check: " + operation)
except Exception as error:
    test_error = error
finally:
    if config_changed:
        try:
            write_config(original_config)
        except Exception as error:
            cleanup_errors.append("config restore failed: " + str(error))
    try:
        cleanup(
            rooms_list,
            reservations,
            group_names,
            need_reload_values,
            assignment_trigger_name,
        )
    except Exception as error:
        cleanup_errors.append("fixture cleanup failed: " + str(error))

if test_error is not None:
    message = str(test_error)
    if cleanup_errors:
        message += "; " + "; ".join(cleanup_errors)
    raise RuntimeError(message)
if cleanup_errors:
    raise RuntimeError("; ".join(cleanup_errors))

print(json.dumps(result))
'''


def run_fias_guest_group_check(module_id, operation):
    encoded_check = base64.b64encode(REMOTE_CHECK.encode()).decode()
    launcher = f'import base64;exec(base64.b64decode("{encoded_check}"))'
    command = shlex.join(
        ["runagent", "-m", module_id, "python3", "-c", launcher, operation]
    )
    ssh = BuiltIn().get_library_instance("SSHLibrary")
    stdout, stderr, return_code = ssh.execute_command(
        command,
        return_stdout=True,
        return_stderr=True,
        return_rc=True,
    )

    if return_code != 0:
        detail = stderr.strip() or stdout.strip()
        raise AssertionError(detail or "FIAS GG check failed")

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise AssertionError("FIAS GG check returned invalid output") from error

    if not result.get("ok"):
        raise AssertionError(result.get("error", "FIAS GG check failed"))
    return result
