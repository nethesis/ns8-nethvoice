const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../htdocs/app/widgets/Base.js"), "utf8");
const sandbox = {
    draw2d: {
        shape: { layout: { VerticalLayout: { extend: methods => methods } } },
        Connection: { extend: methods => methods }
    },
    $: { extend: Object.assign, isNumeric: value => !isNaN(Number(value)) },
    languages: { en: {
        base_agent_string: "Agent",
        view_agent_flow_string: "CleverAI flow",
        view_agent_trunk_string: "CleverAI trunk",
        base_agent_fallback_string: "Fallback"
    } },
    browserLang: "en"
};
vm.runInNewContext(source, sandbox);

let block;
const fakeFigure = {
    setPersistentAttributes(value) { block = value; }
};
const form = [
    { value: "support-flow" },
    { value: "7", selectedOptions: [{ text: "Office (openai)" }] }
];
assert.equal(sandbox.Base.creationSwitch.call(
    fakeFigure, form, "satellite-agent-destination", "Agent"
), true);
assert.match(block.id, /^satellite-agent-destination%[A-Z][0-9]+$/);
assert.equal(block.bgColor, "#528ba7");
assert.deepEqual(Array.from(block.entities, entity => entity.type), [
    "input", "text", "text", "output"
]);
assert.equal(block.entities[0].id, block.id);
const suffix = block.id.split("%")[1];
assert.equal(block.entities[1].id, "agent_flow%" + suffix);
assert.equal(block.entities[2].id, "agent_trunk%" + suffix);
assert.equal(block.entities[3].id, "agent_fallback%" + suffix);
assert.equal(block.userData.id, null);
assert.equal(block.userData.cleverai_trunk_id, 7);
assert.equal(block.userData.cleverai_flow, "support-flow");
assert.equal(block.userData.fallback_destination, null);
assert.equal(block.userData.fallback_touched, false);
assert.doesNotMatch(JSON.stringify(block), /api_key|password|sip_auth_username/);

const viewSource = fs.readFileSync(path.join(__dirname, "../htdocs/app/View.js"), "utf8");
function field(initial) {
    let value = initial;
    return {
        val(next) {
            if (arguments.length) { value = next; return this; }
            return value;
        },
        toggleClass() { return this; },
        text() { return this; }
    };
}
const flowField = field(" support.flow:1 ");
const trunkField = field("7");
const viewSandbox = {
    example: {},
    draw2d: { Canvas: { extend: methods => methods } },
    $: selector => ({
        "#satellite-agent-destination-flow": flowField,
        "#satellite-agent-destination-trunk": trunkField,
        "#modalCreation .agent-form-error": field("")
    })[selector],
    languages: { en: { view_error_required_string: "Required" } },
    browserLang: "en"
};
viewSandbox.$.trim = value => String(value).trim();
vm.runInNewContext(viewSource, viewSandbox);
assert.deepEqual(Array.from(viewSandbox.example.View.getDestination(
    "satellite-agent-destination-42,s,1"
)), ["satellite-agent-destination", "42"]);
assert.equal(viewSandbox.example.View.validateAgentForm(), true);
assert.equal(flowField.val(), "support.flow:1");
flowField.val("bad flow");
assert.equal(viewSandbox.example.View.validateAgentForm(), false);

class CommandDelete {}
class CommandAdd {}
class CommandReconnect {}
viewSandbox.draw2d.Connection = class {};
viewSandbox.draw2d.command = {
    CommandDelete, CommandAdd, CommandReconnect,
    CommandStack: { PRE_EXECUTE: 1, PRE_REDO: 2, PRE_UNDO: 4, POST_EXECUTE: 8 }
};
viewSandbox.document = { getElementById: () => ({
    children: [{}], addEventListener() {}
}) };
let stackListener;
viewSandbox.example.View.init.call({
    _super() {},
    setScrollArea() {},
    getCommandStack() {
        return { addEventListener(listener) { stackListener = listener; } };
    }
}, "canvas");
function agentPort(id) {
    const data = { fallback_touched: false };
    const figure = {
        id: "satellite-agent-destination%" + id,
        getUserData: () => data,
        setUserData(value) { Object.assign(data, value); }
    };
    return {
        data,
        port: {
            getParent: () => ({
                id: "agent_fallback%" + id,
                getParent: () => figure
            })
        }
    };
}
const oldAgent = agentPort("old");
const newAgent = agentPort("new");
const reconnect = new CommandReconnect();
reconnect.oldSourcePort = oldAgent.port;
reconnect.newSourcePort = newAgent.port;
reconnect.con = { getSource: () => newAgent.port };
stackListener.stackChanged({
    getCommand: () => reconnect,
    getDetails: () => 8,
    isPostChangeEvent: () => true
});
assert.equal(oldAgent.data.fallback_touched, true);
assert.equal(newAgent.data.fallback_touched, true);
