//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

const queue = (id: string, name: string, destination = '') => ({
  id,
  name,
  staticMembers: [
    { extension: '201', penalty: 0 },
    { extension: '202', penalty: 1 },
  ],
  dynamicMembers: ['203'],
  strategy: 'ringall',
  agentTimeout: 15,
  maxWait: 300,
  destination,
  ringing: 'moh',
  cidPrefix: '',
  joinAnnouncement: null,
  positionAnnouncement: true,
  announceFrequency: 60,
  breakoutIvr: null,
  musicOnHold: 'inherit',
})

export const EMPTY_VISUAL_PLAN = {
  inboundRoutes: [],
  extensions: [],
  conferences: [],
  ringGroups: [],
  queues: [],
  ivrs: [],
  cqrs: [],
  announcements: [],
  timeConditions: [],
  timeGroups: [],
  callFlowControls: [],
  availableCallFlowCodes: ['1', '2', '3'],
  setCallerIds: [],
  directDids: [],
  queueExits: [],
  queueOptions: [],
  queuePriorities: [],
  recordings: [],
  musicOnHold: ['default'],
  destinations: [],
  unavailable: [],
}

export const VISUAL_PLAN = {
  ...EMPTY_VISUAL_PLAN,
  inboundRoutes: [
    {
      extension: '0721405516',
      cidnum: '',
      description: 'Main number',
      alertinfo: '',
      grppre: '',
      destination: 'timeconditions,1,1',
    },
    {
      extension: '123',
      cidnum: '345',
      description: 'Test',
      alertinfo: '',
      grppre: '',
      destination: 'ext-queues,401,1',
    },
  ],
  extensions: [
    { extension: '201', name: 'Alice Fox', voicemail: true },
    { extension: '202', name: 'Bob Lee', voicemail: false },
    { extension: '203', name: 'Carol Wu', voicemail: true },
  ],
  timeConditions: [
    {
      id: 1,
      name: 'Office hours',
      timeGroup: 1,
      trueDestination: 'ivr-4,s,1',
      falseDestination: 'app-announcement-2,s,1',
    },
  ],
  timeGroups: [{ id: 1, description: 'Weekdays 9-18', times: ['09:00-18:00|mon-fri|*|*'] }],
  ivrs: [
    {
      id: 4,
      name: 'Main menu',
      description: 'Sales or support',
      announcement: 3,
      directDial: true,
      invalidDestination: 'app-blackhole,hangup,1',
      timeoutDestination: '',
      entries: [
        { selection: '1', destination: 'ext-queues,401,1' },
        { selection: '2', destination: 'ext-group,600,1' },
      ],
    },
  ],
  queues: [queue('401', 'Sales', 'ext-local,vmu201,1')],
  ringGroups: [
    {
      id: '600',
      description: 'Support',
      members: ['201', '203'],
      strategy: 'ringall',
      ringTime: 20,
      destination: '',
    },
  ],
  announcements: [
    { id: 2, description: 'Closed', recording: 3, destination: 'app-blackhole,hangup,1' },
  ],
  recordings: [
    { id: 3, name: 'welcome', description: 'Welcome message' },
    { id: 5, name: 'closed', description: 'Office closed' },
  ],
}
