// SPDX-License-Identifier: GPL-3.0-or-later
// Run with: node freepbx/tests/visualplan_lookup_test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const directory = path.join(__dirname, '../var/www/html/freepbx/admin/modules/visualplan/htdocs');
let response;
let created = 0;
let added = 0;
let removed = false;
let loading = false;
let messages = [];
const $ = selector => ({
    show() { if (selector === '#loader') loading = true; return this; },
    hide() { if (selector === '#loader') loading = false; return this; },
    html() { return this; },
    css() { return this; },
    append(message) { messages.push(message); return this; },
    data() { return 'Base'; },
    dialog() { return this; },
    remove() { removed = true; return this; }
});
$.ajax = options => {
    options.beforeSend();
    let done;
    return {
        done(callback) { done = callback; return this; },
        fail(callback) {
            if (response.status === 503) callback();
            else done(JSON.stringify(response.data));
            return this;
        }
    };
};
const sandbox = {
    $, example: {}, languages: {}, browserLang: 'en', document: { body: {} },
    Base: function () {
        created++;
        this.width = this.height = 50;
        this.onDrop = () => true;
    },
    draw2d: {
        Canvas: { extend: methods => methods },
        command: { CommandAdd: function () {} }
    }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(directory, 'i18n/en.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(directory, 'app/View.js'), 'utf8'), sandbox);
const event = { dropped: {}, x: 0, y: 0, context: { getCommandStack: () => ({ execute() { added++; } }) } };
const elements = [{ value: '1' }];

response = { status: 503, data: { error: 'visualplan_data_unavailable' } };
sandbox.example.View.checkData(elements, 'ext-group', event);
assert.equal(created, 0, 'Failed existence check created a block');
assert.equal(added, 0);
assert.equal(removed, false, 'Lookup failure closed the dialog');
assert.equal(loading, false, 'Lookup failure left the spinner visible');
assert(messages.some(message => message.includes(sandbox.languages.en.base_block_unavailable_string)));

messages = [];
response = { status: 200, data: { '1': { description: 'Existing ring group' } } };
sandbox.example.View.checkData(elements, 'ext-group', event);
assert.equal(created, 0, 'Duplicate ring group was created');
assert.equal(added, 0);

response = { status: 200, data: {} };
sandbox.example.View.checkData(elements, 'ext-group', event);
assert.equal(created, 1, 'Healthy empty list prevented creation');
assert.equal(added, 1);
assert.equal(removed, true);
assert.equal(loading, false);
console.log('PASS: failed lookups cannot create blocks; duplicate checks and retry still work');
