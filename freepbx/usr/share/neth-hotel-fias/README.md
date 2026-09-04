# NethHotel FIAS bridge

This directory contains the NethHotel FIAS bridge used to exchange guest and
room state between FreePBX and a PMS.

The code is split into four layers:

1. `fiasd.php`: long-running TCP client that speaks the FIAS protocol.
2. `dispatcher.php`: long-running worker that consumes inbound FIAS messages
   from MySQL and invokes the corresponding local handler.
3. One-shot CLI producer and handler scripts: entrypoints that either queue
  FIAS messages or apply PMS commands to `roomsdb`.
4. `fias-server.php` and `fias-server-*.php`: local test server components used
   to simulate a PMS without a real external system.

## Runtime overview

When hotel FIAS is enabled, the FreePBX container generates
`/etc/asterisk/fias.conf` and starts two supervisor programs:

- `fias`: runs `fiasd.php`
- `fiasdispatcher`: runs `dispatcher.php`

The production data flow is:

```text
PBX event / AGI / helper script
  -> outbound queueing script or helper (cdr.php, minibar.php, le2pms.php, ...)
    -> MySQL database `fias`, table `messages` with dir='PMS'
    -> fiasd.php
    -> TCP connection to PMS

PMS frame
  -> fiasd.php
  -> MySQL database `fias`, table `messages` with dir='PBX'
  -> dispatcher.php
  -> inbound handler script
  -> roomsdb / reservations / Asterisk state
```

The standalone test-server flow is:

```text
fias-server-*.php
    -> MySQL database `fias_server`, table `messages` with dir='PBX'
    -> fias-server.php
    -> TCP connection accepted from fiasd.php
    -> client receives frame and stores it in `fias`
    -> dispatcher.php runs the real PBX-side handler
    -> roomsdb is updated by the same code path used in production
```

## MySQL data model

The FIAS transport uses normalized queue tables.

### Main transport database: `fias`

- `messages`
  - one row per FIAS message
  - `cmd`: two-letter FIAS command (`GI`, `GO`, `PS`, ...)
  - `dir`: `PMS` for outbound messages, `PBX` for inbound messages
  - `elaborationtime`: `NULL` while the row is still pending
  - `raw`: serialized frame after it has been read or sent
- `messagesparameters`
  - one row per message field
  - linked by `msgid`
- `reservations`
  - room and guest tracking used by `gi2pbx.php`, `gc2pbx.php`, and
    `go2pbx.php`
  - keeps the current reservation number, guest name, language, share flag,
    and timestamps

### Test transport database: `fias_server`

`fias-server.php` uses the same schema as `fias`, but in a separate database.
That keeps test traffic isolated from the production queue.

### Target application database: `roomsdb`

The PBX-side handlers update `roomsdb`, mainly:

- `rooms`: current checked-in rooms, guest text, language, clean flag
- `alarms`: configured wake-up calls
- `alarmcalls`: scheduled wake-up call jobs
- `history`: room check-in / check-out history
- `extra_history`: extra and minibar charges

## `/etc/asterisk/fias.conf`

`fias.conf` is the central configuration file for the bridge. The file in the
repository is the base template; the container entrypoint rewrites `address` and
`port` from environment variables at startup.

The helper layer also supports test-only environment overrides:

- `FIAS_CONFIG_PATH`: alternate path for `fias.conf`
- `FIAS_DB_NAME`: alternate transport database name for the client side
- `FIAS_SERVER_DB_NAME`: alternate transport database name for the test server
- `FREEPBX_DB_CONF_PATH`: alternate path for `freepbx_db.conf`
- `FIAS_SERVER_LOCK_PATH`: alternate lock file path for `fias-server.php`

### `[general]`

| Key | Meaning |
| --- | --- |
| `dbhost` | MySQL host used by the standalone test server database connection. |
| `dbport` | MySQL port used by the standalone test server database connection. If omitted, the helper falls back to the FreePBX DB port from `freepbx_db.conf`. |
| `dbname` | Legacy logical name kept in the config template. The current helper code uses `FIAS_DB_NAME` / `FIAS_SERVER_DB_NAME` instead of this key for database selection. |
| `user` | MySQL username used by the standalone test server. |
| `pwd` | MySQL password used by the standalone test server. |

