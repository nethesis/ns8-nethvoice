// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
// Run after installing UI dependencies:
// NODE_PATH=ui/node_modules node tests/ui/hostname_validation.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const parser = require('@babel/parser');

for (const file of ['views/Settings.vue', 'components/first-configuration/NethvoiceStep.vue']) {
  const component = fs.readFileSync(path.join(__dirname, '../../ui/src', file), 'utf8');
  const script = component.match(/<script>([\s\S]*?)<\/script>/)[1];
  const exported = parser.parse(script, { sourceType: 'module' }).program.body
    .find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const methods = exported.properties.find(node => node.key?.name === 'methods').value;
  const method = methods.properties.find(node => node.key?.name === 'validateConfigureModule');
  const validate = vm.runInNewContext(`({${script.slice(method.start, method.end)}}).validateConfigureModule`);

  function form(host = 'Voice.Example.org', ctiHost = 'CTI.Example.org') {
    return {
      nethvoice_host: host,
      nethcti_ui_host: ctiHost,
      user_domain: 'users.example.org',
      timezone: 'UTC',
      reports_international_prefix: '+39',
      nethvoice_admin_password: 'test-only',
      passwordValidation: Object.fromEntries(['Length', 'Lowercase', 'Uppercase', 'Number', 'Symbol', 'Equal']
        .map(name => [`is${name}Ok`, true])),
      error: {},
      clearErrors() { this.error = {}; },
      focusElement() {},
      $t(key) { return key; },
    };
  }

  test(`${file}: normalize before accepting the configuration`, () => {
    const state = form();
    assert.equal(validate.call(state), true);
    assert.equal(state.nethvoice_host, 'voice.example.org');
    assert.equal(state.nethcti_ui_host, 'cti.example.org');
  });

  test(`${file}: reject case-equivalent hostnames`, () => {
    const state = form('Voice.Example.org', 'VOICE.EXAMPLE.ORG');
    assert.equal(validate.call(state), false);
    assert.equal(state.error.nethvoice_host, 'error.same_host');
    assert.equal(state.error.nethcti_ui_host, 'error.same_host');
  });

  test(`${file}: preserve required-field validation`, () => {
    const state = form('', '');
    assert.equal(validate.call(state), false);
    assert.equal(state.error.nethvoice_host, 'error.required');
    assert.equal(state.error.nethcti_ui_host, 'error.required');
  });
}
