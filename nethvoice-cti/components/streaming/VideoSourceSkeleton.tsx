// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { Skeleton } from '../common/Skeleton'

export const VideoSourceSkeleton: React.FC = () => {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
      {[1, 2, 3].map((index) => (
        <div
          key={index}
          className='overflow-hidden bg-elevationL3 dark:bg-elevationL3Dark rounded-3xl shadow'
        >
          {/* Header skeleton */}
          <div className='py-3 px-4 flex justify-between items-center'>
            <Skeleton width='50%' height='1.5rem' />
            <Skeleton width='20%' height='1.5rem' />
          </div>
          {/* Image skeleton */}
          <div className='overflow-hidden'>
            <div className='aspect-video bg-elevationL2Invert dark:bg-elevationL2InvertDark'>
              <Skeleton width='100%' height='100%' variant='rectangular' />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