### `[fiasd]`

| Key | Meaning |
| --- | --- |
| `separator` | Field separator used inside a frame, normally `|`. |
| `record_start` | Start-of-text byte value. The code converts this numeric value to a single character. |
| `record_end` | End-of-text byte value. The code converts this numeric value to a single character. |
| `remote_character_encoding` | Character set expected on the wire. `fiasd.php` and `fias-server.php` convert payloads between this encoding and UTF-8. |
| `link_check_interval` | Idle interval after which `fiasd.php` sends a link-start sequence (`LS`). |
| `send_msdelay` | Delay between consecutive transmitted frames, in milliseconds. |
| `timeout` | Socket receive timeout, in seconds. |
| `TimeoutLE_msec` | Delay applied after sending `LE`, in milliseconds. |
| `DebugLevel` | Logging verbosity. `0` logs only errors, `1` logs info, `2` adds debug, `3` adds verbose debug. |
| `address` | PMS host or test-server host that `fiasd.php` connects to. |
| `port` | PMS port or test-server port that `fiasd.php` connects to. |

### `[cdr]`

| Key | Meaning |
| --- | --- |
| `cdrInternalExtensions` | Comma-separated list of always-internal numbers. |
| `cdrExternalExtensions` | Comma-separated list of always-external numbers. |
| `cdrInternalPatterns` | Regex list that classifies a number as internal. |
| `cdrExternalPatterns` | Regex list that classifies a number as external. |
| `cdrMode` | Billing mode used by `cdr.php`: `C` for direct charge (`TA`), `T` for meter pulse (`MP`). |

### `[minibar]`

| Key | Meaning |
| --- | --- |
| `psmode` | How `minibar.php` converts minibar events into `PS2PMS`: `M` for minibar posting, `C` for direct charge when a total amount is provided. |

### `[record_LDLR]`

This section defines the static `LD` and `LR` records exchanged during link
startup. `fiasd.php` and `fias-server.php` send these records during the
LS/LD/LR/LA handshake.

### Command sections

Each command section has two keys:

- `command`: absolute path to the CLI handler
- `format`: underscore-separated list of FIAS field codes in CLI argument order

`getArguments()` uses the `format` string to map positional CLI arguments to
field names, and `dispatcher.php` uses the same format to rebuild the command
line from the queued `messagesparameters` rows.

Only the fields listed in a section's `format` are parsed from CLI arguments.
Extra positional arguments are ignored. Older ad-hoc examples that rely on
fields not present in the current `format` require a matching `fias.conf`
change first.

The default mapping is:

| Section | Script | Format |
| --- | --- | --- |
| `WR2PMS` | `wr2pms.php` | `DA_TI_RN` |
| `WC2PMS` | `wc2pms.php` | `DA_TI_RN` |
| `WA2PMS` | `wa2pms.php` | `DA_TI_RN_AS` |
| `RE2PMS` | `re2pms.php` | `RN_RS` |
| `PS2PMS` | `ps2pms.php` | `DA_DD_DU_MA_M#_MP_PT_RN_TA_TI_P#_G#_SO` |
| `LE2PMS` | `le2pms.php` | empty |
| `WR2PBX` | `wr2pbx.php` | `DA_TI_RN` |
| `WC2PBX` | `wc2pbx.php` | `DA_TI_RN` |
| `GI2PBX` | `gi2pbx.php` | `RN_G#_GN_GL_GS_SF_A0_A1_A2_A3` |
| `GO2PBX` | `go2pbx.php` | `RN_G#_GS_SF` |
| `GC2PBX` | `gc2pbx.php` | `RN_G#_GN_GL_GS_RO_A0_A1_A2_A3` |
| `PA2PBX` | `pa2pbx.php` | `AS_DA_P#_RN_TI` |
| `RE2PBX` | `re2pbx.php` | `RN_RS_ML_CS_DN` |
| `DR2PMS` | `dr2pms.php` | `DA_TI` |
| `MINIBAR2PMS` | `minibar.php` | `DA_TI_RN_MA_M#_TA` |

