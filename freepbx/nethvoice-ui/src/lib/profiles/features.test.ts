//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import { rawProfile } from './fixtures'
import {
  buildFeatureTree,
  getDynamicFeatureName,
  isFeatureImplied,
  isFeatureShownEnabled,
  type FeatureNode,
} from './features'
import { parseProfile, setFeatureValue, toProfileForm } from './profiles'

const form = () => toProfileForm(parseProfile(rawProfile(3, 'Advanced')))

const findNode = (nodes: FeatureNode[], key: string): FeatureNode | undefined => {
  for (const node of nodes) {
    if (node.key === key) {
      return node
    }
    const child = findNode(node.children, key)

    if (child) {
      return child
    }
  }
  return undefined
}

describe('buildFeatureTree', () => {
  it('should list only the call features the profile has', () => {
    expect(buildFeatureTree(form()).callFeatures.map((node) => node.key)).toEqual([
      'settings.dnd',
      'settings.call_forward',
      'settings.recording',
      'settings.spy',
    ])
  })

  it('should skip the CTI groups without features', () => {
    expect(buildFeatureTree(form()).ctiGroups.map((group) => group.id)).toEqual([
      'presence_panel',
      'phonebook',
      'call_history',
      'call_queues',
      'additional',
    ])
  })

  it('should add a toggle for each presence group', () => {
    const tree = buildFeatureTree(form())
    const group = findNode(tree.ctiGroups[0].nodes, 'presence_panel.grp_sales')

    expect(group?.labelKey).toBe('profiles.features.view_group')
    expect(group?.labelParams).toEqual({ name: 'Sales' })
  })

  it('should add a toggle for each queue of the queue manager', () => {
    const queues = buildFeatureTree(form()).ctiGroups[3].nodes.find(
      (node) => node.key === 'qmanager',
    )

    expect(queues?.requiresSubscription).toBe(true)
    expect(queues?.children.map((node) => node.labelParams.name)).toEqual(['Support (401)'])
  })

  it('should attach a tooltip key only to the features that have one', () => {
    const nodes = buildFeatureTree(form()).callFeatures
    expect(nodes.find((node) => node.key === 'settings.spy')?.tooltipKey).toBe(
      'profiles.features.spy_tooltip',
    )
    expect(nodes.find((node) => node.key === 'settings.dnd')?.tooltipKey).toBe('')
  })
})

describe('isFeatureImplied', () => {
  it('should show every presence group enabled when all groups are visible', () => {
    const profileForm = form()
    const tree = buildFeatureTree(profileForm)
    const group = findNode(tree.ctiGroups[0].nodes, 'presence_panel.grp_sales')

    if (!group) {
      throw new Error('missing group node')
    }
    expect(isFeatureImplied(profileForm, group)).toBe(false)

    setFeatureValue(profileForm, { macro: 'presence_panel', permission: 'all_groups' }, true)
    expect(isFeatureImplied(profileForm, group)).toBe(true)
    expect(isFeatureShownEnabled(profileForm, group, true)).toBe(true)
    expect(isFeatureShownEnabled(profileForm, group, false)).toBe(false)
  })

  it('should show private contacts enabled when shared contacts are', () => {
    const profileForm = form()
    const privateContacts = findNode(
      buildFeatureTree(profileForm).ctiGroups[1].nodes,
      'phonebook.phonebook_level_1',
    )

    if (!privateContacts) {
      throw new Error('missing phonebook node')
    }
    expect(isFeatureImplied(profileForm, privateContacts)).toBe(true)
  })
})

describe('getDynamicFeatureName', () => {
  it('should drop the group prefix', () => {
    expect(getDynamicFeatureName('Group: Sales', 'grp_sales')).toBe('Sales')
    expect(getDynamicFeatureName('', 'grp_sales')).toBe('grp_sales')
  })
})
