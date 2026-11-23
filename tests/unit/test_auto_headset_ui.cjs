// Run with: node tests/unit/test_auto_headset_ui.cjs
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
  'services/provisioning/maps/fanvilservice.js',
  'services/provisioning/maps/nethesisservice.js',
  'services/provisioning/maps/yealinkservice.js',
  'services/provisioning/maps/snomservice.js',
  'services/provisioning/maps/gigasetservice.js',
  'services/provisioning/maps/akuvoxservice.js',
  'services/provisioning/maps/sangomaservice.js',
  'services/provisioning/maps/globalsservice.js',
  'controllers/templates/models-ui.js',
  'controllers/templates/default-modal.js',
  'controllers/configurations/preferences.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(scripts, file), 'utf8'), context, { filename: file });
}


// Language, time zone and similar option lists are irrelevant here.
const utils = new Proxy({}, { get: () => () => [] });

const preferenceVariables = (brand, template) => {
  const generic = new constructors.GenericPhoneService(utils);
  const service = brand === 'GenericPhoneService' ? generic : new constructors[brand](generic);
  const map = generic.map({ tmpl_phone: template });
  const preferences = service.preferences(map);
  return { map, items: preferences.items.map(item => item.variable) };
};

test('Auto Headset is offered only by the Fanvil and NethPhone brand services', () => {
  for (const brand of ['ProvFanvilService', 'ProvNethesisService']) {
    assert.ok(preferenceVariables(brand, 'fanvil-X5.tmpl').items.includes('auto_headset'), brand);
  }
  for (const brand of ['ProvYealinkService', 'ProvSnomService', 'ProvGigasetService',
    'ProvAkuvoxService', 'ProvSangomaService', 'GenericPhoneService']) {
    assert.equal(preferenceVariables(brand, 'fanvil-X5.tmpl').items.includes('auto_headset'), false, brand);
  }
});

test('Auto Headset is visible only for templates that render it', () => {
  const service = new constructors.GenericPhoneService({});
  for (const template of ['fanvil-X5', 'fanvil-V67', 'nethesis']) {
    assert.equal(service.map({ tmpl_phone: template + '.tmpl' }).preferences.auto_headset.visible, true, template);
  }
  for (const template of ['fanvil-X3.tmpl', 'yealink.tmpl', 'fallback.tmpl', 'custom.tmpl', undefined]) {
    assert.equal(service.map({ tmpl_phone: template }).preferences.auto_headset.visible, false, String(template));
  }
});

test('Auto Headset selector uses string values, including disabled zero, and is translated', () => {
  const item = new constructors.GenericPhoneService({}).autoHeadsetItem();
  assert.equal(item.type, 'selectpicker');
  assert.deepEqual(copy(item.options), [{ text: 'Enabled', value: '1' }, { text: 'Disabled', value: '0' }]);
  for (const language of ['en', 'it']) {
    const strings = JSON.parse(fs.readFileSync(path.join(scripts, 'i18n/locale-' + language + '.json'), 'utf8'));
    assert.ok(strings[item.description], language);
  }
});

test('Auto Headset is not part of the global defaults', () => {
  const globals = new constructors.ProvGlobalsService({}, {}, utils);
  for (const section of ['preferences', 'network', 'phonebook']) {
    const ui = globals[section] ? globals[section]() : undefined;
    const items = ui ? (ui.data || ui.items || []) : [];
    assert.equal(items.some(item => item.variable === 'auto_headset'), false, section);
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
  return scope.currentModel.ui.map.preferences.auto_headset.visible;
}

test('phone template override hides Auto Headset when its effective template is unsupported', () => {
  assert.equal(configurationController('fanvil-X5.tmpl', 'fanvil-X3.tmpl'), false);
});

test('phone template override exposes Auto Headset when its effective template supports it', () => {
  assert.equal(configurationController('fanvil-X3.tmpl', 'fanvil-X5.tmpl'), true);
});
