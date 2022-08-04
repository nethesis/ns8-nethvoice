<?php

/*
 * Copyright (C) 2014  Nethesis S.r.l.
 *
 * This script is part of NethServer.
 *
 * NethServer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NethServer is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with NethServer.  If not, see <http://www.gnu.org/licenses/>.
 */

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class SystemTasks
{
    const PTRACK_PATH_TEMPLATE = '/run/nethvoice/%s.sock';
    const PTRACK_DUMP_PATH = '/run/nethvoice/%.16s.dump';
    const TY_DECLARE = 0x01;
    const TY_DONE = 0x02;
    const TY_QUERY = 0x03;
    const TY_PROGRESS = 0x04;
    const TY_ERROR = 0x40;
    const TY_RESPONSE = 0x80;


    private $tasks = array();


    public function startTask($command)
    {
        $taskId = md5(uniqid());
        $socketPath = sprintf(self::PTRACK_PATH_TEMPLATE, $taskId);
        $dumpPath = sprintf(self::PTRACK_DUMP_PATH, md5($socketPath));
        $cmd = strtr('/usr/libexec/nethserver/ptrack -D -s %socketPath -d %dumpPath -v -- ', array(
                '%dumpPath' => \escapeshellarg($dumpPath),
                '%socketPath' => \escapeshellarg($socketPath)
            )) . $command;
        $process = new Process($cmd);
        $process->taskId = $taskId;
        $process->run();
        return $taskId;
    }


    /**
     *
     * @param string $taskId
     * @return array
     * @throws \RuntimeException
     */
    public function getTaskStatus($taskId)
    {
        if ( ! isset($this->tasks[$taskId])) {
            $this->tasks[$taskId] = $this->fetchTaskStatus($taskId);
        }
        return $this->tasks[$taskId];
    }

    private function fetchTaskStatus($taskId)
    {
        $socketPath = sprintf(self::PTRACK_PATH_TEMPLATE, $taskId);
        $dumpPath = sprintf(self::PTRACK_DUMP_PATH, md5($socketPath));

        $taskStatus = FALSE;
        $errno = 0;
        $errstr = "";

        $socket = @fsockopen('unix://' . $socketPath, -1, $errno, $errstr);

        if ($socket === FALSE) {
            $socketPathExists = $errno != 2;
            $taskStatus = $this->fetchDumpFile($dumpPath);
        } else {
            $this->sendMessage($socket, self::TY_QUERY);
            $taskStatus = $this->recvMessage($socket);
            fclose($socket);
        }

        return $taskStatus;
    }

    private function fetchDumpFile($dumpPath)
    {
        if ( ! file_exists($dumpPath)) {
            return NULL;
        }

        $tmp = json_decode(file_get_contents($dumpPath), TRUE);
        if ( ! is_array($tmp)) {
            return NULL;
        }

        return $tmp;
    }

    private function sendMessage($socket, $type, $args = array())
    {
        $payload = json_encode($args);
        $data = pack('Cn', (int) $type, strlen($payload)) . $payload;
        $written = fwrite($socket, $data);
        if ($written !== strlen($data)) {
            throw new \RuntimeException(sprintf('%s: Socket write error', __CLASS__), 1405610071);
        }
    }

    private function recvMessage($socket)
    {
        $buf = $this->safeRead($socket, 3);
        if ($buf === FALSE) {
            throw new \RuntimeException(sprintf('%s: Socket read error', __CLASS__), 1405610072);
        }

        $header = unpack('Ctype/nsize', $buf);
        if ( ! is_array($header)) {
            throw new \RuntimeException(sprintf('%s: Socket read error', __CLASS__), 1405610073);
        }

        $message = NULL;
        if ($header['type'] & self::TY_RESPONSE) {
            $message = $this->safeRead($socket, $header['size']);
            if ($message === FALSE) {
                throw new \RuntimeException(sprintf('%s: Socket read error', __CLASS__), 1405610074);
            }
        }
        return json_decode($message, TRUE);
    }

    private function safeRead($socket, $size)
    {
        $buffer = "";
        $count = 0;
        while ($count < $size) {
            if (feof($socket)) {
                return FALSE;
            }
            $chunk = fread($socket, $size - $count);
            $count += strlen($chunk);
            if ($chunk === FALSE) {
                return FALSE;
            }
            $buffer .= $chunk;
        }
        return $buffer;
    }

}
