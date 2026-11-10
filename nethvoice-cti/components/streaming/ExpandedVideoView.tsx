// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faDownLeftAndUpRightToCenter } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { VideoSource, VideoSourceGate } from '../../hooks/useVideoSources'
import { capitalizeFirstLetter } from '../../utils/stringUtils'
import { VideoSourceView } from './VideoSourceView'

interface ExpandedVideoViewProps {
  source: VideoSource
  hasFailedImage: boolean
  onClose: () => void
  onImageError: (sourceId: string) => void
  onUnlockSource: (source: VideoSource, gate?: VideoSourceGate) => void
  onCallSource: (source: VideoSource) => void
}

export const ExpandedVideoView: React.FC<ExpandedVideoViewProps> = ({
  source,
  hasFailedImage,
  onClose,
  onImageError,
  onUnlockSource,
  onCallSource,
}) => {
  const { t } = useTranslation()

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  // Add escape key handler
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [onClose])

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center'
      onClick={handleOverlayClick}
    >
      <div
        className='relative bg-elevationL3 dark:bg-elevationL3Dark rounded-3xl shadow-lg max-w-5xl w-full mx-4 md:mx-0'
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className='py-2 px-6 flex justify-between items-center font-medium text-base text-secondaryNeutral dark:text-secondaryNeutralDark'>
          <span>{capitalizeFirstLetter(source?.description)}</span>
          {source?.extension && (
            <div className='flex items-center gap-1'>
              <FontAwesomeIcon icon={faPhone} className='w-4 h-4 mr-2' />
              <span>{source.extension}</span>
            </div>
          )}
        </div>

        {/* Image, video or fallback, with the action buttons */}
        <VideoSourceView
          source={source}
          variant='expanded'
          className='flex-1 flex items-center justify-center bg-elevationL2Invert dark:bg-elevationL2InvertDark rounded-3xl overflow-hidden group min-h-[600px]'
          hasFailedImage={hasFailedImage}
          onImageError={onImageError}
          onUnlockSource={onUnlockSource}
          onCallSource={onCallSource}
          sizeAction={{
            icon: faDownLeftAndUpRightToCenter,
            label: 'Collapse',
            tooltip: t('Tooltip.Collapse'),
            onClick: onClose,
          }}
        />
      </div>
    </div>
  )
}
