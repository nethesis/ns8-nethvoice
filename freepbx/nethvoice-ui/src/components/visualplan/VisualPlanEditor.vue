<!--
  Copyright (C) 2026 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRaw,
  useTemplateRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRouter,
  type RouteLocationRaw,
} from 'vue-router'
import { useMutation, useQueryCache } from '@pinia/colada'
import * as v from 'valibot'
import { cloneDeep } from 'lodash'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import {
  MarkerType,
  Panel,
  SelectionMode,
  VueFlow,
  getRectOfNodes,
  useVueFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeDragEvent,
  type OnConnectStartParams,
  type XYPosition,
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import {
  NeBadgeV2,
  NeButton,
  NeDropdown,
  NeInlineNotification,
  NeModal,
  NeSideDrawer,
  NeTooltip,
} from '@nethesis/vue-components'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faSidebarLeft } from '@nethesis/nethesis-solid-svg-icons'
import {
  faArrowLeft,
  faArrowPointer,
  faCircleArrowDown,
  faCircleXmark,
  faCirclePlus,
  faExpand,
  faFloppyDisk,
  faHand,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faMap,
  faPlay,
  faRotateLeft,
  faRotateRight,
  faSitemap,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import {
  saveVisualPlan,
  VisualPlanValidationError,
  type VisualPlanChange,
} from '@/lib/visualplan/api'
import { INBOUND_ROUTES_KEY } from '@/lib/routes/inbound'
import {
  getOutputs,
  NODE_TYPES,
  type FlowEdge as FlowEdgeData,
  type NodeType,
} from '@/lib/visualplan/model'
import { nodeHeight, NODE_WIDTH } from '@/lib/visualplan/layout'
import { alignToGuides, type Rect } from '@/lib/visualplan/guides'
import { toPng } from 'html-to-image'
import { describeError, useNotificationsStore } from '@/stores/notifications'
import { useVisualPlanStore } from '@/stores/visualPlan'
import { useVisualPlanLabels } from '@/composables/useVisualPlanLabels'
import { hasErrors } from '@/lib/visualplan/validation'
import { saveVisualPlanLayout } from '@/lib/visualplan/api'
import { PALETTE_MIME, type PaletteItem } from '@/components/visualplan/nodeMeta'
import FlowNodeCard from '@/components/visualplan/FlowNodeCard.vue'
import FlowEdge from '@/components/visualplan/FlowEdge.vue'
import NodeInspector from '@/components/visualplan/NodeInspector.vue'
import NodePalette from '@/components/visualplan/NodePalette.vue'
import FlowSearch from '@/components/visualplan/FlowSearch.vue'
import QuickAddMenu from '@/components/visualplan/QuickAddMenu.vue'
import SimulationPanel from '@/components/visualplan/SimulationPanel.vue'
import SelectionPanel from '@/components/visualplan/SelectionPanel.vue'

const props = defineProps<{ readOnly: boolean; reloading?: boolean }>()

const emit = defineEmits<{
  saved: [routeKey: string | null, refs: Record<string, string>]
  reload: []
}>()

const { t } = useI18n()
const router = useRouter()
const store = useVisualPlanStore()
const notificationsStore = useNotificationsStore()
const queryCache = useQueryCache()
const { nodeTitle, typeLabel, outputLabel, issueText, issueMessage, fieldLabel } =
  useVisualPlanLabels()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const motion = (duration: number) => (reducedMotion.value ? 0 : duration)

type Snap =
  | { kind: 'link'; source: string; output: string; target: string }
  | { kind: 'insert'; edge: FlowEdgeData }

type QuickAdd = { x: number; y: number; source: string; output: string }

const SNAP_EDGE_ID = '__snap'
const TOOLS = [
  { id: 'pan', icon: faHand, key: 'H' },
  { id: 'select', icon: faArrowPointer, key: 'V' },
] as const
const MAGNET_RADIUS = 180
const INSERT_RADIUS = 90
const {
  fitView,
  zoomIn,
  zoomOut,
  setCenter,
  screenToFlowCoordinate,
  findNode,
  updateNode,
  getNodes,
  viewport,
  setViewport,
} = useVueFlow()

const isLarge = useMediaQuery('(min-width: 1024px)')
const isTouch = useMediaQuery('(pointer: coarse)')
const tool = ref<'pan' | 'select'>('pan')
const selectMode = computed(() => tool.value === 'select' && !isTouch.value)
const showMinimap = ref(true)
const paletteOpen = ref(true)
const paletteDrawerShown = ref(false)
const selectedEdgeId = ref<string | null>(null)
const animating = ref(false)
const snap = ref<Snap | null>(null)
const quickAdd = ref<QuickAdd | null>(null)
let pendingConnection: { source: string; output: string } | null = null
let connectionMade = false
const unsavedModalShown = ref(false)
const pendingLocation = ref<RouteLocationRaw | null>(null)
let leaveConfirmed = false

const PaletteItemSchema = v.union([
  v.object({ kind: v.literal('new'), type: v.picklist(NODE_TYPES) }),
  v.object({ kind: v.literal('existing'), id: v.string() }),
])

const visibleErrorCount = computed(
  () =>
    Object.values(store.issues)
      .flat()
      .filter((issue) => issue.level === 'error').length,
)

const blockedCount = ref(0)

const issueItems = computed(() =>
  Object.entries(store.issues).flatMap(([id, list]) => {
    const node = store.flow.nodes[id]
    if (!node) return []
    return list.map((issue, index) => ({
      id: `${id}-${index}`,
      label: `${nodeTitle(node) || typeLabel(node.type)}: ${issueText(node, issue)}`,
      icon: issue.level === 'error' ? faCircleXmark : faTriangleExclamation,
      danger: issue.level === 'error',
      action: () => focusNode(id),
    }))
  }),
)

const warningCount = computed(
  () =>
    Object.values(store.issues)
      .flat()
      .filter((issue) => issue.level === 'warning').length,
)
const unavailable = computed(() => store.data?.unavailable ?? [])

const UNAVAILABLE_TYPES: Record<string, NodeType> = {
  inboundRoutes: 'inboundRoute',
  extensions: 'extension',
  conferences: 'conference',
  ringGroups: 'ringGroup',
  queues: 'queue',
  ivrs: 'ivr',
  cqrs: 'cqr',
  announcements: 'announcement',
  timeConditions: 'timeCondition',
  callFlowControls: 'callFlowControl',
  setCallerIds: 'setCallerId',
  directDids: 'directDid',
  queueExits: 'queueExit',
  queueOptions: 'queueOptions',
  queuePriorities: 'queuePriority',
}

const unavailableLabels = computed(() =>
  unavailable.value
    .map((key) => {
      const type = UNAVAILABLE_TYPES[key]
      return type ? typeLabel(type) : key
    })
    .join(', '),
)

const rootTitle = computed(() => {
  const root = store.flow.nodes[store.flow.rootId]
  return root ? nodeTitle(root) : ''
})

const flowNodes = computed<Node[]>(() =>
  store.nodes
    .filter((node) => !store.hidden.has(node.id))
    .map((node) => ({
      id: node.id,
      type: 'flow',
      position: store.positions[node.id] ?? { x: 0, y: 0 },
      selected: store.selectedIds.includes(node.id),
      draggable: !store.readOnly,
      ariaLabel: `${typeLabel(node.type)}: ${nodeTitle(node) || t('visual_plan.untitled')}`,
      domAttributes: {
        'aria-roledescription': typeLabel(node.type),
        'aria-describedby': 'visual-plan-node-hint',
      },
      data: {},
    })),
)

const panelMode = computed(() => {
  if (store.simulation) return 'simulation'
  if (store.selectedIds.length > 1) return 'selection'
  return store.selectedNode ? 'node' : null
})

const EDGE_SEPARATOR = ' → '

const edgeId = (source: string, output: string) => `${source}${EDGE_SEPARATOR}${output}`

const edgeLabel = (sourceId: string, outputId: string, targetId: string): string => {
  const source = store.flow.nodes[sourceId]
  const target = store.flow.nodes[targetId]
  const output = source ? getOutputs(source).find((item) => item.id === outputId) : undefined
  return t('visual_plan.edge_label', {
    from: source ? nodeTitle(source) || typeLabel(source.type) : sourceId,
    output: output ? outputLabel(output) : outputId,
    to: target ? nodeTitle(target) || typeLabel(target.type) : targetId,
  })
}

const activeEdgeIds = computed(() => {
  const active = new Set<string>()
  const steps = store.simulationResult?.steps
  if (steps) {
    for (const step of steps) {
      if (step.output) {
        active.add(edgeId(step.nodeId, step.output))
      }
    }
    return active
  }
  const start = store.selectedId
  if (!start) {
    return active
  }
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    const id = queue.shift()
    for (const edge of store.flow.edges) {
      if (edge.source === id) {
        active.add(edgeId(edge.source, edge.output))
        if (!seen.has(edge.target)) {
          seen.add(edge.target)
          queue.push(edge.target)
        }
      }
    }
  }
  for (const edge of store.flow.edges) {
    if (edge.target === start) {
      active.add(edgeId(edge.source, edge.output))
    }
  }
  return active
})

