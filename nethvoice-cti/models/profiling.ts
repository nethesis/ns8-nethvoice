// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createModel } from '@rematch/core'
import type { RootModel } from '.'

type DefaultState = ProfilingTypes

const defaultState: DefaultState = {
  pid: 0,
  uptime: '',
  pkg_ver: {},
  node_ver: '',
  proc_mem: {},
  db_stats: {},
  tot_users: 0,
  conn_clients: {
    ws_conn_clients: 0,
    tcp_conn_clients: {
      tot: 0,
    },
  },
  hostname: '',
  publichost: '',
  server_time: 0,
}

export const profiling = createModel<RootModel>()({
  state: defaultState,
  reducers: {
    update: (state, payload: ProfilingTypes) => {
      return payload
    },
    reset: () => {
      return defaultState
    },
  },
})

export interface ProfilingTypes {
  pid: number
  uptime: string
  pkg_ver: {
    [key: string]: string
  }
  node_ver: string
  proc_mem: {
    [key: string]: number
  }
  db_stats: {
    [key: string]: number
  }
  tot_users: number
  conn_clients: {
    ws_conn_clients: number
    tcp_conn_clients: {
      tot: number
    }
  }
  hostname: string
  publichost: string
  server_time: number
}