### `[custom_fields]`

`gi2pbx.php` and `gc2pbx.php` can execute optional shell commands for `A0` to
`A3`. The command template may use these placeholders:

- `%ROOM%`
- `%RESERVATION%`
- `%GUESTNAME%`
- `%GUESTLANGUAGE%`
- `%ARG%`

## Common field codes

The scripts use standard FIAS field codes. The most common ones are:

| Code | Meaning |
| --- | --- |
| `RN` | Room number |
| `G#` | Reservation number |
| `GN` | Guest name |
| `GL` | Guest language |
| `GS` | Share flag |
| `RO` | Old room number |
| `RS` | Room status |
| `DA` | Date in `yymmdd` format |
| `TI` | Time in `hhmmss` format |
| `AS` | Answer status |
| `A0` - `A3` | User-defined custom fields |
| `DD` | Dialed digits |
| `DU` | Duration |
| `MA` | Minibar article |
| `M#` | Quantity |
| `MP` | Meter pulse |
| `PT` | Posting type |
| `TA` | Total amount |
| `P#` | Posting sequence number |
| `SO` | Sales outlet |
| `ML` | Message light |
| `CS` | Class of service |
| `DN` | Do-not-disturb flag |

## How the bridge works

### Outbound flow: FreePBX to PMS

1. A PBX-side event occurs.
   - Examples: AGI changes a room state and calls `re2pms.php`, CDR processing
     calls `cdr.php`, minibar charging calls `minibar.php`.
2. The script parses its arguments using `getArguments()`.
3. The script inserts a row into `fias.messages` with `dir='PMS'` and stores the
   individual fields in `fias.messagesparameters`.
4. `fiasd.php` reads the pending row, serializes it into a FIAS frame, sends it
   over TCP, then sets `elaborationtime` and stores the serialized `raw` frame.

### Inbound flow: PMS to FreePBX

1. `fiasd.php` receives a FIAS frame on the TCP connection.
2. It parses the frame and writes one row into `fias.messages` with `dir='PBX'`
   plus one row per field into `fias.messagesparameters`.
3. `dispatcher.php` polls the pending inbound rows.
4. `dispatcher.php` maps `cmd` and `dir` back to a section such as `GI2PBX`,
   rebuilds the command line from the configured `format`, and executes the
   script configured in `fias.conf`.
5. The handler updates `roomsdb`, `fias.reservations`, and optionally Asterisk
   state.

### TCP / link management

`fiasd.php` is the source of truth for the FIAS client-side protocol handling.
It manages:

- socket connection and reconnect loops
- `LS`, `LD`, `LR`, `LA`, and `LE` link maintenance frames
- queue draining in both directions
- character set conversion between UTF-8 and `remote_character_encoding`

`fias-server.php` mirrors the same protocol in listen mode so the test server can
exercise the real client path without a live PMS.

## Testing with `fias-server-e2e.php`

`fias-server-e2e.php` is the preferred automated test for the standalone test
server.

### What it does

1. creates a temporary `fias.conf` with a free TCP port
2. creates temporary transport databases for `fias` and `fias_server`
  - this requires MariaDB admin credentials because the normal FreePBX
    application user only has grants on the existing service databases
3. launches:
   - `fias-server.php`
   - `dispatcher.php`
   - `fiasd.php`
4. runs the real test-server wrappers:
   - `fias-server-gi2pbx.php`
   - `fias-server-gc2pbx.php`
   - `fias-server-go2pbx.php`
   - `fias-server-wr2pbx.php`
   - `fias-server-wc2pbx.php`
   - `fias-server-re2pbx.php`
   - `fias-server-le2pbx.php`
5. polls `roomsdb` to verify that each step changed the expected state

### Prerequisites

Run it inside a FreePBX environment where these paths exist:

