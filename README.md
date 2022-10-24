# NethVoice

NethVoice porting to NethServer 8

## Install

Instantiate the module with:

    add-module ghcr.io/nethserver/nethvoice:latest 1

The output of the command will return the instance name.
Output example:

    {"module_id": "nethvoice1", "image_name": "nethvoice", "image_url": "ghcr.io/nethserver/nethvoice:latest"}

## Configure

Let's assume that the nethvoice instance is named `nethvoice1`.

Launch `configure-module`, by setting the following parameters:
- `<MODULE_PARAM1_NAME>`: <MODULE_PARAM1_DESCRIPTION>
- `<MODULE_PARAM2_NAME>`: <MODULE_PARAM2_DESCRIPTION>
- ...

Example:

    api-cli run module/nethvoice1/configure-module --data '{}'

The above command will:
- start and configure the nethvoice instance
- (describe configuration process)
- ...

Send a test HTTP request to the nethvoice backend service:

    curl http://127.0.0.1/nethvoice/

## Uninstall

To uninstall the instance:

    remove-module --no-preserve nethvoice1

## Testing

Test the module using the `test-module.sh` script:


    ./test-module.sh <NODE_ADDR> ghcr.io/nethserver/nethvoice:latest

The tests are made using [Robot Framework](https://robotframework.org/)

