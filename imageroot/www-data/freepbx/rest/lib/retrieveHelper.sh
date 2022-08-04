#!/bin/bash

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

LOCKDIR=/var/run/nethvoice/retrieve-lock
LOCKDIR2=/var/run/nethvoice/retrieve-lock-2
LOCKFILE=$LOCKDIR/pidfile
LOCKFILE2=$LOCKDIR2/pidfile

if mkdir $LOCKDIR 2>/dev/null; then
    # store the current process ID in there so we can check for staleness later
    echo "$$" >"${LOCKFILE}"
    # and clean up locks and tempfile if the script exits or is killed  
    trap "{ rm -f $LOCKFILE; rmdir $LOCKDIR 2>/dev/null; exit 255; }" INT TERM EXIT
else
    # lock failed, check if process exists.  First, if there's no PID file
    # in the lock directory, something bad has happened, we can't know the
    # process name, so clean up the old lockdir and restart
    if [ ! -f $LOCKFILE ]; then
        rmdir $LOCKDIR 2>/dev/null
        echo "retrieveHelper.sh: no lock PID, clearing and restarting myself" >&2
        exec $0 "$@"
    fi
    OTHERPID="$(cat "${LOCKFILE}")"
    # if cat wasn't able to read the file anymore, another instance probably is
    # about to remove the lock -- exit, we're *still* locked
    if [ $? != 0 ]; then
        echo "retrieveHelper.sh: lock failed, PID ${OTHERPID} is active" >&2
        #Create another file that means that another retrieve needs to be launched
        mkdir $LOCKDIR2 2>/dev/null
        touch $LOCKFILE2 2>/dev/null
        exit 0
    fi
    if ! kill -0 $OTHERPID &>/dev/null; then
        # lock is stale, remove it and restart
        echo "retrieveHelper.sh: removing stale lock of nonexistant PID ${OTHERPID}" >&2
        rm -rf "${LOCKDIR}"
        echo "retrieveHelper.sh: restarting myself" >&2
        exec $0 "$@"
    else
        # Remove stale (more than two hours old) lockfiles
        find $LOCKDIR -type f -name 'pidfile' -amin +120 -exec rm -rf $LOCKDIR \;
        # if it's still there, it wasn't too old, bail
        if [ -f $LOCKFILE ]; then
            # lock is valid and OTHERPID is active - exit, we're locked!
            echo "retrieveHelper.sh: lock failed, PID ${OTHERPID} is active" >&2
            #Create another file that means that another retrieve needs to be launched
            mkdir $LOCKDIR2 2>/dev/null
            touch $LOCKFILE2 2>/dev/null
            exit 0
        else
            # lock was invalid, restart
	    echo "retrieveHelper.sh: removing stale lock belonging to stale PID ${OTHERPID}" >&2
            echo "retrieveHelper.sh: restarting myself" >&2
            exec $0 "$@"
        fi
    fi
fi

trap "{ rm -f $LOCKFILE; rmdir $LOCKDIR 2>/dev/null; rm -f $LOCKFILE2; rmdir $LOCKDIR2 2>/dev/null;}" INT TERM EXIT
/usr/bin/scl enable rh-php56 '/var/lib/asterisk/bin/fwconsole r' | /usr/bin/logger -t FreePBX
sleep 10
while [[ -f $LOCKFILE2 ]]; do
    rm -f $LOCKFILE2
    rmdir $LOCKDIR2 2>/dev/null
    /usr/bin/scl enable rh-php56 '/var/lib/asterisk/bin/fwconsole r' | /usr/bin/logger -t FreePBX
    sleep 10
done
