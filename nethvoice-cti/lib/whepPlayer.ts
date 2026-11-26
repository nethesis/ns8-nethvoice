// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Minimal, dependency-free WHEP (WebRTC-HTTP Egress Protocol) player.
 *
 * It receives a one-way (recvonly) video + audio stream from the video gateway and attaches it
 * to a <video> element. The gateway gives no signal when the device drops or the session is
 * revoked (frames just stop), so the player watches the decoded frames itself and reconnects
 * with a fresh token and an exponential backoff.
 *
 * The browser can only start (or recover) decoding on a complete keyframe, and some devices send
 * one rarely. RTSP has no way to ask for one and the device stream is shared by the gateway, so a
 * new session would not get it sooner: while the video packets keep arriving the session is kept
 * open ("waiting" for the picture) instead of being torn down.
 */

// waiting: the video packets arrive but no picture can be decoded yet (no complete keyframe)
export type WhepPlayerStatus = 'connecting' | 'playing' | 'waiting' | 'reconnecting' | 'unavailable'

// unreachable: the gateway could not pull the device (it keeps retrying)
// codec: the browser cannot decode the stream (no retry)
// forbidden: the user is not allowed to watch the source (no retry)
// error: any other permanent error (no retry)
// busy: the user has too many videos open (no retry: the view must be closed and reopened)
export type WhepPlayerFailure = 'unreachable' | 'codec' | 'forbidden' | 'error' | 'busy'

export interface WhepPlayerState {
  status: WhepPlayerStatus
  failure: WhepPlayerFailure | null
  hasAudio: boolean
  // a picture was decoded since the start: the views keep showing the last one while waiting
  // or reconnecting
  hasPicture: boolean
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
  // too many token requests: retried with the backoff, never shown as unavailable
  rateLimited: boolean

  constructor(
    message: string,
    permanent: boolean,
    failure: WhepPlayerFailure = 'error',
    rateLimited = false,
  ) {
    super(message)
    this.name = 'WhepTokenError'
    this.permanent = permanent
    this.failure = failure
    this.rateLimited = rateLimited
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
// Past the timeouts above, the session is kept while its video packets keep arriving (the next
// complete keyframe may be far away), up to this long without a picture
const PICTURE_WAIT_MAX_MS = 90000
// No video packet for this long means no media is arriving
const MEDIA_IDLE_MS = 2000
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

// Progress of a session, as seen by the watchdog
export interface WatchdogProgress {
  // frames decoded and when they last increased (the session start until the first one)
  frames: number
  frameAt: number
  // video packets and bytes received and when they last increased (the session start until the
  // first ones)
  packets: number
  bytes: number
  mediaAt: number
}

export interface WatchdogSample {
  now: number
  framesDecoded: number
  packetsReceived: number
  bytesReceived: number
  connectionState: string
}

// playing: frames are being decoded
// connecting: no frame yet, within the usual time of the first one
// waiting: no (new) frame for longer than usual, but the video packets keep arriving
// failed: no frame and no media arriving (or waited too long): reconnect
export type WatchdogVerdict = 'playing' | 'connecting' | 'waiting' | 'failed'

export const initialWatchdogProgress = (now: number): WatchdogProgress => ({
  frames: 0,
  frameAt: now,
  packets: 0,
  bytes: 0,
  mediaAt: now,
})

/**
 * Decides whether a session is kept or torn down, from a new sample of its video statistics
 */
export const checkWatchdog = (
  progress: WatchdogProgress,
  sample: WatchdogSample,
): { progress: WatchdogProgress; verdict: WatchdogVerdict } => {
  const { now } = sample
  const next = { ...progress }
  if (sample.framesDecoded > next.frames) {
    next.frames = sample.framesDecoded
    next.frameAt = now
  }
  if (sample.packetsReceived > next.packets || sample.bytesReceived > next.bytes) {
    next.packets = Math.max(next.packets, sample.packetsReceived)
    next.bytes = Math.max(next.bytes, sample.bytesReceived)
    next.mediaAt = now
  }
  const sinceFrame = now - next.frameAt
  if (next.frames === 0 && sinceFrame <= FIRST_FRAME_TIMEOUT_MS) {
    return { progress: next, verdict: 'connecting' }
  }
  if (next.frames > 0 && sinceFrame <= STALL_TIMEOUT_MS) {
    return { progress: next, verdict: 'playing' }
  }
  // past the usual timeouts: kept only while the video packets keep arriving
  const connected = !['failed', 'disconnected', 'closed'].includes(sample.connectionState)
  const mediaArriving = connected && now - next.mediaAt <= MEDIA_IDLE_MS
  if (mediaArriving && sinceFrame <= PICTURE_WAIT_MAX_MS) {
    return { progress: next, verdict: 'waiting' }
  }
  return { progress: next, verdict: 'failed' }
}

interface WhepSession {
  pc: RTCPeerConnection
  location: string | null
  token: string
  stream: MediaStream
}

export class WhepPlayer {
  private readonly opts: WhepPlayerOptions
  private state: WhepPlayerState = {
    status: 'connecting',
    failure: null,
    hasAudio: false,
    hasPicture: false,
  }
  private running = false
  // incremented on every new attempt or teardown, async steps of older attempts are dropped
  private generation = 0
  private session: WhepSession | null = null
  private token: { value: string; whep: string; expiresAt: number } | null = null
  // WHEP requests that may still create or free a gateway session: a new offer waits for them
  private pending = new Set<Promise<void>>()
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
    this.setState({ status: 'connecting', failure: null, hasPicture: false })
    this.connect()
  }

  stop() {
    if (!this.running) return
    this.running = false
    this.clearRetry()
    this.teardown()
    this.opts.video.srcObject = null
    this.opts.video.removeAttribute('poster')
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
      next.hasAudio === this.state.hasAudio &&
      next.hasPicture === this.state.hasPicture
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
      } else if (error instanceof WhepTokenError && error.rateLimited) {
        this.log('token rate limited, backing off')
        this.fail('unreachable', true, true)
      } else {
        this.log('token error, retrying', error)
        this.fail('unreachable', true)
      }
      return
    }
    if (!isCurrent()) return

