#!/bin/bash

SOCKET_PATH="/run/rce/command.sock"

# Send the command received as argument to the server
IO_SOCKET_PATH=$(echo "$0 $@" | socat - UNIX-CONNECT:"$SOCKET_PATH")
echo "received socket path: ${IO_SOCKET_PATH}"
trap "rm -f $IO_SOCKET_PATH" EXIT

# connect IO to the new socket
socat UNIX-CONNECT:"$IO_SOCKET_PATH" STDIO

