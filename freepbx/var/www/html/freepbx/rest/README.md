# REST API

Simple REST API framework for NethVoice. This is based on Slim framework: <http://www.slimframework.com/docs/> API design inspired by <http://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api>

The code must be installed under `/var/www/html/freepbx/rest` directory.

## Authentication

Eeach request must include 2 HTTP header:

- `User`: must be a valid FreePBX administrator (ampusers table)
- `Secretkey`: must be a valid hash

The Secretkey must be calculated using the following parameters:

- user: the same value of `User` header
- password: password of the user in sha1 hash format
- secret: shared static secret between client and server; default is: `1234`

Javascript example:

```
<script type="text/javascript" src="rest/sha1.js"></script>
<script type="text/javascript">

var user = "admin";
var password = sha1("admin");
var secret = "1234";
var hash = sha1(user + password + secret);

console.log("Secretkey: " + hash);

</script>
```

Generate the secret key from bash:

```
user=admin;
pass=admin;
secret=$(cat /var/lib/nethserver/secrets/nethvoice); \
pass=$(echo -n $pass | sha1sum | awk '{print $1}'); \
echo -n $user$pass$secret | sha1sum | awk '{print $1}'
```

## Adding modules

To add a new module, create a php file inside the `modules` directory. All modules automatically have access to all FreePBX variables like `$db` and `$astman`.

Example:

```
<?php
use \Psr\Http\Message\ServerRequestInterface as Request;
use \Psr\Http\Message\ResponseInterface as Response;

require_once('/var/www/html/freepbx/admin/modules/_module_/functions.inc.php');

$app->get('/magic/list', function (Request $request, Response $response, $args) {
    global $db;
    global $astman;

    ... do your magic here ..

    return $response->withJson($result);
});
```

## API

### Authentication

Retrieve the secret code

```
POST /testauth
```
```
Parameter: { "username": "myuser", "password": "myPassword" }
```
JSon result:
- {result: "1234"}

### Login

Example:

- user: admin
- password: admin
- secret: 1234

```
curl -kvL  https://localhost/freepbx/rest/login -H "Content-Type: application/json" -H "User: admin" -H "Secretkey: 51b3bfeb54d746a8c8989e71dd8be757787d1adc"
```

### Users

Retrieve all users

```
GET /users
```

Count all users

```
GET /users/count
```

Retrieve a specific user by username

```
GET /users/{id}
```

Create a new user or edit an existing one.

JSON body: `{"username" : "myuser", "fullname" : "my full name"}`

```
POST /users
```

Set user password

```
POST /users/{username}/password

Parameter: { "password": "mypass" }
```

Get user password in clear-text

```
GET /users/{username}/password
```

Force user synchronization

```
POST /users/sync
```

### Configuration

Check mode status.

Legacy mode is enabled if:

- nethserver-directory is installed
- nethvoice{LegacyMode} prop is set to enabled

Result:

- `{'result' => "legacy" }` if legacy mode is enabled
- `{'result' => "uc" }` if UC mode is enabled
- `{'result' => 'unknown' }` if mode isn't set

```
GET configuration/mode
```

Enable selected `<mode>`. Valid modes are:

- `legacy`: set nethvoice{LegacyMode} to enabled, start nethserver-directory installation using ptrack
- `uc`: set nethvoice{LegacyMode} to disabled

JSON Body:

```
{
   "mode" : <mode>
}
```

Legacy mode can't be reverted.

Result:

- `{'result' => <task_id> }` if legacy mode is set
- `{'result' => "success" }` if uc mode is set

The `task_id` is a md5 hash. It can be used to retrieve the task progress using the tasks module.

```
POST /configuration/mode
```

```
GET /configuration/networks
```

Return green ip addresses and their netmasks

### Tasks

Get the status of the given `task_id`

Result:

- task: the task id
- action: current executing action
- progress: total progress

  ```
  {
  "task": "d56c79f9373a2f2f9ccd8a0ac3c46eb4",
  "action": "S10nethserver-directory-conf",
  "progess": 59
  }
  ```

```
GET /tasks/{task_id}
```

