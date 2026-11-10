// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Minimal, dependency-free WHEP (WebRTC-HTTP Egress Protocol) player.
 *
 * It receives a one-way (recvonly) video + audio stream from the video gateway and attaches it
 * to a <video> element. The gateway gives no signal when the device drops or the session is
 * revoked (frames just stop), so the player watches the decoded frames itself and reconnects
 * with a fresh token and an exponential backoff.
 */

export type WhepPlayerStatus = 'connecting' | 'playing' | 'reconnecting' | 'unavailable'

// unreachable: the gateway could not pull the device (it keeps retrying)
// codec: the browser cannot decode the stream (no retry)
// forbidden: the user is not allowed to watch the source (no retry)
// error: any other permanent error (no retry)
export type WhepPlayerFailure = 'unreachable' | 'codec' | 'forbidden' | 'error'

export interface WhepPlayerState {
  status: WhepPlayerStatus
  failure: WhepPlayerFailure | null
  hasAudio: boolean
}

export interface WhepToken {
  token: string
  // WHEP endpoint path (or absolute URL) returned with the token
  whep: string
  // token validity in seconds
  expiresIn: number
}

// Thrown by the token provider: permanent errors stop the retries
export class WhepTokenError extends Error {
  permanent: boolean
  failure: WhepPlayerFailure

  constructor(message: string, permanent: boolean, failure: WhepPlayerFailure = 'error') {
    super(message)
    this.name = 'WhepTokenError'
    this.permanent = permanent
    this.failure = failure
  }
}

export interface WhepPlayerOptions {
  video: HTMLVideoElement
  fetchToken: () => Promise<WhepToken>
  // turns the WHEP path into an absolute URL
  resolveUrl: (path: string) => string
  onStateChange: (state: WhepPlayerState) => void
  debug?: boolean
}

// Max wait for the local ICE gathering before sending the offer (host candidates are enough)
const ICE_GATHERING_TIMEOUT_MS = 1000
// The gateway waits up to 10 s for an unreachable device before answering
const WHEP_REQUEST_TIMEOUT_MS = 15000
// First frame usually arrives 0.6-1.5 s after the answer
const FIRST_FRAME_TIMEOUT_MS = 8000
const FIRST_FRAME_POLL_MS = 200
// No new decoded frame for this long means the stream is stalled
const STALL_TIMEOUT_MS = 3000
const WATCHDOG_INTERVAL_MS = 1000
// Reconnect backoff: 1 s, 2 s, 4 s, 8 s, 16 s, 30 s, 30 s... with +/-20% jitter
const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000
// Playing this long resets the backoff
const STABLE_PLAYING_MS = 10000
// Consecutive failures shown as "reconnecting" before showing "unavailable"
const MAX_RECONNECTING_FAILURES = 3
// Max wait for the DELETE of a session before closing its connection anyway
const DELETE_CLOSE_TIMEOUT_MS = 1000
// Renew the token a bit before it expires
const TOKEN_EXPIRY_MARGIN_MS = 5000

interface WhepSession {
  pc: RTCPeerConnection
  location: string | null
  token: string
  stream: MediaStream
}

export class WhepPlayer {
  private readonly opts: WhepPlayerOptions
  private state: WhepPlayerState = { status: 'connecting', failure: null, hasAudio: false }
  private running = false
  // incremented on every new attempt or teardown, async steps of older attempts are dropped
  private generation = 0
  private session: WhepSession | null = null
  private token: { value: string; whep: string; expiresAt: number } | null = null
  private abort: AbortController | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null
  private stableTimer: ReturnType<typeof setTimeout> | null = null
  private failures = 0
  private consecutiveUnauthorized = 0
  private hasPlayed = false

  constructor(opts: WhepPlayerOptions) {
    this.opts = opts
  }

  start() {
    if (this.running) return
    this.running = true
    this.failures = 0
    this.consecutiveUnauthorized = 0
    this.hasPlayed = false
    this.setState({ status: 'connecting', failure: null })
    this.connect()
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.clearRetry()
    this.teardown()
    this.opts.video.srcObject = null
  }