watch(
  () => store.revision,
  () => {
    if (selectedEdgeId.value && !flowEdges.value.some((edge) => edge.id === selectedEdgeId.value)) {
      selectedEdgeId.value = null
    }
  },
)

const flowEdges = computed<Edge[]>(() => {
  const insertId =
    snap.value?.kind === 'insert' ? edgeId(snap.value.edge.source, snap.value.edge.output) : null
  const visibleEdges = store.flow.edges.filter(
    (edge) => !store.hidden.has(edge.source) && !store.hidden.has(edge.target),
  )
  const edges: Edge[] = visibleEdges.map((edge) => {
    const id = edgeId(edge.source, edge.output)
    const active = activeEdgeIds.value.has(id)
    return {
      id,
      source: edge.source,
      sourceHandle: edge.output,
      target: edge.target,
      targetHandle: 'in',
      type: 'flow',
      animated: (active || id === insertId) && !reducedMotion.value,
      selected: id === selectedEdgeId.value,
      ariaLabel: edgeLabel(edge.source, edge.output, edge.target),
      domAttributes: { 'aria-roledescription': t('visual_plan.link_role') },
      markerEnd: MarkerType.ArrowClosed,
      data: {
        removable: !store.readOnly,
        active,
        preview: id === insertId,
        picked: id === selectedEdgeId.value,
      },
    }
  })
  if (snap.value?.kind === 'link') {
    edges.push({
      id: SNAP_EDGE_ID,
      source: snap.value.source,
      sourceHandle: snap.value.output,
      target: snap.value.target,
      targetHandle: 'in',
      type: 'flow',
      animated: true,
      selectable: false,
      markerEnd: MarkerType.ArrowClosed,
      data: { removable: false, active: false, preview: true },
    })
  }
  return edges
})

const {
  mutate: save,
  isLoading: saving,
  error: saveError,
  reset: resetSave,
} = useMutation({
  mutation: async (input: { changes: VisualPlanChange[]; routeKey: string | null }) => ({
    refs: await saveVisualPlan(input.changes),
    routeKey: input.routeKey,
  }),
  onSuccess({ refs, routeKey }) {
    leaveConfirmed = true
    queryCache.invalidateQueries({ key: [INBOUND_ROUTES_KEY] })
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('visual_plan.saved'),
        description: t('visual_plan.saved_description', { name: rootTitle.value }),
      })
    }, 500)
    emit('saved', routeKey, refs)
  },
  onError(error) {
    if (error instanceof VisualPlanValidationError) {
      store.setServerErrors(error.errors)
      const first = store.errorNodeIds[0]
      if (first) {
        focusNode(first)
      }
    }
  },
})

