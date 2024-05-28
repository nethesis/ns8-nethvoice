var appConfig_OLD = {
  TOTAL_STEP: 11,
  STEP_MAP: {
    extensions: 1,
    physical: 2,
    voip: 3,
    inbound: 4,
    outbound: 5,
    groups: 6,
    profiles: 7,
    devices: 8,
    configurations: 9,
    languages: 10,
    settings: 11
  },
  STEP_MAP_REVERSE: {
    '0': 'users',
    '1': 'extensions',
    '2': 'trunks/physical',
    '3': 'trunks/voip',
    '4': 'routes/inbound',
    '5': 'routes/outbound',
    '6': 'configurations/groups',
    '7': 'configurations/profiles',
    '8': 'configurations/devices',
    '9': 'configurations/preferencesFreepbx',
    '10': 'admin/languages',
    '11': 'admin/settings'
  },
  TRUNKS_PREV_STEP: 1,
  ROUTES_PREV_STEP: 3,
  ADMINS_PREV_STEP: 9,
  STEP_WIZARD: {
    extensions: {
      prev: false,
      next: 'trunks/physical'
    },
    physical: {
      prev: 'extensions',
      next: 'trunks/voip'
    },
    voip: {
      prev: 'trunks/physical',
      next: 'routes/inbound'
    },
    inbound: {
      prev: 'trunks/voip',
      next: 'routes/outbound'
    },
    outbound: {
      prev: 'routes/inbound',
      next: 'configurations/groups'
    },
    groups: {
      prev: 'routes/oubound',
      next: 'configurations/profiles'
    },
    profiles: {
      prev: 'configurations/groups',
      next: 'configurations/devices'
    },
    devices: {
      prev: 'configurations/profiles',
      next: 'configurations/preferencesFreepbx'
    },
    preferences: {
      prev: 'configurations/devices',
      next: 'admin/languages'
    },
    languages: {
      prev: 'configurations/preferencesFreepbx',
      next: 'admin/settings'
    },
    settings: {
      prev: 'admin/languages',
      next: false,
      last: true
    }
  },
  MAX_TRIES: 6,
  INTERVAL_POLLING: 2000
};

var appConfig = {
  TOTAL_STEP: 13,
  STEP_MAP: {
    extensions: 1,
    physical: 2,
    voip: 3,
    inbound: 4,
    outbound: 5,
    devices: 6,
    inventory: 7,
    models: 8,
    groups: 9,
    profiles: 10,
    preferences: 11,
    languages: 12,
    settings: 13
  },
  STEP_MAP_REVERSE: {
    '0': 'users',
    '1': 'extensions',
    '2': 'trunks/physical',
    '3': 'trunks/voip',
    '4': 'routes/inbound',
    '5': 'routes/outbound',
    '6': 'devices',
    '7': 'devices/inventory',
    '8': 'devices/models',
    '9': 'configurations/groups',
    '10': 'configurations/profiles',
    '11': 'configurations/preferences',
    '12': 'admin/languages',
    '13': 'admin/settings'
  },
  TRUNKS_PREV_STEP: 1,
  ROUTES_PREV_STEP: 3,
  DEVICES_PREV_STEP: 5,
  CONFIG_PREV_STEP: 8,
  ADMINS_PREV_STEP: 11,
  STEP_WIZARD: {
    extensions: {
      prev: false,
      next: 'trunks/physical'
    },
    physical: {
      prev: 'extensions',
      next: 'trunks/voip'
    },
    voip: {
      prev: 'trunks/physical',
      next: 'routes/inbound'
    },
    inbound: {
      prev: 'trunks/voip',
      next: 'routes/outbound'
    },
    outbound: {
      prev: 'routes/inbound',
      next: 'devices/inventory'
    },
    inventory: {
      prev: 'routes/outbound',
      next: 'devices/models'
    },
    models: {
      prev: 'devices/inventory',
      next: 'configurations/groups'
    },
    groups: {
      prev: 'devices/models',
      next: 'configurations/profiles'
    },
    profiles: {
      prev: 'configurations/groups',
      next: 'configurations/preferences'
    },
    preferences: {
      prev: 'configurations/profiles',
      next: 'admin/languages'
    },
    languages: {
      prev: 'configurations/preferences',
      next: 'admin/settings'
    },
    settings: {
      prev: 'admin/languages',
      next: false,
      last: true
    }
  },
  MAX_TRIES: 6,
  INTERVAL_POLLING: 2000
};