- `/etc/freepbx_db.conf`
- `/etc/asterisk/fias.conf`
- `/var/www/html/freepbx/hotel/functions.inc.php`
- MariaDB admin credentials for isolated temp DB creation, provided through:
  - `FIAS_E2E_ADMIN_DB_USER` and `FIAS_E2E_ADMIN_DB_PASS`, or
  - `MARIADB_ROOT_PASSWORD` with the default admin user `root`

When admin credentials are provided, the harness writes temporary overrides for
both `fias.conf` and `freepbx_db.conf` so the spawned FIAS processes use those
credentials for the isolated transport databases too.

### Command

```sh
php /usr/share/neth-hotel-fias/fias-server-e2e.php <room-number>
```

If you already created two dedicated databases and granted `AMPDBUSER` access,
you can skip the admin-only create/drop step:

```sh
FIAS_DB_NAME=my_fias_e2e \
FIAS_SERVER_DB_NAME=my_fias_server_e2e \
FIAS_E2E_SKIP_DB_CREATE=1 \
php /usr/share/neth-hotel-fias/fias-server-e2e.php <room-number>
```

Notes:

- the script also uses `<room-number> + 1000` as the move target room
- it cleans the tested rows in `roomsdb` on success and drops the temporary
  transport databases
- when `FIAS_E2E_SKIP_DB_CREATE=1` is used, the script truncates the provided
  transport databases on success instead of dropping them
- on failure it keeps the temporary databases and log files under
  `$(mktempdir)/fias-e2e-<pid>` so the failure can be inspected

## Manual smoke tests

These examples are useful when you want to exercise a single producer or
handler without running the full end-to-end script.

Run them inside the FreePBX container after the bridge has been configured. The
old `scl enable rh-php56 --` prefix from the legacy notes is obsolete; the
scripts can be executed directly or with `php`.

### Outbound queue examples

```sh
RN=201
DATE=$(date +%y%m%d)

/usr/share/neth-hotel-fias/re2pms.php "$RN" 1
/usr/share/neth-hotel-fias/re2pms.php "$RN" 3
/usr/share/neth-hotel-fias/re2pms.php "$RN" 4

/usr/share/neth-hotel-fias/wr2pms.php "$DATE" 073000 "$RN"

/usr/share/neth-hotel-fias/minibar.php "$DATE" 113000 "$RN" 1234 1

/usr/share/neth-hotel-fias/ps2pms.php "$DATE" "" "" 1234 1 "" M "$RN" 5.55 113000 ""

/usr/share/neth-hotel-fias/dr2pms.php
```

`re2pms.php` only accepts `RN RS` with the default `RE2PMS.format`. Older
examples that try to send DND or other optional `RE` fields need a format
change first.

To test `cdr.php`, set `[cdr].cdrMode` in `fias.conf` to `T` or `C`, reload the
bridge, then run:

```sh
RN=201
SOURCE="$RN"
CHANNEL="SIP/2001-00000023"
ENDTIME=""
DURATION="15"
UNIQUEID="1496752037.491"
STARTTIME="2017-06-06 14:27:17"
DESTINATION="3281231231"
DISPOSITION="ANSWERED"
BILLABLESEC="12"

/usr/share/neth-hotel-fias/cdr.php \
  "$SOURCE" "$CHANNEL" "$ENDTIME" "$DURATION" "" "$UNIQUEID" "" \
  "$STARTTIME" "" "$DESTINATION" "$DISPOSITION" "" "$BILLABLESEC"
```

### Manual standalone server examples

These commands queue test messages into `fias_server`. They require
`fias-server.php`, `fiasd.php`, and `dispatcher.php` to be running against the
same config, or an equivalent setup created by `fias-server-e2e.php`.

