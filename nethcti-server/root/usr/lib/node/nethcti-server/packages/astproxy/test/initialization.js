const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const logicPath = path.resolve(__dirname, '../lib/proxy_logic_13/proxy_logic_13.js');
const source = fs.readFileSync(logicPath, 'utf8');
const discoveryError = new Error('Endpoint discovery temporarily unavailable');
const endpoints = [{ ext: 'provider' }];

function createProxy(pjsipResponses, queuesUnsupported) {
  const pending = [];
  const commands = [];
  const events = [];
  const errors = [];
  const timers = new Map();
  let nextTimer = 1;
  let pjsipRequest = 0;
  const context = {
    exports: {},
    require: name => require(name[0] === '.' ? path.resolve(path.dirname(logicPath), name) : name),
    setTimeout: (callback, delay) => {
      assert.strictEqual(delay, 2000);
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id),
    setInterval: () => nextTimer++,
    clearInterval: () => {}
  };
  vm.runInNewContext(source, context, { filename: logicPath });
  const logic = context.exports;
  logic.setLogger({ info: () => {}, warn: () => {}, error: (...args) => errors.push(args) });
  logic.visit({
    doCmd: (args, callback) => {
      commands.push(args.command);
      pending.push({ args, callback });
    },
    emit: event => events.push(event)
  });
  logic.setStaticDataTrunks({
    provider: { tech: 'pjsip', name: 'provider', maxchans: '10', usercontext: 'from-trunk' }
  });

  function flush() {
    while (pending.length) {
      const { args, callback } = pending.shift();
      if (args.command === 'listPjsipPeers') {
        const response = pjsipResponses(pjsipRequest++);
        callback(response instanceof Error ? response : null,
          response instanceof Error ? undefined : response);
      } else if (args.command === 'listQueues' && queuesUnsupported) {
        callback(new Error('Queue listing unavailable'));
      } else if (['listQueues', 'listSipPeers', 'listIaxPeers'].includes(args.command)) {
        callback(null, []);
      } else if (args.command === 'pjsipDetails') {
        callback(null, { exten: args.exten, ip: '192.0.2.1', port: '5060', codecs: [], status: 'online' });
      } else if (args.command === 'pjsipTrunkRegistration') {
        callback(null, { trunk: args.trunk.name, registration: 'registered' });
      } else {
        assert(['listParkings', 'listParkedCalls', 'listChannels', 'listConfBridgeConf'].includes(args.command),
          'Unexpected command: ' + args.command);
        callback(null, {});
      }
    }
    const unexpectedErrors = errors.filter(args =>
      args[1] !== discoveryError && !(args[1] instanceof Error && args[1].message === 'Queue listing unavailable'));
    assert.deepStrictEqual(unexpectedErrors, []);
  }

  return {
    logic, commands, events, timers, flush,
    count: command => commands.filter(value => value === command).length,
    retry: () => {
      const callbacks = Array.from(timers.values());
      timers.clear();
      callbacks.forEach(callback => callback());
      flush();
    }
  };
}

// Every reload must discover queues and finish, including when queues are unavailable.
for (const queuesUnsupported of [false, true]) {
  const proxy = createProxy(() => [], queuesUnsupported);
  proxy.logic.start();
  proxy.flush();
  assert.deepStrictEqual(proxy.events, ['ready']);
  for (let reload = 0; reload < 2; reload++) {
    proxy.logic.setReloading(true);
    proxy.logic.reset();
    proxy.logic.start();
    proxy.flush();
    proxy.logic.setAllExtensionsUsername({});
    assert.strictEqual(proxy.count('listQueues'), reload + 2);
    assert.strictEqual(proxy.events.filter(event => event === 'reloaded').length, reload + 1);
  }
  assert.strictEqual(proxy.timers.size, 0);
}
console.log('PASS: queue discovery completes startup and repeated reloads');

// Both failed discoveries recover without repeating unrelated startup commands.
{
  const proxy = createProxy(request => request < 2 ? discoveryError : endpoints);
  proxy.logic.start();
  proxy.flush();
  assert.strictEqual(proxy.timers.size, 2);
  assert.deepStrictEqual(proxy.events, []);
  assert.strictEqual(proxy.logic.getTrunksList().length, 0);
  proxy.retry();
  assert.strictEqual(proxy.logic.isTrunk('provider'), true);
  assert.strictEqual(proxy.logic.getExtensList().length, 0);
  assert.deepStrictEqual(proxy.events, ['ready']);
  assert.strictEqual(proxy.count('listQueues'), 1);
  assert.strictEqual(proxy.count('listPjsipPeers'), 4);
  for (const command of ['listParkings', 'listSipPeers', 'listIaxPeers', 'listConfBridgeConf']) {
    assert.strictEqual(proxy.count(command), 1);
  }
  assert.strictEqual(proxy.timers.size, 0);
}
console.log('PASS: extension and trunk discovery recover independently');

// Trunk failures retry repeatedly even when extension initialization already succeeded.
{
  const proxy = createProxy(request => request === 1 || request === 2 ? discoveryError : endpoints);
  proxy.logic.start();
  proxy.flush();
  assert.deepStrictEqual(proxy.events, ['ready']);
  assert.strictEqual(proxy.timers.size, 1);
  proxy.retry();
  assert.strictEqual(proxy.timers.size, 1);
  assert.strictEqual(proxy.logic.getTrunksList().length, 0);
  proxy.retry();
  assert.strictEqual(proxy.logic.isTrunk('provider'), true);
  assert.strictEqual(proxy.count('listQueues'), 1);
  assert.strictEqual(proxy.count('listParkings'), 1);
  assert.deepStrictEqual(proxy.events, ['ready']);
  assert.strictEqual(proxy.timers.size, 0);
}
console.log('PASS: trunk retries continue after extension initialization');

// Extension retries must not reinitialize trunks that were already discovered.
{
  const proxy = createProxy(request => request === 0 ? discoveryError : endpoints);
  proxy.logic.start();
  proxy.flush();
  assert.strictEqual(proxy.logic.isTrunk('provider'), true);
  assert.strictEqual(proxy.timers.size, 1);
  proxy.retry();
  assert.deepStrictEqual(proxy.events, ['ready']);
  assert.strictEqual(proxy.count('pjsipDetails'), 1);
  assert.strictEqual(proxy.count('listQueues'), 1);
  assert.strictEqual(proxy.timers.size, 0);
}
console.log('PASS: extension retries preserve initialized trunks');
