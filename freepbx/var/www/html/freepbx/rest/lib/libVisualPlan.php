<?php

#
# Copyright (C) 2026 Nethesis S.r.l.
# http://www.nethesis.it - nethserver@nethesis.it
#
# This script is part of NethServer.
#
# NethServer is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License,
# or any later version.
#
# NethServer is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with NethServer.  If not, see COPYING.
#

const VISUALPLAN_LISTS = [
    'inboundRoutes' => 'visualplan_read_inbound_routes',
    'extensions' => 'visualplan_read_extensions',
    'conferences' => 'visualplan_read_conferences',
    'ringGroups' => 'visualplan_read_ring_groups',
    'queues' => 'visualplan_read_queues',
    'ivrs' => 'visualplan_read_ivrs',
    'cqrs' => 'visualplan_read_cqrs',
    'announcements' => 'visualplan_read_announcements',
    'timeConditions' => 'visualplan_read_time_conditions',
    'timeGroups' => 'visualplan_read_time_groups',
    'callFlowControls' => 'visualplan_read_call_flow_controls',
    'availableCallFlowCodes' => 'visualplan_read_available_call_flow_codes',
    'setCallerIds' => 'visualplan_read_set_caller_ids',
    'directDids' => 'visualplan_read_direct_dids',
    'queueExits' => 'visualplan_read_queue_exits',
    'queueOptions' => 'visualplan_read_queue_options',
    'queuePriorities' => 'visualplan_read_queue_priorities',
    'recordings' => 'visualplan_read_recordings',
    'musicOnHold' => 'visualplan_read_music_on_hold',
    'destinations' => 'visualplan_read_destinations',
];

// goto: destination of the object, filled with its key. created: the PBX assigns the id.
const VISUALPLAN_TYPES = [
    'inboundRoute' => ['list' => 'inboundRoutes', 'destinations' => ['destination']],
    'voicemail' => ['list' => 'extensions', 'goto' => 'ext-local,vmu%s,1'],
    'conference' => ['list' => 'conferences', 'goto' => 'ext-meetme,%s,1'],
    'ringGroup' => ['list' => 'ringGroups', 'goto' => 'ext-group,%s,1', 'destinations' => ['destination']],
    'queue' => ['list' => 'queues', 'goto' => 'ext-queues,%s,1', 'destinations' => ['destination']],
    'ivr' => ['list' => 'ivrs', 'goto' => 'ivr-%s,s,1', 'created' => true,
        'destinations' => ['invalidDestination', 'timeoutDestination']],
    'cqr' => ['list' => 'cqrs', 'goto' => 'nethcqr,%s,1', 'created' => true, 'destinations' => ['defaultDestination']],
    'announcement' => ['list' => 'announcements', 'goto' => 'app-announcement-%s,s,1', 'created' => true,
        'destinations' => ['destination']],
    'timeCondition' => ['list' => 'timeConditions', 'goto' => 'timeconditions,%s,1', 'created' => true,
        'destinations' => ['trueDestination', 'falseDestination']],
    'timeGroup' => ['list' => 'timeGroups', 'created' => true],
    'callFlowControl' => ['list' => 'callFlowControls', 'goto' => 'app-daynight,%s,1',
        'destinations' => ['normalDestination', 'overrideDestination']],
    'setCallerId' => ['list' => 'setCallerIds', 'goto' => 'app-setcid,%s,1', 'created' => true,
        'destinations' => ['destination']],
    'directDid' => ['list' => 'directDids', 'goto' => 'directdid-%s,${EXTEN},1', 'created' => true,
        'destinations' => ['timeoutDestination', 'busyDestination', 'unavailableDestination']],
    'queueExit' => ['list' => 'queueExits', 'goto' => 'queueexit-%s,${EXTEN},1', 'created' => true,
        'destinations' => ['timeoutDestination', 'fullDestination', 'joinEmptyDestination', 'leaveEmptyDestination',
            'joinUnavailableDestination', 'leaveUnavailableDestination', 'continueDestination']],
    'queueOptions' => ['list' => 'queueOptions', 'goto' => 'queueoptions-%s,s,1', 'created' => true,
        'destinations' => ['failoverDestination', 'destination']],
    'queuePriority' => ['list' => 'queuePriorities', 'goto' => 'app-queueprio,%s,1', 'created' => true,
        'destinations' => ['destination']],
];

const VISUALPLAN_NEW_PREFIX = 'new:';
const VISUALPLAN_HANGUP = 'app-blackhole,hangup,1';
const VISUALPLAN_RING_STRATEGIES = ['ringall', 'ringall-prim', 'hunt', 'hunt-prim', 'memoryhunt', 'memoryhunt-prim',
    'firstavailable', 'firstnotonphone', 'random'];
const VISUALPLAN_QUEUE_STRATEGIES = ['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory', 'rrordered',
    'linear', 'wrandom'];
const VISUALPLAN_RECORDING_FORMATS = ['wav', 'mp3'];
const VISUALPLAN_RECORDING_MAX_BYTES = 8 * 1024 * 1024;
const VISUALPLAN_INT_MAX = 2147483647;
// Canvas layouts live in the kvstore of the Core module, one key per inbound route, under this id.
const VISUALPLAN_LAYOUT_STORE = 'visualplanLayout';
const VISUALPLAN_LAYOUT_MAX_NODES = 2000;
const VISUALPLAN_LAYOUT_MAX_COORDINATE = 1000000;
// Objects whose module also writes the Asterisk DB.
const VISUALPLAN_ASTDB_TYPES = ['queue', 'ringGroup', 'conference', 'callFlowControl', 'voicemail'];
// Per inbound route settings of other modules, keyed by the route extension and cidnum.
const VISUALPLAN_ROUTE_SETTINGS = [
    'UPDATE `language_incoming` SET `extension` = ?, `cidnum` = ? WHERE `extension` = ? AND `cidnum` = ?',
    'UPDATE `fax_incoming` SET `extension` = ?, `cidnum` = ? WHERE `extension` = ? AND `cidnum` = ?',
    'UPDATE `callrecording_module` SET `extension` = ?, `cidnum` = ? WHERE `display` = \'did\' AND `extension` = ? AND `cidnum` = ?',
    'UPDATE `offhour` SET `didextension` = ?, `didcidnum` = ? WHERE `didextension` = ? AND `didcidnum` = ?',
];
// queues_config.maxwait is a varchar(8).
const VISUALPLAN_QUEUE_SECONDS_MAX = 99999999;
// Each part of a goto: plain dialplan characters and plain variables such as ${EXTEN}, never functions.
const VISUALPLAN_DESTINATION_PATTERN = '#^(?:[A-Za-z0-9_.+*\#@:/!-]|\$\{[A-Za-z0-9_]+\})+(?:,(?:[A-Za-z0-9_.+*\#@:/!-]|\$\{[A-Za-z0-9_]+\})+){2}$#';
// Literal caller id text, optionally with the current caller id.
const VISUALPLAN_CALLERID_PATTERN = '/^(?:[^$\[\];]|\$\{CALLERID\((?:name|num)\)\})*$/';

// Queue settings a queue may lack, as restored by the legacy visual plan.
const VISUALPLAN_QUEUE_DEFAULTS = [
    'maxlen' => '0', 'joinempty' => 'yes', 'leavewhenempty' => 'no', 'autopause' => 'no', 'retry' => '5',
    'wrapuptime' => '0', 'announce-frequency' => '0', 'announce-holdtime' => 'no', 'announce-position' => 'no',
    'periodic-announce-frequency' => '0', 'eventwhencalled' => '', 'eventmemberstatus' => 'no', 'weight' => '0',
    'autofill' => 'no', 'reportholdtime' => 'no', 'servicelevel' => '60', 'memberdelay' => '0',
    'timeoutrestart' => 'no', 'recording' => 'dontcare', 'rvolume' => '', 'rvol_mode' => '', 'rtone' => '0',
    'skip_joinannounce' => '', 'answered_elsewhere' => '0', 'timeoutpriority' => 'app', 'autopausebusy' => 'no',
    'autopauseunavail' => 'no', 'autopausedelay' => '0', 'penaltymemberslimit' => '0', 'announcemenu' => 'none',
    'callback' => 'none', 'min-announce-frequency' => '15', 'lazymembers' => '', 'password' => '',
    'agentannounce_id' => '', 'alertinfo' => '', 'cwignore' => '1', 'qregex' => '', 'queuewait' => '0',
    'use_queue_context' => '0', 'dynmemberonly' => 'no', 'togglehint' => '0', 'qnoanswer' => '0',
    'callconfirm' => '0', 'callconfirm_id' => '', 'monitor_type' => '', 'monitor_heard' => '0',
    'monitor_spoken' => '0', 'member' => [], 'dynmembers' => '',
];

const VISUALPLAN_IVR_DEFAULTS = [
    'directdial' => 'ext-local', 'invalid_loops' => 0, 'invalid_retry_recording' => 'default',
    'invalid_destination' => '', 'invalid_recording' => '', 'retvm' => '', 'timeout_time' => 10,
    'timeout_recording' => 'default', 'timeout_retry_recording' => 'default', 'timeout_destination' => '',
    'timeout_loops' => 0, 'timeout_append_announce' => 0, 'invalid_append_announce' => 0, 'timeout_ivr_ret' => 0,
    'invalid_ivr_ret' => 0, 'alertinfo' => '', 'rvolume' => '',
];

const VISUALPLAN_CQR_DEFAULTS = [
    'use_code' => 'on', 'use_workphone' => 'on', 'manual_code' => 'on', 'cod_cli_announcement' => '',
    'err_announcement' => '', 'code_length' => 5, 'code_retries' => 3, 'default_destination' => '',
    'db_type' => 'mysql', 'db_url' => 'localhost', 'db_name' => '', 'db_user' => '', 'db_pass' => '', 'query' => '',
    'cc_db_type' => 'mysql', 'cc_db_url' => 'localhost', 'cc_db_name' => '', 'cc_db_user' => '', 'cc_db_pass' => '',
    'cc_query' => '', 'ccc_query' => '',
];

const VISUALPLAN_QUEUE_OPTIONS_COLUMNS = ['name', 'VQ_CIDPP', 'VQ_AINFO', 'VQ_JOINMSG', 'VQ_RETRY', 'VQ_OPTIONS',
    'VQ_GOSUB', 'VQ_AGI', 'VQ_POSITION_ENABLED', 'VQ_POSITION', 'VQ_CONFIRMMSG', 'VQ_AANNOUNCE', 'VQ_MOH',
    'VQ_MAXWAIT_ENABLED', 'VQ_MAXWAIT', 'VQ_DEST_ENABLED', 'VQ_DEST', 'DEST'];

const VISUALPLAN_QUEUE_EXIT_COLUMNS = [
    'timeoutDestination' => 'timeout_destination', 'fullDestination' => 'full_destination',
    'joinEmptyDestination' => 'joinempty_destination', 'leaveEmptyDestination' => 'leaveempty_destination',
    'joinUnavailableDestination' => 'joinunavail_destination',
    'leaveUnavailableDestination' => 'leaveunavail_destination', 'continueDestination' => 'continue_destination',
];

const VISUALPLAN_TIME_PATTERN = '/^(\*|\d{1,2}:\d{2}(-\d{1,2}:\d{2})?)'
    . '\|(\*|(mon|tue|wed|thu|fri|sat|sun)(-(mon|tue|wed|thu|fri|sat|sun))?)'
    . '\|(\*|\d{1,2}(-\d{1,2})?)'
    . '\|(\*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(-(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))?)$/';

/**
 * Include the functions of the FreePBX modules whose procedural API is used here.
 */
function visualplan_include_modules()
{
    foreach (['core', 'queues', 'ivr', 'daynight', 'timeconditions', 'nethcqr'] as $module) {
        $file = __DIR__ . '/../../admin/modules/' . $module . '/functions.inc.php';
        if (is_file($file)) {
            include_once($file);
        }
    }
}

function visualplan_string($value): string
{
    return is_scalar($value) ? (string) $value : '';
}

function visualplan_decode($value): string
{
    return html_entity_decode(visualplan_string($value), ENT_QUOTES | ENT_HTML401, 'UTF-8');
}

// Characters, as counted by the database columns.
function visualplan_length(string $value): int
{
    $length = preg_match_all('/./su', $value);
    return $length === false ? strlen($value) : $length;
}

function visualplan_optional_id($value): ?int
{
    $value = trim(visualplan_string($value));
    return ctype_digit($value) && (int) $value > 0 ? (int) $value : null;
}