  getState() {
    return this.state
  }

  private log(...args: any[]) {
    if (this.opts.debug) console.debug('[whep]', ...args)
  }

  private setState(patch: Partial<WhepPlayerState>) {
    const next = { ...this.state, ...patch }
    if (
      next.status === this.state.status &&
      next.failure === this.state.failure &&
      next.hasAudio === this.state.hasAudio
    ) {
      return
    }
    this.state = next
    this.opts.onStateChange(next)
  }

  private clearRetry() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private async getToken(): Promise<{ value: string; whep: string }> {
    if (this.token && this.token.expiresAt > Date.now()) {
      return this.token
    }
    const t = await this.opts.fetchToken()
    const ttlMs = Math.max(0, (t.expiresIn || 0) * 1000 - TOKEN_EXPIRY_MARGIN_MS)
    this.token = { value: t.token, whep: t.whep, expiresAt: Date.now() + ttlMs }
    return this.token
  }

  private async connect() {
    this.clearRetry()
    this.teardown()
    const gen = ++this.generation
    const isCurrent = () => this.running && gen === this.generation

    let token: { value: string; whep: string }
    try {
      token = await this.getToken()
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof WhepTokenError && error.permanent) {
        this.log('token error, giving up', error.message)
        this.fail(error.failure, false)
      } else {
        this.log('token error, retrying', error)
        this.fail('unreachable', true)
      }
      return
    }
    if (!isCurrent()) return

    const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' })
    const stream = new MediaStream()
    this.session = { pc, location: null, token: token.value, stream }
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (event) => {
      if (!isCurrent()) return
      stream.addTrack(event.track)
      if (event.track.kind === 'audio') {
        this.setState({ hasAudio: true })
      }
      if (this.opts.video.srcObject !== stream) {
        this.opts.video.srcObject = stream
      }
      this.opts.video.play().catch(() => {})
    }
    pc.onconnectionstatechange = () => {
      if (!isCurrent()) return
      this.log('connection state', pc.connectionState)
      if (pc.connectionState === 'failed') {
        this.fail('unreachable', true)
      }
    }

