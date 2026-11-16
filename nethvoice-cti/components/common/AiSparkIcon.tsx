// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import classNames from 'classnames'

interface AiSparkIconProps {
  className?: string
  animate?: boolean
}

const AI_SPARK_SVG_PATH =
  'M327.5 85.2c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L384 128l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L448 128l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L448 64 426.8 7.5C425.1 3 420.8 0 416 0s-9.1 3-10.8 7.5L384 64 327.5 85.2zM205.1 73.3c-2.6-5.7-8.3-9.3-14.5-9.3s-11.9 3.6-14.5 9.3L123.3 187.3 9.3 240C3.6 242.6 0 248.3 0 254.6s3.6 11.9 9.3 14.5l114.1 52.7L176 435.8c2.6 5.7 8.3 9.3 14.5 9.3s11.9-3.6 14.5-9.3l52.7-114.1 114.1-52.7c5.7-2.6 9.3-8.3 9.3-14.5s-3.6-11.9-9.3-14.5L257.8 187.4 205.1 73.3zM383.6 324.7c-1.7-3.8-5.5-6.3-9.6-6.3s-7.9 2.4-9.6 6.3L341.9 364l-39.4 22.5c-3.8 1.7-6.3 5.5-6.3 9.6s2.4 7.9 6.3 9.6L341.9 428l22.5 39.4c1.7 3.8 5.5 6.3 9.6 6.3s7.9-2.4 9.6-6.3L406 428l39.4-22.5c3.8-1.7 6.3-5.5 6.3-9.6s-2.4-7.9-6.3-9.6L406 364 383.6 324.7z'

export const AiSparkIcon: FC<AiSparkIconProps> = ({ className = 'w-4 h-4', animate = false }) => {
  const svgDataUrl = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath d='${AI_SPARK_SVG_PATH}'/%3E%3C/svg%3E")`

  return (
    <div
      className={classNames(className, { 'animate-pulse': animate })}
      style={{
        background: 'linear-gradient(90deg, #4F46E5 0%, #DB2777 100%)',
        WebkitMask: svgDataUrl,
        mask: svgDataUrl,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        transform: 'scaleX(-1)',
      }}
    />
  )
}