function visualplan_rows($rows): array
{
    if (!is_array($rows)) {
        throw new UnexpectedValueException('Invalid list');
    }
    foreach ($rows as $row) {
        if (!is_array($row)) {
            throw new UnexpectedValueException('Invalid row');
        }
    }
    return $rows;
}

// Rows fetched with PDO::FETCH_BOTH also carry numeric keys that must not be written back.
function visualplan_named_columns($row): array
{
    return is_array($row) ? array_filter($row, 'is_string', ARRAY_FILTER_USE_KEY) : [];
}

/**
 * Read every list of the visual plan; a list that cannot be read is empty and named in "unavailable".
 */
function visualplan_load(): array
{
    $data = [];
    $unavailable = [];
    foreach (VISUALPLAN_LISTS as $key => $reader) {
        try {
            $data[$key] = array_values($reader());
        } catch (Throwable $error) {
            // Exception messages may contain PBX secrets.
            error_log('Visualplan: failed to load ' . $key . ' (' . get_class($error) . ')');
            $data[$key] = [];
            $unavailable[] = $key;
        }
    }
    // Layouts are a convenience: without them the editor arranges the nodes itself.
    try {
        $data['layouts'] = visualplan_read_layouts();
    } catch (Throwable $error) {
        error_log('Visualplan: failed to load layouts (' . get_class($error) . ')');
        $data['layouts'] = new stdClass();
    }
    $data['unavailable'] = $unavailable;
    return $data;
}

/**
 * Normalize stored positions to node id => {x, y}, dropping malformed entries.
 */
function visualplan_layout_positions($value): array
{
    $positions = [];
    foreach (is_array($value) || is_object($value) ? (array) $value : [] as $node => $position) {
        $position = is_array($position) || is_object($position) ? (array) $position : [];
        if (is_int($position['x'] ?? null) && is_int($position['y'] ?? null)) {
            $positions[(string) $node] = ['x' => $position['x'], 'y' => $position['y']];
        }
    }
    return $positions;
}

function visualplan_read_layouts(): object
{
    $layouts = new stdClass();
    $stored = FreePBX::Core()->getAll(VISUALPLAN_LAYOUT_STORE);
    foreach (is_array($stored) ? $stored : [] as $route => $value) {
        $positions = visualplan_layout_positions($value);
        if ($positions) {
            $layouts->{(string) $route} = (object) $positions;
        }
    }
    return $layouts;
}

/**
 * Replace the canvas layout of one inbound route.
 *
 * Returns the HTTP status and the response body.
 */
function visualplan_save_layout($body): array
{
    $body = is_array($body) ? $body : [];
    $ref = is_string($body['route'] ?? null) ? $body['route'] : '';
    $check = new VisualPlanCheck('layout', $ref, []);
    $positions = [];
    try {
        $route = $check->text($body, 'route', 101, true);
        $routes = array_map(fn($item) => $item['extension'] . '/' . $item['cidnum'], visualplan_read_inbound_routes());
        if ($route !== '' && !$check->errors && !in_array($route, $routes, true)) {
            $check->error('route', 'not_found');
        }
        $items = $body['positions'] ?? null;
        if ($items === null) {
            $check->error('positions', 'required');
        } elseif (!is_array($items) || ($items && array_is_list($items)) || count($items) > VISUALPLAN_LAYOUT_MAX_NODES) {
            $check->error('positions', 'invalid');
        } else {
            foreach ($items as $node => $position) {
                $node = (string) $node;
                if ($node === '' || visualplan_length($node) > 200 || preg_match('/[\x00-\x1F\x7F]/', $node)) {
                    $check->error('positions', 'invalid');
                    continue;
                }
                $position = is_array($position) ? $position : [];
                foreach (['x', 'y'] as $axis) {
                    $positions[$node][$axis] = $check->integer($position, $axis, -VISUALPLAN_LAYOUT_MAX_COORDINATE,
                        VISUALPLAN_LAYOUT_MAX_COORDINATE, 'positions.' . $node . '.' . $axis);
                }
            }
        }
        if ($check->errors) {
            return ['status' => 422, 'body' => ['message' => 'Validation failed', 'errors' => $check->errors]];
        }
        $core = FreePBX::Core();
        // The first access prepares the kvstore, which must not happen inside a transaction.
        $core->getConfig($route, VISUALPLAN_LAYOUT_STORE);
        visualplan_transaction(function () use ($core, $route, $positions) {
            if ($positions) {
                $core->setConfig($route, (object) $positions, VISUALPLAN_LAYOUT_STORE);
            } else {
                $core->delConfig($route, VISUALPLAN_LAYOUT_STORE);
            }
        });
    } catch (Throwable $error) {
        error_log('Visualplan: layout save failed (' . get_class($error) . ')');
        return ['status' => 500, 'body' => ['error' => 'Internal server error']];
    }
    return ['status' => 204, 'body' => null];
}

/**
 * Move the canvas layout of a renamed inbound route, or remove it when $to is null.
 */
function visualplan_move_layout(string $from, ?string $to): void
{
    $core = FreePBX::Core();
    $layout = $core->getConfig($from, VISUALPLAN_LAYOUT_STORE);
    if ($layout === false) {
        return;
    }
    if ($to !== null) {
        $core->setConfig($to, $layout, VISUALPLAN_LAYOUT_STORE);
    }
    $core->delConfig($from, VISUALPLAN_LAYOUT_STORE);
}

function visualplan_read_inbound_routes(): array
{
    $routes = [];
    foreach (visualplan_rows(FreePBX::Core()->getAllDIDs('extension')) as $row) {
        $route = [];
        foreach (['extension', 'cidnum', 'description', 'alertinfo', 'grppre', 'destination'] as $field) {
            $route[$field] = visualplan_string($row[$field] ?? '');
        }
        $routes[] = $route;
    }
    return $routes;
}

function visualplan_read_extensions(): array
{
    $extensions = [];
    foreach (visualplan_rows(FreePBX::Core()->listUsers(true)) as $row) {
        $extension = visualplan_string($row[0] ?? '');
        if ($extension === '' || preg_match('/^9\d{4,}$/', $extension)) {
            continue;
        }
        $mailbox = strtolower(trim(visualplan_string($row[2] ?? '')));
        $extensions[] = [
            'extension' => $extension,
            'name' => visualplan_string($row[1] ?? ''),
            'voicemail' => $mailbox !== '' && $mailbox !== 'novm',
        ];
    }
    return $extensions;
}

function visualplan_read_conferences(): array
{
    $conferences = [];
    foreach (visualplan_rows(FreePBX::Conferences()->listConferences()) as $row) {
        $conferences[] = ['id' => visualplan_string($row[0] ?? ''), 'name' => visualplan_string($row[1] ?? '')];
    }
    return $conferences;
}

function visualplan_read_ring_groups(): array
{
    $groups = [];
    foreach (visualplan_rows(FreePBX::Ringgroups()->getAllGroups()) as $row) {
        $groups[] = [
            'id' => visualplan_string($row['grpnum'] ?? ''),
            'description' => visualplan_string($row['description'] ?? ''),
            'members' => array_values(array_filter(explode('-', visualplan_string($row['grplist'] ?? '')), 'strlen')),
            'strategy' => visualplan_string($row['strategy'] ?? ''),
            'ringTime' => (int) ($row['grptime'] ?? 0),
            'destination' => visualplan_string($row['postdest'] ?? ''),
        ];
    }
    return $groups;
}

/**
 * Split a static queue member such as "Local/201@from-queue/n,0" into its interface and penalty.
 */
function visualplan_split_member($member): array
{
    $member = trim(visualplan_string($member));
    $position = strrpos($member, ',');
    if ($position === false) {
        return [$member, 0];
    }
    return [substr($member, 0, $position), (int) substr($member, $position + 1)];
}

function visualplan_member_extension(string $interface): string
{
    return preg_match('#^[^/]+/([^@/,]+)#', $interface, $matches) ? $matches[1] : $interface;
}

function visualplan_dynamic_members($members): array
{
    $penalties = [];
    foreach (preg_split('/\R/', visualplan_string($members)) as $line) {
        $parts = explode(',', $line, 2);
        $extension = trim($parts[0]);
        if ($extension !== '') {
            $penalties[$extension] = trim($parts[1] ?? '');
        }
    }
    return $penalties;
}

function visualplan_map_queue(string $number, array $queue): array
{
    $members = [];
    foreach ((array) ($queue['member'] ?? []) as $member) {
        [$interface, $penalty] = visualplan_split_member($member);
        $members[] = ['extension' => visualplan_member_extension($interface), 'penalty' => $penalty];
    }
    $music = visualplan_string($queue['music'] ?? '');
    return [
        'id' => $number,
        'name' => visualplan_string($queue['name'] ?? ''),
        'staticMembers' => $members,
        'dynamicMembers' => array_map('strval', array_keys(visualplan_dynamic_members($queue['dynmembers'] ?? ''))),
        'strategy' => visualplan_string($queue['strategy'] ?? ''),
        'agentTimeout' => (int) ($queue['timeout'] ?? 0),
        'maxWait' => (int) ($queue['maxwait'] ?? 0),
        'destination' => visualplan_string($queue['goto'] ?? ''),
        'ringing' => (int) ($queue['rtone'] ?? 0) !== 0 ? 'ring' : 'moh',
        'cidPrefix' => visualplan_string($queue['prefix'] ?? ''),
        'joinAnnouncement' => visualplan_optional_id($queue['joinannounce_id'] ?? null),
        'positionAnnouncement' => ($queue['announce-position'] ?? '') === 'yes',
        'announceFrequency' => (int) ($queue['announce-frequency'] ?? 0),
        'breakoutIvr' => visualplan_optional_id($queue['announcemenu'] ?? null),
        'musicOnHold' => $music !== '' ? $music : 'inherit',
    ];
}

function visualplan_read_queues(): array
{
    $queues = [];
    foreach (visualplan_rows(FreePBX::Queues()->listQueues(true)) as $row) {
        $number = visualplan_string($row[0] ?? '');
        $queue = queues_get($number);
        if (!is_array($queue) || !$queue) {
            throw new UnexpectedValueException('Invalid queue');
        }
        $queues[] = visualplan_map_queue($number, $queue);
    }
    return $queues;
}

function visualplan_read_ivrs(): array
{
    $ivrs = [];
    foreach (visualplan_rows(FreePBX::Ivr()->getDetails()) as $row) {
        $id = (int) ($row['id'] ?? 0);
        $entries = [];
        foreach (visualplan_rows(ivr_get_entries($id)) as $entry) {
            $entries[] = [
                'selection' => visualplan_string($entry['selection'] ?? ''),
                'destination' => visualplan_string($entry['dest'] ?? ''),
            ];
        }
        $ivrs[] = [
            'id' => $id,
            'name' => visualplan_decode($row['name'] ?? ''),
            'description' => visualplan_decode($row['description'] ?? ''),
            'announcement' => visualplan_optional_id($row['announcement'] ?? null),
            'directDial' => trim(visualplan_string($row['directdial'] ?? '')) !== '',
            'invalidDestination' => visualplan_string($row['invalid_destination'] ?? ''),
            'timeoutDestination' => visualplan_string($row['timeout_destination'] ?? ''),
            'entries' => $entries,
        ];
    }
    return $ivrs;
}

function visualplan_read_cqrs(): array
{
    $cqrs = [];
    foreach (visualplan_rows(nethcqr_get_details()) as $row) {
        $id = (int) ($row['id_cqr'] ?? 0);
        $entries = [];
        foreach (visualplan_rows(nethcqr_get_entries($id)) as $entry) {
            $entries[] = [
                'condition' => visualplan_string($entry['condition'] ?? ''),
                'destination' => visualplan_string($entry['destination'] ?? ''),
            ];
        }
        $cqrs[] = [
            'id' => $id,
            'name' => visualplan_string($row['name'] ?? ''),
            'description' => visualplan_string($row['description'] ?? ''),
            'announcement' => visualplan_optional_id($row['announcement'] ?? null),
            'defaultDestination' => visualplan_string($row['default_destination'] ?? ''),
            'entries' => $entries,
        ];
    }
    return $cqrs;
}

function visualplan_read_announcements(): array
{
    $announcements = [];
    foreach (visualplan_rows(FreePBX::Announcement()->getAnnouncements()) as $row) {
        $announcements[] = [
            'id' => (int) ($row['announcement_id'] ?? 0),
            'description' => visualplan_string($row['description'] ?? ''),
            'recording' => visualplan_optional_id($row['recording_id'] ?? null),
            'destination' => visualplan_string($row['post_dest'] ?? ''),
        ];
    }
    return $announcements;
}

