// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import Image from 'next/image'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPhone,
  faVideo,
  faCamera,
  faLock,
  faExpand,
  faUpRightAndDownLeftFromCenter,
  faBullhorn,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { useTranslation } from 'react-i18next'
import { VideoSource } from '../../hooks/useVideoSources'
import { capitalizeFirstLetter } from '../../utils/stringUtils'
import { getISODateForFilename } from '../../lib/utils'

interface VideoSourceCardProps {
  source: VideoSource
  hasFailedImage: boolean
  onImageError: (sourceId: string) => void
  onUnlockSource: (source: VideoSource) => void
  onCallSource: (source: VideoSource) => void
  onExpand: (sourceId: string) => void
}

export const VideoSourceCard: React.FC<VideoSourceCardProps> = ({
  source,
  hasFailedImage,
  onImageError,
  onUnlockSource,
  onCallSource,
  onExpand,
}) => {
  const { t } = useTranslation()

  return (
    <div className='overflow-hidden bg-elevationL3 dark:bg-elevationL3Dark rounded-3xl shadow group relative transition-all duration-200'>
      {/* Header */}
      <div className='py-2 px-4 flex justify-between items-center font-medium text-base text-primaryNeutral dark:text-primaryNeutralDark'>
        <span>{capitalizeFirstLetter(source?.description)}</span>
        <div className='flex items-center gap-1'>
          <FontAwesomeIcon icon={faPhone} className='w-4 h-4 mr-2' />
          <span>{source?.extension || source?.id}</span>
        </div>
      </div>

      {/* Image or Fallback */}
      <div className='overflow-hidden rounded-t-3xl'>
        <div className='aspect-video bg-elevationL2Invert dark:bg-elevationL2InvertDark relative'>
          {hasFailedImage ? (
            <div className='w-full h-full flex flex-col items-center justify-center text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark'>
              <FontAwesomeIcon icon={faVideo} className='w-8 h-8 mb-3' />
              <p>{t('Streaming.video feed not available')}</p>
            </div>
          ) : (
            <Image
              src={source.url}
              alt={source.description || 'Video source preview'}
              fill
              unoptimized
              className='object-cover'
              onError={() => onImageError(source.id)}
            />
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className='absolute bottom-0 left-0 right-0 bg-black/30 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-in-out flex justify-center gap-3'>
        <Button
          variant='call'
          aria-label='Call'
          size='full'
          data-tooltip-id={`call-tooltip-${source.id}`}
          data-tooltip-content={t('Tooltip.Call')}
          onClick={() => onCallSource(source)}
        >
          <FontAwesomeIcon icon={faPhone} className='w-6 h-6' />
        </Button>
        <CustomThemedTooltip id={`call-tooltip-${source.id}`} />

        <a
          href={source.url}
          download={
            source.description
              ? `${capitalizeFirstLetter(source.description).replace(/\s+/g, '_')}_${getISODateForFilename()}_screenshot.jpg`
              : `screenshot_${getISODateForFilename()}.jpg`
          }
          className={`inline-flex pi-flex pi-content-center pi-items-center pi-justify-center pi-tracking-wide <pi-duration-200 pi-transform pi-outline-none focus:pi-ring-2 focus:pi-z-20 focus:pi-ring-offset-2 disabled:pi-opacity-40 disabled:pi-cursor-not-allowed pi-border pi-border-transparent focus:pi-ring-offset-white dark:focus:pi-ring-offset-black pi-text-sm pi-leading-4 pi-col-start-auto pi-transition-color pi-shrink-0 content-center items-center justify-center font-medium tracking-wide transition-colors duration-200 transform focus:outline-none focus:z-20 bg-phoneIslandActive dark:bg-phoneIslandActiveDark hover:bg-gray-500 dark:hover:bg-gray-50 focus:ring-emerald-500 dark:focus:ring-emerald-300 text-phoneIslandPrimaryInvert dark:text-phoneIslandPrimaryInvertDark h-12 w-12 rounded-full`}
          data-tooltip-id={`screenshot-tooltip-${source.id}`}
          data-tooltip-content={t('Common.Take a screenshot')}
          aria-label='Take screenshot'
        >
          <FontAwesomeIcon icon={faCamera} className='w-6 h-6' />
        </a>
        <CustomThemedTooltip id={`screenshot-tooltip-${source.id}`} />

        <Button
          variant='primaryPhoneIsland'
          aria-label='Open door'
          size='full'
          data-tooltip-id={`secure-tooltip-${source.id}`}
          data-tooltip-content={t('Common.Open door')}
          onClick={() => onUnlockSource(source)}
        >
          <FontAwesomeIcon icon={faLock} className='w-6 h-6' />
        </Button>
        <CustomThemedTooltip id={`secure-tooltip-${source.id}`} />

        <Button
          variant='primaryPhoneIsland'
          aria-label='Fullscreen'
          size='full'
          data-tooltip-id={`expand-tooltip-${source.id}`}
          data-tooltip-content={t('Tooltip.Expand')}
          onClick={(e) => {
            e.stopPropagation()
            onExpand(source.id)
          }}
        >
          <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} className='w-6 h-6' />
        </Button>
        <CustomThemedTooltip id={`expand-tooltip-${source.id}`} />
      </div>
    </div>
  )
}
