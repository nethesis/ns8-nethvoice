//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import {
  CTI_MACRO,
  getFeatureValue,
  hasFeature,
  type FeatureRef,
  type ProfileForm,
} from '@/lib/profiles/profiles'

export type FeatureNode = {
  key: string
  ref: FeatureRef
  labelKey: string
  labelParams: Record<string, string>
  tooltipKey: string
  impliedBy: FeatureRef | null
  requiresSubscription: boolean
  gatesChildren: boolean
  children: FeatureNode[]
}

export type FeatureGroupId =
  'presence_panel' | 'phonebook' | 'call_history' | 'call_queues' | 'additional'

export type FeatureGroup = {
  id: FeatureGroupId
  nodes: FeatureNode[]
}

export type FeatureTree = {
  callFeatures: FeatureNode[]
  ctiGroups: FeatureGroup[]
}

type FeatureSpec = {
  ref: FeatureRef
  tooltip?: boolean
  impliedBy?: FeatureRef
  requiresSubscription?: boolean
  children?: FeatureSpec[]
  dynamicChildren?: { prefix: string; labelKey: string; impliedBy?: FeatureRef }
}

type FeatureForm = Pick<ProfileForm, 'macroPermissions'>

export const CALL_FEATURES_MACRO = 'settings'

const permission = (macro: string, name: string): FeatureRef => ({ macro, permission: name })

const CALL_FEATURE_SPECS: FeatureSpec[] = [
  { ref: permission('settings', 'dnd') },
  { ref: permission('settings', 'call_forward') },
  { ref: permission('settings', 'recording') },
  { ref: permission('settings', 'conference') },
  { ref: permission('settings', 'parkings'), tooltip: true },
  { ref: permission('settings', 'pickup') },
  { ref: permission('settings', 'spy'), tooltip: true },
  { ref: permission('settings', 'intrude'), tooltip: true },
]

const CTI_GROUP_SPECS: { id: FeatureGroupId; specs: FeatureSpec[] }[] = [
  {
    id: 'presence_panel',
    specs: [
      {
        ref: { macro: 'presence_panel' },
        children: [
          { ref: permission('presence_panel', 'ad_recording'), tooltip: true },
          { ref: permission('presence_panel', 'ad_parking'), tooltip: true },
          { ref: permission('presence_panel', 'transfer') },
          { ref: permission('presence_panel', 'hangup') },
          { ref: permission('presence_panel', 'ad_phone') },
          {
            ref: permission('presence_panel', 'all_groups'),
            dynamicChildren: {
              prefix: 'grp_',
              labelKey: 'profiles.features.view_group',
              impliedBy: permission('presence_panel', 'all_groups'),
            },
          },
        ],
      },
    ],
  },
  {
    id: 'phonebook',
    specs: [
      {
        ref: { macro: 'phonebook' },
        children: [
          {
            ref: permission('phonebook', 'phonebook_level_1'),
            impliedBy: permission('phonebook', 'phonebook_level_2'),
          },
          { ref: permission('phonebook', 'phonebook_level_2'), tooltip: true },
        ],
      },
    ],
  },
  {
    id: 'call_history',
    specs: [
      {
        ref: { macro: 'cdr' },
        children: [{ ref: permission('cdr', 'ad_cdr') }, { ref: permission('cdr', 'group_cdr') }],
      },
    ],
  },
  {
    id: 'call_queues',
    specs: [
      {
        ref: { macro: 'queue_agent' },
        children: [
          { ref: permission('queue_agent', 'ad_queue_agent') },
          { ref: permission('queue_agent', 'lost_queue_call') },
        ],
      },
      {
        ref: { macro: 'qmanager' },
        tooltip: true,
        requiresSubscription: true,
        dynamicChildren: { prefix: 'qmanager_', labelKey: 'profiles.features.manage_queue' },
      },
    ],
  },
  {
    id: 'additional',
    specs: [
      { ref: { macro: 'customer_card' }, tooltip: true },
      { ref: permission(CTI_MACRO, 'privacy') },
      { ref: permission(CTI_MACRO, 'screen_sharing') },
      {
        ref: { macro: 'off_hour' },
        tooltip: true,
        children: [
          { ref: permission('off_hour', 'advanced_off_hour'), tooltip: true },
          { ref: permission('off_hour', 'ad_off_hour'), tooltip: true },
        ],
      },
      { ref: permission(CTI_MACRO, 'phone_buttons') },
      { ref: permission(CTI_MACRO, 'satellite_stt'), tooltip: true },
      { ref: { macro: 'streaming' } },
    ],
  },
]

const featureKey = (ref: FeatureRef): string =>
  ref.permission ? `${ref.macro}.${ref.permission}` : ref.macro

const translationKey = (ref: FeatureRef): string =>
  `profiles.features.${ref.permission ?? ref.macro}`

export const getDynamicFeatureName = (displayName: string, name: string): string =>
  displayName.replace(/^Group:\s*/, '').trim() || name

const buildDynamicNodes = (
  form: FeatureForm,
  macro: string,
  dynamic: NonNullable<FeatureSpec['dynamicChildren']>,
): FeatureNode[] =>
  (form.macroPermissions[macro]?.permissions ?? [])
    .filter((item) => item.name.startsWith(dynamic.prefix))
    .map((item) => ({
      key: `${macro}.${item.name}`,
      ref: permission(macro, item.name),
      labelKey: dynamic.labelKey,
      labelParams: { name: getDynamicFeatureName(item.displayName, item.name) },
      tooltipKey: '',
      impliedBy: dynamic.impliedBy ?? null,
      requiresSubscription: false,
      gatesChildren: true,
      children: [],
    }))

const buildNodes = (form: FeatureForm, specs: FeatureSpec[]): FeatureNode[] =>
  specs
    .filter((spec) => hasFeature(form, spec.ref))
    .map((spec) => ({
      key: featureKey(spec.ref),
      ref: spec.ref,
      labelKey: translationKey(spec.ref),
      labelParams: {},
      tooltipKey: spec.tooltip ? `${translationKey(spec.ref)}_tooltip` : '',
      impliedBy: spec.impliedBy ?? null,
      requiresSubscription: spec.requiresSubscription ?? false,
      gatesChildren: !spec.dynamicChildren?.impliedBy,
      children: [
        ...buildNodes(form, spec.children ?? []),
        ...(spec.dynamicChildren
          ? buildDynamicNodes(form, spec.ref.macro, spec.dynamicChildren)
          : []),
      ],
    }))

export const buildFeatureTree = (form: FeatureForm): FeatureTree => ({
  callFeatures: buildNodes(form, CALL_FEATURE_SPECS),
  ctiGroups: CTI_GROUP_SPECS.map((group) => ({
    id: group.id,
    nodes: buildNodes(form, group.specs),
  })).filter((group) => group.nodes.length > 0),
})

export const isFeatureImplied = (form: FeatureForm, node: FeatureNode): boolean =>
  node.impliedBy !== null && getFeatureValue(form, node.impliedBy)

export const isFeatureShownEnabled = (
  form: FeatureForm,
  node: FeatureNode,
  parentEnabled: boolean,
): boolean => parentEnabled && (getFeatureValue(form, node.ref) || isFeatureImplied(form, node))
