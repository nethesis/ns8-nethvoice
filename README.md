# NethVoice

NethVoice porting to NethServer 8

## Install

Instantiate the module with:

    add-module ghcr.io/nethesis/nethvoice:latest 1

The output of the command will return the instance name.
Output example:

    {"module_id": "nethvoice1", "image_name": "nethvoice", "image_url": "ghcr.io/nethserver/nethvoice:latest"}

## Proxy 

This module is intended to be used with the ns8-nethvoice-proxy module as SIP proxy

## Configure

Module can be configured from cluster-admin NethServer 8 interface.

To make also provisioniong RPS work with Falconieri, you need to manualy set `SUBSCRIPTION_SECRET` and `SUBSCRIPTION_SYSTEMID` into `~/.config/state/environment` 
file and restart freepbx container with `systemctl --user restart freepbx`

Also `PUBLIC_IP` environment variable should be configured

You can access NethVoice wizard at:
```
https://makako.nethesis.it/nethvoice/
```

## Notify for services

After FreePBX configurations have been applied, some containers should be restarted or reloaded.
The `watcher.path` units looks for files named `<action>_<service>` inside the `notify` directory.

If a container wants to signal a restart, it must mount the file using the `volume` option. Eg:
```
--volume=./notify:/notify
```

Then, create a file named `<action>_<service>`, like `reload_nethcti-server`.
The file must be created inside the container. Example:
```
touch /notify/restart_nethcti-server
```

## Phonebook integration

The module defines the `pbookreader` role that allows to call the following API:

- `get-phonebook-credentials`: return the phonebook credentials, including the host, port, username and password

This role can be used by other modules to access the phonebook.

The module is a provider for the `<module_id>/srv/tcp/phonebook` service.
It raises an event named `phonebook-settings-changed` with the following payload:

- `module_id`: the module id
- `node_id`: the node id
- `module_uuid`: the module uuid
- `reason`: the reason for the change

Consumers of the events must then run the `get-phonebook-credentials` action on `module_id` to get the updated phonebook credentials.

## Uninstall

To uninstall the instance:

    remove-module --no-preserve nethvoice1

## Testing

Test the module using the `test-module.sh` script:


    ./test-module.sh <NODE_ADDR> ghcr.io/nethserver/nethvoice:latest

The tests are made using [Robot Framework](https://robotframework.org/)


## Music

This project incorporates a number of royalty-free, creative commons licensed music files. These files are distributed under the Creative Commons Attribution-ShareAlike 3.0 license through explicit permission from their authors. The license can be found at: http://creativecommons.org/licenses/by-sa/3.0/

* [macroform-cold_day] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-robot_dity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [macroform-the_simplicity] - Paul Shuler (Macroform), paulshuler@gmail.com

* [manolo_camp-morning_coffee] - Manolo Camp, beatbastard@gmx.net

* [reno_project-system] - Reno Project, renoproject@hotmail.com