    try {
      await pc.setLocalDescription(await pc.createOffer())
      await this.waitIceGathering(pc)
      if (!isCurrent()) return

      const abort = new AbortController()
      this.abort = abort
      const abortTimer = setTimeout(() => abort.abort(), WHEP_REQUEST_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(this.opts.resolveUrl(token.whep), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
            Authorization: `Bearer ${token.value}`,
          },
          body: pc.localDescription?.sdp,
          signal: abort.signal,
        })
      } finally {
        clearTimeout(abortTimer)
      }
      if (!isCurrent()) return

      if (response.status === 401) {
        // token expired or revoked: get a new one, retry at once only the first time
        this.token = null
        this.consecutiveUnauthorized++
        this.log('401 from the gateway')
        if (this.consecutiveUnauthorized === 1) {
          this.connect()
        } else {
          this.fail('unreachable', true)
        }
        return
      }
      this.consecutiveUnauthorized = 0

      if (response.status !== 201 && response.status !== 200) {
        const body = await response.text().catch(() => '')
        if (!isCurrent()) return
        let message = body
        try {
          message = JSON.parse(body)?.error || body
        } catch {
          // not JSON
        }
        this.log('gateway error', response.status, message)
        if (response.status === 400 && /codec/i.test(message)) {
          this.fail('codec', false)
        } else {
          this.fail('unreachable', true)
        }
        return
      }

      const location = response.headers.get('Location')
      if (location && this.session) {
        this.session.location = new URL(location, response.url).toString()
      }
      const answer = await response.text()
      if (!isCurrent()) return
      await pc.setRemoteDescription({ type: 'answer', sdp: answer })
    } catch (error) {
      if (!isCurrent()) return
      // network errors, timeouts, an answer the browser cannot accept
      this.log('connect error', error)
      this.fail('unreachable', true)
      return
    }
    if (!isCurrent()) return
    this.startWatchdog(gen, pc)
  }

  private waitIceGathering(pc: RTCPeerConnection) {
    return new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve()
        return
      }
      const timer = setTimeout(done, ICE_GATHERING_TIMEOUT_MS)
      function done() {
        clearTimeout(timer)
        pc.removeEventListener('icegatheringstatechange', onChange)
        resolve()
      }
      function onChange() {
        if (pc.iceGatheringState === 'complete') done()
      }
      pc.addEventListener('icegatheringstatechange', onChange)
    })
  }

  // Polls the decoded frames: fast until the first frame (to show it at once), then every second
  private startWatchdog(gen: number, pc: RTCPeerConnection) {
    const startedAt = Date.now()
    let lastFrames = 0
    let lastProgressAt = startedAt

    const tick = async () => {
      let frames = lastFrames
      try {
        const stats = await pc.getStats()
        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            frames = report.framesDecoded || 0
          }
        })
      } catch {
        // the connection was closed meanwhile
      }
      if (!this.running || gen !== this.generation) return

      const now = Date.now()
      if (frames > lastFrames) {
        lastFrames = frames
        lastProgressAt = now
        if (this.state.status !== 'playing') this.onPlaying()
      } else if (lastFrames === 0) {
        if (now - startedAt > FIRST_FRAME_TIMEOUT_MS) {
          this.log('no first frame')
          this.fail('unreachable', true)
          return
        }
      } else if (now - lastProgressAt > STALL_TIMEOUT_MS) {
        this.log('stream stalled')
        // the session may have been revoked: do not reuse the token
        this.token = null
        this.fail('unreachable', true)
        return
      }
      this.watchdogTimer = setTimeout(
        tick,
        lastFrames === 0 ? FIRST_FRAME_POLL_MS : WATCHDOG_INTERVAL_MS,
      )
    }
    this.watchdogTimer = setTimeout(tick, FIRST_FRAME_POLL_MS)
  }

  private onPlaying() {
    this.hasPlayed = true
    this.setState({ status: 'playing', failure: null })
    if (this.stableTimer) clearTimeout(this.stableTimer)
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null
      this.failures = 0
    }, STABLE_PLAYING_MS)
  }

  private fail(failure: WhepPlayerFailure, retry: boolean) {
    this.teardown()
    if (!retry) {
      this.setState({ status: 'unavailable', failure })
      return
    }
    this.failures++
    if (this.hasPlayed && this.failures <= MAX_RECONNECTING_FAILURES) {
      this.setState({ status: 'reconnecting', failure: null })
    } else {
      this.setState({ status: 'unavailable', failure })
    }
    const delay =
      Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (this.failures - 1)) *
      (0.8 + Math.random() * 0.4)
    this.log(`retry in ${Math.round(delay)} ms (failure ${this.failures})`)
    this.clearRetry()
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (this.running) this.connect()
    }, delay)
  }

  // Close the current session (if any) and invalidate its pending async steps
  private teardown() {
    this.generation++
    if (this.abort) {
      this.abort.abort()
      this.abort = null
    }
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer)
      this.watchdogTimer = null
    }
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }
    const session = this.session
    this.session = null
    if (!session) return

    session.pc.ontrack = null
    session.pc.onconnectionstatechange = null
    // the <video> keeps showing the last frame while reconnecting
    if (!session.location) {
      session.pc.close()
      return
    }
    // free the gateway session at once (keepalive survives a page unload), then close the
    // connection: closing it first makes the gateway drop the session before the DELETE arrives
    let closed = false
    const close = () => {
      if (closed) return
      closed = true
      clearTimeout(closeTimer)
      session.pc.close()
    }
    const closeTimer = setTimeout(close, DELETE_CLOSE_TIMEOUT_MS)
    fetch(session.location, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.token}` },
      keepalive: true,
    })
      .catch(() => {})
      .finally(close)
  }
}