    const pc = new RTCPeerConnection({ bundlePolicy: 'max-bundle' })
    const stream = new MediaStream()
    const session: WhepSession = { pc, location: null, token: token.value, stream }
    this.session = session
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
      // at most one gateway session per player: let the previous requests settle first
      await this.settle()
      if (!isCurrent()) return

      // The POST is never aborted by a teardown: the gateway creates the session before
      // answering, and without its Location it could not be deleted. A stale answer frees it.
      const exchange = (async () => {
        // a token opens one session only: never reuse it
        if (this.token?.value === token.value) this.token = null
        const abort = new AbortController()
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
        const location = response.headers.get('Location')
        const created =
          (response.status === 201 || response.status === 200) && location
            ? new URL(location, response.url).toString()
            : null
        if (!isCurrent()) {
          this.log('stale WHEP answer, closing its session')
          if (created) await this.deleteSession(created, token.value)
          return null
        }
        // from now on the teardown deletes it
        session.location = created
        return response
      })()
      this.track(exchange)
      const response = await exchange
      if (!response || !isCurrent()) return

      if (response.status === 401) {
        // token expired, revoked or already used: new token, retry at once only the first time
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

  // Polls the decoded frames and the received video packets: fast until the first frame (to show
  // it at once), then every second
  private startWatchdog(gen: number, pc: RTCPeerConnection) {
    let progress = initialWatchdogProgress(Date.now())

    const tick = async () => {
      let video: any = null
      try {
        const stats = await pc.getStats()
        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            video = report
          }
        })
      } catch {
        // the connection was closed meanwhile
      }
      if (!this.running || gen !== this.generation) return

