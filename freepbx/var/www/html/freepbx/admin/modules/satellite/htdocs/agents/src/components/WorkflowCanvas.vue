<script setup lang="ts">
import { computed, ref } from "vue";
import { VueFlow, Handle, Position, type Connection } from "@vue-flow/core";
import { Controls } from "@vue-flow/controls";
import { MiniMap } from "@vue-flow/minimap";
import { Background } from "@vue-flow/background";
import {
  NeButton,
  NeSideDrawer,
  NeTextInput,
  NeMultiselectCombobox,
} from "@nethesis/vue-components";
import { useI18n } from "vue-i18n";
import FieldSelect from "./FieldSelect.vue";
import SchemaFields from "./SchemaFields.vue";
import InputBindings from "./InputBindings.vue";
import { clone, ports, effectiveTools, toolKey, objectSchema } from "../model";
import type { Graph, Inventory, JsonObject } from "../types";
const props = defineProps<{
  modelValue: Graph;
  inventory: Inventory;
  readonly?: boolean;
  errors?: string[];
  trace?: JsonObject[];
}>();
const emit = defineEmits<{ "update:modelValue": [value: Graph] }>();
const { t, te } = useI18n();
function blockLabel(type: string) {
  const key = "blockNames." + type.replaceAll(".", "_");
  return te(key) ? t(key) : type;
}
const selected = ref(""),
  blockType = ref("conversation.collect");
const undoStack: Graph[] = [],
  redoStack: Graph[] = [];
