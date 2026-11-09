## Node.js Proxy for Asterisk PBX

`Astproxy` is a proxy between [Asterisk PBX system](https://www.asterisk.org/) and your application. It provides the possibility to send *commands* and to receive *events* from Asterisk offering an *abstraction layer* of data to always remain independent from the specific version of the PBX and to offer the possibiity to extend its functionalities to even support other type of PBX systems.

### Requirements

Node.js v10 LTS (10.19.0) or later.

### Asterisk versions supported

[Asterisk v13.](https://wiki.asterisk.org/wiki/display/AST/Asterisk+13+Documentation)

### Installation

This is a [Node.js](https://nodejs.org/en/) module available through the [npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).

Install with npm:
```
npm i astproxy --save
```

### Quick start

1. Install the executable:

```sh
npm install astproxy
```

2. Include the library:

```js
const astproxy = require('astproxy');
```

3. Configure `astproxy`

`astproxy` uses [Asterisk AMI](https://wiki.asterisk.org/wiki/display/AST/The+Asterisk+Manager+TCP+IP+API) to communicate with Asterisk, so it needs some information to connect to it:

```js
astproxy.config({
  port: 5038,
  host: 'localhost',
  username: '<USERNAME>',
  password: '<PASSWORD>',
  reconnect: true,
  reconnect_after: 3000
});
```
The credentials are usually present into `/etc/asterisk/manager.conf`.

4. Register for the event `ready`

The event `ready` is emmited when the connection with Asterisk has been successfully established. **Before using the `astproxy` you always have to register for this event:**

```js
let ready = () => {
  // astproxy is ready to be used
  // your code here
};
astproxy.on('ready', ready);
```

5. Start the module:

```js
astproxy.start();
```

### Features

- Configuration by JSON files
- Send command to Asterisk
- Receive events from Asterisk
- Provides all the JSON data about:
  - `extensions`
  - `queues`
  - `parkings`
  - `call conversations`
- Runtime reloading

### Use Cases

An example of use cases could be:

- originate a new call, answer to an incoming call, hangup a call
- obtain all the extensions status: online, busy, ringing, offline, dnd, ...
- obtain information about all phone conversations

### Configuration

These are the configuration options used by `astproxy` to connect to Asterisk AMI:

- **port**: port number for Asterisk AMI (default `5038`)
- **host**: host of Asterisk (default `localhost`)
- **username**: username of Asterisk AMI user (default `username`)
- **password**: password of Asterisk AMI user (default `password`)
- **reconnect**: do you want the ami to reconnect if the connection is dropped (default `false`)
- **reconnect_after**: how long to wait to reconnect, in miliseconds (default `3000`)
- **prefix**: a prefix number to be used for all phone calls (optional)

Example:

```js
const astproxy = require('astproxy');
astproxy.config({
  port: 5038,
  host: 'localhost',
  username: 'admin',
  password: '0123456789',
  reconnect: true,
  reconnect_after: 3000
});
```

The credentials are usually contained into `/etc/asterisk/manager.conf`.

### Events

You can obtain the events list with `astproxy.EVENTS`.

- `ready`: is emitted once the asterisk connection has been established. **You always have to register for this event before doing any operation.**

```js
const astproxy = require('astproxy');
astproxy.config({
  port: 5038,
  host: 'localhost',
  username: '<USERNAME>',
  password: '<PASSWORD>',
  reconnect: true,
  reconnect_after: 3000
});
astproxy.on('ready', () => {});  // or astproxy.on(asproxy.EVENTS.EVT_READY, () => {});
astproxy.start();
```
- `extenHangup`
- `extenDialing`

### Get Extensions list

Data about all the extensions:

```js
let extensions = astproxy.getExtensions();
```

Example of returned data:

```js
{
  "2001": {                 // extension identifier
    "ip": "192.168.5.163",  // the ip address of the phone registered with this extension
    "cf": "221",            // the call forward status. If it's disabled, it is an empty string
    "cfb": "221",           // the call forward on busy status. If it's disabled, it is an empty string
    "cfu": "221",           // the call forward on unavailable status. If it's disabled, it is an empty string
    "dnd": false,           // it's true if the don't disturb is active
    "cfVm": "",             // the call forward to voicemail status. If it's disabled, it is an empty string
    "cfbVm": "",            // the call forward on busy to voicemail status. If it's disabled, it is an empty string
    "cfuVm": "",            // the call forward on unavailable to voicemail status. If it's disabled, it is an empty string
    "port": "5062",
    "name": "Alessandro",
    "exten": "214",
    "status": "online",              // the status can be: "dnd", "busy", "online", "onhold", "offline", "ringing", "busy_ringing"
    "context": "from-internal",      // the context
    "useWebsocket": false,           // if the extension use websocket
    "sipuseragent": "Twinkle/1.4.2",
    "conversations": {               // the keys are the conversation identifiers
      "SIP/214-000002f4>SIP/209-000002f5": {
        "id": "SIP/214-000002f4>SIP/209-000002f5",
        "owner": "214",
        "chDest": { ... },           // the source channel of the call
        "queueId": "401",            // the queue identifier if the conversation has gone through a queue
        "chSource": { ... },         // the destination channel of the call
        "duration": 26,
        "recording": "false",        // it's "true" or "mute" if the conversation is recording, "false" otherwise
        "direction": "in",
        "inConference": true,        // if the conversation involves a meetme conference
        "throughQueue": true,        // if the call has gone through a queue
        "counterpartNum": "209",
        "counterpartName": "user"
      }
    }
  },
  ...
}
```

### Make a phone call

```js
let callCb = (err, resp) => {
  // callback function
};
astproxy.call({
  endpointId: '2001', // the extension identifier: the caller
  to: '2002',         // the destination number of the call
  cb: callCb          // the callback function
});
```
