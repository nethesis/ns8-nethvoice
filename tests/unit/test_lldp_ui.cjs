// Run with: node tests/unit/test_lldp_ui.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scripts = path.resolve(__dirname, '../../freepbx/wizard-ui/app/scripts');
const constructors = {};
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const context = vm.createContext({
  angular: {
    module: () => ({
      service: (name, constructor) => { constructors[name] = constructor; },
      controller: (name, constructor) => { constructors[name] = constructor; }
    }),
    copy,
    element: () => ({ ready() {} })
  },
  $: () => ({ on() {}, each() {}, modal() {} }),
  localStorage: { getItem: () => null },
  document: { addEventListener() {}, removeEventListener() {} },
  setTimeout() {},
  setInterval() {},
  clearInterval() {},
  console
});
for (const file of [
  'services/provisioning/maps/genericphoneservice.js',
  'services/provisioning/maps/globalsservice.js',
  'controllers/templates/models-ui.js',
  'controllers/templates/default-modal.js',
  'controllers/configurations/preferences.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context, { filename: file });
}

test('LLDP is available for all implemented templates and hidden for unsupported templates', () => {
  const service = new constructors.GenericPhoneService({});
  for (const template of [
    'yealink', 'snom', 'snomD8XX', 'gigasetP', 'gigasetP8XX',
    'akuvox', 'akuvox410w', 'akuvox480w', 'fanvil-X3', 'fanvil-X5',
    'fanvil-V67', 'nethesis', 'sangoma'
  ]) {
    assert.equal(service.map({ tmpl_phone: template + '.tmpl' }).network.lldp_enable.visible, true, template);
  }
  for (const template of ['gigaset-Maxwell.tmpl', 'fallback.tmpl', 'custom.tmpl', undefined]) {
    assert.equal(service.map({ tmpl_phone: template }).network.lldp_enable.visible, false);
  }
});

test('global and model selectors use the same string values, including disabled zero', () => {
  const generic = new constructors.GenericPhoneService({});
  const globals = new constructors.ProvGlobalsService({}, {}, {});
  const model = generic.network({}).items.find(item => item.variable === 'lldp_enable');
  const global = globals.network().data.find(item => item.variable === 'lldp_enable');
  assert.deepEqual(copy(model.options), [{ text: 'Enabled', value: '1' }, { text: 'Disabled', value: '0' }]);
  assert.deepEqual(copy(global.options), copy(model.options));
  assert.equal(model.type, 'selectpicker');
  assert.equal(global.type, 'list');
  for (const language of ['en', 'it']) {
    const strings = JSON.parse(fs.readFileSync(path.join(scripts, 'i18n/locale-' + language + '.json'), 'utf8'));
    assert.ok(strings[model.description]);
  }
});

function configurationController(modelTemplate, phoneTemplate) {
  const generic = new constructors.GenericPhoneService({});
  const response = data => ({ then: callback => callback({ data: copy(data) }) });
  const scope = {
    view: {}, macVendors: [],
    $watch() {}, $on() {},
    destroyAllSelects() {}, modelLdapTypeCheck() {},
    buildModel() {
      const variables = { tmpl_phone: modelTemplate };
      this.currentModel = {
        ui: { map: generic.map(variables) },
        storedVariables: copy(variables),
        variables: copy(variables)
      };
      return response({});
    }
  };
  const inert = {};
  const userService = { statusSynchronization: () => response(true) };
  const phoneService = { getPhone: () => response({ variables: { tmpl_phone: phoneTemplate } }) };
  constructors.ConfigurationsCtrl(
    scope, { $on() {} }, inert, inert, inert, inert, inert,
    userService, phoneService, inert, inert, generic
  );
  scope.setCurrentModelConfig('test-model', '00-00-00-00-00-01');
  return scope.currentModel.ui.map.network.lldp_enable.visible;
}

test('phone template override hides LLDP when its effective template is unsupported', () => {
  assert.equal(configurationController('yealink.tmpl', 'custom.tmpl'), false);
});

test('phone template override exposes LLDP when its effective template supports it', () => {
  assert.equal(configurationController('gigaset-Maxwell.tmpl', 'yealink.tmpl'), true);
});

function modelController(location, stored = {}, globals = { lldp_enable: '1' }) {
  let modelData = copy(stored);
  const requests = [];
  const response = data => ({ then: callback => callback({ data: copy(data) }) });
  const scope = {
    $on() {}, $emit() {},
    currentModel: {
      name: 'test-model', mac: '00-00-00-00-00-01', display_name: 'Test model',
      uiLocation: location,
      storedVariables: copy(stored), globals: copy(globals),
      variables: Object.assign({}, globals, stored), singleVariables: {}
    }
  };
  constructors.ModelsUICtrl(scope, {}, {}, {
    patchModel(id, payload) {
      requests.push(copy(payload));
      for (const [key, value] of Object.entries(payload.variables)) {
        if (value === null) delete modelData[key];
        else modelData[key] = value;
      }
      return response({});
    },
    getModel: () => response({ variables: modelData }),
    getDefaults: () => response(globals)
  }, {
    patchPhone(id, payload) { requests.push(copy(payload)); return response({}); }
  }, {}, { $on() {} });
  return { scope, requests };
}

test('saving and reloading a disabled model preserves string zero over an enabled default', () => {
  const { scope, requests } = modelController('models');
  scope.currentModel.variables.lldp_enable = '0';
  scope.onVariableChanged('lldp_enable', 'list');
  scope.saveCurrentModel();
  assert.equal(requests[0].variables.lldp_enable, '0');
  assert.equal(scope.currentModel.variables.lldp_enable, '0');
  assert.equal(scope.currentModel.storedVariables.lldp_enable, '0');
});

test('saving unrelated model settings keeps LLDP inherited', () => {
  const { scope, requests } = modelController('models');
  scope.currentModel.variables.language = 'it';
  scope.saveCurrentModel();
  assert.equal(Object.hasOwn(requests[0].variables, 'lldp_enable'), false);
  assert.equal(scope.currentModel.variables.lldp_enable, '1');
});

test('resetting a model LLDP override sends null and reloads the inherited value', () => {
  const { scope, requests } = modelController('models', { lldp_enable: '0' });
  scope.currentModel.variables.lldp_enable = 'null';
  scope.saveCurrentModel();
  assert.equal(requests[0].variables.lldp_enable, null);
  assert.equal(scope.currentModel.variables.lldp_enable, '1');
});

for (const value of ['0', '1', 'null']) {
  test('phone override saves ' + value + ' through the existing change handler', () => {
    const { scope, requests } = modelController('configurations');
    scope.currentModel.variables.lldp_enable = value;
    scope.onVariableChanged('lldp_enable', 'list');
    scope.saveCurrentModelSingle();
    assert.equal(requests[0].variables.lldp_enable, value === 'null' ? null : value);
    assert.deepEqual(Object.keys(requests[0].variables), ['lldp_enable']);
  });
}

test('global defaults save disabled zero unchanged', () => {
  let saved;
  const scope = {
    buildDefaultSettingsUI: () => ({}),
    defaultSettings: { lldp_enable: '0', adminpw: 'test-password' },
    adminPw: { origValue: 'test-password' },
    startPhonebookService() {}, enableNextDisabled() {}
  };
  constructors.DefaultModalUICtrl(scope, {}, {}, {
    setDefaults(data) {
      saved = copy(data);
      return { then: callback => callback({}) };
    }
  });
  scope.setDefaultSettings();
  assert.equal(saved.lldp_enable, '0');
});
