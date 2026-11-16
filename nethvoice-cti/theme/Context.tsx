// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import defaultTheme from './Theme'
import { createContext, useContext } from 'react'

export const ThemeContext = createContext({
  theme: defaultTheme,
})

export function useTheme() {
  return useContext(ThemeContext)
}