function visualplan_read_time_conditions(): array
{
    $conditions = [];
    foreach (visualplan_rows(FreePBX::Timeconditions()->listTimeconditions(false)) as $row) {
        $conditions[] = [
            'id' => (int) ($row['timeconditions_id'] ?? 0),
            'name' => visualplan_string($row['displayname'] ?? ''),
            'timeGroup' => visualplan_optional_id($row['time'] ?? null),
            'trueDestination' => visualplan_string($row['truegoto'] ?? ''),
            'falseDestination' => visualplan_string($row['falsegoto'] ?? ''),
        ];
    }
    return $conditions;
}

function visualplan_read_time_groups(): array
{
    $groups = [];
    foreach (visualplan_rows(FreePBX::Timeconditions()->listTimegroups()) as $row) {
        $id = (int) ($row[0] ?? 0);
        $times = [];
        foreach (visualplan_rows(timeconditions_timegroups_get_times($id)) as $time) {
            $times[] = visualplan_string($time[1] ?? '');
        }
        $groups[] = ['id' => $id, 'description' => visualplan_string($row[1] ?? ''), 'times' => $times];
    }
    return $groups;
}

function visualplan_read_call_flow_controls(): array
{
    $controls = [];
    foreach (visualplan_rows(daynight_list()) as $row) {
        $code = visualplan_string($row['ext'] ?? '');
        $flow = daynight_get_obj($code);
        if (!is_array($flow)) {
            throw new UnexpectedValueException('Invalid call flow control');
        }
        $state = visualplan_string($flow['state'] ?? '');
        $controls[] = [
            'id' => $code,
            'name' => visualplan_string($flow['fc_description'] ?? ''),
            'state' => $state === 'NIGHT' ? 'NIGHT' : 'DAY',
            'normalDestination' => visualplan_string($flow['day'] ?? ''),
            'overrideDestination' => visualplan_string($flow['night'] ?? ''),
        ];
    }
    return $controls;
}

function visualplan_read_available_call_flow_codes(): array
{
    $codes = daynight_get_avail();
    if (!is_array($codes)) {
        throw new UnexpectedValueException('Invalid control code list');
    }
    return array_map('strval', array_values($codes));
}

function visualplan_read_set_caller_ids(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Setcid()->listAll()) as $row) {
        $list[] = [
            'id' => (int) ($row['cid_id'] ?? 0),
            'description' => visualplan_string($row['description'] ?? ''),
            'cidName' => visualplan_string($row['cid_name'] ?? ''),
            'cidNum' => visualplan_string($row['cid_num'] ?? ''),
            'destination' => visualplan_string($row['dest'] ?? ''),
        ];
    }
    return $list;
}

function visualplan_read_direct_dids(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Directdid()->directdid_get()) as $row) {
        $list[] = [
            'id' => (int) ($row['id'] ?? 0),
            'prefix' => visualplan_string($row['prefix'] ?? ''),
            'root' => visualplan_string($row['root'] ?? ''),
            'varlength' => (int) ($row['varlength'] ?? 0),
            'timeout' => (int) ($row['timeout'] ?? 0),
            'timeoutDestination' => visualplan_string($row['timeout_destination'] ?? ''),
            'busyDestination' => visualplan_string($row['busy_destination'] ?? ''),
            'unavailableDestination' => visualplan_string($row['unavailable_destination'] ?? ''),
        ];
    }
    return $list;
}

function visualplan_read_queue_exits(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Queueexit()->queueexit_get()) as $row) {
        $item = ['id' => (int) ($row['id'] ?? 0), 'name' => visualplan_string($row['displayname'] ?? '')];
        foreach (VISUALPLAN_QUEUE_EXIT_COLUMNS as $field => $column) {
            $item[$field] = visualplan_string($row[$column] ?? '');
        }
        $list[] = $item;
    }
    return $list;
}

/**
 * Map recording filenames to recording ids: Queue Options store the filename of its join message.
 */
function visualplan_recording_files(): array
{
    $files = [];
    foreach (visualplan_rows(FreePBX::Recordings()->getAllRecordings()) as $row) {
        $files[visualplan_string($row['filename'] ?? '')] = (int) ($row['id'] ?? 0);
    }
    return $files;
}

function visualplan_read_queue_options(): array
{
    $files = visualplan_recording_files();
    $list = [];
    foreach (visualplan_rows(FreePBX::Queueoptions()->queueoptions_get()) as $row) {
        $message = visualplan_string($row['VQ_JOINMSG'] ?? '');
        $list[] = [
            'id' => (int) ($row['id'] ?? 0),
            'name' => visualplan_string($row['name'] ?? ''),
            'cidPrefix' => visualplan_string($row['VQ_CIDPP'] ?? ''),
            'alertInfo' => visualplan_string($row['VQ_AINFO'] ?? ''),
            'joinAnnouncement' => $message !== '' && isset($files[$message]) ? $files[$message] : null,
            'musicOnHold' => visualplan_string($row['VQ_MOH'] ?? ''),
            'positionEnabled' => (bool) ($row['VQ_POSITION_ENABLED'] ?? false),
            'position' => (int) ($row['VQ_POSITION'] ?? 0),
            'maxWaitEnabled' => (bool) ($row['VQ_MAXWAIT_ENABLED'] ?? false),
            'maxWait' => (int) ($row['VQ_MAXWAIT'] ?? 0),
            'failoverEnabled' => (bool) ($row['VQ_DEST_ENABLED'] ?? false),
            'failoverDestination' => visualplan_string($row['VQ_DEST'] ?? ''),
            'destination' => visualplan_string($row['DEST'] ?? ''),
        ];
    }
    return $list;
}

function visualplan_read_queue_priorities(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Queueprio()->getPriorities()) as $row) {
        $list[] = [
            'id' => (int) ($row['id'] ?? 0),
            'description' => visualplan_string($row['name'] ?? ''),
            'priority' => (int) ($row['priority'] ?? 0),
            'destination' => visualplan_string($row['dest'] ?? ''),
        ];
    }
    return $list;
}

function visualplan_read_recordings(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Recordings()->getAllRecordings()) as $row) {
        $list[] = [
            'id' => (int) ($row['id'] ?? 0),
            'name' => visualplan_decode($row['displayname'] ?? ''),
            'description' => visualplan_decode($row['description'] ?? ''),
        ];
    }
    return $list;
}

function visualplan_read_music_on_hold(): array
{
    $classes = [];
    foreach (visualplan_rows(FreePBX::Music()->getCategories()) as $row) {
        $category = visualplan_string($row['category'] ?? '');
        if ($category !== '') {
            $classes[] = $category;
        }
    }
    return $classes;
}

function visualplan_read_destinations(): array
{
    $list = [];
    foreach (visualplan_rows(FreePBX::Modules()->getDestinations()) as $key => $row) {
        $list[] = [
            'destination' => visualplan_string($row['destination'] ?? $key),
            'category' => visualplan_decode($row['category'] ?? ($row['name'] ?? ($row['module'] ?? ''))),
            'description' => visualplan_decode($row['description'] ?? ''),
        ];
    }
    return $list;
}

/**
 * Collect validation errors of one change and normalize its values.
 */
final class VisualPlanCheck
{
    public array $errors = [];
    private $knownDestination;

    public function __construct(private string $type, private string $ref, private array $newRefs, ?callable $knownDestination = null)
    {
        $this->knownDestination = $knownDestination;
    }

    public function error(string $field, string $code): void
    {
        $this->errors[] = ['type' => $this->type, 'ref' => $this->ref, 'field' => $field, 'message' => $code];
    }

    private function present(array $from, string $key, string $path): bool
    {
        if (!array_key_exists($key, $from) || $from[$key] === null) {
            $this->error($path, 'required');
            return false;
        }
        return true;
    }

    /**
     * A trimmed string. Unless $expressions is set, Asterisk expressions are refused:
     * most of these values end up in the dialplan, where ${...} and $[...] are evaluated.
     */
    public function text(array $from, string $key, int $max, bool $required = false, ?string $pattern = null, ?string $path = null, bool $expressions = false): string
    {
        $path ??= $key;
        if (!$this->present($from, $key, $path)) {
            return '';
        }
        if (!is_string($from[$key])) {
            $this->error($path, 'invalid');
            return '';
        }
        $value = trim($from[$key]);
        if (preg_match('/[\x00-\x1F\x7F]/', $from[$key])) {
            $this->error($path, 'invalid');
        } elseif ($required && $value === '') {
            $this->error($path, 'required');
        } elseif (visualplan_length($value) > $max
            || (!$expressions && preg_match('/\$[{\[]/', $value))
            || ($pattern !== null && $value !== '' && !preg_match($pattern, $value))) {
            $this->error($path, 'invalid');
        }
        return $value;
    }

    public function integer(array $from, string $key, int $min = 0, int $max = VISUALPLAN_INT_MAX, ?string $path = null): int
    {
        $path ??= $key;
        if (!$this->present($from, $key, $path)) {
            return 0;
        }
        $value = $from[$key];
        if (is_string($value) && preg_match('/^-?\d+$/', $value)) {
            $value = (int) $value;
        }
        if (!is_int($value) || $value < $min || $value > $max) {
            $this->error($path, 'invalid');
            return 0;
        }
        return $value;
    }

    public function optionalId(array $from, string $key, ?string $path = null): ?int
    {
        $path ??= $key;
        if (!array_key_exists($key, $from)) {
            $this->error($path, 'required');
            return null;
        }
        if ($from[$key] === null) {
            return null;
        }
        $value = $from[$key];
        if (is_string($value) && ctype_digit($value)) {
            $value = (int) $value;
        }
        if (!is_int($value) || $value < 1 || $value > VISUALPLAN_INT_MAX) {
            $this->error($path, 'invalid');
            return null;
        }
        return $value;
    }

    public function flag(array $from, string $key): bool
    {
        if (!$this->present($from, $key, $key)) {
            return false;
        }
        if (!is_bool($from[$key])) {
            $this->error($key, 'invalid');
            return false;
        }
        return $from[$key];
    }

    public function items(array $from, string $key): array
    {
        if (!$this->present($from, $key, $key)) {
            return [];
        }
        if (!is_array($from[$key]) || !array_is_list($from[$key])) {
            $this->error($key, 'invalid');
            return [];
        }
        return $from[$key];
    }

    /**
     * A goto "context,exten,priority" no longer than its column, or a reference to a new object.
     */
    public function destination(array $from, string $key, int $max, ?string $path = null): string
    {
        $path ??= $key;
        $errors = count($this->errors);
        $value = $this->text($from, $key, 255, false, null, $path, true);
        if ($value === '' || count($this->errors) > $errors) {
            return $value;
        }
        if (str_starts_with($value, VISUALPLAN_NEW_PREFIX)) {
            $type = $this->newRefs[substr($value, strlen(VISUALPLAN_NEW_PREFIX))] ?? null;
            if ($type === null) {
                $this->error($path, 'not_found');
            } elseif (!isset(VISUALPLAN_TYPES[$type]['goto'])) {
                $this->error($path, 'invalid');
            }
        } elseif (visualplan_length($value) > $max
            || (!preg_match(VISUALPLAN_DESTINATION_PATTERN, $value)
                && !($this->knownDestination !== null && ($this->knownDestination)($value)))) {
            $this->error($path, 'invalid');
        }
        return $value;
    }
}

/**
 * Lists read once per request and shared by the validation.
 */
function visualplan_state_list(array &$state, string $key): array
{
    if (!array_key_exists($key, $state)) {
        $state[$key] = array_values((VISUALPLAN_LISTS[$key])());
    }
    return $state[$key];
}

function visualplan_state_ids(array &$state, string $key, string $field = 'id'): array
{
    $ids = [];
    foreach (visualplan_state_list($state, $key) as $item) {
        $ids[visualplan_string($item[$field] ?? '')] = $item;
    }
    return $ids;
}

function visualplan_number_in_use(string $number): bool
{
    return !empty(FreePBX::Extensions()->checkUsage($number, false));
}

function visualplan_split_route_key(string $key): array
{
    $parts = explode('/', $key, 2);
    return [$parts[0], $parts[1] ?? ''];
}

function visualplan_request_error(string $type, string $ref, string $field, string $code): array
{
    return ['type' => $type, 'ref' => $ref, 'field' => $field, 'message' => $code];
}

/**
 * Check the shape of the request and of each change, without reading the PBX.
 */
