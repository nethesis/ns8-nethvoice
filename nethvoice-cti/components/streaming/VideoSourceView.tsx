// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import classNames from 'classnames'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
  faVideo,
  faVolumeHigh,
  faVolumeXmark,
  faCircleNotch,
} from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '../common/Skeleton'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { VideoSource, VideoSourceGate } from '../../hooks/useVideoSources'
import { useIsWatched, useWhepPlayer } from '../../hooks/useWhepPlayer'
import { WhepToken } from '../../lib/whepPlayer'
import { capitalizeFirstLetter } from '../../utils/stringUtils'
import { getISODateForFilename } from '../../lib/utils'
import { VideoSourceActions } from './VideoSourceActions'

interface VideoSourceViewProps {
  source: VideoSource
  variant: 'card' | 'expanded'
  // classes of the media container
  className?: string
  hasFailedImage: boolean
  onImageError: (sourceId: string) => void
  onUnlockSource: (source: VideoSource, gate?: VideoSourceGate) => void
  onCallSource: (source: VideoSource) => void
  sizeAction: {
    icon: IconDefinition
    label: string
    tooltip: string
    onClick: () => void
  }
  // false closes the stream of an rtsp source (e.g. while it is shown expanded)
  active?: boolean
  // overridable for tests
  fetchToken?: (sourceId: string) => Promise<WhepToken>
  resolveUrl?: (path: string) => string
}

const snapshotFilename = (source: VideoSource) =>
  source.description
    ? `${capitalizeFirstLetter(source.description).replace(
        /\s+/g,
        '_',
      )}_${getISODateForFilename()}_screenshot.jpg`
    : `screenshot_${getISODateForFilename()}.jpg`

const downloadDataUrl = (dataUrl: string, filename: string) => {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/**
 * Media area of a video source (JPEG frames for "image" sources, WebRTC for "rtsp" sources)
 * with its action bar.
 */
export const VideoSourceView: React.FC<VideoSourceViewProps> = ({
  source,
  variant,
  className,
  hasFailedImage,
  onImageError,
  onUnlockSource,
  onCallSource,
  sizeAction,
  active = true,
  fetchToken,
  resolveUrl,
}) => {
  const { t } = useTranslation()
  const isRtsp = source.type === 'rtsp'
  const isExpanded = variant === 'expanded'
  const tooltipKey = isExpanded ? 'expanded' : source.id

  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const watched = useIsWatched(containerRef)
  const [muted, setMuted] = useState(true)

  const player = useWhepPlayer({
    sourceId: source.id,
    whep: source.whep,
    enabled: isRtsp && active && watched,
    videoRef,
    fetchToken,
    resolveUrl,
  })

  // React does not keep the muted attribute in sync, set the property
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted, player.status])

  const hasVideoFrame = player.status === 'playing' || player.status === 'reconnecting'
  const canSnapshot = isRtsp ? hasVideoFrame : !!source.url && !hasFailedImage

  const handleSnapshot = useCallback(() => {
    if (!isRtsp) {
      if (source.url) downloadDataUrl(source.url, snapshotFilename(source))
      return
    }
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    downloadDataUrl(canvas.toDataURL('image/jpeg', 0.92), snapshotFilename(source))
  }, [isRtsp, source])

  const unavailable = (message?: string) => (
    <div
      className={classNames(
        'absolute inset-0 flex flex-col items-center justify-center text-center px-4 font-medium text-secondaryNeutral dark:text-secondaryNeutralDark',
        isExpanded ? '' : 'text-sm',
      )}
    >
      <FontAwesomeIcon icon={faVideo} className={isExpanded ? 'w-16 h-16 mb-4' : 'w-8 h-8 mb-3'} />
      <p className={isExpanded ? 'text-lg' : ''}>{t('Streaming.video feed not available')}</p>
      {message && <p className='mt-1 text-xs font-normal'>{message}</p>}
    </div>
  )

  const loading = (
    <div className='absolute inset-0'>
      <Skeleton width='100%' height='100%' variant='rectangular' />
    </div>
  )

  const renderImage = () => {
    if (hasFailedImage) return unavailable()
    if (!source.url) return loading
    return (
      <Image
        src={source.url}
        alt={source.description || 'Video source preview'}
        fill
        unoptimized
        className={isExpanded ? 'object-contain' : 'object-cover'}
        onError={() => onImageError(source.id)}
      />
    )
  }

  const unavailableMessage = () => {
    switch (player.failure) {
      case 'codec':
        return t('Streaming.Your browser cannot play the video format of this source')
      case 'forbidden':
        return t('Streaming.You are not allowed to watch this source')
      case 'unreachable':
        return t('Streaming.The video source is not reachable, retrying')
      default:
        return undefined
    }
  }

  const renderStream = () => (
    <>
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className={classNames(
          'absolute inset-0 w-full h-full',
          isExpanded ? 'object-contain' : 'object-cover',
          !hasVideoFrame && 'invisible',
        )}
      />
      {player.status === 'connecting' && loading}
      {player.status === 'unavailable' && unavailable(unavailableMessage())}
      {player.status === 'reconnecting' && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/40 text-white text-sm font-medium'>
          <FontAwesomeIcon icon={faCircleNotch} className='w-4 h-4 mr-2 animate-spin' />
          <span>{t('Streaming.Reconnecting')}</span>
        </div>
      )}
      {player.status === 'playing' && player.hasAudio && (
        <>
          <button
            type='button'
            className='absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500'
            aria-label={muted ? 'Unmute' : 'Mute'}
            data-tooltip-id={`audio-tooltip-${tooltipKey}`}
            data-tooltip-content={muted ? t('Streaming.Unmute') : t('Streaming.Mute')}
            onClick={(e) => {
              e.stopPropagation()
              setMuted((value) => !value)
            }}
          >
            <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} className='w-4 h-4' />
          </button>
          <CustomThemedTooltip id={`audio-tooltip-${tooltipKey}`} />
        </>
      )}
    </>
  )

  return (
    <div ref={containerRef} className={classNames('relative', className)}>
      {isRtsp ? renderStream() : renderImage()}

      <VideoSourceActions
        source={source}
        tooltipKey={tooltipKey}
        canSnapshot={canSnapshot}
        onSnapshot={handleSnapshot}
        onUnlockSource={onUnlockSource}
        onCallSource={onCallSource}
        sizeAction={sizeAction}
      />
    </div>
  )
}