      const result = checkWatchdog(progress, {
        now: Date.now(),
        framesDecoded: video?.framesDecoded || 0,
        packetsReceived: video?.packetsReceived || 0,
        bytesReceived: video?.bytesReceived || 0,
        connectionState: pc.connectionState,
      })
      progress = result.progress
      switch (result.verdict) {
        case 'playing':
          if (this.state.status !== 'playing') this.onPlaying()
          break
        case 'waiting':
          if (this.state.status !== 'waiting') this.onWaiting(video)
          break
        case 'failed':
          this.log(progress.frames ? 'stream stalled' : 'no first frame', video)
          // the session may have been revoked: do not reuse the token
          this.token = null
          this.fail('unreachable', true)
          return
      }
      this.watchdogTimer = setTimeout(
        tick,
        progress.frames === 0 ? FIRST_FRAME_POLL_MS : WATCHDOG_INTERVAL_MS,
      )
    }
    this.watchdogTimer = setTimeout(tick, FIRST_FRAME_POLL_MS)
  }

  private onPlaying() {
    this.hasPlayed = true
    this.setState({ status: 'playing', failure: null, hasPicture: true })
    if (this.stableTimer) clearTimeout(this.stableTimer)
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null
      this.failures = 0
    }, STABLE_PLAYING_MS)
  }

  // Media arriving without a picture to decode: the session is kept, not counted as a failure
  private onWaiting(video: any) {
    this.log('waiting for a keyframe', {
      packetsReceived: video?.packetsReceived,
      framesDecoded: video?.framesDecoded,
      keyFramesDecoded: video?.keyFramesDecoded,
      pliCount: video?.pliCount,
    })
    // not stable playback: the backoff is not reset meanwhile
    if (this.stableTimer) {
      clearTimeout(this.stableTimer)
      this.stableTimer = null
    }
    this.setState({ status: 'waiting', failure: null })
  }

  // quiet: a transient failure (rate limit), shown as connecting/reconnecting, never unavailable
  private fail(failure: WhepPlayerFailure, retry: boolean, quiet = false) {
    this.teardown()
    if (!retry) {
      this.setState({ status: 'unavailable', failure })
      return
    }
    this.failures++
    if (quiet) {
      this.setState({ status: this.hasPlayed ? 'reconnecting' : 'connecting', failure: null })
    } else if (this.hasPlayed && this.failures <= MAX_RECONNECTING_FAILURES) {
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

  // Keeps a request in `pending` until it settles
  private track(request: Promise<unknown>) {
    const settled: Promise<void> = request.then(
      () => {
        this.pending.delete(settled)
      },
      () => {
        this.pending.delete(settled)
      },
    )
    this.pending.add(settled)
  }

  private async settle() {
    while (this.pending.size) {
      await Promise.all(Array.from(this.pending))
    }
  }

  // DELETE of a gateway session (keepalive survives a page unload), settles in at most
  // DELETE_CLOSE_TIMEOUT_MS
  private deleteSession(location: string, token: string) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, DELETE_CLOSE_TIMEOUT_MS)
      fetch(location, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer)
          resolve()
        })
    })
  }

  // Closing the connection ends its tracks and the <video> turns black: while reconnecting,
  // the last frame is kept on screen as the poster (shown until the next stream plays)
  private freezeLastFrame(session: WhepSession) {
    const video = this.opts.video
    if (video.srcObject !== session.stream) return
    if (video.videoWidth && video.videoHeight) {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
        video.poster = canvas.toDataURL('image/jpeg', 0.9)
      } catch {
        // no frame to keep
      }
    }
    video.srcObject = null
  }

  // Close the current session (if any) and invalidate its pending async steps
  private teardown() {
    this.generation++
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
    if (this.running) this.freezeLastFrame(session)
    // no Location yet: an in-flight POST deletes its session when it completes
    if (!session.location) {
      session.pc.close()
      return
    }
    // free the gateway session at once, then close the connection: closing it first makes the
    // gateway drop the session before the DELETE arrives
    const deleted = this.deleteSession(session.location, session.token).then(() =>
      session.pc.close(),
    )
    this.track(deleted)
  }
}
