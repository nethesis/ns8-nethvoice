// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { init, RematchDispatch, RematchRootState } from '@rematch/core'
import { models, RootModel } from '../models'
import immerPlugin from '@rematch/immer'
import selectPlugin from '@rematch/select'

export const store = init<RootModel>({
  models,
  plugins: [immerPlugin(), selectPlugin()],
})

export type Store = typeof store
export type Dispatch = RematchDispatch<RootModel>
export type RootState = RematchRootState<RootModel>
