//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

const permission = (id: number | null, name: string, value = false, displayname = name) => ({
  id,
  name,
  displayname,
  description: `${name} description`,
  value,
})

export const rawProfile = (id: number, name: string) => ({
  id,
  name,
  macro_permissions: {
    settings: {
      value: true,
      displayname: 'Settings',
      description: 'General and notifications settings',
      permissions: [
        permission(2, 'dnd', true),
        permission(3, 'call_forward'),
        permission(4, 'recording'),
        permission(15, 'spy'),
      ],
    },
    phonebook: {
      value: true,
      displayname: 'Phonebook',
      description: 'View Phonebook',
      permissions: [
        permission(10, 'phonebook_level_0', true),
        permission(11, 'phonebook_level_1'),
        permission(12, 'ad_phonebook', true),
        permission(14, 'phonebook_level_2'),
      ],
    },
    presence_panel: {
      value: true,
      displayname: 'Presence Panel',
      description: 'Allow to view Presence Panel',
      permissions: [
        permission(17, 'ad_recording'),
        permission(3500, 'all_groups'),
        permission(5002, 'grp_sales', false, 'Group: Sales'),
      ],
    },
    qmanager: {
      value: false,
      displayname: 'Queue Manager',
      description: 'Allow to view and manage queues in real time',
      permissions: [permission(null, 'qmanager_401', false, 'Support (401)')],
    },
    cdr: { value: true, displayname: 'CDR', description: 'View own call history', permissions: [] },
    remote_sites: { value: false, displayname: 'Remote Sites', description: '', permissions: [] },
    nethvoice_cti: {
      value: true,
      displayname: 'NethVoice CTI',
      description: 'Enables access to NethVoice CTI application',
      permissions: [permission(8, 'chat'), permission(9, 'privacy', true)],
    },
  },
  outbound_routes_permissions: [
    { route_id: 1, name: 'national_it', permission: true },
    { route_id: 2, name: 'cellphone_it', permission: false },
    { route_id: 5, name: 'Custom route', permission: true },
  ],
})
