# nethcti-server

It is a daemon that provides a set of api to perform common switchboard operations and a websocket streaming channel to listen for the events.

Actually it supports only [Asterisk PBX](https://www.asterisk.org/).

## Index

* [How to use](#how-to-use)
* [Documentation](#documentation)
* [Authentication](#authentication)
  * [Login](#login)
  * [Logout](#logout)
  * [Disabling](#disabling)
* [REST API](#rest-api)
* [Reconnections](#reconnections)
* [CORS](#cors)
* [WebSocket Events](#websocket-events)
* [Logging](#logging)

## How to use

To launch it manually copy all the server content into the path:

```bash
cp root/usr/lib/node/nethcti-server /usr/lib/node/
```

install all npm packages:

```bash
cd /usr/lib/node/nethcti-server
/usr/bin/scl enable rh-nodejs10 "npm install"
```

then launch the daemon:

```bash
/usr/bin/scl enable rh-nodejs10 "npm start"
```

You can easily enable _info_ logging level setting environment variable:

```bash
NODE_ENV=development
```

## Documentation

https://nethvoice.docs.nethesis.it/it/v14/

## Authentication

### Login

To obtain the nonce you have to do:

```
POST /authentication/login
```

with the following body in JSON format:

```
{
  "username": "<username>",
  "password": "<password>"
}
```

If the authentication is successfully you get the following:

```
HTTP 401

www-authenticate Digest 6e4fed102e96e9f408d53ebfab889c5ded22acb3
```

The digest is the nonce by which you calculate the token that will be used for any rest api call.

To calculate the token use the following algorithm:

```
tohash = username + ':' + password + ':' + nonce
token  = HMAC-SHA1(tohash, password)
```

The token expires after 30 minutes if not used.

### Logout

To logout you have to do:

```
POST /authentication/logout
```

## Disabling

The authentication is controlled by the `NETHCTI_AUTHENTICATION_ENABLED` variable of the NethVoice module, written to `/etc/nethcti/authentication.json` when the container starts.

To disable the authentication (replace `nethvoice1` with the module instance name):

```bash
runagent -m nethvoice1 python3 -c 'import agent; agent.set_env("NETHCTI_AUTHENTICATION_ENABLED", "false")'
runagent -m nethvoice1 systemctl --user restart nethcti-server
```

at this point you can login to NethCTI only using the username.

To re-enable it, run the same commands with `true`.

## REST API

Each request must contain the authentication token retrieved as described above. It must be specified in the HTTP Header of the request:

```
Authorization: <username>:token
```

## Reconnections

Websocket reconnections are fundamental to keep cti services up.

A key concept is the reconnection delay to keep safe the server from possible connections flood.

As you can see from the following url
https://github.com/socketio/socket.io-client/blob/master/docs/API.md#managerurl-options
socket io client is set to reconnect automatically for default up to infinity with a randomized initial delay. Each attempt increases the reconnection delay by 2x along with a randomization as above.

## CORS

CORS are allowed.

## WebSocket Events

```
userPresenceUpdate
```

## Logging

The daemon logs on

```
/var/log/asterisk/nethcti.log
```

## NethCTI CLI

`root/usr/lib/node/nethcti-server/nethcti-cli.js` it's a command line interface to communicate with the nethcti-server.

It uses the `/run/nethvoice/nethcti.sock` IPC to communicate.

To show the command's help message, execute the script without arugments:

```bash
scl enable rh-nodejs10 'node /usr/lib/node/nethcti-server/nethcti-cli'
```