### Virtual Extensions

Retrieve all Main Extensions

```
GET /mainextensions
```

Retrieve a Main Extension by its own extension number

```
GET /mainextensions/{extnumber}
```

Create a new Main Extension

```
POST /mainextensions
```

```
Parameter: { "username": "myuser", "extension": "extnumber"[,"outboundcid" : "outboundcid" ] }
```

### Physical Extensions

Retrieve all Physical Extensions

```
GET /physicalextensions
```

Retrieve a Physical Extension by its own extension number

```
GET /physicalextensions/{extnumber}
```

Create a new Physical Extension. If extension number is given, API is going to create/edit the requested extension number, otherwise a new extension with first available extension number between 9[1-7] mainextnumber.

```
POST /physicalextensions
```

```
Parameter: { "mainextension": "mainextnumber" [, "extension": "extensionnumber"]}
```

Delete physical extension

```
DELETE /physicalextensions/{extension|mac}
```

Change admin user web interface password for all physical extensions

```
POST /physicalextensions/adminpw
```

```
Parameters: { "password": "PASSWORD" }
```

### Mobile App

Create a mobile app extension
```
POST /mobileapp
```

Parameter: {"mainextension": MAINEXTENSION}

Get mobile app extensions for a mainextension
```
GET /mobileapp/{mainextension}
```

Delete a mobile app extension
```
DELETE /mobileapp/{extension}
```

### Voicemail

Retrieve list of all voicemails

```
GET /voicemails
```

Retrieve voicemail for a specific extension (Mainextension)

```
GET /voicemails/{extension}
```

Enable voicemail for an extension

```
POST /voicemails
```

Parameters: {"extension":"mainextension"}

### Devices

Launch a network scan creating two files: MD5.phones.scan and MD5.gateways.scan in /var/run/nethvoice, where MD5 is the MD5 hash of given network. Return long run process id

```
POST /devices/scan
```

```
Parameter: { "network": "192.168.0.0/24"}
```

Set phone model

```
POST /devices/phones/model
```

```
Parameter: { mac: "C4:64:13:3D:15:F7", vendor: "Cisco/Linksys", model: "ATA186" }
```

Get phones scanned from all netwotks

```
GET /devices/phones/list
```
Get brand from mac scanned

```
/devices/{mac}/brand
```
{mac} is the device mac (example: 00:50:58:50:C3:3C)

Result:
```
{Sangoma}

```

Get phone SIP credential:

```
GET /phones/account/{mac}
```

Get gateways scanned from all netwotks

```
GET /devices/gateways/list
```

Get phones scanned from specific network

```
GET /devices/phones/list/{id}
```

{id} is md5(NETWORK) where NETWORK is the network in cidr format (example: 192.168.1.0/24)

Get gateways scanned from specific network

```
GET /devices/gateways/list/{id}
```

{id} is md5(NETWORK) where NETWORK is the network in cidr format (example: 192.168.1.0/24)

Get supported phones

```
GET /devices/phones/manufacturers
```

Get supported gateways

```
GET /devices/gateways/manufacturers
```

Create/Update configuration for a gateway

```
POST /devices/gateways
```

```
Parameters:
{
    "name": "Patton 1234",
    "mac": "00:A0:BA:0B:1C:DA",
    "ipv4": "192.168.5.245",
    "ipv4_new": "192.168.5.213",
    "manufacturer": "Patton",
    "gateway": "192.168.1.1",
    "model": "8",
    "trunks_isdn": [{
        "name": 2005,
        "type": "pp"
    }, {
        "name": 2006,
        "type": "pmp"
    }],
    "trunks_pri": [{
        "linked_trunk": 2005
    }],
    "trunks_fxo": [{
        "number": "072112345",
        "linked_trunk": 2005
    }, {
        "number": "072112346",
        "linked_trunk": 2006
    }],
    "users_fxs": [{
        "linked_user": "stefanof"
    }]
}
```

Create configuration in tftp and push it to gateway

```
POST /devices/gateways/push
```

Parameters: {"name": "name"}

Delete configuration for a device