const { mutate: saveLayout, isLoading: savingLayout } = useMutation({
  mutation: async (route: string) => {
    const sent = cloneDeep(toRaw(store.positions))
    await saveVisualPlanLayout(route, sent)
    return sent
  },
  onSuccess(sent) {
    store.markLayoutSaved(sent)
    setTimeout(() => {
      notificationsStore.createNotification({
        kind: 'success',
        title: t('visual_plan.layout_saved'),
        description: t('visual_plan.layout_saved_description'),
      })
    }, 500)
  },
  onError(error) {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('visual_plan.cannot_save_layout'),
      description: describeError(error),
    })
  },
})

const saveErrorDescription = computed(() => {
  if (!(saveError.value instanceof VisualPlanValidationError)) {
    return describeError(saveError.value)
  }
  const general = store.generalErrors.map((item) => {
    const label = item.field ? fieldLabel(undefined, item.field) : ''
    const text = issueMessage({ code: item.message })
    return label ? `${label}: ${text}` : text
  })
  return [t('visual_plan.save_validation_failed'), ...general].join(' ')
})

watch(
  () => store.revision,
  () => {
    if (saveError.value) {
      resetSave()
    }
    if (blockedCount.value) {
      blockedCount.value = store.errorNodeIds.length
    }
  },
)

watch(
  [() => props.readOnly, saving, savingLayout, () => props.reloading],
  ([readOnly, isSaving, isSavingLayout, reloading]) => {
    store.readOnly = Boolean(readOnly || isSaving || isSavingLayout || reloading)
  },
  { immediate: true },
)

watch(
  () => props.reloading,
  (reloading, wasReloading) => {
    if (wasReloading && !reloading) {
      leaveConfirmed = false
    }
  },
)

function requestSave() {
  if (
    saving.value ||
    savingLayout.value ||
    props.reloading ||
    props.readOnly ||
    !store.isDirty ||
    unavailable.value.length
  ) {
    return
  }
  if (hasErrors(store.allIssues)) {
    store.revealErrors = true
    blockedCount.value = store.errorNodeIds.length
    const first = store.errorNodeIds[0]
    if (first) {
      focusNode(first)
    }
    return
  }
  blockedCount.value = 0
  resetSave()
  if (store.changes.length) {
    save({ changes: cloneDeep(store.changes), routeKey: store.savedRouteKey })
  } else if (store.originalRouteKey !== null) {
    saveLayout(store.originalRouteKey)
  }
}

function focusNode(id: string) {
  store.reveal(id)
  store.selectedId = id
  store.focusRequest += 1
  nextTick(() => centerOn(id, false))
}

function centerOn(id: string, zoomIn = true) {
  const position = store.positions[id]
  const node = store.flow.nodes[id]
  if (position && node) {
    setCenter(position.x + NODE_WIDTH / 2, position.y + nodeHeight(node) / 2, {
      zoom: zoomIn ? Math.max(viewport.value.zoom, 1) : Math.max(viewport.value.zoom, 0.6),
      duration: motion(300),
    })
  }
}

function ensureVisible(id: string) {
  nextTick(() => window.setTimeout(() => revealOnCanvas(id), 80))
}

function revealOnCanvas(id: string) {
  const rect = canvasRef.value?.getBoundingClientRect()
  const graphNode = findNode(id)
  if (!rect || !graphNode) return
  const { x, y, zoom } = viewport.value
  const left = graphNode.computedPosition.x * zoom + x
  const top = graphNode.computedPosition.y * zoom + y
  const right = left + graphNode.dimensions.width * zoom
  const bottom = top + graphNode.dimensions.height * zoom
  if (left < 0 || top < 0 || right > rect.width || bottom > rect.height) {
    setCenter(
      graphNode.computedPosition.x + graphNode.dimensions.width / 2,
      graphNode.computedPosition.y + graphNode.dimensions.height / 2,
      { zoom, duration: motion(300) },
    )
  }
}

watch(
  () => store.selectedId,
  (id) => {
    if (!id) return
    ensureVisible(id)
  },
)

const canvasRef = useTemplateRef<HTMLElement>('canvas')
const { width: canvasWidth } = useElementSize(canvasRef)

function viewportCenter() {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) {
    return store.nextPosition()
  }
  const point = screenToFlowCoordinate({
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  })
  return { x: point.x - NODE_WIDTH / 2, y: point.y - 40 }
}

function withAnimation(action: () => void) {
  animating.value = true
  action()
  window.setTimeout(() => {
    animating.value = false
  }, 350)
}

function addFromPalette(item: PaletteItem, position?: { x: number; y: number }) {
  const at = position ?? store.placementFor(viewportCenter())
  const id = item.kind === 'new' ? store.addNode(item.type, at) : store.addExisting(item.id, at)
  paletteDrawerShown.value = false
  if (id) ensureVisible(id)
}

function onDrop(event: DragEvent) {
  const raw = event.dataTransfer?.getData(PALETTE_MIME)
  if (!raw || store.readOnly) return
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return
  }
  const result = v.safeParse(PaletteItemSchema, parsed)
  if (!result.success) return
  const item: PaletteItem = result.output
  const point = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  addFromPalette(item, { x: point.x - NODE_WIDTH / 2, y: point.y - 30 })
}

function onConnect(connection: Connection) {
  connectionMade = true
  if (connection.sourceHandle) {
    store.connect(connection.source, connection.sourceHandle, connection.target)
  }
}

function onConnectStart(params: OnConnectStartParams) {
  connectionMade = false
  pendingConnection =
    params.handleType === 'source' && params.nodeId && params.handleId
      ? { source: params.nodeId, output: params.handleId }
      : null
}

function onConnectEnd(event?: MouseEvent | TouchEvent) {
  const from = pendingConnection
  pendingConnection = null
  if (!from || connectionMade || store.readOnly || !event) {
    return
  }
  const point = 'changedTouches' in event ? event.changedTouches[0] : event
  if (!point) {
    return
  }
  const target = document.elementFromPoint(point.clientX, point.clientY)
  if (!(target instanceof Element) || !canvasRef.value?.contains(target)) {
    return
  }
  const dropNode = target.closest<HTMLElement>('.vue-flow__node')?.dataset.id
  if (dropNode) {
    if (dropNode !== store.flow.rootId && dropNode !== from.source) {
      store.connect(from.source, from.output, dropNode)
    }
    return
  }
  if (target.closest('.vue-flow__handle, .vue-flow__panel, .vue-flow__minimap')) {
    return
  }
  const menu = { x: point.clientX, y: point.clientY, ...from }
  window.setTimeout(() => {
    quickAdd.value = menu
  })
}