function visualplan_parse_changes($body, array &$errors): array
{
    $changes = [];
    if (!is_array($body) || !array_key_exists('changes', $body)) {
        $errors[] = visualplan_request_error('', '', 'changes', 'required');
        return [];
    }
    if (!is_array($body['changes']) || !array_is_list($body['changes'])) {
        $errors[] = visualplan_request_error('', '', 'changes', 'invalid');
        return [];
    }
    $refs = [];
    foreach ($body['changes'] as $item) {
        if (is_array($item) && is_string($item['ref'] ?? null)) {
            $refs[$item['ref']] = ($refs[$item['ref']] ?? 0) + 1;
        }
    }
    $existing = [];
    foreach ($body['changes'] as $item) {
        if (!is_array($item)) {
            $errors[] = visualplan_request_error('', '', 'changes', 'invalid');
            continue;
        }
        $ref = $item['ref'] ?? null;
        $type = $item['type'] ?? null;
        $errorType = is_string($type) ? $type : '';
        $before = count($errors);
        if (!is_string($ref) || trim($ref) === '') {
            $errors[] = visualplan_request_error($errorType, is_scalar($ref) ? (string) $ref : '', 'ref', $ref === null || $ref === '' ? 'required' : 'invalid');
            $ref = is_scalar($ref) ? (string) $ref : '';
        }
        if ($type === null) {
            $errors[] = visualplan_request_error('', $ref, 'type', 'required');
        } elseif (!is_string($type) || !isset(VISUALPLAN_TYPES[$type])) {
            $errors[] = visualplan_request_error($errorType, $ref, 'type', 'invalid');
        }
        if (!array_key_exists('isNew', $item)) {
            $errors[] = visualplan_request_error($errorType, $ref, 'isNew', 'required');
        } elseif (!is_bool($item['isNew'])) {
            $errors[] = visualplan_request_error($errorType, $ref, 'isNew', 'invalid');
        }
        if (!array_key_exists('data', $item) || $item['data'] === null) {
            $errors[] = visualplan_request_error($errorType, $ref, 'data', 'required');
        } elseif (!is_array($item['data']) || ($item['data'] && array_is_list($item['data']))) {
            $errors[] = visualplan_request_error($errorType, $ref, 'data', 'invalid');
        }
        if (count($errors) > $before) {
            continue;
        }
        // The response maps refs to keys, so a new ref must not be used by any other change.
        if (($item['isNew'] && $refs[$ref] > 1) || (!$item['isNew'] && isset($existing[$type][$ref]))) {
            $errors[] = visualplan_request_error($type, $ref, 'ref', 'invalid');
            continue;
        }
        if (!$item['isNew']) {
            $existing[$type][$ref] = true;
        }
        $changes[] = ['type' => $type, 'ref' => $ref, 'isNew' => $item['isNew'], 'data' => $item['data']];
    }
    return $changes;
}

/**
 * Validate every change against the PBX and store its normalized values in "values".
 */
function visualplan_validate(array &$changes, array &$state): array
{
    $newRefs = [];
    foreach ($changes as $change) {
        if ($change['isNew']) {
            $newRefs[$change['ref']] = $change['type'];
        }
    }
    $known = null;
    $knownDestination = function (string $destination) use (&$state, &$known): bool {
        if ($known === null) {
            try {
                $known = array_flip(array_column(visualplan_state_list($state, 'destinations'), 'destination'));
            } catch (Throwable $error) {
                error_log('Visualplan: failed to load destinations (' . get_class($error) . ')');
                $known = [];
            }
        }
        return isset($known[$destination]);
    };
    $claims = [];
    $errors = [];
    foreach ($changes as $index => $change) {
        $check = new VisualPlanCheck($change['type'], $change['ref'], $newRefs, $knownDestination);
        $validator = 'visualplan_check_' . strtolower(preg_replace('/[A-Z]/', '_$0', $change['type']));
        $changes[$index]['values'] = $validator($check, $change, $state, $claims, $newRefs);
        array_push($errors, ...$check->errors);
    }
    return $errors;
}

/**
 * Resolve the id of an existing object whose id is assigned by the PBX.
 */
function visualplan_check_existing(VisualPlanCheck $check, array $change, array &$state): ?int
{
    if ($change['isNew']) {
        return null;
    }
    $items = visualplan_state_ids($state, VISUALPLAN_TYPES[$change['type']]['list']);
    if (!ctype_digit($change['ref']) || !isset($items[(string) (int) $change['ref']])) {
        $check->error('ref', 'not_found');
        return null;
    }
    return (int) $change['ref'];
}

/**
 * An existing object keyed by its number cannot be renumbered.
 */
function visualplan_check_existing_key(VisualPlanCheck $check, array $change, array $items): void
{
    $id = $change['data']['id'] ?? null;
    if (!isset($items[$change['ref']])) {
        $check->error('ref', 'not_found');
    } elseif ($id !== null && (!is_scalar($id) || (string) $id !== $change['ref'])) {
        $check->error('id', 'invalid');
    }
}

/**
 * Check the number of a conference, ring group or queue.
 */
function visualplan_check_number(VisualPlanCheck $check, array $change, array &$state, array &$claims, int $max): string
{
    if (!$change['isNew']) {
        visualplan_check_existing_key($check, $change, visualplan_state_ids($state, VISUALPLAN_TYPES[$change['type']]['list']));
        return $change['ref'];
    }
    $number = $check->text($change['data'], 'id', $max, true, '/^\d+$/');
    if ($number !== '' && ctype_digit($number)) {
        if (isset($claims['number'][$number]) || visualplan_number_in_use($number)) {
            $check->error('id', 'number_in_use');
        }
        $claims['number'][$number] = true;
    }
    return $number;
}

/**
 * The current state of an existing object, empty for a new one.
 */
function visualplan_current(array $change, array &$state): array
{
    if ($change['isNew']) {
        return [];
    }
    return visualplan_state_ids($state, VISUALPLAN_TYPES[$change['type']]['list'])[$change['ref']] ?? [];
}

// References are checked only when they change, so stale data the user did not touch can be saved.
function visualplan_changed(array $current, string $field, $value): bool
{
    return !array_key_exists($field, $current) || $current[$field] !== $value;
}

function visualplan_check_recording(VisualPlanCheck $check, array $data, string $key, array &$state, array $current): ?int
{
    $id = $check->optionalId($data, $key);
    if ($id !== null && visualplan_changed($current, $key, $id)
        && !isset(visualplan_state_ids($state, 'recordings')[(string) $id])) {
        $check->error($key, 'not_found');
    }
    return $id;
}

/**
 * Compare names as the database does: case and accent insensitive, spaces collapsed.
 */
function visualplan_name_key(string $name): string
{
    $name = trim(preg_replace('/\s+/u', ' ', $name) ?? $name);
    if (class_exists('Normalizer')) {
        $decomposed = Normalizer::normalize($name, Normalizer::FORM_D);
        if (is_string($decomposed)) {
            $name = preg_replace('/\p{Mn}+/u', '', $decomposed) ?? $name;
        }
    }
    return function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
}

/**
 * Names that must be unique among the objects of one kind.
 */
function visualplan_check_unique_name(VisualPlanCheck $check, string $field, string $name, ?int $id, array $items, string $nameField, array &$claims, string $kind): void
{
    if ($name === '') {
        return;
    }
    $key = visualplan_name_key($name);
    foreach ($items as $item) {
        if (visualplan_name_key(visualplan_string($item[$nameField] ?? '')) === $key && (int) $item['id'] !== $id) {
            $check->error($field, 'invalid');
            return;
        }
    }
    if (isset($claims[$kind][$key])) {
        $check->error($field, 'invalid');
    }
    $claims[$kind][$key] = true;
}

/**
 * The same extension cannot be listed twice.
 */
function visualplan_check_unique_members(VisualPlanCheck $check, string $field, array $extensions): void
{
    $extensions = array_filter($extensions, fn($extension) => $extension !== '');
    if (count($extensions) !== count(array_unique($extensions))) {
        $check->error($field, 'invalid');
    }
}

function visualplan_check_inbound_route(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $values = [
        'extension' => $check->text($data, 'extension', 50, false, '#^[^/<>,]*$#'),
        'cidnum' => $check->text($data, 'cidnum', 50, false, '#^[^/<>,]*$#'),
        'description' => $check->text($data, 'description', 100),
        'alertinfo' => $check->text($data, 'alertinfo', 255),
        'grppre' => $check->text($data, 'grppre', 80),
        'destination' => $check->destination($data, 'destination', 60),
    ];
    $routes = [];
    foreach (visualplan_state_list($state, 'inboundRoutes') as $route) {
        $routes[$route['extension'] . '/' . $route['cidnum']] = true;
    }
    $key = $values['extension'] . '/' . $values['cidnum'];
    if (!$change['isNew'] && !isset($routes[$change['ref']])) {
        $check->error('ref', 'not_found');
    } elseif (($change['isNew'] || $key !== $change['ref']) && (isset($routes[$key]) || isset($claims['route'][$key]))) {
        $check->error('extension', 'number_in_use');
    }
    $claims['route'][$key] = true;
    return $values;
}

function visualplan_check_voicemail(VisualPlanCheck $check, array $change, array &$state): array
{
    $extension = $check->text($change['data'], 'extension', 20, true);
    if ($extension !== '' && !isset(visualplan_state_ids($state, 'extensions', 'extension')[$extension])) {
        $check->error('extension', 'not_found');
    }
    return ['extension' => $extension];
}

function visualplan_check_conference(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    return [
        'id' => visualplan_check_number($check, $change, $state, $claims, 50),
        'name' => $check->text($change['data'], 'name', 50, true),
    ];
}

function visualplan_check_ring_group(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $items = $check->items($data, 'members');
    if (array_key_exists('members', $data) && is_array($data['members']) && !$data['members']) {
        $check->error('members', 'required');
    }
    $members = [];
    foreach ($items as $index => $member) {
        $members[] = $check->text($data['members'], $index, 20, true, '/^[0-9*#+]+$/', 'members.' . $index);
    }
    visualplan_check_unique_members($check, 'members', $members);
    if (strlen(implode('-', $members)) > 255) {
        $check->error('members', 'invalid');
    }
    $strategy = $check->text($data, 'strategy', 50, true);
    if ($strategy !== '' && !in_array($strategy, VISUALPLAN_RING_STRATEGIES, true)
        && visualplan_changed(visualplan_current($change, $state), 'strategy', $strategy)) {
        $check->error('strategy', 'invalid');
    }
    return [
        'id' => visualplan_check_number($check, $change, $state, $claims, 20),
        'description' => $check->text($data, 'description', 35, true),
        'members' => $members,
        'strategy' => $strategy,
        'ringTime' => $check->integer($data, 'ringTime', 0, 300),
        'destination' => $check->destination($data, 'destination', 255),
    ];
}

function visualplan_check_queue(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $members = [];
    foreach ($check->items($data, 'staticMembers') as $index => $member) {
        if (!is_array($member)) {
            $check->error('staticMembers.' . $index, 'invalid');
            continue;
        }
        $members[] = [
            'extension' => $check->text($member, 'extension', 20, true, '/^[0-9*#]+$/', 'staticMembers.' . $index . '.extension'),
            'penalty' => $check->integer($member, 'penalty', 0, 99, 'staticMembers.' . $index . '.penalty'),
        ];
    }
    visualplan_check_unique_members($check, 'staticMembers', array_column($members, 'extension'));
    $dynamic = [];
    foreach ($check->items($data, 'dynamicMembers') as $index => $member) {
        $dynamic[] = $check->text($data['dynamicMembers'], $index, 20, true, '/^[0-9*#]+$/', 'dynamicMembers.' . $index);
    }
    visualplan_check_unique_members($check, 'dynamicMembers', $dynamic);
    $strategy = $check->text($data, 'strategy', 50, true);
    $current = visualplan_current($change, $state);
    if ($strategy !== '' && !in_array($strategy, VISUALPLAN_QUEUE_STRATEGIES, true)
        && visualplan_changed($current, 'strategy', $strategy)) {
        $check->error('strategy', 'invalid');
    }
    $ringing = $check->text($data, 'ringing', 4, true);
    if ($ringing !== '' && !in_array($ringing, ['moh', 'ring'], true)) {
        $check->error('ringing', 'invalid');
    }
    $breakout = $check->optionalId($data, 'breakoutIvr');
    if ($breakout !== null && visualplan_changed($current, 'breakoutIvr', $breakout)
        && !isset(visualplan_state_ids($state, 'ivrs')[(string) $breakout])) {
        $check->error('breakoutIvr', 'not_found');
    }
    $music = $check->text($data, 'musicOnHold', 80, true);
    if ($music !== '' && $music !== 'inherit' && $music !== 'none' && visualplan_changed($current, 'musicOnHold', $music)
        && !in_array($music, visualplan_state_list($state, 'musicOnHold'), true)) {
        $check->error('musicOnHold', 'not_found');
    }
    return [
        'id' => visualplan_check_number($check, $change, $state, $claims, 20),
        'name' => $check->text($data, 'name', 35, true),
        'staticMembers' => $members,
        'dynamicMembers' => $dynamic,
        'strategy' => $strategy,
        'agentTimeout' => $check->integer($data, 'agentTimeout', 0, VISUALPLAN_QUEUE_SECONDS_MAX),
        'maxWait' => $check->integer($data, 'maxWait', 0, VISUALPLAN_QUEUE_SECONDS_MAX),
        'destination' => $check->destination($data, 'destination', 50),
        'ringing' => $ringing,
        'cidPrefix' => $check->text($data, 'cidPrefix', 100),
        'joinAnnouncement' => visualplan_check_recording($check, $data, 'joinAnnouncement', $state, $current),
        'positionAnnouncement' => $check->flag($data, 'positionAnnouncement'),
        'announceFrequency' => $check->integer($data, 'announceFrequency', 0, VISUALPLAN_QUEUE_SECONDS_MAX),
        'breakoutIvr' => $breakout,
        'musicOnHold' => $music,
    ];
}