```
DELETE /devices/gateways
```

Parameters: {"name": "name"}

### Routes

Retrieve inbound routes

```
GET /inboundroutes
```

Create an inbound routes

```
POST /inboundroutes
```

```
Parameter: { "cidnum": "cidnumber", "extension": "extensionnumber", "mohclass": "default" [, "destination": "<val>", "faxexten": "<val>", "faxemail": "<val>", "answer": "<val>", "wait": "<val>", "privacyman": "<val>", "alertinfo": "<val>", "ringing": "<val>", "description": "<val>", "grppre": "<val>", "delay_answer": "<val>", "pricid": "<val>", "pmmaxretries": "<val>", "pmminlength": "<val>", "reversal": "<val>" ] }
```

Delete an inbound route

```
DELETE /inboundroutes/{id}
```

Retrieve outbound routes

```
GET /outboundroutes
```

Retrieve default outbound routes

```
GET /outboundroutes/defaults
```

Result:

```
{
  "it": [
    {
      "name": "national_it",
      "trunks": [
        { "name": "patton_1_isdn_1", "id": "2001" },
        { "name": "patton_2_isdn_2", "id": "2002" }
      ],
    },
    {
      "name": "international_it",
      "trunks": [
        { "name": "patton_1_isdn_1", "id": "2001" },
        { "name": "patton_2_isdn_2", "id": "2002" }
      ],
    },
    ...
  ],
  "en": ...
}
```

Create an outbound route

```
POST /outboundroutes
```

```
Parameters:
{
   "it":[
      {
         "route_id":"25",
         "name":"national_it",
         "outcid":"",
         "outcid_mode":"",
         "password":"",
         "emergency_route":"",
         "intracompany_route":"",
         "mohclass":"default",
         "time_group_id":null,
         "dest":"",
         "seq":"0",
         "trunks":[
            {
               "trunkid":"1",
               "name":"Patton_0b1cda_isdn_0"
            },
            {
               "trunkid":"2",
               "name":"Patton_0b1cda_isdn_1"
            }
         ]
      },
      ...
   ]
}
```

Delete outbound routes

```
DELETE /outboundroutes/{id}
```

Get list of supported patterns for outbound routes

```
GET /outboundroutes/supportedLocales
```

### Mobiles

Retrieve list of all mobile phones and associated users

```
GET /mobiles
```

Retrieve mobile phone for a specific user

```
GET /mobiles/username
```

Create or edit mobile phone for a user

```
POST /mobiles
```

```
Parameters: {"username": "username", "mobile": "mobile"} mobile is the phone number of user
```

### Trunks

Retrieve all Trunks

```
GET /trunks
```

Result:

```
[
  {
    "trunkid":"1",
    "name":"2001",
    "tech":"dahdi",
    "outcid":"",
    "keepcid":"off",
    "maxchans":"",
    "failscript":"",
    "dialoutprefix":"",
    "channelid":"g0",
    "usercontext":"notneeded",
    "provider":"",
    "disabled":"off",
    "continue":"off"
  }
]
```

Retrieve all Trunks by used technology (e.g. "sip", "dahdi", ...)

```
GET /trunks/{tech}
```

Result:

```
[
  {
    "trunkid":"1",
    "name":"2001",
    "tech":"dahdi",
    "outcid":"",
    "keepcid":"off",
    "maxchans":"",
    "failscript":"",
    "dialoutprefix":"",
    "channelid":"g0",
    "usercontext":"notneeded",
    "provider":"",
    "disabled":"off",
    "continue":"off"
  }
]
```

Create a new trunk

```
POST /trunks
```

```
Parameters: { "provider": "<provider>",
  "name": "<name>",
  "username": "<username>",
  "password": "<password>",
  "phone": "<phone number>",
  "codec": "<codec1>,<codec2>,...",
  "forceCodec": <true | false>
}
```

### Providers

Retrieve all providers

```
GET /providers
```

Result:

```
[
  {
    "descrizione": "Eutelia",
    "dettpeer": "disallow=all↵allow...",
    "dettuser": "allow=CODECS↵conte...",
    "provider": "eutelia",
    "registration": "USERNAME:PASSW..."
  }
]
```

