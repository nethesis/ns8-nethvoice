// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import classNames from 'classnames'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { useIsTruncated } from '../../lib/hooks/useIsTruncated'

interface PhoneKeyLabelProps {
  text: string
  tooltipId: string
  className?: string
}

export const PhoneKeyLabel: FC<PhoneKeyLabelProps> = ({ text, tooltipId, className }) => {
  const { ref, isTruncated } = useIsTruncated<HTMLSpanElement>(text)

  return (
    <>
      <span
        ref={ref}
        className={classNames('truncate', className)}
        data-tooltip-id={tooltipId}
        data-tooltip-content={isTruncated ? text : ''}
      >
        {text}
      </span>
      {isTruncated && (
        <CustomThemedTooltip
          id={tooltipId}
          place='top'
          className='whitespace-normal text-left'
          positionStrategy='fixed'
        />
      )}
    </>
  )
}

PhoneKeyLabel.displayName = 'PhoneKeyLabel'