function visualplan_check_ivr(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    $entries = [];
    $selections = [];
    foreach ($check->items($data, 'entries') as $index => $entry) {
        if (!is_array($entry)) {
            $check->error('entries.' . $index, 'invalid');
            continue;
        }
        $selection = $check->text($entry, 'selection', 30, true, '/^[0-9A-Za-z*#]+$/', 'entries.' . $index . '.selection');
        if ($selection !== '' && isset($selections[$selection])) {
            $check->error('entries.' . $index . '.selection', 'invalid');
        }
        $selections[$selection] = true;
        $path = 'entries.' . $index . '.destination';
        $destination = $check->destination($entry, 'destination', 200, $path);
        // The IVR module silently drops a selection without destination.
        if ($destination === '' && is_string($entry['destination'] ?? null)) {
            $check->error($path, 'required');
        }
        $entries[] = ['selection' => $selection, 'destination' => $destination];
    }
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'name' => $check->text($data, 'name', 50, true),
        'description' => $check->text($data, 'description', 150),
        'announcement' => visualplan_check_recording($check, $data, 'announcement', $state, visualplan_current($change, $state)),
        'directDial' => $check->flag($data, 'directDial'),
        'invalidDestination' => $check->destination($data, 'invalidDestination', 50),
        'timeoutDestination' => $check->destination($data, 'timeoutDestination', 50),
        'entries' => $entries,
    ];
}

function visualplan_check_cqr(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $entries = [];
    foreach ($check->items($data, 'entries') as $index => $entry) {
        if (!is_array($entry)) {
            $check->error('entries.' . $index, 'invalid');
            continue;
        }
        $entries[] = [
            'condition' => $check->text($entry, 'condition', 255, false, null, 'entries.' . $index . '.condition'),
            'destination' => $check->destination($entry, 'destination', 50, 'entries.' . $index . '.destination'),
        ];
    }
    $id = visualplan_check_existing($check, $change, $state);
    $name = $check->text($data, 'name', 60, true);
    visualplan_check_unique_name($check, 'name', $name, $id, visualplan_state_list($state, 'cqrs'), 'name', $claims, 'cqr');
    return [
        'id' => $id,
        'name' => $name,
        'description' => $check->text($data, 'description', 120),
        'announcement' => visualplan_check_recording($check, $data, 'announcement', $state, visualplan_current($change, $state)),
        'defaultDestination' => $check->destination($data, 'defaultDestination', 50),
        'entries' => $entries,
    ];
}

function visualplan_check_announcement(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'description' => $check->text($data, 'description', 50, true),
        'recording' => visualplan_check_recording($check, $data, 'recording', $state, visualplan_current($change, $state)),
        'destination' => $check->destination($data, 'destination', 255),
    ];
}

function visualplan_check_time_condition(VisualPlanCheck $check, array $change, array &$state, array &$claims, array $newRefs): array
{
    $data = $change['data'];
    $groupRef = null;
    $group = null;
    if (isset($data['timeGroupRef']) && $data['timeGroupRef'] !== '') {
        $groupRef = $check->text($data, 'timeGroupRef', 255);
        if ($groupRef !== '' && ($newRefs[$groupRef] ?? null) !== 'timeGroup') {
            $check->error('timeGroupRef', 'not_found');
        }
    } else {
        $group = $check->optionalId($data, 'timeGroup');
        if ($group !== null && visualplan_changed(visualplan_current($change, $state), 'timeGroup', $group)
            && !isset(visualplan_state_ids($state, 'timeGroups')[(string) $group])) {
            $check->error('timeGroup', 'not_found');
        }
    }
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'name' => $check->text($data, 'name', 50, true),
        'timeGroup' => $group,
        'timeGroupRef' => $groupRef,
        'trueDestination' => $check->destination($data, 'trueDestination', 50),
        'falseDestination' => $check->destination($data, 'falseDestination', 50),
    ];
}

function visualplan_check_time_group(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $items = $check->items($data, 'times');
    $pattern = visualplan_changed(visualplan_current($change, $state), 'times', $items) ? VISUALPLAN_TIME_PATTERN : null;
    $times = [];
    foreach ($items as $index => $time) {
        $time = $check->text($data['times'], $index, 100, true, $pattern, 'times.' . $index);
        // The Time Groups module drops a rule that always matches.
        if ($time === '*|*|*|*') {
            $check->error('times.' . $index, 'invalid');
        }
        $times[] = $time;
    }
    $id = visualplan_check_existing($check, $change, $state);
    // Stored as the Time Groups module stores it.
    $description = trim(preg_replace('/\s+/', ' ', $check->text($data, 'description', 50, true)));
    visualplan_check_unique_name($check, 'description', $description, $id, visualplan_state_list($state, 'timeGroups'), 'description', $claims, 'timeGroup');
    return ['id' => $id, 'description' => $description, 'times' => $times];
}

function visualplan_check_call_flow_control(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    if ($change['isNew']) {
        $code = $check->text($data, 'id', 2, true, '/^\d{1,2}$/');
        if ($code !== '' && ctype_digit($code)) {
            $code = (string) (int) $code;
            if (isset($claims['callFlow'][$code])
                || !in_array($code, visualplan_state_list($state, 'availableCallFlowCodes'), true)) {
                $check->error('id', 'number_in_use');
            }
            $claims['callFlow'][$code] = true;
        }
    } else {
        visualplan_check_existing_key($check, $change, visualplan_state_ids($state, 'callFlowControls'));
        $code = $change['ref'];
    }
    // The state is toggled from the phones: only a new control takes it from the request.
    $flowState = 'DAY';
    if (isset($data['state'])) {
        $flowState = $check->text($data, 'state', 5);
        if (!in_array($flowState, ['DAY', 'NIGHT'], true)) {
            $check->error('state', 'invalid');
        }
    }
    return [
        'id' => $code,
        'name' => $check->text($data, 'name', 190),
        'state' => $flowState,
        'normalDestination' => $check->destination($data, 'normalDestination', 190),
        'overrideDestination' => $check->destination($data, 'overrideDestination', 190),
    ];
}

function visualplan_check_set_caller_id(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'description' => $check->text($data, 'description', 50, true),
        'cidName' => $check->text($data, 'cidName', 150, false, VISUALPLAN_CALLERID_PATTERN, null, true),
        'cidNum' => $check->text($data, 'cidNum', 150, false, VISUALPLAN_CALLERID_PATTERN, null, true),
        'destination' => $check->destination($data, 'destination', 255),
    ];
}

function visualplan_check_direct_did(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'prefix' => $check->text($data, 'prefix', 3, false, '/^\d+$/'),
        'root' => $check->text($data, 'root', 20, true, '/^\d+$/'),
        'varlength' => $check->integer($data, 'varlength', 1, 20),
        'timeout' => $check->integer($data, 'timeout', 0, 3600),
        'timeoutDestination' => $check->destination($data, 'timeoutDestination', 80),
        'busyDestination' => $check->destination($data, 'busyDestination', 80),
        'unavailableDestination' => $check->destination($data, 'unavailableDestination', 80),
    ];
}

function visualplan_check_queue_exit(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    $values = [
        'id' => visualplan_check_existing($check, $change, $state),
        'name' => $check->text($data, 'name', 50, true),
    ];
    foreach (array_keys(VISUALPLAN_QUEUE_EXIT_COLUMNS) as $field) {
        $values[$field] = $check->destination($data, $field, 80);
    }
    return $values;
}

function visualplan_check_queue_options(VisualPlanCheck $check, array $change, array &$state): array
{
    $data = $change['data'];
    $current = visualplan_current($change, $state);
    $music = $check->text($data, 'musicOnHold', 100);
    if ($music !== '' && visualplan_changed($current, 'musicOnHold', $music)
        && !in_array($music, visualplan_state_list($state, 'musicOnHold'), true)) {
        $check->error('musicOnHold', 'not_found');
    }
    return [
        'id' => visualplan_check_existing($check, $change, $state),
        'name' => $check->text($data, 'name', 100, true),
        'cidPrefix' => $check->text($data, 'cidPrefix', 100),
        'alertInfo' => $check->text($data, 'alertInfo', 100),
        'joinAnnouncement' => visualplan_check_recording($check, $data, 'joinAnnouncement', $state, $current),
        'musicOnHold' => $music,
        'positionEnabled' => $check->flag($data, 'positionEnabled'),
        'position' => $check->integer($data, 'position'),
        'maxWaitEnabled' => $check->flag($data, 'maxWaitEnabled'),
        'maxWait' => $check->integer($data, 'maxWait'),
        'failoverEnabled' => $check->flag($data, 'failoverEnabled'),
        'failoverDestination' => $check->destination($data, 'failoverDestination', 80),
        'destination' => $check->destination($data, 'destination', 80),
    ];
}

function visualplan_check_queue_priority(VisualPlanCheck $check, array $change, array &$state, array &$claims): array
{
    $data = $change['data'];
    $id = visualplan_check_existing($check, $change, $state);
    $description = $check->text($data, 'description', 50, true);
    visualplan_check_unique_name($check, 'description', $description, $id, visualplan_state_list($state, 'queuePriorities'), 'description', $claims, 'queuePriority');
    $destination = $check->destination($data, 'destination', 255);
    if ($destination === '' && isset($data['destination']) && is_string($data['destination'])) {
        $check->error('destination', 'required');
    }
    return [
        'id' => $id,
        'description' => $description,
        'priority' => $check->integer($data, 'priority', 0, 999),
        'destination' => $destination,
    ];
}

/**
 * Save a request: validate everything, then create and update the objects.
 *
 * Returns the HTTP status, the response body and whether the dialplan must be reloaded.
 */
function visualplan_save($body): array
{
    $errors = [];
    $changes = visualplan_parse_changes($body, $errors);
    $state = [];
    try {
        array_push($errors, ...visualplan_validate($changes, $state));
    } catch (Throwable $error) {
        error_log('Visualplan: validation failed (' . get_class($error) . ')');
        return ['status' => 500, 'body' => ['error' => 'Internal server error'], 'reload' => false];
    }
    if ($errors) {
        return ['status' => 422, 'body' => ['message' => 'Validation failed', 'errors' => $errors], 'reload' => false];
    }
    try {
        $refs = visualplan_apply($changes);
    } catch (Throwable $error) {
        error_log('Visualplan: save failed (' . get_class($error) . ')');
        return ['status' => 500, 'body' => ['error' => 'Internal server error'], 'reload' => false];
    }
    return ['status' => 200, 'body' => ['refs' => (object) $refs], 'reload' => count($changes) > 0];
}

function visualplan_resolve(string $destination, array $gotos): string
{
    if (!str_starts_with($destination, VISUALPLAN_NEW_PREFIX)) {
        return $destination;
    }
    $ref = substr($destination, strlen(VISUALPLAN_NEW_PREFIX));
    if (!isset($gotos[$ref])) {
        throw new RuntimeException('Unresolved reference ' . $ref);
    }
    return $gotos[$ref];
}

function visualplan_resolve_values(string $type, array $values, array $gotos): array
{
    foreach (VISUALPLAN_TYPES[$type]['destinations'] ?? [] as $field) {
        $values[$field] = visualplan_resolve($values[$field], $gotos);
    }
    if (isset($values['entries']) && in_array($type, ['ivr', 'cqr'], true)) {
        foreach ($values['entries'] as $index => $entry) {
            $values['entries'][$index]['destination'] = visualplan_resolve($entry['destination'], $gotos);
        }
    }
    return $values;
}