### Codecs

Get allowed codecs for VoIP trunks, ordered and enabled

```
GET /codecs/voip
```

### Reboot phones

There are three API to manage phones reboot:

Plan phones reboot:

```
POST /phones/reboot
```
Parameters:
```
{
  "00-11-22-33-44-55":
  {
    "hours":12,
    "minutes":45
  },
  "00-11-22-33-44-55": {}

}
```

If "hours" and "minutes" are omitted, phones are rebooted immediately.

This API returns list of mac address with a status code for each mac. For instance:
```
{
  "00-11-22-33-44-61a": {
    "title": "Malformed MAC address",
    "detail": "Malformed MAC address: 00-11-22-33-44-61a",
    "code": 400
  },
  "00-11-22-33-44-91": {
    "code": 204
  }
}
```

```
DELETE /phones/reboot
```

Removes phones to rebbot saved into crontab.
Parameters:
```
["00-11-22-33-44-91","00-11-22-33-44-53"]
```
Return is the same as POST

```
GET /phones/reboot
```
This API return configured reboot in crontab:

```
{
  "00-11-22-33-44-91": {
    "hours": "22",
    "minutes": "22"
  },
  "00-11-22-33-44-92": {
    "hours": "22",
    "minutes": "22"
  }
}
```

### Configure remote provisioning

Remote provisioning "RPS" allows to configure Yealink, Snom, Gigaset and Fanvil phones provisioning endpoint without configuring option 66 on DHCP
It has been introduced with new provisioning engine.

```
POST /phones/rps/{mac}
```
Parameters:
```
{
  "url": "https://mypbx.example.com/provisioning/tok2/{mac}.cfg"
}
```

Falconieri[1] RPS gateway will insert the given ``url`` into the vendor cloud service. Ensure the URL file name and path components are URL-encoded, i.e. ``%`` is escaped as ``%25`` and so on...

[1]: https://github.com/nethesis/falconieri

### Provisioning engine

```
GET /provisioning/engine
```

return provisioning engine configured in configuration db nethvoice ProvisioningEngine prop. Possible values are "freepbx" or "tancredi"

### External ip

External IP is used by SIP to configure NAT. There are three APIs:

```
GET /configuration/externalip
```

return the configured external IP

```
POST /configuration/externalip/{ip}
```

Set the external IP

```
GET /configuration/suggestedip
```

Return the external IP as seen from an external service

### Local networks

SIP NAT configuration, requires the lost of networks to be used without NAT, that can be configured with these two APIs:

```
GET /configuration/localnetworks
```

Return the current configured localnetworks, for example:

```
[
    {
        "net":"192.168.122.0",
        "mask":"24"
    },
    {
        "net":"192.168.7.0",
        "mask":"24"
    }
]
```


```
POST /configuration/localnetworks
```

Accept a JSON array of local networks and CIDR mask in body:

```
[
    {
        "net":"192.168.122.0",
        "mask":"24"
    },
    {
        "net":"192.168.7.0",
        "mask":"24"
    }
]
```
### enable or disable google speech STT for voicemail attachment

```
POST /configuration/voicemailgooglestt/<enabled|disabled>
```

"enabled" or "disabled" google speech recognition feature for voicemail attachment

```
GET /configuration/voicemailgooglestt
```

return google speech STT for voicemail attachment status. Valid values "enabled" or "disabled"

```
POST /configuration/googleauth
```

```
{
  "file": [Base 64 encoded google authentication JSON file]
}
```

upload the google's auth json file into /home/asterisk/google-auth.json


### Allow or deny access to SIPS from red interfaces

```
GET /configuration/allowexternalsips
```

return the status of external SIPS access: "enabled" or "disabled"

```
POST /configuration/allowexternalsips/<enabled|disabled>
```

enable or disable access to SIPS from red interfaces (and to RTP ports)


### SRTP

```
GET /extensions/{extension}/srtp
```

Return (true|false) if the extension has srtp enabled

