#!/bin/env bash

#
# Copyright (C) 2018 Nethesis S.r.l.
# http://www.nethesis.it - support@nethesis.it
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
# along with NethServer.  If not, see <http://www.gnu.org/licenses/>.
#

# migrate queue_log
/usr/bin/mysqldump --no-create-info --insert-ignore asteriskcdrdb11 queue_log | /usr/bin/mysql asteriskcdrdb
# migrate queue_log_history
/usr/bin/mysqldump --insert-ignore asteriskcdrdb11 queue_log_history | /usr/bin/mysql asteriskcdrdb
# migrate voicemessages
/usr/bin/mysqldump --no-create-info --insert-ignore asteriskcdrdb11 voicemessages | /usr/bin/mysql asteriskcdrdb
# migrate CTI phonebook
/usr/bin/mysql --defaults-file=/root/.my.cnf -N -B -e 'INSERT INTO nethcti3.cti_phonebook (SELECT * FROM nethcti2.cti_phonebook)'