```sh
DATE=$(date +%y%m%d)

/usr/share/neth-hotel-fias/fias-server-gi2pbx.php 201 123456 "Mr Foo Bar" IT "" ""
/usr/share/neth-hotel-fias/fias-server-gc2pbx.php 202 123456 "Mrs. Bar" EN "" 201
/usr/share/neth-hotel-fias/fias-server-go2pbx.php 202 123456 "" ""

/usr/share/neth-hotel-fias/fias-server-wr2pbx.php "$DATE" 233000 201
/usr/share/neth-hotel-fias/fias-server-wc2pbx.php "$DATE" 233000 201

/usr/share/neth-hotel-fias/fias-server-re2pbx.php 202 1 "" ""
/usr/share/neth-hotel-fias/fias-server-re2pbx.php 202 3 "" ""
/usr/share/neth-hotel-fias/fias-server-re2pbx.php 202 4 "" ""

/usr/share/neth-hotel-fias/fias-server-le2pbx.php
```

Shared-room and room-move scenarios can be exercised manually with this
sequence:

```sh
/usr/share/neth-hotel-fias/fias-server-gi2pbx.php 201 123456 "Mr Foo Bar" IT Y ""
/usr/share/neth-hotel-fias/fias-server-gi2pbx.php 201 123457 "Mrs. Bar" EN Y ""
/usr/share/neth-hotel-fias/fias-server-gi2pbx.php 201 123458 "Foo Bar Jr" EN Y ""

/usr/share/neth-hotel-fias/fias-server-gc2pbx.php 202 123457 "Mrs. Bar" EN "" 201
/usr/share/neth-hotel-fias/fias-server-go2pbx.php 201 123456 "" ""
/usr/share/neth-hotel-fias/fias-server-go2pbx.php 202 123457 "" ""
/usr/share/neth-hotel-fias/fias-server-go2pbx.php 201 123458 "" ""
```

After the shared-room check-in step, inspect `fias.reservations`. After the
wake-up request step, inspect `roomsdb.alarms` for the tested extension.

## Script reference

### Shared helpers

#### `functions.inc.php`

- Purpose: shared bootstrap for the main bridge scripts.
- Parameters: none.
- Responsibilities:
  - load `fias.conf`
  - load the FreePBX DB credentials
  - initialize logging
  - parse CLI arguments from a `format` definition
  - queue messages in the `fias` database
  - support test-only env overrides for config and database names

#### `fias-server-functions.inc.php`

- Purpose: shared bootstrap for the standalone test-server wrappers.
- Parameters: none.
- Responsibilities:
  - connect to the `fias_server` transport database
  - resolve the logical section for `fias-server-*.php` wrappers
  - queue messages in `fias_server.messages`

### Daemons and orchestration

#### `fiasd.php`

- Purpose: main long-running FIAS client service.
- Parameters: none.
- Behavior:
  - connects to the PMS host and port from `[fiasd]`
  - performs the FIAS link handshake
  - reads outbound rows from `fias.messages` where `dir='PMS'`
  - writes inbound rows to `fias.messages` where `dir='PBX'`
  - updates `elaborationtime` when a queued row has been processed

#### `dispatcher.php`

- Purpose: long-running queue consumer for inbound PMS messages.
- Parameters: none.
- Behavior:
  - polls `fias.messages` where `dir='PBX'` and `elaborationtime IS NULL`
  - reconstructs the command line from `messagesparameters`
  - executes the script configured in `fias.conf`
  - marks the queue row as elaborated

#### `fias-server.php`

- Purpose: standalone PMS simulator for local testing.
- Parameters: none.
- Behavior:
  - listens on the configured TCP port instead of connecting outward
  - mirrors the FIAS link-state machine used by `fiasd.php`
  - reads queued test commands from `fias_server.messages` where `dir='PBX'`
  - stores frames received from the client as `dir='PMS'` in `fias_server`

#### `fias-server-e2e.php`

- Purpose: automated end-to-end validation for the standalone test server.
- Parameters: `<room-number>`.
- Behavior:
  - creates isolated transport config and temporary databases
  - starts `fias-server.php`, `dispatcher.php`, and `fiasd.php`
  - runs the test-server wrappers in a fixed sequence
  - validates the resulting `roomsdb` state after each command

### Outbound queue producers: FreePBX to PMS

#### `wr2pms.php`

- Purpose: queue a wake-up request to the PMS.
- Parameters: `DA TI RN`.
- Behavior: inserts a `WR2PMS` message into the `fias` queue.

