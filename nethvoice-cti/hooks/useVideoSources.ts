// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEventListener } from '../lib/hooks/useEventListener'
import { getVideoSources, openVideoSource, subscribe, unsubscribe } from '../services/streaming'
import { callPhoneNumber } from '../lib/utils'

export interface VideoSource {
  id: string
  url: string
  user: string
  cmdOpen: string
  password: string
  frameRate: string
  extension: string
  description: string
}

export const useVideoSources = () => {
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

  // Handle unlock source action
  const handleUnlockSource = useCallback(async (source: VideoSource) => {
    try {
      await openVideoSource({ id: source.id })
    } catch (error) {
      console.error('Error unlocking source:', error)
    }
  }, [])

  // Handle call source action
  const handleCallSource = useCallback((source: VideoSource) => {
    callPhoneNumber(source?.extension || source.id)
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

      const sourcesArray = Object.keys(response).map((key) => {
        return {
          ...response[key],
          id: response[key].id || key,
        }
      })

      setVideoSources(sourcesArray)
      setIsLoaded(true)

      // Subscribe to all sources
      sourcesArray.forEach((source: VideoSource) => {
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
          source.id === data.res.streaming.source
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
      const sources: VideoSource[] = videoSourcesRef.current

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
      videoSourcesRef.current.forEach((source: VideoSource) => {
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
