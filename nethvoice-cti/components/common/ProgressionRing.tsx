// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect, useRef } from 'react'

interface ProgressionRingProps {
  seconds: number
  size: number
}

export const ProgressionRing: React.FC<ProgressionRingProps> = ({ seconds, size }) => {
  const circumference = 2 * Math.PI * (size / 2)
  const totalTime = seconds * 1000
  const [progress, setProgress] = useState(0)
  const animationFrameRef = useRef<number | null>(null)
  const tabActivatedTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    const animate = (timestamp: number) => {
      const elapsedTime = timestamp - tabActivatedTimeRef.current
      const progressPercent = (elapsedTime / totalTime) * 100

      if (progressPercent >= 100) {
        setProgress(100)

        // Reset the progress after reaching 100%
        setTimeout(() => {
          setProgress(0)
          tabActivatedTimeRef.current = performance.now()
          animationFrameRef.current = requestAnimationFrame(animate)
        }, 1000)
      } else {
        setProgress(progressPercent)
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameRef.current ?? 0)
    }
  }, [seconds, totalTime])

  return (
    <div>
      <svg className={`w-${size} h-${size} pl-9`}>
        <circle
          className='text-gray-300'
          strokeWidth='5'
          stroke='currentColor'
          fill='transparent'
          r={size / 2 - 2.5}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className='text-primary dark:text-primaryDark'
          strokeWidth='5'
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (progress / 100) * circumference}
          strokeLinecap='round'
          stroke='currentColor'
          fill='transparent'
          r={size / 2 - 2.5}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
    </div>
  )
}

ProgressionRing.displayName = 'ProgressionRing'