#### `wc2pms.php`

- Purpose: queue a wake-up clear request to the PMS.
- Parameters: `DA TI RN`.
- Behavior: inserts a `WC2PMS` message into the `fias` queue.

#### `wa2pms.php`

- Purpose: queue a wake-up answer or result back to the PMS.
- Parameters: `DA TI RN AS`.
- Behavior: inserts a `WA2PMS` message into the `fias` queue.

#### `re2pms.php`

- Purpose: queue a room-state update to the PMS.
- Parameters: `RN RS` in the default config.
- Behavior:
  - maps the supplied room to the main extension using `getMainExtension()`
  - inserts an `RE2PMS` message into the `fias` queue
- Notes: the script can also be called manually with additional fields such as
  `DN`, but the default `fias.conf` format only wires `RN` and `RS`.

#### `ps2pms.php`

- Purpose: queue a generic posting-simple record.
- Parameters: `DA DD DU MA M# MP PT RN TA TI P# G# SO`.
- Behavior: inserts a `PS2PMS` message into the `fias` queue.

#### `le2pms.php`

- Purpose: request link termination toward the PMS.
- Parameters: none.
- Behavior:
  - inserts an `LE2PMS` message into the `fias` queue
  - waits until the queued `LE` row has been elaborated by `fiasd.php`

#### `dr2pms.php`

- Purpose: request a database resynchronization from the PMS.
- Parameters: optional `DA TI`.
- Behavior:
  - fills missing date and time with the current values
  - inserts a `DR2PMS` message into the `fias` queue

#### `minibar.php`

- Purpose: convert a minibar event into a posting record sent to the PMS.
- Parameters: `DA TI RN MA M# TA`.
- Behavior:
  - validates room number and minibar article
  - applies `[minibar].psmode`
  - generates a posting sequence number (`P#`)
  - queues the resulting message as `PS2PMS`

#### `cdr.php`

- Purpose: convert an answered outbound hotel call into a FIAS posting.
- Parameters:
  - Asterisk CDR argv layout: `src channel endtime duration amaflags uniqueid callerid starttime answertime dst disposition lastapp billablesec [accountcode]`
- Behavior:
  - classifies the call as internal, incoming, outgoing, or unknown
  - ignores calls that should not be billed
  - determines the room number from the source/accountcode/channel
  - computes the amount or meter pulses from the configured rates and
    `[cdr].cdrMode`
  - queues the result as `PS2PMS`

#### `gc2pms.php`

- Purpose: legacy manual helper for guest-change style test traffic.
- Parameters: intended shape is `RN G# GN GL GS RO A0 A1 A2 A3`.
- Behavior:
  - fills a missing `RO` with the current room number
  - fills a missing `G#` from the `reservations` table
  - attempts to queue the message through `insertMessageIntoDB()`
- Notes: this script is not referenced by the default `fias.conf`, so it should
  be treated as a legacy or custom-use helper unless a matching section is
  added to the config.

### Inbound handlers: PMS to FreePBX

#### `gi2pbx.php`

- Purpose: apply a guest check-in received from the PMS.
- Parameters: `RN G# GN GL GS SF A0 A1 A2 A3`.
- Behavior:
  - builds the guest name from the available name fields
  - maps FIAS language codes to room language codes
  - optionally executes custom shell commands for `A0` to `A3`
  - updates `fias.reservations`
  - performs `externalCheckIn()` on the room and updates `roomsdb.rooms`
  - supports shared rooms when `GS='Y'`

#### `gc2pbx.php`

- Purpose: apply a guest data change or room move received from the PMS.
- Parameters: `RN G# GN GL GS RO A0 A1 A2 A3`.
- Behavior:
  - updates reservation metadata and room assignment
  - checks whether the old room must be checked out
  - checks whether the new room must be checked in
  - optionally executes custom shell commands for `A0` to `A3`
  - supports room moves and shared-room edge cases

#### `go2pbx.php`

