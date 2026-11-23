#!/usr/bin/python3

'''
This script connects to onOffice enterprise API to get contact information for a given number.
To use this script, copy it in /usr/src/nethvoice/lookup.d/

Usage: lookup_onoffice.py <number>
Prints {"company": "...", "name": "...", "number": "..."} and exits 0 when found,
exits 1 when not found or on error.

Set up credentials: set token and secret in the script, or export ONOFFICE_TOKEN / ONOFFICE_SECRET,
or put a JSON file in /etc/phonebook/sources.d/ with "dbtype": "onoffice", "token" and "secret".
'''

import base64
import hashlib
import hmac
import json
import os
import re
import sys
import time
import requests

# onOffice API credentials (API user created in onOffice enterprise)
url = 'https://api.onoffice.de/api/stable/api.php'
token = 'CHANGE_ME'
secret = 'CHANGE_ME'

ACTION_READ = 'urn:onoffice-de-ns:smart:2.5:smartml:action:read'
# how many final digits are compared (handles +39 / 0039 / no prefix)
MATCH_DIGITS = 9
# minimum digits to run a lookup (skip internal extensions)
MIN_DIGITS = 6
TIMEOUT = 5

# if credentials aren't set, try environment, then phonebook configuration
if token == '' or secret == '':
	token = os.getenv('ONOFFICE_TOKEN', '')
	secret = os.getenv('ONOFFICE_SECRET', '')

if (token == '' or secret == '') and os.path.isdir('/etc/phonebook/sources.d/'):
	configuration_files = ['/etc/phonebook/sources.d/' + f for f in os.listdir('/etc/phonebook/sources.d/') if f.endswith('.json')]
	for configuration_file in configuration_files:
		try:
			with open(configuration_file) as json_file:
				data = json.load(json_file)
				data = data[next(iter(data))]
				if data.get('dbtype') == 'onoffice':
					url = data.get('url') or url
					token = data['token']
					secret = data['secret']
					break
		except Exception as err:
			pass

if token == '' or secret == '':
	print('No token or secret found', file=sys.stderr)
	sys.exit(1)

if len(sys.argv) < 2:
	print('Usage: ' + sys.argv[0] + ' <number>', file=sys.stderr)
	sys.exit(1)

# Get the search term from the command line
number = sys.argv[1]
# remove international prefix (+ or 00) and every non digit character
number_to_lookup = re.sub(r'\D', '', re.sub(r'^(\+|00)', '', number.strip()))

try:
	if len(number_to_lookup) < MIN_DIGITS:
		raise Exception('Number too short for lookup: ' + number)

	# match the final digits, so +390731123456, 0039 0731 123456 and 0731123456 are equal
	tail = number_to_lookup[-MATCH_DIGITS:]

	timestamp = int(time.time())
	resourcetype = 'address'
	message = f"{timestamp}{token}{resourcetype}{ACTION_READ}".encode('utf-8')
	signature = base64.b64encode(hmac.new(secret.encode('utf-8'), message, hashlib.sha256).digest()).decode('ascii')

	body = {
		"token": token,
		"request": {
			"actions": [{
				"actionid": ACTION_READ,
				"resourceid": "",
				"identifier": "",
				"resourcetype": resourcetype,
				"timestamp": timestamp,
				"hmac": signature,
				"hmac_version": "2",
				"parameters": {
					"data": ["Vorname", "Name", "Zusatz1"],
					"filter": {
						"normalizedPhoneNumbers": [{"op": "like", "val": "%" + tail}]
					},
					"listlimit": 10
				}
			}]
		}
	}

	response = requests.post(url, json=body, timeout=TIMEOUT)
	if response.status_code != 200:
		raise Exception('Failed to get contacts from ' + url + ' with status code ' + str(response.status_code))

	payload = response.json()
	if payload.get('status', {}).get('code') != 200:
		raise Exception('onOffice API error: ' + json.dumps(payload.get('status')))
	action_result = payload['response']['results'][0]
	if action_result.get('status', {}).get('errorcode', 0) != 0:
		raise Exception('onOffice action error: ' + json.dumps(action_result.get('status')))

	contacts = action_result.get('data', {}).get('records', [])
	if not contacts:
		raise Exception('No contacts found for ' + number)

	result = {
		"company": "",
		"name": "",
		"number": number,
		}
	names = set()
	for contact in contacts:
		el = contact.get('elements', {})
		company = (el.get('Zusatz1') or '').strip()
		name = ' '.join(p for p in ((el.get('Vorname') or '').strip(), (el.get('Name') or '').strip()) if p)
		if company != '' and result["company"] == '':
			result["company"] = company
		if name != '':
			names.add(name)
	# if the number belongs to more than one person, show only the company
	if len(names) == 1:
		result["name"] = names.pop()

	print(json.dumps(result))
	sys.exit(0)
except Exception as err:
	print(str(err), file=sys.stderr)
	sys.exit(1)