function pickQuickAdd(type: NodeType) {
  const current = quickAdd.value
  quickAdd.value = null
  if (!current) {
    return
  }
  const point = screenToFlowCoordinate({ x: current.x, y: current.y })
  const id = store.addNode(type, { x: point.x + 16, y: point.y - 30 }, current)
  if (id) ensureVisible(id)
}

function pickQuickAddExisting(catalogId: string) {
  const current = quickAdd.value
  quickAdd.value = null
  if (!current) {
    return
  }
  const point = screenToFlowCoordinate({ x: current.x, y: current.y })
  const id = store.addExisting(catalogId, { x: point.x + 16, y: point.y - 30 }, current)
  if (id) ensureVisible(id)
}

const distance = (a: XYPosition, b: XYPosition) => Math.hypot(a.x - b.x, a.y - b.y)

const handleCenter = (nodeId: string, handleId: string): XYPosition | null => {
  const graphNode = findNode(nodeId)
  const handle = graphNode?.handleBounds.source?.find((item) => item.id === handleId)
  if (!graphNode || !handle) {
    return null
  }
  return {
    x: graphNode.computedPosition.x + handle.x + handle.width / 2,
    y: graphNode.computedPosition.y + handle.y + handle.height / 2,
  }
}

type DragCache = {
  id: string
  others: Rect[]
  midpoints: { edge: FlowEdgeData; point: XYPosition }[]
  outlets: { source: string; output: string; point: XYPosition }[]
}

let dragCache: DragCache | null = null

function buildDragCache(id: string): DragCache {
  const edges = store.flow.edges
  const used = new Set(edges.map((edge) => `${edge.source}${EDGE_SEPARATOR}${edge.output}`))
  const midpoints = edges.flatMap((edge) => {
    const from = handleCenter(edge.source, edge.output)
    const target = findNode(edge.target)
    if (!from || !target) return []
    const to = {
      x: target.computedPosition.x,
      y: target.computedPosition.y + target.dimensions.height / 2,
    }
    return [{ edge, point: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 } }]
  })
  const outlets = store.nodes.flatMap((node) =>
    node.id === id || store.hidden.has(node.id)
      ? []
      : getOutputs(node).flatMap((output) => {
          if (used.has(`${node.id}${EDGE_SEPARATOR}${output.id}`)) return []
          const point = handleCenter(node.id, output.id)
          return point ? [{ source: node.id, output: output.id, point }] : []
        }),
  )
  const others = getNodes.value
    .filter((item) => item.id !== id)
    .flatMap((item) => {
      const rect = rectOf(item.id)
      return rect ? [rect] : []
    })
  return { id, others, midpoints, outlets }
}

function findSnap(cache: DragCache, position: XYPosition, height: number): Snap | null {
  const { id } = cache
  const edges = store.flow.edges
  if (id === store.flow.rootId || edges.some((edge) => edge.target === id)) {
    return null
  }
  const center = { x: position.x + NODE_WIDTH / 2, y: position.y + height / 2 }
  const dragged = store.flow.nodes[id]
  if (dragged && getOutputs(dragged).length && !edges.some((edge) => edge.source === id)) {
    const hit = cache.midpoints.find(
      (item) => item.edge.source !== id && distance(center, item.point) < INSERT_RADIUS,
    )
    if (hit) {
      return { kind: 'insert', edge: hit.edge }
    }
  }
  const inlet = { x: position.x, y: position.y + height / 2 }
  let best: Snap | null = null
  let bestDistance = MAGNET_RADIUS
  for (const outlet of cache.outlets) {
    if (outlet.point.x > inlet.x) continue
    const gap = distance(outlet.point, inlet)
    if (gap < bestDistance) {
      bestDistance = gap
      best = { kind: 'link', source: outlet.source, output: outlet.output, target: id }
    }
  }
  return best
}

const guides = ref<{ vertical: number | null; horizontal: number | null }>({
  vertical: null,
  horizontal: null,
})
let snappedPosition: { id: string; position: XYPosition } | null = null

const rectOf = (id: string): Rect | null => {
  const graphNode = findNode(id)
  if (!graphNode) {
    return null
  }
  return {
    x: graphNode.computedPosition.x,
    y: graphNode.computedPosition.y,
    width: graphNode.dimensions.width,
    height: graphNode.dimensions.height,
  }
}

function onNodeDrag(event: NodeDragEvent) {
  dragActive = true
  if (store.readOnly || event.nodes.length !== 1) {
    snap.value = null
    guides.value = { vertical: null, horizontal: null }
    snappedPosition = null
    return
  }
  const { id, dimensions } = event.node
  if (dragCache?.id !== id) {
    dragCache = buildDragCache(id)
  }
  const aligned = alignToGuides({ ...event.node.position, ...dimensions }, dragCache.others)
  guides.value = { vertical: aligned.vertical, horizontal: aligned.horizontal }
  const position = { x: aligned.x, y: aligned.y }
  if (aligned.vertical !== null || aligned.horizontal !== null) {
    updateNode(id, { position })
  }
  snappedPosition = { id, position }
  snap.value = findSnap(dragCache, position, dimensions.height || 0)
}

let dragActive = false

function onNodeDragStop(event: NodeDragEvent) {
  dragActive = false
  dragCache = null
  const current = snap.value
  const snapped = snappedPosition
  snap.value = null
  snappedPosition = null
  guides.value = { vertical: null, horizontal: null }

  const positionOf = (id: string, position: XYPosition) => {
    const final = snapped?.id === id ? snapped.position : position
    return { x: Math.round(final.x), y: Math.round(final.y) }
  }
  const [single] = event.nodes
  if (event.nodes.length === 1 && single) {
    const position = positionOf(single.id, single.position)
    if (current?.kind === 'link' && current.target === single.id) {
      store.dropOnLink(single.id, position, current.source, current.output)
    } else if (current?.kind === 'insert') {
      store.dropOnEdge(single.id, position, current.edge)
    } else {
      store.moveNode(single.id, position)
    }
    return
  }
  store.moveNodes(
    Object.fromEntries(event.nodes.map((node) => [node.id, positionOf(node.id, node.position)])),
  )
}

