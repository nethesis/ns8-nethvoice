// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { VideoSource, VideoSourceGate } from '../../hooks/useVideoSources'
import { capitalizeFirstLetter } from '../../utils/stringUtils'
import { VideoSourceView } from './VideoSourceView'

interface VideoSourceCardProps {
  source: VideoSource
  hasFailedImage: boolean
  // the source is shown in the expanded view: its stream is paused here
  isExpanded?: boolean
  onImageError: (sourceId: string) => void
  onUnlockSource: (source: VideoSource, gate?: VideoSourceGate) => void
  onCallSource: (source: VideoSource) => void
  onExpand: (sourceId: string) => void
}

export const VideoSourceCard: React.FC<VideoSourceCardProps> = ({
  source,
  hasFailedImage,
  isExpanded = false,
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
        {source?.extension && (
          <div className='flex items-center gap-1'>
            <FontAwesomeIcon icon={faPhone} className='w-4 h-4 mr-2' />
            <span>{source.extension}</span>
          </div>
        )}
      </div>

      {/* Image, video or fallback, with the action buttons */}
      <div className='overflow-hidden rounded-t-3xl'>
        <VideoSourceView
          source={source}
          variant='card'
          className='aspect-video bg-elevationL2Invert dark:bg-elevationL2InvertDark'
          hasFailedImage={hasFailedImage}
          onImageError={onImageError}
          onUnlockSource={onUnlockSource}
          onCallSource={onCallSource}
          active={!isExpanded}
          sizeAction={{
            icon: faUpRightAndDownLeftFromCenter,
            label: t('Tooltip.Expand'),
            tooltip: t('Tooltip.Expand'),
            onClick: () => onExpand(source.id),
          }}
        />
      </div>
    </div>
  )
}
