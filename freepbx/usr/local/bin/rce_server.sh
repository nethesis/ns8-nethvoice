#!/bin/bash

COMMAND_SOCKET_PATH="/run/rce/command.sock"

# Clean up
trap "rm -f $COMMAND_SOCKET_PATH" EXIT

# launch a worker for each command received from the socket.
# the worker will send back the IO socket path to the client.
socat -d -d UNIX-LISTEN:"$COMMAND_SOCKET_PATH",fork,user=asterisk,group=asterisk SYSTEM:"/usr/local/bin/rce_worker.sh"