function onNodesChange(changes: NodeChange[]) {
  const moves: Record<string, XYPosition> = {}
  for (const change of changes) {
    if (change.type === 'position' && change.dragging === false && change.position) {
      moves[change.id] = { x: Math.round(change.position.x), y: Math.round(change.position.y) }
    }
  }
  if (Object.keys(moves).length && !store.readOnly && !dragActive) {
    store.moveNodes(moves)
  }
  const selection = changes.flatMap((change) => (change.type === 'select' ? [change] : []))
  if (!selection.length) {
    return
  }
  const next = new Set(store.selectedIds)
  for (const change of selection) {
    if (change.selected) {
      next.add(change.id)
    } else {
      next.delete(change.id)
    }
  }
  const ids = [...next]
  if (
    ids.length !== store.selectedIds.length ||
    ids.some((id) => !store.selectedIds.includes(id))
  ) {
    store.selectedIds = ids
  }
  if (ids.length) {
    selectedEdgeId.value = null
  }
}

const guideStyle = computed(() => ({
  vertical:
    guides.value.vertical === null
      ? null
      : { left: `${guides.value.vertical * viewport.value.zoom + viewport.value.x}px` },
  horizontal:
    guides.value.horizontal === null
      ? null
      : { top: `${guides.value.horizontal * viewport.value.zoom + viewport.value.y}px` },
}))

function startSimulation() {
  store.selectedIds = []
  store.simulation = { date: new Date(), callFlowStates: {}, menuChoices: {}, answered: {} }
  ensureVisible(store.flow.rootId)
}

const exporting = ref(false)

