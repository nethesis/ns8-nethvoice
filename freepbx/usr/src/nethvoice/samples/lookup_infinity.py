#!/usr/bin/python3

'''
This sample script connects to Zucchetti Inifinity API to get contact information for a given number.
To use this script, copy it in /usr/src/nethvoice/lookup.d/

Set up credentials: if centralized phonebook is already configured in /etc/phonebook/sources.d/, the script will try to get the credentials from there.
Otherwise, set the url, username and password in the script.
'''


import re
import requests
import json
import sys
import os

# Set the URL for the API
url = ''
username = ''
password = ''

# if url and credentials aren't set, try to get them from phonebook configuration
if url == '' or username == '' or password == '':
	# check if one of the json files in /etc/phonebook/sources.d/ is for infinity
	configuration_files = ['/etc/phonebook/sources.d/' + f for f in os.listdir('/etc/phonebook/sources.d/') if f.endswith('.json')]
	for configuration_file in configuration_files:
		try:
			with open(configuration_file) as json_file:
				data = json.load(json_file)
				data = data[next(iter(data))]
				if data['dbtype'] == 'infinity':
					url = data['url']
					username = data['username']
					password = data['password']
					break
		except Exception as err:
			pass

if url == '' or username == '' or password == '':
	print('No URL, username or password found', file=sys.stderr)
	sys.exit(1)

# Get the search term from the command line
number = sys.argv[1]
# remove international prefix (if number start with +??? or 00???, replace it with '')
number_to_lookup = re.sub(r'^(\+|00)(\d{1,3})', '', number)

token_url = f"{url}/servlet/oauth/token"
auth = (username, password)
token_body = {
	"scope": "logintoken"
}
try:
	token_response = requests.post(token_url, auth=auth, data=token_body)
	if token_response.status_code != 200:
		raise Exception('Failed to get token from ' + token_url + ' with status code ' + str(token_response.status_code))
	token = token_response.json().get("access_token")
	if not token:
		raise Exception('No token found in response from ' + url)
	# Get contacts using token
	contact_url = f"{url}/servlet/api/v1/gsfr_fgetaddress_wsapi/{number_to_lookup}"
	headers = {
		"Authorization": f"Bearer {token}"
	}
	contact_response = requests.get(contact_url, headers=headers)
	if contact_response.status_code != 200:
		raise Exception('Failed to get contacts from ' + url + ' with status code ' + str(contact_response.status_code))
	contacts = contact_response.json()['data']
	if not contacts:
		raise Exception('No contacts found in response from ' + url)
	
	result = {
		"company" : "",
		"name": "",
		"number": number,
		}
	if len(contacts) > 0:
		names = set()
		for contact in contacts:
			if 'company' in contact and contact['company'] != '':
				result["company"] = contact['company']
			if 'name' in contact and contact["name"] != '':
				names.add(contact["name"])
		if len(names) == 1:
			result["name"] = names.pop()

	print(json.dumps(result))
	sys.exit(0)
except Exception as err:
	print(str(err), file=sys.stderr)
	sys.exit(1)
