//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { useI18n } from 'vue-i18n'
import { getOutputs, type FlowNode, type NodeType, type OutputDef } from '@/lib/visualplan/model'
import type { Issue } from '@/lib/visualplan/validation'
import { useVisualPlanStore } from '@/stores/visualPlan'

const withNumber = (name: string, number: string): string =>
  name && number ? `${name} (${number})` : name || number

export const useVisualPlanLabels = () => {
  const { t, te } = useI18n()
  const store = useVisualPlanStore()

  const typeLabel = (type: NodeType): string => t(`visual_plan.types.${type}`)

  const extensionName = (extension: string): string =>
    store.data?.extensions.find((item) => item.extension === extension)?.name ?? ''

  const recordingName = (id: number | null): string =>
    id === null ? '' : (store.data?.recordings.find((item) => item.id === id)?.name ?? `#${id}`)

  const timeGroupName = (id: number | null, ref: string | null): string => {
    const key = ref ?? (id === null ? null : String(id))
    return key === null
      ? ''
      : (store.timeGroups.find((item) => item.ref === key)?.data.description ?? '')
  }

  const otherDestination = (destination: string) =>
    store.data?.destinations.find((item) => item.destination === destination)

  const nodeTitle = (node: FlowNode): string => {
    switch (node.type) {
      case 'inboundRoute': {
        const number = node.data.extension || t('visual_plan.any_did')
        return node.data.cidnum ? `${number} / ${node.data.cidnum}` : number
      }
      case 'extension':
        return withNumber(node.data.name, node.data.extension)
      case 'voicemail':
        return withNumber(extensionName(node.data.extension), node.data.extension)
      case 'conference':
        return withNumber(node.data.name, node.data.id)
      case 'ringGroup':
        return withNumber(node.data.description, node.data.id)
      case 'queue':
        return withNumber(node.data.name, node.data.id)
      case 'hangup':
        return te(`visual_plan.hangup_variants.${node.data.variant}`)
          ? t(`visual_plan.hangup_variants.${node.data.variant}`)
          : node.data.variant
      case 'ivr':
      case 'cqr':
      case 'timeCondition':
      case 'callFlowControl':
      case 'queueExit':
      case 'queueOptions':
        return node.data.name
      case 'announcement':
      case 'setCallerId':
      case 'queuePriority':
        return node.data.description
      case 'directDid':
        return t('visual_plan.direct_did_title', {
          prefix: node.data.prefix || '-',
          root: node.data.root || '-',
        })
      case 'other':
        return otherDestination(node.data.destination)?.description || node.data.destination
    }
  }

  const nodeSubtitle = (node: FlowNode): string => {
    switch (node.type) {
      case 'inboundRoute':
        return node.data.description
      case 'voicemail':
        return t(`visual_plan.voicemail_modes.${node.data.mode}`)
      case 'ringGroup':
        return t(
          'visual_plan.members_count',
          { count: node.data.members.length },
          node.data.members.length,
        )
      case 'queue': {
        const count = node.data.staticMembers.length + node.data.dynamicMembers.length
        return t('visual_plan.members_count', { count }, count)
      }
      case 'ivr':
      case 'cqr':
        return node.data.description
      case 'announcement':
        return recordingName(node.data.recording)
      case 'timeCondition':
        return timeGroupName(node.data.timeGroup, node.data.timeGroupRef)
      case 'callFlowControl':
        return `*28${node.data.id} · ${t(`visual_plan.call_flow_states.${node.data.state}`)}`
      case 'setCallerId':
        return node.data.cidName
      case 'queuePriority':
        return t('visual_plan.priority_value', { priority: node.data.priority })
      case 'other':
        return otherDestination(node.data.destination)?.category ?? ''
      default:
        return ''
    }
  }

  const outputLabel = (output: OutputDef): string =>
    output.label !== undefined ? t(output.labelKey, { value: output.label }) : t(output.labelKey)

  const outputLabelById = (node: FlowNode, outputId: string): string => {
    const output = getOutputs(node).find((item) => item.id === outputId)
    return output ? outputLabel(output) : outputId
  }

  const issueMessage = (issue: Pick<Issue, 'code' | 'params'>): string => {
    const key = `visual_plan.issues.${issue.code}`
    if (te(key)) {
      return t(key, issue.params ?? {})
    }
    return issue.code ? issue.code.charAt(0).toUpperCase() + issue.code.slice(1) : ''
  }

  const FIELD_LABELS: Record<string, string> = {
    name: 'visual_plan.fields.name',
    description: 'visual_plan.fields.description',
    cidnum: 'visual_plan.fields.cid',
    alertinfo: 'visual_plan.fields.alert_info',
    alertInfo: 'visual_plan.fields.alert_info',
    grppre: 'visual_plan.fields.cid_prefix',
    cidPrefix: 'visual_plan.fields.cid_prefix',
    id: 'visual_plan.fields.number',
    members: 'visual_plan.fields.members',
    staticMembers: 'visual_plan.fields.static_members',
    dynamicMembers: 'visual_plan.fields.dynamic_members',
    strategy: 'visual_plan.fields.strategy',
    ringTime: 'visual_plan.fields.ring_time',
    agentTimeout: 'visual_plan.fields.agent_timeout',
    maxWait: 'visual_plan.fields.max_wait',
    musicOnHold: 'visual_plan.fields.music_class',
    joinAnnouncement: 'visual_plan.fields.join_announcement',
    announceFrequency: 'visual_plan.fields.announce_frequency',
    breakoutIvr: 'visual_plan.fields.breakout_ivr',
    announcement: 'visual_plan.fields.announcement',
    recording: 'visual_plan.fields.recording',
    timeGroup: 'visual_plan.fields.time_group',
    cidName: 'visual_plan.fields.cid_name',
    cidNum: 'visual_plan.fields.cid_number',
    prefix: 'visual_plan.fields.direct_did_prefix',
    root: 'visual_plan.fields.direct_did_root',
    varlength: 'visual_plan.fields.direct_did_length',
    timeout: 'visual_plan.fields.ring_time',
    position: 'visual_plan.fields.position',
    priority: 'visual_plan.fields.priority',
  }

  const fieldLabel = (node: FlowNode | undefined, field: string): string => {
    if (field === 'extension') {
      return node?.type === 'inboundRoute'
        ? t('visual_plan.fields.did')
        : t('visual_plan.fields.extension')
    }
    if (node && field.startsWith('entry:')) {
      return outputLabelById(node, field)
    }
    const key = FIELD_LABELS[field]
    return key ? t(key) : ''
  }

  const issueText = (node: FlowNode, issue: Issue): string => {
    const text = issueMessage(issue)
    if (issue.output && issue.code === 'output_not_connected') {
      return t('visual_plan.issues.output_not_connected', {
        output: outputLabelById(node, issue.output),
      })
    }
    if (issue.output) {
      return `${outputLabelById(node, issue.output)}: ${text}`
    }
    const label = issue.field ? fieldLabel(node, issue.field) : ''
    return label ? `${label}: ${text}` : text
  }

  return {
    typeLabel,
    nodeTitle,
    nodeSubtitle,
    outputLabel,
    issueText,
    issueMessage,
    fieldLabel,
    recordingName,
    extensionName,
  }
}
