<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import { computed } from 'vue'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  Position,
  useVueFlow,
} from '@vue-flow/core'
import { NeTooltip } from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faCircleMinus } from '@fortawesome/free-solid-svg-icons'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  id: string
  source: string
  target: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
  selected?: boolean
  markerEnd?: string
  data: { removable: boolean; active?: boolean; preview?: boolean; picked?: boolean }
}>()

const emit = defineEmits<{ remove: [id: string] }>()

const { findNode, viewport } = useVueFlow()

const LOOP_GAP = 28

const path = computed((): [string, number, number] => {
  if (props.source === props.target) {
    const node = findNode(props.source)
    const top = (node?.computedPosition.y ?? props.sourceY) - LOOP_GAP
    const right = props.sourceX + LOOP_GAP
    const left = props.targetX - LOOP_GAP
    return [
      [
        `M ${props.sourceX} ${props.sourceY}`,
        `L ${right} ${props.sourceY}`,
        `L ${right} ${top}`,
        `L ${left} ${top}`,
        `L ${left} ${props.targetY}`,
        `L ${props.targetX} ${props.targetY}`,
      ].join(' '),
      (left + right) / 2,
      top,
    ]
  }
  const params = {
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  }
  if (props.targetX < props.sourceX) {
    const [d, x, y] = getSmoothStepPath({ ...params, borderRadius: 12, offset: LOOP_GAP })
    return [d, x, y]
  }
  const [d, x, y] = getBezierPath(params)
  return [d, x, y]
})

const buttonTransform = computed(
  () =>
    `translate(-50%, -50%) translate(${path.value[1]}px, ${path.value[2]}px) scale(${1 / viewport.value.zoom})`,
)
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :class="[
      'fill-none! stroke-2!',
      data.picked || data.active || data.preview
        ? 'stroke-primary-active!'
        : 'stroke-gray-400! dark:stroke-gray-500!',
    ]"
  />
  <EdgeLabelRenderer v-if="data.picked && data.removable">
    <div class="nodrag nopan pointer-events-auto absolute" :style="{ transform: buttonTransform }">
      <NeTooltip trigger-event="mouseenter focus" placement="top">
        <template #trigger>
          <button
            type="button"
            class="bg-elevation-0 text-secondary-neutral focus-visible:ring-primary-focus flex size-7 items-center justify-center rounded-full shadow ring-1 ring-gray-300 hover:text-rose-700 focus:outline-none focus-visible:ring-2 dark:ring-gray-600 dark:hover:text-rose-500"
            @click="emit('remove', id)"
          >
            <FontAwesomeIcon :icon="faCircleMinus" class="size-4" aria-hidden="true" />
            <span class="sr-only">{{ $t('visual_plan.remove_link') }}</span>
          </button>
        </template>
        <template #content>{{ $t('visual_plan.remove_link') }}</template>
      </NeTooltip>
    </div>
  </EdgeLabelRenderer>
</template>