// These modules write every exit as a Goto, so an exit without destination hangs up.
function visualplan_goto(string $destination): string
{
    return $destination !== '' ? $destination : VISUALPLAN_HANGUP;
}

function visualplan_created_id($id): int
{
    if (!is_numeric($id) || (int) $id < 1) {
        throw new RuntimeException('The object was not created');
    }
    return (int) $id;
}

/**
 * Run database writes atomically; nested calls join the outer transaction.
 *
 * The legacy $db of the FreePBX modules wraps the same PDO connection. Changes kept
 * outside the database (Asterisk DB, configuration files) are not rolled back.
 */
function visualplan_transaction(callable $callback)
{
    $database = FreePBX::Database();
    if ($database->inTransaction()) {
        return $callback();
    }
    $database->beginTransaction();
    try {
        $result = $callback();
        $database->commit();
        return $result;
    } catch (Throwable $error) {
        if ($database->inTransaction()) {
            $database->rollBack();
        }
        throw $error;
    }
}

/**
 * Write the changes in two passes, so that new objects can point at each other.
 *
 * The first pass creates the objects whose id is assigned by the PBX, without exits;
 * the second writes every object with its references replaced by real destinations.
 * Both run in one transaction; on failure the created objects are also removed, to
 * clean what they left outside the database.
 */
function visualplan_apply(array $changes): array
{
    $keys = [];
    $newIndex = [];
    foreach ($changes as $index => $change) {
        $type = $change['type'];
        $values = $change['values'];
        if ($change['isNew']) {
            $newIndex[$change['ref']] = $index;
        }
        if (!empty(VISUALPLAN_TYPES[$type]['created'])) {
            $keys[$index] = $change['isNew'] ? null : (int) $change['ref'];
        } elseif ($type === 'inboundRoute') {
            $keys[$index] = $values['extension'] . '/' . $values['cidnum'];
        } elseif ($type === 'voicemail') {
            $keys[$index] = $values['extension'];
        } else {
            $keys[$index] = $values['id'];
        }
    }

    $order = array_keys($changes);
    usort($order, fn($a, $b) => ($changes[$b]['type'] === 'timeGroup') <=> ($changes[$a]['type'] === 'timeGroup') ?: $a <=> $b);
    $created = [];
    try {
        return visualplan_transaction(function () use ($changes, $order, $newIndex, &$keys, &$created) {
            foreach ($order as $index) {
                $change = $changes[$index];
                if (!$change['isNew'] || empty(VISUALPLAN_TYPES[$change['type']]['created'])) {
                    continue;
                }
                $values = $change['values'];
                if ($change['type'] === 'timeCondition' && $values['timeGroupRef'] !== null) {
                    $values['timeGroup'] = $keys[$newIndex[$values['timeGroupRef']]];
                }
                $keys[$index] = visualplan_create($change['type'], $values);
                $created[] = [$change['type'], $keys[$index]];
            }

            $gotos = [];
            foreach ($changes as $index => $change) {
                if ($change['isNew'] && isset(VISUALPLAN_TYPES[$change['type']]['goto'])) {
                    $gotos[$change['ref']] = sprintf(VISUALPLAN_TYPES[$change['type']]['goto'], $keys[$index]);
                }
            }

            // The Asterisk DB is not transactional: write it last, after everything that can still fail
            // in the database, and keep what is needed to undo it.
            $refs = [];
            foreach ($changes as $index => $change) {
                $refs[$change['ref']] = (string) $keys[$index];
            }
            $last = array_keys(array_filter($changes, fn($change) => in_array($change['type'], VISUALPLAN_ASTDB_TYPES, true)));
            foreach (array_merge(array_diff(array_keys($changes), $last), $last) as $index) {
                $change = $changes[$index];
                $values = visualplan_resolve_values($change['type'], $change['values'], $gotos);
                if ($change['type'] === 'timeCondition' && $values['timeGroupRef'] !== null) {
                    $values['timeGroup'] = $keys[$newIndex[$values['timeGroupRef']]];
                }
                visualplan_guard_astdb($change, $values, $created);
                visualplan_write($change, $values, $keys[$index]);
            }
            return $refs;
        });
    } catch (Throwable $error) {
        visualplan_rollback($created);
        throw $error;
    }
}

/**
 * First pass: create an object with neutral exits and return its id.
 */
function visualplan_create(string $type, array $values): int
{
    switch ($type) {
        case 'timeGroup':
            return visualplan_created_id(FreePBX::Timeconditions()->addTimeGroup($values['description']));
        case 'ivr':
            return visualplan_created_id(FreePBX::Ivr()->saveDetails(array_merge(VISUALPLAN_IVR_DEFAULTS, [
                'id' => '',
                'name' => $values['name'],
                'description' => $values['description'],
                'announcement' => $values['announcement'],
                'directdial' => $values['directDial'] ? 'ext-local' : '',
            ])));
        case 'cqr':
            return visualplan_created_id(nethcqr_save_details(array_merge(VISUALPLAN_CQR_DEFAULTS, [
                'id_cqr' => '',
                'name' => $values['name'],
                'description' => $values['description'],
                'announcement' => $values['announcement'] ?? '',
            ])));
        case 'announcement':
            return visualplan_created_id(FreePBX::Announcement()->addAnnouncement($values['description'], $values['recording'], 0, '', 0, 0, ''));
        case 'timeCondition':
            return visualplan_created_id(FreePBX::Timeconditions()->addTimeCondition([
                'displayname' => $values['name'], 'time' => $values['timeGroup'] ?? 0, 'timezone' => '',
                'goto0' => 'dest', 'dest0' => '', 'goto1' => 'dest', 'dest1' => '', 'invert_hint' => '0',
                'fcc_password' => '', 'deptname' => '', 'mode' => 'time-group', 'calendar-id' => '',
                'calendar-group' => '',
            ]));
        case 'setCallerId':
            FreePBX::Setcid()->update(null, $values['description'], $values['cidName'], $values['cidNum'], '');
            return visualplan_created_id(FreePBX::Database()->lastInsertId());
        case 'directDid':
            FreePBX::Database()->prepare('INSERT INTO `directdid` (`timeout`,`timeout_destination`,`busy_destination`,`unavailable_destination`,`root`,`prefix`,`varlength`) VALUES (?,?,?,?,?,?,?)')
                ->execute([$values['timeout'], VISUALPLAN_HANGUP, VISUALPLAN_HANGUP, VISUALPLAN_HANGUP, $values['root'], $values['prefix'], $values['varlength']]);
            return visualplan_created_id(FreePBX::Database()->lastInsertId());
        case 'queueExit':
            FreePBX::Database()->prepare('INSERT INTO `queueexit` (`displayname`,`timeout_destination`,`full_destination`,`joinempty_destination`,`leaveempty_destination`,`joinunavail_destination`,`leaveunavail_destination`,`continue_destination`) VALUES (?,?,?,?,?,?,?,?)')
                ->execute(array_merge([$values['name']], array_fill(0, count(VISUALPLAN_QUEUE_EXIT_COLUMNS), VISUALPLAN_HANGUP)));
            return visualplan_created_id(FreePBX::Database()->lastInsertId());
        case 'queueOptions':
            $row = visualplan_queue_options_row([
                'VQ_RETRY' => 0, 'VQ_OPTIONS' => 0, 'VQ_GOSUB' => '', 'VQ_AGI' => '', 'VQ_CONFIRMMSG' => '',
                'VQ_AANNOUNCE' => '', 'VQ_JOINMSG' => '',
            ], array_merge($values, ['failoverDestination' => '', 'destination' => '']), []);
            FreePBX::Database()->prepare('INSERT INTO `queueoptions` (`' . implode('`,`', VISUALPLAN_QUEUE_OPTIONS_COLUMNS) . '`) VALUES (' . implode(',', array_fill(0, count(VISUALPLAN_QUEUE_OPTIONS_COLUMNS), '?')) . ')')
                ->execute($row);
            return visualplan_created_id(FreePBX::Database()->lastInsertId());
        case 'queuePriority':
            return visualplan_created_id(FreePBX::Queueprio()->addPriority($values['description'], $values['priority'], VISUALPLAN_HANGUP));
    }
    throw new UnexpectedValueException('Unknown type ' . $type);
}

/**
 * Read the Asterisk DB entries under a family, or a single key when $key is given.
 */
function visualplan_astdb_read(string $family, ?string $key = null): array
{
    global $astman;
    if ($key !== null) {
        $value = $astman->database_get($family, $key);
        return $value === false ? [] : ['/' . $family . '/' . $key => $value];
    }
    // The cache of the manager may be stale.
    $caching = $astman->useCaching ?? false;
    $astman->useCaching = false;
    try {
        $values = $astman->database_show($family);
    } finally {
        $astman->useCaching = $caching;
    }
    return is_array($values) ? $values : [];
}

/**
 * Put back the entries read by visualplan_astdb_read().
 */
function visualplan_astdb_restore(string $family, ?string $key, array $values): void
{
    global $astman;
    if ($key !== null) {
        $astman->database_del($family, $key);
    } else {
        $astman->database_deltree($family);
    }
    foreach ($values as $path => $value) {
        $path = trim((string) $path, '/');
        $position = strrpos($path, '/');
        $astman->database_put(substr($path, 0, $position), substr($path, $position + 1), $value);
    }
}

/**
 * Before an object writes the Asterisk DB, remember how to undo it if the save fails.
 */
function visualplan_guard_astdb(array $change, array $values, array &$created): void
{
    global $astman;
    if (!in_array($change['type'], VISUALPLAN_ASTDB_TYPES, true) || empty($astman)) {
        return;
    }
    $entries = [];
    switch ($change['type']) {
        case 'queue':
            $entries = [['QPENALTY/' . $values['id'], null]];
            break;
        case 'ringGroup':
            $entries = [['RINGGROUP/' . $values['id'], null]];
            break;
        case 'conference':
            // Renaming a conference does not touch the Asterisk DB.
            $entries = $change['isNew'] ? [['CONFERENCE/' . $values['id'], null]] : [];
            break;
        case 'callFlowControl':
            $entries = [['DAYNIGHT', 'C' . $values['id']], ['CustomDevstate', 'DAYNIGHT' . $values['id']]];
            break;
        case 'voicemail':
            if (!empty(FreePBX::Voicemail()->getMailbox($values['extension'], false))) {
                return;
            }
            $created[] = ['voicemail', $values['extension']];
            $entries = [['AMPUSER', $values['extension'] . '/voicemail']];
            break;
    }
    foreach ($entries as [$family, $key]) {
        // A new object has nothing to keep: its entries are removed.
        $created[] = ['astdb', [$family, $key, $change['isNew'] && $change['type'] !== 'voicemail' ? [] : visualplan_astdb_read($family, $key)]];
    }
}

/**
 * Undo a save that did not complete: remove the objects it created and restore the Asterisk DB.
 */
function visualplan_rollback(array $created): void
{
    foreach (array_reverse($created) as [$type, $id]) {
        try {
            switch ($type) {
                case 'astdb':
                    visualplan_astdb_restore(...$id);
                    break;
                case 'voicemail':
                    FreePBX::Voicemail()->delMailbox($id);
                    break;
                case 'timeGroup':
                    FreePBX::Timeconditions()->delTimeGroup($id);
                    break;
                case 'ivr':
                    FreePBX::Ivr()->delete($id);
                    break;
                case 'cqr':
                    nethcqr_delete($id);
                    break;
                case 'announcement':
                    FreePBX::Announcement()->deleteAnnouncement($id);
                    break;
                case 'timeCondition':
                    FreePBX::Timeconditions()->delTimeCondition($id);
                    break;
                case 'setCallerId':
                    FreePBX::Setcid()->delete($id);
                    break;
                case 'directDid':
                case 'queueExit':
                case 'queueOptions':
                    $table = ['directDid' => 'directdid', 'queueExit' => 'queueexit', 'queueOptions' => 'queueoptions'][$type];
                    FreePBX::Database()->prepare('DELETE FROM `' . $table . '` WHERE `id` = ?')->execute([$id]);
                    break;
                case 'queuePriority':
                    FreePBX::Queueprio()->delPriority($id);
                    break;
            }
        } catch (Throwable $error) {
            error_log('Visualplan: cannot undo ' . $type . ' (' . get_class($error) . ')');
        }
    }
}

/**
 * Second pass: write one object with its final values.
 */
