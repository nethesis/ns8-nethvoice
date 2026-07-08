'use strict';
const ipc = require('node-ipc');
const name = 'nethcti.sock';
const CMD = process.argv[2];
const ALLOWED_CMDS = {
  reload: 'reload',
  dump: 'dump',
  nethifier_log: 'nethifier_log'
};

if (ALLOWED_CMDS[CMD] === undefined ||
  (CMD === ALLOWED_CMDS.nethifier_log && process.argv.length !== 5)) {
  let cmdlist = Object.keys(ALLOWED_CMDS).join('|');
  cmdlist = cmdlist.replace('nethifier_log', 'nethifier_log <USERNAME> ("on" | "off")');
  console.log(`usage: node nethcti-cli (${cmdlist})`);
  process.exit(2);
}

ipc.config.id = 'nethcti-cli';
ipc.config.socketRoot = '/run/nethvoice/';
ipc.config.appspace = '';
ipc.config.encoding = 'utf8';
ipc.config.stopRetrying = true;
ipc.config.silent = true;
ipc.config.rawBuffer = true;

ipc.connectTo(name, () => {
  ipc.of[name].on('connect', () => {

    if (CMD === ALLOWED_CMDS.nethifier_log) {
      ipc.of[name].emit(JSON.stringify({
        type: 'message',
        data: CMD,
        username: process.argv[3],
        state: process.argv[4]
      }));
    } else {
      ipc.of[name].emit(JSON.stringify({
        type: 'message',
        data: CMD
      }));
    }
    if (CMD === ALLOWED_CMDS.reload) {
      ipc.disconnect(name);
    }
  });
  ipc.of[name].on('disconnect', () => {
    process.exit(0);
  });
  ipc.of[name].on('error', (err) => {
    console.error(err);
    process.exit(1);
  });
  ipc.of[name].on('data', data => {
    try {
      data = JSON.parse(data.toString());
      if (data.type === 'dump') {
        console.log(JSON.stringify(data.data, null, 2));
      } else if (data.type === 'nethifier_log') {
        console.log(JSON.stringify(data, null, 2));
      }
      ipc.disconnect(name);
    } catch (err) {
      console.error(err);
    }
  });
});