// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { VideoSource } from '../../hooks/useVideoSources'
import { VideoSourceCard } from './VideoSourceCard'

interface VideoSourcesGridProps {
  sources: VideoSource[]
  failedImages: Record<string, boolean>
  onImageError: (sourceId: string) => void
  onUnlockSource: (source: VideoSource) => void
  onCallSource: (source: VideoSource) => void
  onExpand: (sourceId: string) => void
}

export const VideoSourcesGrid: React.FC<VideoSourcesGridProps> = ({
  sources,
  failedImages,
  onImageError,
  onUnlockSource,
  onCallSource,
  onExpand,
}) => {
  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
      {sources.map((source) => (
        <VideoSourceCard
          key={source.id}
          source={source}
          hasFailedImage={failedImages[source.id] || false}
          onImageError={onImageError}
          onUnlockSource={onUnlockSource}
          onCallSource={onCallSource}
          onExpand={onExpand}
        />
      ))}
    </div>
  )
}
