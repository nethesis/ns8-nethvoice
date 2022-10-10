<?php
#
# Copyright (C) 2017 Nethesis S.r.l.
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

use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

require_once(__DIR__. '/../lib/SystemTasks.php');

# get the status of a running task

$app->get('/tasks/{task}', function (Request $request, Response $response, $args) {
    $taskId = $request->getAttribute('task');
    $ret = [ "task" => $taskId ];
    $code = 200;
    $st = new SystemTasks();
    $task = $st->getTaskStatus($taskId);
    $ret['action'] = $task['last']['title'];
    $ret['progress'] = ceil($task['progress'] * 100);

    # task has reached di end, set progress to 100
    if (isset($task['task_command_line'])) {
        $ret['progress'] = 100;

        # return server error if task has failed
        if ($task['exit_code'] > 0) {
            $code = 500;
        }
    }

    return $response->withJson($ret, $code);
});

