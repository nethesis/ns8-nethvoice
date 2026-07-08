// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'
import type { StatusTypes } from '../theme/Types'

interface EndpointsTypes {
  cellphone: any[]
  email: any[]
  extension: any[]
  jabber: any[]
  mainextension: any[]
  voicemail: any[]
}

interface ProfileTypes {
  id: string
  macro_permissions: any
  name: string
  outbound_routes_permissions: any[]
}

interface SettingsTypes {
  auto_dndoff_login: any
  auto_dndon_logout: any
  call_ringtone: any
  ccard_order: []
  chat_notifications: any
  default_extension: string
  desktop_notifications: any
  call_summary_notifications?: any
  open_ccard: any
  open_param_url: any
  queue_auto_login: any
  queue_auto_logout: any
  company_extension: any
  caller_info: any
  queue_auto_pause_onpresence: any
  queue_autopause_presencelist: any
}

interface FeatureCodes {
  pickup: string
  dnd_toggle: string
  audio_test: string
  confbridge_conf: string
  incall_audio: string
  que_toggle: string
}

interface Default_device {
  action: any[]
  description: any
  id: any
  proxy_port: any
  secret: any
  type: any
  username: any
}
interface DefaultState {
  default_device: Default_device
  name: string
  username: string
  mainextension: string
  mainPresence: StatusTypes
  endpoints: EndpointsTypes
  profile: ProfileTypes
  avatar: string
  settings: SettingsTypes
  recallOnBusy: any
  lkhash: string
  call_summary_enabled?: boolean
  urlOpened?: boolean
  feature_codes: FeatureCodes | null
}

const defaultState: DefaultState = {
  default_device: {
    action: [],
    description: '',
    id: '',
    proxy_port: '',
    secret: '',
    type: '',
    username: '',
  },
  name: '',
  username: '',
  mainextension: '',
  mainPresence: 'offline',
  endpoints: {
    cellphone: [],
    email: [],
    extension: [],
    jabber: [],
    mainextension: [],
    voicemail: [],
  },
  profile: {
    id: '',
    macro_permissions: {},
    name: '',
    outbound_routes_permissions: [],
  },
  avatar: '',
  settings: {
    auto_dndoff_login: '',
    auto_dndon_logout: '',
    call_ringtone: '',
    ccard_order: [],
    chat_notifications: '',
    default_extension: '',
    desktop_notifications: '',
    call_summary_notifications: '',
    open_ccard: '',
    open_param_url: '',
    queue_auto_login: '',
    queue_auto_logout: '',
    company_extension: '',
    caller_info: '',
    queue_auto_pause_onpresence: '',
    queue_autopause_presencelist: [],
  },
  recallOnBusy: '',
  lkhash: '',
  call_summary_enabled: false,
  urlOpened: false,
  feature_codes: null,
}

export const user = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, payload: DefaultState) => {
      state.default_device = payload?.default_device
      state.name = payload?.name
      state.username = payload?.username
      state.mainextension = payload?.mainextension
      state.mainPresence = payload?.mainPresence
      state.endpoints = payload?.endpoints
      state.profile = payload?.profile
      state.avatar = payload?.avatar
      state.settings = payload?.settings
      state.recallOnBusy = payload?.recallOnBusy
      state.lkhash = payload?.lkhash
      state.call_summary_enabled = payload?.call_summary_enabled ?? false
      return state
    },
    updateMainPresence: (state, mainPresence) => {
      state.mainPresence = mainPresence
      return state
    },
    updateSettings: (state, ccardSettingsUpdate) => {
      state.settings = {
        ...state.settings,
        ...ccardSettingsUpdate,
      }
      return state
    },
    updateCompanyExtension: (state, companyExtension) => {
      state.settings.company_extension = companyExtension
      return state
    },
    updateCallerCustomerCardInformation: (state, callerInformations) => {
      state.settings.caller_info = callerInformations
      return state
    },
    updateLogoutQueue: (state, logoutStatus) => {
      state.settings.queue_auto_logout = logoutStatus
      return state
    },
    updateLoginQueue: (state, loginStatus) => {
      state.settings.queue_auto_login = loginStatus
      return state
    },
    updatePauseQueue: (state, pauseStatus) => {
      state.settings.queue_auto_pause_onpresence = pauseStatus
      return state
    },
    updateQueueAutopausePresencelist: (state, autoPausePresenceList: any) => {
      state.settings.queue_autopause_presencelist = autoPausePresenceList
      return state
    },
    updateDefaultDevice: (state, defaultDevice) => {
      state.default_device = defaultDevice
      return state
    },
    updateOpenParamUrl: (state, openParamUrl) => {
      state.settings.open_param_url = openParamUrl
      return state
    },
    setUrlOpened: (state, opened: boolean) => {
      state.urlOpened = opened
      return state
    },
    updateFeatureCodes: (state, featureCodes: FeatureCodes) => {
      state.feature_codes = featureCodes
      return state
    },
    reset: () => {
      return defaultState
    },
  },
  selectors: (slice) => ({
    allowedOperatorGroupsIds: () =>
      slice((state) => {
        const presencePanelPermissions =
          state.profile?.macro_permissions?.presence_panel?.permissions || []

        return Object.keys(presencePanelPermissions).filter(
          (perm) => perm.startsWith('grp_') && presencePanelPermissions[perm].value,
        )
      }),
    presencePanelPermissions: () =>
      slice(
        (state) =>
          (state.profile?.macro_permissions?.presence_panel?.permissions as {
            [key: string]: any
          }) || {},
      ),
    allUserExtensions: () =>
      slice((state) => {
        const extensions: string[] = []
        if (state.mainextension) {
          extensions.push(state.mainextension)
        }
        if (state.endpoints?.extension) {
          state.endpoints.extension.forEach((ext: any) => {
            if (ext.id && !extensions.includes(ext.id)) {
              extensions.push(ext.id)
            }
          })
        }
        if (state.endpoints?.mainextension?.[0]?.id) {
          const mainExt = state.endpoints.mainextension?.[0].id
          if (!extensions.includes(mainExt)) {
            extensions.push(mainExt)
          }
        }
        return extensions
      }),
  }),
})
