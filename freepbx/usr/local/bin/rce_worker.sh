#!/bin/bash

# read the command to launch from stdin
read COMMAND

# create a socket path for the io
IO_SOCKET_PATH="/run/rce/io_$$.sock"

# launch command received from arguments with io on the socket
socat -d -d UNIX-LISTEN:"$IO_SOCKET_PATH" EXEC:"$COMMAND",pty &

# command ready to be launched and waiting for connection. Send the socket path to the client.
echo $IO_SOCKET_PATH

