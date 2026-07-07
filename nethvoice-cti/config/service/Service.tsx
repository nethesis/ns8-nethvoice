// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, FC, ReactNode, useState } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { axiosSetup } from '../../config/axios'

interface ServiceProps {
  children: ReactNode
}

export const Service: FC<ServiceProps> = ({ children }) => {
  const { token } = useSelector((state: RootState) => state.authentication)
  const [ready, isReady] = useState<boolean>(false)

  useEffect(() => {
    // Init axios default config
    axiosSetup()
    isReady(true)
  }, [token])

  return <>{ready && children}</>
}
