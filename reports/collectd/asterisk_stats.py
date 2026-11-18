#
# Copyright (C) 2020 Nethesis S.r.l.
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

import collectd
import re
import subprocess
import locale

def log_debug(msg):
    global CONFIG
    if CONFIG['Debug'].lower() == 'true':
        collectd.info('asterisk plugin: %s' % msg)

# configure callback is called at startup
def configure_callback(conf):
    global CONFIG
    for node in conf.children:
        CONFIG[node.key] = node.values[0]

    # make sure Popen output is UTF-8
    locale.setlocale(locale.LC_ALL, "en_US.UTF-8")

    # set custom interval
    log_debug('Setting interval %d' % int(CONFIG['Interval']))
    collectd.register_read(read_callback, int(CONFIG['Interval']))
    

def parse_calls():
    cmd = ["/sbin/asterisk", "-rx", "core show channels"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    for line in proc.stdout.readlines():
        line = line.decode('utf-8')
        # skip empty line
        if re.match("^\s*$", line):
            continue

        matches = re.findall('^(\d+)\s+active\s+call.*$',line)
        if matches:
            return int(matches[0][0])

def parse_queues():
    agents = {}
    calls = {}
    last_queue = None
    calls_total = 0

    cmd = ["/sbin/asterisk", "-rx", "queue show"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    for line in proc.stdout.readlines():
        line = line.decode('utf-8')
        # skip empty line
        if re.match("^\s*$", line):
            continue

        # search for queue header (numeric only, skip queue with alphanumeric name)
        matches = re.findall('^([0-9]+)\s+has\s+(\d+)\s+call.*$', line)
        if len(matches) > 0:
            queue = matches[0][0]
            calls[queue] = int(matches[0][1])
            calls_total = calls_total + int(matches[0][1])
            last_queue = queue

            # initialize also agent dict to avoid later error
            agents[queue] = 0
            continue

        # search for empty queue
        if re.match('^\s+No Members$', line):
            if last_queue is not None:
                agents[last_queue] = 0
                continue

        # search for member
        if "has taken" in line:
            if last_queue is not None:
                agents[last_queue] = agents[last_queue] + 1
                continue

    return (agents, calls, calls_total)



def read_callback():
    (agents, qcalls, calls_total) = parse_queues()
    if agents is not None:
        for q in agents:
            n = agents[q]
            log_debug("Queue agents in %s: %d" % (q, n))
            try:
                dispatch_value('queue_agents_%s' % q , 'agents', n, 'gauge', 'Agents')
            except Exception as err:
                collectd.info('ERROR dispatching Asterisk plugin data (queue_agents_%s): %s' % (q, str(err)))
    
    if qcalls is not None:
        for q in qcalls:
            n = qcalls[q]
            log_debug("Queue calls in %s: %d" % (q, n))
            try:
                dispatch_value('queue_calls_%s' % q, 'calls', n, 'gauge', 'Calls')
            except Exception as err:
                collectd.info('ERROR dispatching Asterisk plugin data (queue_calls_%s): %s' % (q, str(err)))

    if calls_total is not None:
        log_debug("Queue calls total: %d" % calls_total)
        try:
            dispatch_value('queue_calls_total' , 'calls', calls_total, 'gauge', 'Calls')
        except Exception as err:
            collectd.info('ERROR dispatching Asterisk plugin data (queue_calls_total): %s' % str(err))


    calls = parse_calls()
    if calls is not None:
        log_debug("Calls total: %d" % calls)
        try:
            dispatch_value('calls_total', 'calls', calls, 'gauge', 'Calls')
        except Exception as err:
            collectd.info('ERROR dispatching Asterisk plugin data (calls_total): %s' % str(err))

# Send values to collectd
def dispatch_value(prefix, key, value, vtype, type_instance=None):
    val = collectd.Values(type=vtype)
    val.plugin = 'asterisk'
    val.type_instance = type_instance
    val.plugin_instance = plugin_instance=prefix
    val.interval = int(CONFIG['Interval'])
    val.dispatch(values=[value])


# Initialize default configuration
CONFIG = {
    'Debug' : 'False',
    'Interval': 30
}

# register collectd callbacks
collectd.register_config(configure_callback)