async function exportImage() {
  const pane = canvasRef.value?.querySelector('.vue-flow__transformationpane')
  const nodes = getNodes.value
  if (!(pane instanceof HTMLElement) || !nodes.length || !canvasRef.value) {
    return
  }
  exporting.value = true
  const collapsed = [...store.collapsedIds]
  if (collapsed.length) {
    store.collapsedIds = []
    await nextTick()
    await new Promise((resolve) => window.setTimeout(resolve, 100))
  }
  const paths = [...pane.querySelectorAll<SVGPathElement>('.vue-flow__edge path')]
  const previous = paths.map((path) => path.getAttribute('style'))
  for (const path of paths) {
    const computed = getComputedStyle(path)
    path.style.stroke = computed.stroke
    path.style.strokeWidth = computed.strokeWidth
    path.style.fill = computed.fill
    path.style.strokeDasharray = 'none'
    path.style.animation = 'none'
  }
  try {
    const padding = 48
    const bounds = getRectOfNodes(getNodes.value)
    const width = Math.ceil(bounds.width + padding * 2)
    const height = Math.ceil(bounds.height + padding * 2)
    const url = await toPng(pane, {
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      width,
      height,
      pixelRatio: 2,
      filter: (element) => !(element instanceof Element && element.classList.contains('nodrag')),
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${padding - bounds.x}px, ${padding - bounds.y}px) scale(1)`,
      },
    })
    const link = document.createElement('a')
    link.download = `visual-plan-${(rootTitle.value || 'flow').replace(/[^\w-]+/g, '_')}.png`
    link.href = url
    link.click()
  } catch (error) {
    notificationsStore.createNotification({
      kind: 'error',
      title: t('visual_plan.export.cannot_export'),
      description: describeError(error),
    })
  } finally {
    paths.forEach((path, index) => {
      const style = previous[index]
      if (style === null || style === undefined) {
        path.removeAttribute('style')
      } else {
        path.setAttribute('style', style)
      }
    })
    store.collapsedIds = collapsed
    exporting.value = false
  }
}

function removeEdge(id: string) {
  const index = id.lastIndexOf(EDGE_SEPARATOR)
  const source = index < 0 ? '' : id.slice(0, index)
  const output = index < 0 ? '' : id.slice(index + EDGE_SEPARATOR.length)
  if (source && output) {
    store.connect(source, output, '')
  }
  selectedEdgeId.value = null
}

function pickSearchResult(id: string) {
  store.reveal(id)
  store.selectedId = id
  centerOn(id)
}

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

const editorRef = useTemplateRef<HTMLElement>('editor')

const isEditorTarget = (target: EventTarget | null) =>
  target === document.body ||
  (target instanceof Element &&
    Boolean(editorRef.value?.contains(target)) &&
    !target.closest('[role="dialog"], [data-visual-plan-form]'))

const isCanvasTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(canvasRef.value?.contains(target))

function onKeydown(event: KeyboardEvent) {
  const mod = event.metaKey || event.ctrlKey

  if (mod && event.key.toLowerCase() === 's') {
    event.preventDefault()
    requestSave()
    return
  }
  if (isEditable(event.target) || !isEditorTarget(event.target)) return
  const onCanvas = isCanvasTarget(event.target)

  const letter = event.key.toLowerCase()
  if (onCanvas && !mod && !event.altKey && (letter === 'h' || letter === 'v')) {
    tool.value = letter === 'h' ? 'pan' : 'select'
    return
  }

  if (mod && event.key.toLowerCase() === 'z' && !store.readOnly) {
    event.preventDefault()
    withAnimation(() => (event.shiftKey ? store.redo() : store.undo()))
  } else if (mod && event.key.toLowerCase() === 'y' && !store.readOnly) {
    event.preventDefault()
    withAnimation(() => store.redo())
  } else if (mod && event.key.toLowerCase() === 'a') {
    event.preventDefault()
    store.selectAll()
  } else if (onCanvas && (event.key === 'Delete' || event.key === 'Backspace') && !store.readOnly) {
    if (store.selectedIds.length) {
      store.removeNodes(store.selectedIds)
    } else if (selectedEdgeId.value) {
      removeEdge(selectedEdgeId.value)
    }
  } else if (event.key === 'Escape') {
    if (store.simulation) {
      store.simulation = null
    } else {
      store.selectedIds = []
      selectedEdgeId.value = null
    }
  }
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (store.isDirty && !leaveConfirmed) {
    event.preventDefault()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('beforeunload', onBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('beforeunload', onBeforeUnload)
})

const fitPending = ref(true)

const MIN_READABLE_ZOOM = 0.7

function initialView() {
  const rect = canvasRef.value?.getBoundingClientRect()
  const nodes = getNodes.value
  if (!rect || !nodes.length) {
    return
  }
  if (nodes.some((node) => !node.dimensions.width)) {
    return
  }
  fitPending.value = false
  const bounds = getRectOfNodes(nodes)
  const fit = Math.min(rect.width / (bounds.width + 160), rect.height / (bounds.height + 160))
  if (fit >= MIN_READABLE_ZOOM) {
    fitView({ padding: 0.2, maxZoom: 1, duration: motion(200) })
    return
  }
  const root = findNode(store.flow.rootId)
  if (!root) {
    fitView({ padding: 0.2, minZoom: MIN_READABLE_ZOOM, maxZoom: 1 })
    return
  }
  const zoom = 0.8
  setViewport({
    x: 48 - root.computedPosition.x * zoom,
    y: rect.height / 2 - (root.computedPosition.y + root.dimensions.height / 2) * zoom,
    zoom,
  })
}

watch(
  () => store.fitRequest,
  () => {
    fitPending.value = true
    nextTick(initialView)
  },
)

function onNodesInitialized() {
  if (fitPending.value) {
    initialView()
  }
}

function onEdgesChange(changes: EdgeChange[]) {
  for (const change of changes) {
    if (change.type === 'select') {
      if (change.selected) {
        selectedEdgeId.value = change.id
      } else if (selectedEdgeId.value === change.id) {
        selectedEdgeId.value = null
      }
    }
  }
}

const canvasControls = computed(() => [
  {
    id: 'zoom-in',
    icon: faMagnifyingGlassPlus,
    label: t('visual_plan.zoom_in'),
    pressed: undefined,
    action: () => zoomIn({ duration: motion(200) }),
  },
  {
    id: 'zoom-out',
    icon: faMagnifyingGlassMinus,
    label: t('visual_plan.zoom_out'),
    pressed: undefined,
    action: () => zoomOut({ duration: motion(200) }),
  },
  {
    id: 'fit',
    icon: faExpand,
    label: t('visual_plan.fit_view'),
    pressed: undefined,
    action: () => fitView({ padding: 0.2, maxZoom: 1, duration: motion(300) }),
  },
  ...(isLarge.value && canvasWidth.value >= 700
    ? [
        {
          id: 'minimap',
          icon: faMap,
          label: t('visual_plan.toggle_minimap'),
          pressed: showMinimap.value,
          action: () => (showMinimap.value = !showMinimap.value),
        },
      ]
    : []),
])

watch(canvasWidth, (width) => {
  if (isLarge.value && paletteOpen.value && panelMode.value && width > 0 && width < 480) {
    paletteOpen.value = false
  }
})

function onPaneClick() {
  selectedEdgeId.value = null
  canvasRef.value?.focus({ preventScroll: true })
}

function onNodeClick(id: string) {
  if (store.simulation) {
    store.simulationFocus = id
  }
}

const guardNavigation = (to: RouteLocationRaw) => {
  if (!store.isDirty || leaveConfirmed) {
    return true
  }
  pendingLocation.value = to
  unsavedModalShown.value = true
  return false
}

onBeforeRouteLeave((to) => guardNavigation(to.fullPath))
onBeforeRouteUpdate((to, from) =>
  to.query.route === from.query.route ? true : guardNavigation(to.fullPath),
)

function confirmLeave() {
  leaveConfirmed = true
  unsavedModalShown.value = false
  if (pendingLocation.value) {
    router.push(pendingLocation.value)
  }
}

function closePanel() {
  if (store.simulation) {
    store.simulation = null
  } else {
    store.selectedIds = []
  }
}

function goBack() {
  router.push({ name: 'routes', params: { tab: 'inbound' } })
}
</script>

<template>
  <div ref="editor" class="bg-elevation-1 flex h-full flex-col">
    <header
      class="bg-elevation-0 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 px-4 py-3 dark:border-gray-700"
    >
      <NeTooltip v-if="isLarge && !readOnly" trigger-event="mouseenter focus" placement="bottom">
        <template #trigger>
          <NeButton
            kind="tertiary"
            size="sm"
            :aria-pressed="paletteOpen"
            @click="paletteOpen = !paletteOpen"
          >
            <FontAwesomeIcon :icon="faSidebarLeft" aria-hidden="true" />
            <span class="sr-only">{{ t('visual_plan.toggle_palette') }}</span>
          </NeButton>
        </template>
        <template #content>{{ t('visual_plan.toggle_palette') }}</template>
      </NeTooltip>
      <NeButton kind="tertiary" size="sm" @click="goBack">
        <template #prefix>
          <FontAwesomeIcon :icon="faArrowLeft" aria-hidden="true" />
        </template>
        {{ t('visual_plan.back_to_routes') }}
      </NeButton>
      <div class="min-w-32 flex-1">
        <p class="text-tertiary-neutral text-xs">{{ t('visual_plan.title') }}</p>
        <h1 class="text-primary-neutral truncate text-base font-medium" :title="rootTitle">
          {{ rootTitle }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <NeDropdown
          v-if="issueItems.length"
          :items="issueItems"
          align-to-right
          :open-menu-aria-label="t('visual_plan.issues_list')"
        >
          <template #button>
            <span
              :class="[
                'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                visibleErrorCount
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-700 dark:text-rose-50'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-700 dark:text-amber-50',
              ]"
            >
              <FontAwesomeIcon
                :icon="visibleErrorCount ? faCircleXmark : faTriangleExclamation"
                aria-hidden="true"
              />
              {{
                visibleErrorCount
                  ? t('visual_plan.errors_count', { count: visibleErrorCount }, visibleErrorCount)
                  : t('visual_plan.warnings_count', { count: warningCount }, warningCount)
              }}
            </span>
          </template>
        </NeDropdown>
        <NeBadgeV2 v-if="store.isDirty" kind="indigo" size="sm">
          {{ t('common.unsaved_changes') }}
        </NeBadgeV2>
      </div>
      <FlowSearch class="sm:w-56" @pick="pickSearchResult" />
      <NeButton
        kind="secondary"
        size="sm"
        :disabled="Boolean(store.simulation)"
        @click="startSimulation"
      >
        <template #prefix>
          <FontAwesomeIcon :icon="faPlay" aria-hidden="true" />
        </template>
        {{ t('visual_plan.simulation.start') }}
      </NeButton>
      <div class="flex items-center gap-1">
        <template v-if="!readOnly">
          <NeTooltip trigger-event="mouseenter focus" placement="bottom">
            <template #trigger>
              <NeButton
                kind="tertiary"
                size="sm"
                :disabled="!store.canUndo"
                @click="withAnimation(() => store.undo())"
              >
                <FontAwesomeIcon :icon="faRotateLeft" aria-hidden="true" />
                <span class="sr-only">{{ t('visual_plan.undo') }}</span>
              </NeButton>
            </template>
            <template #content>{{ t('visual_plan.undo') }}</template>
          </NeTooltip>
          <NeTooltip trigger-event="mouseenter focus" placement="bottom">
            <template #trigger>
              <NeButton
                kind="tertiary"
                size="sm"
                :disabled="!store.canRedo"
                @click="withAnimation(() => store.redo())"
              >
                <FontAwesomeIcon :icon="faRotateRight" aria-hidden="true" />
                <span class="sr-only">{{ t('visual_plan.redo') }}</span>
              </NeButton>
            </template>
            <template #content>{{ t('visual_plan.redo') }}</template>
          </NeTooltip>
          <NeTooltip trigger-event="mouseenter focus" placement="bottom">
            <template #trigger>
              <NeButton kind="tertiary" size="sm" @click="withAnimation(() => store.autoLayout())">
                <FontAwesomeIcon :icon="faSitemap" aria-hidden="true" />
                <span class="sr-only">{{ t('visual_plan.auto_layout') }}</span>
              </NeButton>
            </template>
            <template #content>{{ t('visual_plan.auto_layout') }}</template>
          </NeTooltip>
        </template>
        <NeTooltip trigger-event="mouseenter focus" placement="bottom">
          <template #trigger>
            <NeButton kind="tertiary" size="sm" :loading="exporting" @click="exportImage()">
              <FontAwesomeIcon :icon="faCircleArrowDown" aria-hidden="true" />
              <span class="sr-only">{{ t('visual_plan.export.download_image') }}</span>
            </NeButton>
          </template>
          <template #content>{{ t('visual_plan.export.download_image') }}</template>
        </NeTooltip>
        <NeButton
          v-if="!isLarge && !readOnly"
          kind="secondary"
          size="sm"
          @click="paletteDrawerShown = true"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faCirclePlus" aria-hidden="true" />
          </template>
          {{ t('visual_plan.add_node') }}
        </NeButton>
        <NeButton
          v-if="!readOnly"
          kind="primary"
          size="sm"
          :disabled="!store.isDirty || unavailable.length > 0 || saving || reloading"
          :loading="saving || savingLayout"
          class="ml-2"
          @click="requestSave"
        >
          <template #prefix>
            <FontAwesomeIcon :icon="faFloppyDisk" aria-hidden="true" />
          </template>
          {{ t('common.save') }}
        </NeButton>
      </div>
    </header>

    <div
      v-if="unavailable.length || saveError || blockedCount || readOnly"
      class="space-y-2 px-4 pt-3"
      role="alert"
    >
      <NeInlineNotification
        v-if="readOnly"
        kind="info"
        :title="t('visual_plan.read_only_title')"
        :description="t('visual_plan.read_only_description')"
      />
      <NeInlineNotification
        v-if="unavailable.length"
        kind="warning"
        :title="t('visual_plan.partial_data_title')"
        :description="t('visual_plan.partial_data_description', { items: unavailableLabels })"
        :primary-button-label="t('visual_plan.reload')"
        @primary-click="emit('reload')"
      />
      <NeInlineNotification
        v-if="blockedCount"
        kind="error"
        :title="t('visual_plan.errors_to_fix', { count: blockedCount }, blockedCount)"
        :description="t('visual_plan.save_validation_failed')"
      />
      <NeInlineNotification
        v-if="saveError"
        kind="error"
        :title="t('visual_plan.cannot_save')"
        :description="saveErrorDescription"
      />
    </div>

    <div class="flex min-h-0 flex-1">
      <aside
        v-if="isLarge && !readOnly && paletteOpen"
        class="bg-elevation-0 w-64 shrink-0 border-r border-gray-200 dark:border-gray-700"
        :aria-label="t('visual_plan.palette.title')"
      >
        <NodePalette @add="addFromPalette" />
      </aside>

      <div
        ref="canvas"
        tabindex="-1"
        :class="[
          'visual-plan-canvas relative min-w-0 flex-1 focus:outline-none',
          { 'is-animating': animating },
        ]"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <VueFlow
          :nodes="flowNodes"
          :edges="flowEdges"
          :min-zoom="0.2"
          :max-zoom="1.5"
          :delete-key-code="null"
          :nodes-connectable="!readOnly"
          :elements-selectable="true"
          :select-nodes-on-drag="false"
          :zoom-on-double-click="false"
          :snap-to-grid="true"
          :snap-grid="[8, 8]"
          :connection-radius="48"
          :selection-key-code="selectMode ? true : 'Shift'"
          :multi-selection-key-code="['Meta', 'Control']"
          :selection-mode="SelectionMode.Partial"
          :pan-on-drag="selectMode ? [1, 2] : true"
          :pan-on-scroll="true"
          :zoom-activation-key-code="['Meta', 'Control']"
          @nodes-change="onNodesChange"
          @selection-end="canvasRef?.focus({ preventScroll: true })"
          @connect="onConnect"
          @connect-start="onConnectStart"
          @connect-end="onConnectEnd"
          @node-drag="onNodeDrag"
          @edges-change="onEdgesChange"
          @node-click="({ node }) => onNodeClick(node.id)"
          @edge-click="({ edge }) => ((selectedEdgeId = edge.id), (store.selectedIds = []))"
          @pane-click="onPaneClick"
          @node-drag-stop="onNodeDragStop"
          @nodes-initialized="onNodesInitialized"
        >
          <template #node-flow="nodeProps">
            <FlowNodeCard :id="nodeProps.id" :selected="nodeProps.selected" />
          </template>
          <template #edge-flow="edgeProps">
            <FlowEdge v-bind="edgeProps" @remove="removeEdge" />
          </template>
          <Background :gap="20" :size="1.2" />
          <MiniMap
            v-if="showMinimap && isLarge && canvasWidth >= 700"
            pannable
            zoomable
            :aria-label="t('visual_plan.minimap')"
          />
          <Panel position="bottom-left">
            <div
              class="bg-elevation-0 flex items-center gap-1 rounded-lg p-1 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700"
            >
              <div
                v-if="!isTouch"
                class="flex items-center gap-0.5 border-r border-gray-200 pr-1 dark:border-gray-700"
                role="group"
                :aria-label="t('visual_plan.tools.title')"
              >
                <NeTooltip
                  v-for="item in TOOLS"
                  :key="item.id"
                  trigger-event="mouseenter focus"
                  placement="top"
                >
                  <template #trigger>
                    <button
                      type="button"
                      :aria-pressed="tool === item.id"
                      :aria-keyshortcuts="item.key"
                      :class="[
                        'focus-visible:ring-primary-focus flex size-8 items-center justify-center rounded-md text-sm transition-colors duration-(--duration-small) focus:outline-hidden focus-visible:ring-2',
                        tool === item.id
                          ? 'text-primary-active bg-gray-100 dark:bg-gray-800'
                          : 'text-secondary-neutral hover:bg-gray-100 dark:hover:bg-gray-800',
                      ]"
                      @click="tool = item.id"
                    >
                      <FontAwesomeIcon :icon="item.icon" class="size-4" aria-hidden="true" />
                      <span class="sr-only">{{ t(`visual_plan.tools.${item.id}`) }}</span>
                    </button>
                  </template>
                  <template #content>{{ t(`visual_plan.tools.${item.id}`) }}</template>
                </NeTooltip>
              </div>
              <NeTooltip
                v-for="control in canvasControls"
                :key="control.id"
                trigger-event="mouseenter focus"
                placement="top"
              >
                <template #trigger>
                  <NeButton
                    kind="tertiary"
                    size="sm"
                    :aria-pressed="control.pressed"
                    @click="control.action"
                  >
                    <FontAwesomeIcon :icon="control.icon" aria-hidden="true" />
                    <span class="sr-only">{{ control.label }}</span>
                  </NeButton>
                </template>
                <template #content>{{ control.label }}</template>
              </NeTooltip>
            </div>
          </Panel>
        </VueFlow>
        <div
          v-if="guideStyle.vertical"
          class="border-primary-active pointer-events-none absolute inset-y-0 border-l border-dashed"
          :style="guideStyle.vertical"
          aria-hidden="true"
        />
        <div
          v-if="guideStyle.horizontal"
          class="border-primary-active pointer-events-none absolute inset-x-0 border-t border-dashed"
          :style="guideStyle.horizontal"
          aria-hidden="true"
        />
        <p id="visual-plan-node-hint" class="sr-only">{{ t('visual_plan.node_hint') }}</p>
        <QuickAddMenu
          v-if="quickAdd"
          :x="quickAdd.x"
          :y="quickAdd.y"
          @pick="pickQuickAdd"
          @pick-existing="pickQuickAddExisting"
          @close="quickAdd = null"
        />
      </div>

      <aside
        v-if="isLarge && panelMode"
        class="bg-elevation-0 w-96 shrink-0 border-l border-gray-200 dark:border-gray-700"
        :aria-label="
          panelMode === 'simulation'
            ? t('visual_plan.simulation.title')
            : t('visual_plan.inspector')
        "
      >
        <SimulationPanel
          v-if="panelMode === 'simulation'"
          @center="centerOn"
          @close="store.simulation = null"
        />
        <SelectionPanel
          v-else-if="panelMode === 'selection'"
          @arrange="withAnimation(() => store.arrangeSelected())"
        />
        <NodeInspector v-else @center="centerOn" />
      </aside>
    </div>

    <NeSideDrawer
      v-if="!isLarge"
      :is-shown="Boolean(panelMode)"
      :title="
        panelMode === 'simulation' ? t('visual_plan.simulation.title') : t('visual_plan.inspector')
      "
      :close-aria-label="t('shell.close_side_drawer')"
      @close="closePanel"
    >
      <SimulationPanel v-if="panelMode === 'simulation'" in-drawer @center="centerOn" />
      <SelectionPanel
        v-else-if="panelMode === 'selection'"
        in-drawer
        @arrange="withAnimation(() => store.arrangeSelected())"
      />
      <NodeInspector v-else in-drawer @center="centerOn" />
    </NeSideDrawer>
    <NeSideDrawer
      v-if="!isLarge"
      :is-shown="paletteDrawerShown"
      :title="t('visual_plan.palette.title')"
      :close-aria-label="t('shell.close_side_drawer')"
      @close="paletteDrawerShown = false"
    >
      <NodePalette @add="addFromPalette" />
    </NeSideDrawer>

    <NeModal
      :visible="unsavedModalShown"
      :title="t('common.unsaved_changes')"
      kind="warning"
      :primary-label="t('common.discard_changes')"
      primary-button-kind="danger"
      :cancel-label="t('common.keep_editing')"
      :close-aria-label="t('common.close')"
      @close="unsavedModalShown = false"
      @primary-click="confirmLeave"
    >
      <p>{{ t('visual_plan.unsaved_leave_description') }}</p>
    </NeModal>
  </div>
</template>
