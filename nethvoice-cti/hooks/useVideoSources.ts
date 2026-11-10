// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { useEventListener } from '../lib/hooks/useEventListener'
import { getVideoSources, openVideoSource, subscribe, unsubscribe } from '../services/streaming'
import { callPhoneNumber, openToast } from '../lib/utils'

export interface VideoSourceGate {
  // empty for the implicit gate of the servers that do not send the gates list
  id: string
  name: string
  type?: string
}

export interface VideoSource {
  id: string
  // "image" sources: last JPEG frame (data URI) received from the websocket, empty until then
  url: string
  user: string
  cmdOpen: string
  password: string
  frameRate: string
  extension: string | null
  description: string
  // "image": JPEG frames sampled by the server, "rtsp": WebRTC stream from the video gateway
  type: 'image' | 'rtsp'
  // WHEP endpoint path of "rtsp" sources
  whep: string | null
  gates: VideoSourceGate[]
}

// Older servers do not send type, whep and gates
const normalizeSource = (key: string, raw: any): VideoSource => {
  const type = raw?.type === 'rtsp' ? 'rtsp' : 'image'
  let gates: VideoSourceGate[]
  if (Array.isArray(raw?.gates)) {
    gates = raw.gates.map((gate: any) => ({
      id: String(gate?.id ?? ''),
      name: gate?.name || '',
      type: gate?.type,
    }))
  } else {
    gates = raw?.cmdOpen ? [{ id: '', name: '' }] : []
  }
  return {
    ...raw,
    id: raw?.id || key,
    url: type === 'image' ? raw?.url || '' : '',
    extension: raw?.extension ? String(raw.extension) : null,
    type,
    whep: type === 'rtsp' ? raw?.whep || null : null,
    gates,
  }
}

const isImageSource = (source: VideoSource) => source.type === 'image'

// Error codes of POST /streaming/open
const OPEN_ERROR_CODES = [
  'no_gates',
  'no_extension',
  'no_code',
  'no_url',
  'gate_not_found',
  'gate_failed',
  'gate_unreachable',
  'dtmf_failed',
  'gate_timeout',
  'call_not_answered',
]

export const useVideoSources = () => {
  const { t } = useTranslation()
  const [streamingError, setStreamingError] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [videoSources, setVideoSources] = useState<VideoSource[]>([])
  const videoSourcesRef = useRef<VideoSource[]>([])
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})

  // Handle image loading errors
  const handleImageError = useCallback((sourceId: string) => {
    setFailedImages((prev) => ({
      ...prev,
      [sourceId]: true,
    }))
  }, [])

  // Handle unlock source action (the server opens the first gate when none is given)
  const handleUnlockSource = useCallback(
    async (source: VideoSource, gate?: VideoSourceGate) => {
      const gateName = gate?.name || source.description || source.id
      try {
        await openVideoSource(gate?.id ? { id: source.id, gate: gate.id } : { id: source.id })
        openToast(
          'success',
          t('Streaming.Open gate success message', { name: gateName }),
          t('Streaming.Gate opened'),
        )
      } catch (error) {
        // unexpected failures are logged by openVideoSource
        let message = t('Streaming.open_error_generic')
        if (axios.isAxiosError(error)) {
          const code = (error.response?.data as any)?.code
          if (code && OPEN_ERROR_CODES.includes(code)) {
            message = t(`Streaming.open_error_${code}`)
          } else if (error.response?.status === 403) {
            message = t('Streaming.open_error_forbidden')
          }
        }
        openToast('error', message, t('Streaming.Unable to open', { name: gateName }))
      }
    },
    [t],
  )

  // Handle call source action
  const handleCallSource = useCallback((source: VideoSource) => {
    if (source?.extension) {
      callPhoneNumber(source.extension)
    }
  }, [])

  // Subscribe to streaming updates
  const subscribeToSource = useCallback(async (sourceId: string) => {
    try {
      await subscribe({ id: sourceId })
    } catch (error) {
      console.error('Error subscribing to source:', error)
    }
  }, [])

  // Unsubscribe from streaming updates
  const unsubscribeFromSource = useCallback(async (sourceId: string) => {
    try {
      await unsubscribe({ id: sourceId })
    } catch (error) {
      console.error('Error unsubscribing from source:', error)
    }
  }, [])

  // Fetch video sources from the API
  const fetchVideoSources = useCallback(async () => {
    try {
      const response = await getVideoSources()

      const sourcesArray = Object.keys(response || {}).map((key) =>
        normalizeSource(key, response[key]),
      )

      // Keep the last frame of the image sources while reloading
      setVideoSources((prevSources) =>
        sourcesArray.map((source) => {
          const prev = prevSources.find((item) => item.id === source.id)
          return isImageSource(source) && prev?.url ? { ...source, url: prev.url } : source
        }),
      )
      setIsLoaded(true)

      // Subscribe to the image sources, rtsp sources are streamed through WebRTC
      sourcesArray.filter(isImageSource).forEach((source: VideoSource) => {
        subscribeToSource(source.id)
      })
    } catch (error) {
      console.error(error)
      setStreamingError('Error fetching video sources')
    }
  }, [subscribeToSource])

  // Update source URLs when receiving streaming information
  useEventListener('phone-island-streaming-information-received', (data: any) => {
    if (data.res?.streaming && data.res.streaming.source && data.res.streaming.image) {
      setVideoSources((prevSources) =>
        prevSources.map((source) =>
          source.id === data.res.streaming.source && isImageSource(source)
            ? { ...source, url: data.res.streaming.image }
            : source,
        ),
      )

      // Reset failed image state for this source when URL is updated
      setFailedImages((prev) => {
        const updated = { ...prev }
        delete updated[data.res.streaming.source]
        return updated
      })
    }
  })

  // Reload sources when server is reloaded
  useEventListener('phone-island-server-reloaded', () => {
    fetchVideoSources()
  })

  // Reload sources when socket is authorized
  useEventListener('phone-island-socket-authorized', () => {
    fetchVideoSources()
  })

  // Manage visibility changes to optimize subscriptions
  useEffect(() => {
    const handleVisibilityChange = () => {
      const sources: VideoSource[] = videoSourcesRef.current.filter(isImageSource)

      if (document.hidden) {
        sources.forEach((source: VideoSource) => {
          unsubscribeFromSource(source.id)
        })
      } else {
        sources.forEach((source: VideoSource) => {
          subscribeToSource(source.id)
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [subscribeToSource, unsubscribeFromSource])

  // Keep reference updated
  useEffect(() => {
    videoSourcesRef.current = videoSources
  }, [videoSources])

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      videoSourcesRef.current.filter(isImageSource).forEach((source: VideoSource) => {
        unsubscribeFromSource(source.id)
      })
    }
  }, [unsubscribeFromSource])

  // Initial fetch
  useEffect(() => {
    fetchVideoSources()
  }, [fetchVideoSources])

  return {
    videoSources,
    isLoaded,
    error: streamingError,
    failedImages,
    handleImageError,
    handleUnlockSource,
    handleCallSource,
  }
}
