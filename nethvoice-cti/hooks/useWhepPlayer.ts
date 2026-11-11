// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RefObject, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { WhepPlayer, WhepPlayerState, WhepToken, WhepTokenError } from '../lib/whepPlayer'
import { getStreamingToken, getWhepUrl } from '../services/streaming'

// Grace time before closing the stream of a card scrolled out of view
const OUT_OF_VIEW_GRACE_MS = 2000

/**
 * True while the element is (at least partially) in the viewport and the browser tab is visible.
 * Leaving the viewport is reported after a short grace time to avoid reconnecting on every scroll.
 */
export const useIsWatched = (ref: RefObject<HTMLElement | null>) => {
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  )

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting)
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      if (visible) {
        setInView(true)
      } else {
        timer = setTimeout(() => setInView(false), OUT_OF_VIEW_GRACE_MS)
      }
    })
    observer.observe(element)
    return () => {
      if (timer) clearTimeout(timer)
      observer.disconnect()
    }
  }, [ref])

  return inView && pageVisible
}

// Token provider of a source, using the CTI REST API
export const fetchSourceToken = async (sourceId: string): Promise<WhepToken> => {
  try {
    const data = await getStreamingToken(sourceId)
    return { token: data.token, whep: data.whep, expiresIn: data.expires_in }
  } catch (error) {
    const status = axios.isAxiosError(error) ? error.response?.status : undefined
    const code = axios.isAxiosError(error) ? (error.response?.data as any)?.code : undefined
    if (status === 403) {
      throw new WhepTokenError('streaming token forbidden', true, 'forbidden')
    }
    if (status === 429 && code === 'too_many_sessions') {
      throw new WhepTokenError('too many streaming sessions', true, 'busy')
    }
    if (status === 429) {
      // too_many_requests: retry later, with the backoff
      throw new WhepTokenError('streaming token rate limited', false, 'unreachable', true)
    }
    if (status === 400 || status === 404) {
      throw new WhepTokenError(`streaming token error ${status}`, true, 'error')
    }
    // network errors, 5xx: retry
    throw new WhepTokenError(`streaming token error ${status ?? ''}`, false, 'unreachable')
  }
}

interface UseWhepPlayerOptions {
  sourceId: string
  // WHEP path from the sources list, the one returned with the token wins
  whep: string | null
  enabled: boolean
  videoRef: RefObject<HTMLVideoElement | null>
  // overridable for tests
  fetchToken?: (sourceId: string) => Promise<WhepToken>
  resolveUrl?: (path: string) => string
}

const initialState: WhepPlayerState = { status: 'connecting', failure: null, hasAudio: false }

/**
 * Plays the WebRTC stream of an "rtsp" video source into a <video> element while enabled.
 * The session is closed when disabled or unmounted.
 */
export const useWhepPlayer = ({
  sourceId,
  whep,
  enabled,
  videoRef,
  fetchToken = fetchSourceToken,
  resolveUrl = getWhepUrl,
}: UseWhepPlayerOptions) => {
  const [state, setState] = useState<WhepPlayerState>(initialState)
  // keep the latest providers without restarting the session when their identity changes
  const providers = useRef({ fetchToken, resolveUrl })
  providers.current = { fetchToken, resolveUrl }

  useEffect(() => {
    const video = videoRef.current
    if (!enabled || !video) return

    const player = new WhepPlayer({
      video,
      fetchToken: async () => {
        const token = await providers.current.fetchToken(sourceId)
        return { ...token, whep: token.whep || whep || '' }
      },
      resolveUrl: (path) => providers.current.resolveUrl(path),
      onStateChange: setState,
    })
    player.start()
    setState(player.getState())

    return () => {
      player.stop()
      setState(initialState)
    }
  }, [enabled, sourceId, whep, videoRef])

  return state
}