```
POST /extensions/{extension}/srtp/(true|false)
```

Enable or disable SRTP for the extension

### Connectivity check

This API check the hostname or ip used for provisioning, verifing that it's reachable. It also try to use https to verify if certificate is valid

```
POST /provisioning/connectivitycheck
```

payload

```json
{
    "host" : "my.example.com",
    "scheme": "https"
}
```

* `scheme` can be (string) `http` or `https`
* `host` can be a FQDN host name or IP address

returns

```json
{
    "host_type": "FQDN",
    "is_reachable" : true,
    "valid_certificate" : true
}
```

* `host_type` can be a string, `FQDN` or `IP`
* `is_reachable` is a boolean
* `valid_certficate` is a boolean

### LDAP phonebook

This API return system LDAP phonebooks settings

```
GET /phonebook/ldap
```

returns

```json
{
    "ldap": {
        "enabled":true,
        "port":"10389",
        "user":"",
        "password":"",
        "tls" : "none",
        "base" : "dc=phonebook,dc=nh",
        "name_display" : "%cn %o",
        "mainphone_number_attr" : "telephoneNumber",
        "mobilephone_number_attr" : "mobile",
        "otherphone_number_attr" : "homePhone",
        "name_attr" : "cn o",
        "number_filter" : "(|(telephoneNumber=%)(mobile=%)(homePhone=%))",
        "name_filter" : "(|(cn=%)(o=%))"
    },
    "ldaps":{
        "enabled":true,
        "port":"10636",
        "user":"cn=ldapuser,dc=phonebook,dc=nh",
        "password":"1n2_E4WIa4H3Xwj9"
        "tls" : "ldaps",
        "base" : "dc=phonebook,dc=nh",
        "name_display" : "%cn %o",
        "mainphone_number_attr" : "telephoneNumber",
        "mobilephone_number_attr" : "mobile",
        "otherphone_number_attr" : "homePhone",
        "name_attr" : "cn o",
        "number_filter" : "(|(telephoneNumber=%)(mobile=%)(homePhone=%))",
        "name_filter" : "(|(cn=%)(o=%))"
    }
}
```

Enable or disable the centralized phonebook to LDAP

```
POST /phonebook/ldap/status/[enabled|disabled]
```

Enable or disable the centralized phonebook to LDAP with SSL

```
POST /phonebook/ldaps/status/[enabled|disabled]
```

### Phonebook sources options

This API return system phonebooks sources options

```
GET /phonebook/sources
```

returns

```json
{
    "extensions" : true,
    "nethcti" : true,
    "speeddial" : true
}
```

Enable or disable extensions of PBX

```
POST /phonebook/sources/extensions/[enabled|disabled]
```

Enable or disable public contacts of NethCTI

```
POST /phonebook/sources/nethcti/[enabled|disabled]
```

Enable or disable speed dials of PBX

```
POST /phonebook/sources/speeddial/[enabled|disabled]
```

### Video conference

This API return the conference URL

```
GET /settings/conferenceurl
```

Set the conference URL

```
POST /conference/conferenceurl
```

payload

```json
{
    "url" : "https://jitsi.example.com"
}
```

* `url` can be a `FQDN`
## Configuration

config.inc.php configuration file is generated by NethServer templates. Here there is an example:

```
<?php

$config = [
    'settings' => [
        'secretkey' => '1234',
        'cti_config_path' => '/etc/nethcti'
    ],
];

```


## Environment variables

NethServer 8 version expect some configuration to be passed as environment variables

### Local networks
Local networks are required to properly do NAT with extensions in local networks. It is possible to configure it with the environment variable `NETHVOICE_HOST_LOCAL_NETWORKS` that contains a JSON with an array of local networks, for instance:
```
{
    [
        "network":"192.168.5.0",
        "ip":"192.168.5.14",
        "netmask":"255.255.255.0",
        "gateway":"192.168.5.1"
    ],
    [
        "network":"10.0.1.0",
        "ip":"10.0.1.12",
        "netmask":"255.255.0.0",
        "gateway":"10.0.0.1"
    ],
}
```