var migrationConfig = {
  INDEX_MAP: {
    "1": "profiles",
    "2": "users",
    "3": "vtrunks",
    "4": "gateptrunks",
    "5": "iax",
    "6": "outroutes",
    "7": "groups",
    "8": "queues",
    "9": "ivr",
    "10": "cqr",
    "11": "recordings",
    "12": "announcements",
    "13": "daynight",
    "14": "tgroupstcond",
    "15": "iroutes",
    "16": "postmig",
    "17": "cdr"
  },
  LABEL_INFO: {
    profiles: {
      route: "/migration/users",
      functions: [
        "cloneOldCTIProfile"
      ],
      prev: false,
      next: "users"
    },
    users: {
      route: "/migration/users",
      functions: [
        "csvimport"
      ],
      prev: "profiles",
      next: "vtrunks"
    },
    vtrunks: {
      route: "/migration/config",
      functions: [
        "copyOldTrunks"
      ],
      prev: "users",
      next: "gateptrunks"
    },
    gateptrunks: {
      route: "/migration/config",
      functions: [
        "getOldGateways"
      ],
      prev: "vtrunks",
      next: "iax"
    },
    iax: {
      route: "/migration/config",
      functions: [
        "migrateIAX"
      ],
      prev: "gateptrunks",
      next: "outroutes"
    },
    outroutes: {
      route: "/migration/config",
      functions: [
        "copyOldOutboundRoutes",
        "migrateRoutesTrunksAssignements"
      ],
      prev: "gateptrunks",
      next: "groups"
    },
    groups: {
      route: "/migration/config",
      functions: [
        "migrateGroups"
      ],
      prev: "outroutes",
      next: "queues"
    },
    queues: {
      route: "/migration/config",
      functions: [
        "migrateQueues"
      ],
      prev: "groups",
      next: "ivr"
    },
    ivr: {
      route: "/migration/config",
      functions: [
        "migrateIVRs"
      ],
      prev: "queues",
      next: "cqr"
    },
    cqr: {
      route: "/migration/config",
      functions: [
        "migrateCQRs"
      ],
      prev: "ivr",
      next: "recordings"
    },
    recordings: {
      route: "/migration/config",
      functions: [
        "migrateRecordings"
      ],
      prev: "cqr",
      next: "announcements"
    },
    announcements: {
      route: "/migration/config",
      functions: [
        "migrateAnnouncements"
      ],
      prev: "recordings",
      next: "daynight"
    },
    daynight: {
      route: "/migration/config",
      functions: [
        "daynight"
      ],
      prev: "announcements",
      next: "tgroupstcond"
    },
    tgroupstcond: {
      route: "/migration/config",
      functions: [
        "migrateTimegroups",
        "migrateTimeconditions"
      ],
      prev: "announcements",
      next: "iroutes"
    },
    iroutes: {
      route: "/migration/config",
      functions: [
        "migrateInboundRoutes"
      ],
      prev: "tgroupstcond",
      next: "postmig"
    },
    postmig: {
      route: "/migration/config",
      functions: [
        "postMigration"
      ],
      prev: "iroutes",
      next: "cdr"
    },
    cdr: {
      route: "/migration/cdr",
      functions: [
        "cdrmigration"
      ],
      prev: "iroutes",
      next: null
    }
  }
}