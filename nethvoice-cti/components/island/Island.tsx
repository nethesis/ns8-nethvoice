// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import '@nethesis/phone-island/dist/index.css'
import { useState, useEffect } from 'react'
import { newIslandConfig } from '../../lib/settings'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import dynamic from 'next/dynamic'

// Import the module asynchronously avoiding server-side-rendering
const PhoneIsland = dynamic(() => import('@nethesis/phone-island').then((mod) => mod.PhoneIsland), {
  ssr: false,
})

export function Island() {
  const [config, setConfig] = useState<string>('')
  const currentUser = useSelector((state: RootState) => state.user)
  const auth = useSelector((state: RootState) => state.authentication)

  useEffect(() => {
    let cancelled = false

    const loadConfig = async () => {
      // Create the configuration for the PhoneIsland
      if (auth.token && currentUser.endpoints.extension) {
        const webRTCExtension =
          currentUser.endpoints.extension.find(
            (el: any) =>
              el.type === 'webrtc' &&
              currentUser.default_device?.type === 'webrtc' &&
              el.id === currentUser.default_device?.id,
          ) ||
          currentUser.endpoints.extension.find((el: any) => el.type === 'webrtc')

        if (auth.token && currentUser.username) {
          if (cancelled) {
            return
          }
          setConfig(
            newIslandConfig({
              // @ts-ignore
              hostname: window.CONFIG.API_ENDPOINT,
              username: currentUser.username,
              auth_token: auth.token,
              sip_exten: webRTCExtension?.id || '',
              sip_secret: webRTCExtension?.secret || '',
              // @ts-ignore
              sip_host: window.CONFIG.SIP_HOST,
              // @ts-ignore
              sip_port: window.CONFIG.SIP_PORT,
            }),
          )
        }
      }
    }

    loadConfig()

    return () => {
      cancelled = true
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.token, currentUser.endpoints.extension])

  return (
    <>
      {config && (
        <PhoneIsland
          dataConfig={config}
          uaType={'desktop'}
          preferredSummaryExtensionType='webrtc'
        />
      )}
    </>
  )
}