function visualplan_write(array $change, array $values, $key): void
{
    switch ($change['type']) {
        case 'inboundRoute':
            visualplan_write_inbound_route($change, $values);
            return;
        case 'voicemail':
            visualplan_write_voicemail($values['extension']);
            return;
        case 'conference':
            visualplan_write_conference($change['isNew'], $values);
            return;
        case 'ringGroup':
            visualplan_write_ring_group($change['isNew'], $values);
            return;
        case 'queue':
            visualplan_write_queue($change['isNew'], $values);
            return;
        case 'callFlowControl':
            visualplan_write_call_flow_control($change['isNew'], $values);
            return;
    }
    $writer = 'visualplan_update_' . strtolower(preg_replace('/[A-Z]/', '_$0', $change['type']));
    $writer((int) $key, $values);
}

function visualplan_write_inbound_route(array $change, array $values): void
{
    $core = FreePBX::Core();
    $fields = [
        'description' => $values['description'],
        'alertinfo' => $values['alertinfo'],
        'grppre' => $values['grppre'],
        'destination' => $values['destination'],
    ];
    if ($change['isNew']) {
        $settings = array_merge([
            'extension' => $values['extension'],
            'cidnum' => $values['cidnum'],
            'mohclass' => 'default',
            'ringing' => 'CHECKED',
            'fanswer' => 'CHECKED',
        ], $fields);
        if ($core->addDID($settings) !== true) {
            throw new RuntimeException('Inbound route not created');
        }
        return;
    }
    [$extension, $cidnum] = visualplan_split_route_key($change['ref']);
    if ($extension === $values['extension'] && $cidnum === $values['cidnum']) {
        $core->editDIDProperties(array_merge(['extension' => $extension, 'cidnum' => $cidnum], $fields));
        return;
    }
    $route = visualplan_named_columns($core->getDID($extension, $cidnum));
    if (!$route) {
        throw new RuntimeException('Inbound route not found');
    }
    $route = array_merge($route, ['extension' => $values['extension'], 'cidnum' => $values['cidnum']], $fields);
    visualplan_transaction(function () use ($core, $extension, $cidnum, $route) {
        if ($core->editDID($extension, $cidnum, $route) !== true) {
            throw new RuntimeException('Inbound route not renamed');
        }
        visualplan_move_route_settings([$extension, $cidnum], [$route['extension'], $route['cidnum']]);
        visualplan_move_layout($extension . '/' . $cidnum, $route['extension'] . '/' . $route['cidnum']);
    });
}

/**
 * Move to the new route key the settings other modules store for an inbound route.
 *
 * Their pages save them from the route form, while Core::editDID() leaves them on the old key.
 */
function visualplan_move_route_settings(array $from, array $to): void
{
    $database = FreePBX::Database();
    foreach (VISUALPLAN_ROUTE_SETTINGS as $sql) {
        try {
            $database->prepare($sql)->execute(array_merge($to, $from));
        } catch (PDOException $error) {
            // The module that owns the table is not installed.
            if (($error->errorInfo[1] ?? null) !== 1146) {
                throw $error;
            }
        }
    }
}

function visualplan_write_voicemail(string $extension): void
{
    $voicemail = FreePBX::Voicemail();
    if (!empty($voicemail->getMailbox($extension, false))) {
        return;
    }
    $user = FreePBX::Core()->getUser($extension);
    $owner = FreePBX::Userman()->getUserByDefaultExtension($extension);
    $voicemail->processQuickCreate('pjsip', $extension, [
        'vm' => 'yes',
        'name' => is_array($user) && isset($user['name']) ? $user['name'] : $extension,
        'vmpwd' => sprintf('%04d', random_int(0, 9999)),
        'email' => is_array($owner) && isset($owner['email']) ? $owner['email'] : '',
    ]);
}

function visualplan_write_conference(bool $isNew, array $values): void
{
    $conferences = FreePBX::Conferences();
    if ($isNew) {
        $conferences->addConference($values['id'], $values['name'], '', '', '');
    } else {
        $conferences->updateConferenceSettingById($values['id'], 'description', $values['name']);
    }
}

function visualplan_write_ring_group(bool $isNew, array $values): void
{
    $groups = FreePBX::Ringgroups();
    $list = implode('-', $values['members']);
    if ($isNew) {
        $saved = $groups->add($values['id'], $values['strategy'], $values['ringTime'], $list, $values['destination'],
            $values['description'], '', '', '', '', '', '', 'Ring', '', '', 'default', '', 'CHECKED', 'dontcare', 'no',
            'yes', '', 1);
    } else {
        // get() fails without the Asterisk manager, before anything is deleted.
        $group = $groups->get($values['id']);
        if (!is_array($group) || !$group) {
            throw new RuntimeException('Ring group not found');
        }
        $saved = visualplan_transaction(function () use ($groups, $values, $list, $group) {
            $groups->delete($values['id']);
            return $groups->add($values['id'], $values['strategy'], $values['ringTime'], $list, $values['destination'],
                $values['description'], $group['grppre'] ?? '', $group['annmsg_id'] ?? '', $group['alertinfo'] ?? '',
                $group['needsconf'] ?? '', $group['remotealert_id'] ?? '', $group['toolate_id'] ?? '',
                $group['ringing'] ?? '', $group['cwignore'] ?? '', $group['cfignore'] ?? '',
                $group['changecid'] ?? 'default', $group['fixedcid'] ?? '', $group['cpickup'] ?? '',
                $group['recording'] ?? 'dontcare', $group['progress'] ?? '', $group['elsewhere'] ?? '',
                $group['rvolume'] ?? '', 1);
        });
    }
    if ($saved !== true) {
        throw new RuntimeException('Ring group not saved');
    }
}

/**
 * Run a function of a FreePBX module that reads its form from $_REQUEST.
 */
function visualplan_with_request(array $request, callable $callback)
{
    $saved = $_REQUEST;
    $_REQUEST = $request;
    try {
        return $callback();
    } finally {
        $_REQUEST = $saved;
    }
}

function visualplan_write_queue(bool $isNew, array $values): void
{
    $number = $values['id'];
    $current = [];
    if (!$isNew) {
        $current = queues_get($number);
        if (!is_array($current) || !$current) {
            throw new RuntimeException('Queue not found');
        }
    }
    $queue = array_merge(VISUALPLAN_QUEUE_DEFAULTS, $isNew ? ['answered_elsewhere' => '1'] : [], $current);

    $interfaces = [];
    foreach ((array) $queue['member'] as $member) {
        [$interface] = visualplan_split_member($member);
        $interfaces[visualplan_member_extension($interface)] = $interface;
    }
    $members = [];
    foreach ($values['staticMembers'] as $member) {
        $interface = $interfaces[$member['extension']] ?? 'Local/' . $member['extension'] . '@from-queue/n';
        $members[] = $interface . ',' . $member['penalty'];
    }
    $penalties = visualplan_dynamic_members($queue['dynmembers']);
    $dynamic = [];
    foreach ($values['dynamicMembers'] as $extension) {
        $penalty = $penalties[$extension] ?? '';
        $dynamic[] = $extension . ',' . ($penalty !== '' ? $penalty : '0');
    }

    $rtone = '0';
    if ($values['ringing'] === 'ring') {
        $rtone = (int) $queue['rtone'] !== 0 ? (string) $queue['rtone'] : '1';
    }
    $callback = visualplan_string($queue['callback']);
    $keepCallback = $values['breakoutIvr'] === null && $callback !== '' && $callback !== 'none';
    $request = [
        'action' => $isNew ? 'add' : 'edit',
        'maxlen' => $queue['maxlen'],
        'joinempty' => $queue['joinempty'],
        'leavewhenempty' => $queue['leavewhenempty'],
        'strategy' => $values['strategy'],
        'timeout' => (string) $values['agentTimeout'],
        'autopause' => $queue['autopause'],
        'retry' => $queue['retry'],
        'wrapuptime' => $queue['wrapuptime'],
        'announcefreq' => (string) $values['announceFrequency'],
        'min-announce' => $queue['min-announce-frequency'],
        'announceholdtime' => $queue['announce-holdtime'],
        'announceposition' => $values['positionAnnouncement'] ? 'yes' : 'no',
        'pannouncefreq' => $queue['periodic-announce-frequency'],
        'eventwhencalled' => $queue['eventwhencalled'],
        'eventmemberstatus' => $queue['eventmemberstatus'],
        'music' => $values['musicOnHold'],
        'weight' => $queue['weight'],
        'autofill' => $queue['autofill'] === 'yes' ? 'yes' : '',
        'reportholdtime' => $queue['reportholdtime'],
        'servicelevel' => $queue['servicelevel'],
        'memberdelay' => $queue['memberdelay'],
        'timeoutrestart' => $queue['timeoutrestart'],
        'recording' => $queue['recording'],
        'rvolume' => $queue['rvolume'],
        'rvol_mode' => $queue['rvol_mode'],
        'rtone' => $rtone,
        'skip_joinannounce' => $queue['skip_joinannounce'],
        'answered_elsewhere' => $queue['answered_elsewhere'],
        'timeoutpriority' => $queue['timeoutpriority'],
        'autopausebusy' => $queue['autopausebusy'],
        'autopauseunavail' => $queue['autopauseunavail'],
        'autopausedelay' => $queue['autopausedelay'],
        'penaltymemberslimit' => $queue['penaltymemberslimit'],
        'announcemenu' => $values['breakoutIvr'] === null ? 'none' : (string) $values['breakoutIvr'],
        'breakouttype' => $keepCallback ? 'callback' : 'ivr',
        'callback' => $keepCallback ? $callback : 'none',
    ];
    foreach (['cron_schedule', 'cron_random', 'cron_month', 'cron_minute', 'cron_hour', 'cron_dow', 'cron_dom'] as $key) {
        if (isset($queue[$key])) {
            $request[$key] = $queue[$key];
        }
    }
    // Without the Asterisk manager the queues module exits halfway through.
    global $astman;
    if (empty($astman)) {
        throw new RuntimeException('Asterisk manager not available');
    }
    $request['account'] = $number;
    visualplan_with_request($request, fn() => visualplan_transaction(function () use ($isNew, $number, $values, $queue, $members, $dynamic) {
        if (!$isNew) {
            queues_del($number);
        }
        $saved = queues_add($number, $values['name'], $queue['password'], $values['cidPrefix'], $values['destination'],
            $queue['agentannounce_id'], $members, $values['joinAnnouncement'],
            $values['maxWait'] > 0 ? (string) $values['maxWait'] : '', $queue['alertinfo'], $queue['cwignore'],
            $queue['qregex'], $queue['queuewait'], $queue['use_queue_context'], $dynamic,
            visualplan_string($queue['dynmemberonly']) !== '' ? $queue['dynmemberonly'] : 'no', $queue['togglehint'],
            $queue['qnoanswer'], $queue['callconfirm'], $queue['callconfirm_id'], $queue['monitor_type'],
            $queue['monitor_heard'], $queue['monitor_spoken'], $queue['answered_elsewhere'], $queue['recording'],
            $queue['rvolume'], $queue['rvol_mode']);
        if ($saved !== true) {
            throw new RuntimeException('Queue not saved');
        }
        if (!$isNew) {
            // As the Queues page does through Queue Options: queues_add() does not write this field,
            // and the agents removed from a restricted queue are logged out.
            $options = FreePBX::Queueoptions();
            $options->setLazyMembers($number, $queue['lazymembers'] === 'yes');
            $options->logoutUnlistedDynamicMembers($number);
        }
    }));
}

function visualplan_write_call_flow_control(bool $isNew, array $values): void
{
    $current = $isNew ? [] : daynight_get_obj($values['id']);
    if (!is_array($current)) {
        throw new RuntimeException('Call flow control not found');
    }
    // The state of an existing control is toggled from the phones and never taken from the request.
    $state = $isNew ? $values['state'] : (($current['state'] ?? '') === 'NIGHT' ? 'NIGHT' : 'DAY');
    FreePBX::Daynight()->edit([
        'action' => $isNew ? 'add' : 'edit',
        'goto0' => 'dest',
        'dest0' => $values['normalDestination'],
        'goto1' => 'dest',
        'dest1' => $values['overrideDestination'],
        'fc_description' => $values['name'],
        'state' => $state,
        'password' => $current['password'] ?? '',
        'day_recording_id' => $current['day_recording_id'] ?? '',
        'night_recording_id' => $current['night_recording_id'] ?? '',
    ], $values['id']);
}