const historyTick = ref(0);
const canUndo = computed(() => {
  void historyTick.value;
  return undoStack.length > 0;
});
const canRedo = computed(() => {
  void historyTick.value;
  return redoStack.length > 0;
});
const node = computed(() =>
  props.modelValue.nodes.find((n) => n.id === selected.value),
);
const manifest = computed(() =>
  props.inventory.blocks.find((b) => b.type === node.value?.type),
);
const blocks = computed(() =>
  props.inventory.blocks.filter((b) =>
    props.modelValue.entrypoints.every((entry) =>
      b.entrypoints.includes(entry),
    ),
  ),
);
const nodes = computed(() =>
  props.modelValue.nodes.map((n, index) => ({
    id: n.id,
    type: "workflow",
    position: {
      x:
        props.modelValue.layout[n.id]?.x ??
        props.modelValue.layout[n.id]?.pos_x ??
        60 + index * 300,
      y:
        props.modelValue.layout[n.id]?.y ??
        props.modelValue.layout[n.id]?.pos_y ??
        180,
    },
    data: {
      node: n,
      ports: ports(n, props.inventory.blocks),
      toolCount: effectiveTools(props.modelValue, n).length,
      error: props.errors?.includes(n.id),
      outcome: props.trace?.find((s) => (s.node_id || s.node) === n.id)
        ?.outcome,
    },
  })),
);
const edges = computed(() =>
  props.modelValue.edges.map((edge, i) => ({
    id: `edge-${i}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.outcome,
    label: edge.outcome,
    style: { stroke: "#6b7280", strokeWidth: 2 },
    labelBgStyle: { fill: "var(--color-gray-800)" },
    labelStyle: { fill: "var(--color-gray-100)" },
  })),
);
function change(next: Graph) {
  if (props.readonly) return;
  undoStack.push(clone(props.modelValue));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  historyTick.value++;
  emit("update:modelValue", next);
}
function undo() {
  const next = undoStack.pop();
  if (next) {
    redoStack.push(clone(props.modelValue));
    historyTick.value++;
    emit("update:modelValue", next);
  }
}
function redo() {
  const next = redoStack.pop();
  if (next) {
    undoStack.push(clone(props.modelValue));
    historyTick.value++;
    emit("update:modelValue", next);
  }
}
function nodeUpdate(key: string, value: unknown) {
  const next = clone(props.modelValue);
  const item = next.nodes.find((n) => n.id === selected.value);
  if (item) {
    (item as JsonObject)[key] = value;
    change(next);
  }
}
function configUpdate(key: string, value: unknown) {
  nodeUpdate("config", { ...node.value?.config, [key]: value });
}
function defaults(schema: JsonObject): any {
  if (schema.default !== undefined) return schema.default;
  if (schema.enum) return schema.enum[0];
  if (schema.type === "object")
    return Object.fromEntries(
      Object.entries(schema.properties || {})
        .filter(([k]) => (schema.required || []).includes(k))
        .map(([k, s]) => [k, defaults(s as JsonObject)]),
    );
  return schema.type === "array"
    ? []
    : schema.type === "boolean"
      ? false
      : ["integer", "number"].includes(schema.type)
        ? schema.minimum || 1
        : "";
}
function addNode() {
  const block = props.inventory.blocks.find((b) => b.type === blockType.value);
  if (!block) return;
  const next = clone(props.modelValue),
    id = "n-" + crypto.randomUUID().slice(0, 8),
    config = defaults(block.config_schema);
  if (
    block.type.startsWith("conversation.") &&
    block.type !== "conversation.speak"
  )
    Object.assign(config, {
      output_schema: objectSchema(),
      outcomes: ["success"],
      max_turns: 5,
      tool_mode: "inherit",
      tools: [],
    });
  next.nodes.push({
    id,
    type: block.type,
    version: block.version,
    name: blockLabel(block.type),
    config,
    inputs: {},
  });
  next.layout[id] = { x: 160, y: 40 + next.nodes.length * 30 };
  change(next);
  selected.value = id;
}
function removeNode() {
  const next = clone(props.modelValue);
  next.nodes = next.nodes.filter((n) => n.id !== selected.value);
  next.edges = next.edges.filter(
    (e) => e.source !== selected.value && e.target !== selected.value,
  );
  delete next.layout[selected.value];
  selected.value = "";
  change(next);
}
function connect(connection: Connection) {
  if (!connection.sourceHandle || connection.source === connection.target)
    return;
  const next = clone(props.modelValue);
  next.edges = next.edges.filter(
    (e) =>
      !(
        e.source === connection.source && e.outcome === connection.sourceHandle
      ),
  );
  next.edges.push({
    source: connection.source,
    target: connection.target,
    outcome: connection.sourceHandle,
  });
  change(next);
}
function drag({ node: moved }: JsonObject) {
  const next = clone(props.modelValue);
  next.layout[moved.id] = { x: moved.position.x, y: moved.position.y };
  change(next);
}
function removeEdges(changes: JsonObject[]) {
  const removed = new Set(
    changes
      .filter((c) => c.type === "remove")
      .map((c) => Number(c.id.replace("edge-", ""))),
  );
  if (removed.size) {
    const next = clone(props.modelValue);
    next.edges = next.edges.filter((_, i) => !removed.has(i));
    change(next);
  }
}
const allowedTools = computed(() =>
  (props.modelValue.tool_bindings || [])
    .filter((b) => b.conversation)
    .map((b) => ({
      id: toolKey(b),
      label:
        props.inventory.tool_versions.find(
          (v) => v.tool_id === b.tool_id && v.version === b.version,
        )?.definition.name || b.tool_id,
    })),
);
const selectedTools = computed({
  get: () =>
    allowedTools.value.filter((o) =>
      (node.value?.config.tools || []).includes(o.id),
    ),
  set: (value) =>
    configUpdate(
      "tools",
      value.map((o) => o.id),
    ),
});
const invokedTool = computed(() =>
  props.inventory.tool_versions.find(
    (row) =>
      row.tool_id === node.value?.config.tool?.tool_id &&
      row.version === node.value?.config.tool?.version,
  ),
);
</script>
<template>
  <div class="space-y-4">
    <div v-if="!readonly" class="flex flex-wrap items-end gap-3">
      <FieldSelect
        v-model="blockType"
        :label="t('addNode')"
        :options="
          blocks.map((b) => ({ id: b.type, label: blockLabel(b.type) }))
        "
        class="min-w-64"
      /><NeButton @click="addNode">{{ t("addNode") }}</NeButton
      ><NeButton :disabled="!canUndo" @click="undo">{{ t("undo") }}</NeButton
      ><NeButton :disabled="!canRedo" @click="redo">{{ t("redo") }}</NeButton>
    </div>
    <div class="nv-canvas">
      <VueFlow
        :nodes="nodes"
        :edges="edges"
        :nodes-draggable="!readonly"
        :nodes-connectable="!readonly"
        :edges-updatable="!readonly"
        :delete-key-code="null"
        fit-view-on-init
        @connect="connect"
        @node-click="selected = $event.node.id"
        @node-drag-stop="drag"
        @edges-change="removeEdges"
      >
        <Background :gap="20" pattern-color="#4b5563" /><Controls /><MiniMap
          pannable
          zoomable
        />
        <template #node-workflow="{ data, selected: isSelected }"
          ><div
            :class="['nv-node', { selected: isSelected, error: data.error }]"
          >
            <Handle
              v-if="!data.node.type.startsWith('start.')"
              type="target"
              :position="Position.Left"
            />
            <p class="mb-1 text-xs text-primary-700 dark:text-primary-400">
              {{ blockLabel(data.node.type) }}
            </p>
            <p class="font-medium">{{ data.node.name }}</p>
            <p v-if="data.toolCount" class="nv-muted mt-2 text-xs">
              {{ data.toolCount }} {{ t("enabledTools") }}
            </p>
            <p v-if="data.outcome" class="mt-2 text-xs text-primary-400">
              {{ data.outcome }}
            </p>
            <div
              v-for="port in data.ports"
              :key="port"
              class="relative mt-2 text-right text-xs"
            >
              <span>{{ port }}</span
              ><Handle
                :id="port"
                type="source"
                :position="Position.Right"
                :style="{ top: '50%', right: '-20px' }"
              />
            </div></div
        ></template>
      </VueFlow>
    </div>
    <NeSideDrawer
      :visible="Boolean(node) && !readonly"
      :title="node?.name || t('node')"
      :close-aria-label="t('close')"
      @close="selected = ''"
    >
      <div v-if="node" class="space-y-6 p-6">
        <NeTextInput
          :model-value="node.name"
          :label="t('nodeName')"
          @update:model-value="nodeUpdate('name', $event)"
        />
        <template
          v-if="
            ['conversation.collect', 'conversation.decision'].includes(
              node.type,
            )
          "
        >
          <SchemaFields
            :model-value="node.config"
            :schema="{
              ...manifest?.config_schema,
              properties: Object.fromEntries(
                Object.entries(manifest?.config_schema.properties || {}).filter(
                  ([key]) => !['tools', 'tool_mode'].includes(key),
                ),
              ),
            }"
            @update:model-value="
              nodeUpdate('config', { ...node.config, ...$event })
            "
          />
          <FieldSelect
            :model-value="node.config.tool_mode || 'selected'"
            :label="t('enabledTools')"
            :options="[
              { id: 'inherit', label: t('inherit') },
              { id: 'selected', label: t('selected') },
            ]"
            @update:model-value="configUpdate('tool_mode', $event)"
          />
          <NeMultiselectCombobox
            v-if="node.config.tool_mode !== 'inherit'"
            v-model="selectedTools"
            :options="allowedTools"
            :label="t('tools')"
            :no-results-label="t('noResults')"
            :no-options-label="t('noOptions')"
            :optional-label="t('optional')"
            :user-input-label="t('choose')"
            :limited-options-label="t('tools')"
          />
          <p class="nv-muted">
            {{ effectiveTools(modelValue, node).length }}
            {{ t("enabledTools") }}
          </p>
        </template>
        <FieldSelect
          v-else-if="node.type === 'tool.invoke'"
          :model-value="node.config.tool ? toolKey(node.config.tool) : ''"
          :label="t('tools')"
          :options="
            (modelValue.tool_bindings || [])
              .filter((b) => b.workflow)
              .map((b) => ({
                id: toolKey(b),
                label:
                  inventory.tool_versions.find(
                    (v) => v.tool_id === b.tool_id && v.version === b.version,
                  )?.definition.name || b.tool_id,
              }))
          "
          @update:model-value="
            configUpdate(
              'tool',
              (() => {
                const b = modelValue.tool_bindings?.find(
                  (b) => toolKey(b) === $event,
                );
                return b ? { tool_id: b.tool_id, version: b.version } : {};
              })(),
            )
          "
        />
        <SchemaFields
          v-else
          :model-value="node.config"
          :schema="manifest?.config_schema || {}"
          @update:model-value="nodeUpdate('config', $event)"
        />
        <InputBindings
          :model-value="node.inputs"
          :schema="
            invokedTool?.definition.input_schema || manifest?.input_schema || {}
          "
          :graph="modelValue"
          :node-id="node.id"
          @update:model-value="nodeUpdate('inputs', $event)"
        />
        <NeButton kind="danger" @click="removeNode">{{
          t("deleteNode")
        }}</NeButton>
      </div>
    </NeSideDrawer>
  </div>
</template>