- Purpose: apply a guest check-out received from the PMS.
- Parameters: `RN G# GS SF`.
- Behavior:
  - checks out the room when the last reservation leaves
  - for shared rooms, removes only the selected reservation and rebuilds the
    `roomsdb.rooms.text` guest label from the remaining reservations
  - updates `fias.reservations`

#### `wr2pbx.php`

- Purpose: apply a wake-up request received from the PMS.
- Parameters: `DA TI RN`.
- Behavior:
  - converts the FIAS date and time to a timestamp
  - creates an enabled alarm in `roomsdb.alarms`
  - creates the related row in `roomsdb.alarmcalls`

#### `wc2pbx.php`

- Purpose: clear a wake-up request received from the PMS.
- Parameters: `DA TI RN`.
- Behavior:
  - disables the room alarm in `roomsdb.alarms`
  - removes the related wake-up call rows from `roomsdb.alarmcalls`

#### `wa2pbx.php`

- Purpose: placeholder for PMS wake-up answers.
- Parameters: `DA TI RN` in the current script comment.
- Behavior: logs `[not implemented]` and exits successfully.

#### `re2pbx.php`

- Purpose: apply room status and DND updates received from the PMS.
- Parameters: `RN RS ML CS DN`.
- Behavior:
  - handles implemented room states by calling the NethHotel room helpers
  - toggles Asterisk DND when `DN` is present
- Implemented `RS` codes in the current code:
  - `1`: Dirty/Vacant
  - `2`: Dirty/Occupied, logged as not implemented
  - `3`: Clean/Vacant
  - `4`: Inspected/Vacant
  - `5`: Inspected/Occupied, logged as not implemented

#### `pa2pbx.php`

- Purpose: placeholder for posting answers coming from the PMS.
- Parameters: comment documents `AS CT P# RN C# G# GN ID SO`.
- Behavior: logs `[not implemented]` and exits successfully.

### Standalone test-server wrappers

All `fias-server-*.php` wrappers are one-shot CLI helpers. They do not change
`roomsdb` directly. Instead, they validate their arguments and insert a message
into the `fias_server` transport database, which `fias-server.php` then sends to
`fiasd.php`.

#### `fias-server-gi2pbx.php`

- Purpose: queue a simulated `GI2PBX` message.
- Parameters: `RN G# GN GL GS SF A0 A1 A2 A3`.

#### `fias-server-gc2pbx.php`

- Purpose: queue a simulated `GC2PBX` message.
- Parameters: `RN G# GN GL GS RO A0 A1 A2 A3`.

#### `fias-server-go2pbx.php`

- Purpose: queue a simulated `GO2PBX` message.
- Parameters: `RN G# GS SF`.

#### `fias-server-wr2pbx.php`

- Purpose: queue a simulated `WR2PBX` message.
- Parameters: `DA TI RN`.

#### `fias-server-wc2pbx.php`

- Purpose: queue a simulated `WC2PBX` message.
- Parameters: `DA TI RN`.

#### `fias-server-re2pbx.php`

- Purpose: queue a simulated `RE2PBX` message.
- Parameters: `RN RS ML CS DN`.

#### `fias-server-le2pbx.php`

- Purpose: queue a simulated link-end message.
- Parameters: none.

## Compatibility notes

- Older manual notes used `scl enable rh-php56 --`; this is no longer required.
- Only fields listed in a section's `format` are parsed from CLI arguments.
  Older examples that append unconfigured fields will not work unchanged.
- `gc2pms.php` is not wired by the default `fias.conf`. Its old direct
  invocation examples only work after adding a matching `GC2PMS` section.
- The shortened `ps2pms.php` minibar example from older notes predates the
  current `PS2PMS` format. Use `minibar.php` for minibar events unless you are
  intentionally building the full `PS2PMS` record yourself.
- To change phone-charge billing mode, edit `[cdr].cdrMode` in `fias.conf` and
  reload the bridge. Older NS7 `config setprop` and `signal-event` commands do
  not apply here.
- `fias-server-create_db.sql` is the legacy schema initializer for the
  standalone server database. The automated end-to-end script now creates its
  own temporary transport databases directly.