function visualplan_update_ivr(int $id, array $values): void
{
    $ivr = FreePBX::Ivr();
    $row = visualplan_named_columns($ivr->getDetails($id));
    if (!$row) {
        throw new RuntimeException('IVR not found');
    }
    $directDial = trim(visualplan_string($row['directdial'] ?? ''));
    $ivr->saveDetails(array_merge($row, [
        'id' => $id,
        'name' => $values['name'],
        'description' => $values['description'],
        'announcement' => $values['announcement'],
        'directdial' => $values['directDial'] ? ($directDial !== '' ? $directDial : 'ext-local') : '',
        'invalid_destination' => $values['invalidDestination'],
        'timeout_destination' => $values['timeoutDestination'],
    ]));
    $returns = [];
    foreach (visualplan_rows(ivr_get_entries($id)) as $entry) {
        $returns[visualplan_string($entry['selection'] ?? '')] = (int) ($entry['ivr_ret'] ?? 0);
    }
    $entries = ['ext' => [], 'goto' => [], 'ivr_ret' => []];
    foreach ($values['entries'] as $entry) {
        $entries['ext'][] = $entry['selection'];
        $entries['goto'][] = $entry['destination'];
        $entries['ivr_ret'][] = $returns[$entry['selection']] ?? 0;
    }
    $ivr->saveEntries($id, $entries);
}

function visualplan_update_cqr(int $id, array $values): void
{
    $rows = nethcqr_get_details($id);
    $row = is_array($rows) && isset($rows[0]) && is_array($rows[0]) ? $rows[0] : null;
    if ($row === null) {
        throw new RuntimeException('CQR not found');
    }
    $details = ['id_cqr' => $id];
    foreach (array_keys(VISUALPLAN_CQR_DEFAULTS) as $field) {
        $details[$field] = $row[$field] ?? '';
    }
    foreach (['use_code', 'use_workphone', 'manual_code'] as $field) {
        $details[$field] = (int) $details[$field] === 1 ? 'on' : '';
    }
    nethcqr_save_details(array_merge($details, [
        'name' => $values['name'],
        'description' => $values['description'],
        'announcement' => $values['announcement'] ?? '',
        'default_destination' => $values['defaultDestination'],
    ]));
    $entries = ['position' => [], 'condition' => [], 'goto' => []];
    foreach ($values['entries'] as $index => $entry) {
        $entries['position'][] = $index + 1;
        $entries['condition'][] = $entry['condition'];
        $entries['goto'][] = $entry['destination'];
    }
    nethcqr_save_entries($id, $entries);
}

function visualplan_update_announcement(int $id, array $values): void
{
    $announcement = FreePBX::Announcement();
    $row = $announcement->getAnnouncementByID($id);
    if (!is_array($row) || !$row) {
        throw new RuntimeException('Announcement not found');
    }
    $announcement->editAnnouncement($id, $values['description'], $values['recording'], $row['allow_skip'] ?? 0,
        $values['destination'], $row['return_ivr'] ?? 0, $row['noanswer'] ?? 0, $row['repeat_msg'] ?? '');
}

function visualplan_update_time_condition(int $id, array $values): void
{
    $conditions = FreePBX::Timeconditions();
    $row = $conditions->getTimeCondition($id);
    if (!is_array($row) || !isset($row['timeconditions_id'])) {
        throw new RuntimeException('Time condition not found');
    }
    $post = [
        'displayname' => $values['name'],
        'time' => $values['timeGroup'] ?? 0,
        'timezone' => visualplan_string($row['timezone'] ?? ''),
        'goto0' => 'dest',
        'dest0' => $values['trueDestination'],
        'goto1' => 'dest',
        'dest1' => $values['falseDestination'],
        'invert_hint' => (string) (int) ($row['invert_hint'] ?? 0),
        'fcc_password' => visualplan_string($row['fcc_password'] ?? ''),
        'deptname' => visualplan_string($row['deptname'] ?? ''),
        'mode' => visualplan_string($row['mode'] ?? '') !== '' ? $row['mode'] : 'time-group',
        'calendar-id' => visualplan_string($row['calendar_id'] ?? ''),
        'calendar-group' => visualplan_string($row['calendar_group_id'] ?? ''),
        'tcstate_new' => 'unchanged',
    ];
    // The Call Flow Control hook drops the association unless it is posted again.
    if (function_exists('daynight_get_timecondition')) {
        $association = daynight_get_timecondition($id);
        if (is_array($association) && visualplan_string($association['ext'] ?? '') !== '') {
            $post['daynight_ref'] = $association['ext'] . ',' . $association['dmode'];
        }
    }
    $conditions->editTimeCondition($id, $post);
}

function visualplan_update_time_group(int $id, array $values): void
{
    FreePBX::Timeconditions()->editTimeGroup($id, $values['description']);
    $database = FreePBX::Database();
    $database->prepare('DELETE FROM `timegroups_details` WHERE `timegroupid` = ?')->execute([$id]);
    $insert = $database->prepare('INSERT INTO `timegroups_details` (`timegroupid`, `time`) VALUES (?, ?)');
    foreach ($values['times'] as $time) {
        $insert->execute([$id, $time]);
    }
}

function visualplan_update_set_caller_id(int $id, array $values): void
{
    FreePBX::Setcid()->update($id, $values['description'], $values['cidName'], $values['cidNum'], $values['destination']);
}

function visualplan_update_direct_did(int $id, array $values): void
{
    FreePBX::Database()->prepare('REPLACE INTO `directdid` (`id`,`timeout`,`timeout_destination`,`busy_destination`,`unavailable_destination`,`root`,`prefix`,`varlength`) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$id, $values['timeout'], visualplan_goto($values['timeoutDestination']),
            visualplan_goto($values['busyDestination']), visualplan_goto($values['unavailableDestination']),
            $values['root'], $values['prefix'], $values['varlength']]);
}

function visualplan_update_queue_exit(int $id, array $values): void
{
    $row = [$id, $values['name']];
    foreach (array_keys(VISUALPLAN_QUEUE_EXIT_COLUMNS) as $field) {
        $row[] = visualplan_goto($values[$field]);
    }
    FreePBX::Database()->prepare('REPLACE INTO `queueexit` (`id`,`displayname`,`' . implode('`,`', VISUALPLAN_QUEUE_EXIT_COLUMNS) . '`) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute($row);
}

/**
 * Build the Queue Options columns from the current row and the new values.
 */
function visualplan_queue_options_row(array $current, array $values, array $files): array
{
    $message = visualplan_string($current['VQ_JOINMSG'] ?? '');
    if ($values['joinAnnouncement'] !== null) {
        $message = (string) array_search($values['joinAnnouncement'], $files, true);
    } elseif ($message === '' || isset($files[$message])) {
        // A message that is not a system recording cannot be shown, so it is kept.
        $message = '';
    }
    $columns = array_merge($current, [
        'name' => $values['name'],
        'VQ_CIDPP' => $values['cidPrefix'],
        'VQ_AINFO' => $values['alertInfo'],
        'VQ_JOINMSG' => $message,
        'VQ_MOH' => $values['musicOnHold'],
        'VQ_POSITION_ENABLED' => (int) $values['positionEnabled'],
        'VQ_POSITION' => $values['position'],
        'VQ_MAXWAIT_ENABLED' => (int) $values['maxWaitEnabled'],
        'VQ_MAXWAIT' => $values['maxWait'],
        'VQ_DEST_ENABLED' => (int) $values['failoverEnabled'],
        'VQ_DEST' => visualplan_goto($values['failoverDestination']),
        'DEST' => visualplan_goto($values['destination']),
    ]);
    $row = [];
    foreach (VISUALPLAN_QUEUE_OPTIONS_COLUMNS as $column) {
        $row[] = in_array($column, ['VQ_RETRY', 'VQ_OPTIONS'], true) ? (int) ($columns[$column] ?? 0) : ($columns[$column] ?? '');
    }
    return $row;
}

function visualplan_update_queue_options(int $id, array $values): void
{
    $current = visualplan_named_columns(FreePBX::Queueoptions()->queueoptions_get($id));
    if (!$current) {
        throw new RuntimeException('Queue options not found');
    }
    $files = $values['joinAnnouncement'] !== null || visualplan_string($current['VQ_JOINMSG'] ?? '') !== ''
        ? visualplan_recording_files() : [];
    $row = visualplan_queue_options_row($current, $values, $files);
    FreePBX::Database()->prepare('REPLACE INTO `queueoptions` (`id`,`' . implode('`,`', VISUALPLAN_QUEUE_OPTIONS_COLUMNS) . '`) VALUES (' . implode(',', array_fill(0, count(VISUALPLAN_QUEUE_OPTIONS_COLUMNS) + 1, '?')) . ')')
        ->execute(array_merge([$id], $row));
}

function visualplan_update_queue_priority(int $id, array $values): void
{
    if (FreePBX::Queueprio()->updatePriority($id, $values['description'], $values['priority'], $values['destination']) !== true) {
        throw new RuntimeException('Queue priority not saved');
    }
}

function visualplan_sound_language(): string
{
    try {
        $language = visualplan_string(FreePBX::Soundlang()->getLanguage());
    } catch (Throwable $error) {
        $language = '';
    }
    return preg_match('/^[a-z]{2}(_[A-Z]{2})?$/', $language) ? $language : 'en';
}

function visualplan_audio_matches(string $path, string $extension): bool
{
    $header = (string) @file_get_contents($path, false, null, 0, 12);
    if ($extension === 'wav') {
        return strlen($header) === 12 && substr($header, 0, 4) === 'RIFF' && substr($header, 8, 4) === 'WAVE';
    }
    return str_starts_with($header, 'ID3') || (strlen($header) >= 2 && ord($header[0]) === 0xFF && (ord($header[1]) & 0xE0) === 0xE0);
}

/**
 * Store an uploaded wav or mp3 file as a new system recording.
 *
 * $file is the PSR-7 uploaded file of the request, or null when missing.
 */
function visualplan_upload_recording($file, $name): array
{
    $errors = [];
    $name = is_string($name) ? trim($name) : '';
    $displayName = (string) filter_var($name, FILTER_SANITIZE_FULL_SPECIAL_CHARS);
    if ($name === '') {
        $errors[] = visualplan_request_error('', '', 'name', 'required');
    } elseif (visualplan_length($displayName) > 50) {
        $errors[] = visualplan_request_error('', '', 'name', 'invalid');
    }
    $extension = '';
    if (!is_object($file) || $file->getError() === UPLOAD_ERR_NO_FILE) {
        $errors[] = visualplan_request_error('', '', 'file', 'required');
    } else {
        $extension = strtolower(pathinfo(visualplan_string($file->getClientFilename()), PATHINFO_EXTENSION));
        if ($file->getError() !== UPLOAD_ERR_OK || (int) $file->getSize() < 1
            || (int) $file->getSize() > VISUALPLAN_RECORDING_MAX_BYTES
            || !in_array($extension, VISUALPLAN_RECORDING_FORMATS, true)) {
            $errors[] = visualplan_request_error('', '', 'file', 'invalid');
        }
    }
    if ($errors) {
        return ['status' => 422, 'body' => ['message' => 'Validation failed', 'errors' => $errors]];
    }

    $invalidFile = ['status' => 422, 'body' => ['message' => 'Validation failed', 'errors' => [
        visualplan_request_error('', '', 'file', 'invalid'),
    ]]];
    $temporary = '';
    try {
        $spool = visualplan_string(FreePBX::Config()->get('ASTSPOOLDIR'));
        $directory = ($spool !== '' ? $spool : '/var/spool/asterisk') . '/tmp';
        $base = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', $name), '-_');
        $base = substr($base !== '' ? $base : 'recording', 0, 40) . '-' . time() . random_int(100, 999);
        $temporary = $base . '.' . $extension;
        $file->moveTo($directory . '/' . $temporary);
        if (!visualplan_audio_matches($directory . '/' . $temporary, $extension)) {
            return $invalidFile;
        }
        $language = visualplan_sound_language();
        $recordings = FreePBX::Recordings();
        $converted = $recordings->convertFiles([
            'file' => $temporary,
            'name' => 'custom/' . $base,
            'codec' => 'wav',
            'lang' => $language,
            'temporary' => 1,
        ]);
        if (!is_array($converted) || empty($converted['status']) || visualplan_string($converted['name'] ?? '') === '') {
            error_log('Visualplan: cannot convert recording');
            return $invalidFile;
        }
        $id = visualplan_created_id($recordings->addRecording($displayName, '', $converted['name'], 0, '', $language));
    } catch (Throwable $error) {
        error_log('Visualplan: recording upload failed (' . get_class($error) . ')');
        return ['status' => 500, 'body' => ['error' => 'Internal server error']];
    } finally {
        if ($temporary !== '' && isset($directory) && is_file($directory . '/' . $temporary)) {
            @unlink($directory . '/' . $temporary);
        }
    }
    return ['status' => 200, 'body' => ['id' => $id, 'name' => $name, 'description' => '']];
}
