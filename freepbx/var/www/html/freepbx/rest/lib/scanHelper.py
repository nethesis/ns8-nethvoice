#!/usr/bin/env python

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

import sys
import os
import threading
import json
import nmap                         # import nmap.py module
import urllib2
import hashlib
import socket

try:
    nm = nmap.PortScanner()         # instantiate nmap.PortScanner object
except nmap.PortScannerError:
    print('Nmap not found', sys.exc_info()[0])
    sys.exit(1)
except:
    print("Unexpected error:", sys.exc_info()[0])
    sys.exit(1)

net = sys.argv[1]

with open('/var/www/html/freepbx/rest/lib/macAddressMap.json', 'r') as macfile:
    macdata=macfile.read().replace('\n', '')
manufacturer = json.loads(macdata)

with open('/var/www/html/freepbx/rest/lib/typeMap.json', 'r') as typefile:
    typedata = typefile.read().replace('\n', '')
types = json.loads(typedata)

nm.scan(hosts=net, arguments='-sn -n')

#output punes to file
m = hashlib.md5()
m.update(net)
phonesoutfile = open("/var/run/nethvoice/"+m.hexdigest()+".phones.scan",'w')
gatewaysoutfile = open("/var/run/nethvoice/"+m.hexdigest()+".gateways.scan",'w')

phonesout = []
gatewaysout = []

for host in nm.all_hosts():
    row = {}
    try :
        nm[host]['addresses']['mac']
        #check if manufacturer is known
        identifier = nm[host]['addresses']['mac'][0:8]
        row['mac'] = nm[host]['addresses']['mac']
        row['ipv4'] = nm[host]['addresses']['ipv4']
        row['manufacturer'] = manufacturer[identifier]
    except (KeyError, IndexError):
        continue

    #find device type
    try :
        row['type'] = types[manufacturer[identifier]]
    except (KeyError, IndexError):
        row['type'] = 'unknown'

    #Sangoma exception
    if manufacturer[identifier] == 'Sangoma' and types[manufacturer[identifier]] == 'unknown':
        try:
            req = urllib2.Request('http://'+nm[host]['addresses']['ipv4']+'/index.htm')
            res = urllib2.urlopen(req,timeout = 5)
            res = res.read()
            if "Gateway" in res or "Sangoma Vega " in res:
                row['type'] = 'gateway'
            else:
                row['type'] = 'phone'
        except:
            row['type'] = 'phone'
    if row['type'] == 'phone':
        phonesout.append(row)
    if row['type'] == 'gateway':
        gatewaysout.append(row)

phonesoutfile.write("%s\n" % json.dumps(phonesout))
gatewaysoutfile.write("%s\n" % json.dumps(gatewaysout))

macfile.close()
typefile.close()
phonesoutfile.close()
gatewaysoutfile.close()
sys.exit(0);

