// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faPhone, faCamera, faLock } from '@fortawesome/free-solid-svg-icons'
import { Button, Dropdown } from '../common'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { useTranslation } from 'react-i18next'
import { VideoSource, VideoSourceGate } from '../../hooks/useVideoSources'

interface VideoSourceActionsProps {
  source: VideoSource
  // suffix of the tooltip ids, unique in the page
  tooltipKey: string
  canSnapshot: boolean
  onSnapshot: () => void
  onUnlockSource: (source: VideoSource, gate?: VideoSourceGate) => void
  onCallSource: (source: VideoSource) => void
  // expand or collapse
  sizeAction: {
    icon: IconDefinition
    label: string
    tooltip: string
    onClick: () => void
  }
}

export const VideoSourceActions: React.FC<VideoSourceActionsProps> = ({
  source,
  tooltipKey,
  canSnapshot,
  onSnapshot,
  onUnlockSource,
  onCallSource,
  sizeAction,
}) => {
  const { t } = useTranslation()
  const gates = source.gates || []
  const barRef = useRef<HTMLDivElement>(null)
  // the gates menu opens above the action bar and stays inside the media area
  const [menuMaxHeight, setMenuMaxHeight] = useState<number>()
  const measureMenuSpace = () => {
    if (barRef.current) setMenuMaxHeight(barRef.current.offsetTop)
  }

  // gates without a name are "Door", numbered by position when there are several of them
  const unnamedGates = gates.filter((gate) => !gate.name)
  const gateLabel = (gate: VideoSourceGate) =>
    gate.name ||
    (unnamedGates.length > 1
      ? t('Streaming.Door number', { number: unnamedGates.indexOf(gate) + 1 })
      : t('Streaming.Door'))

  // "Open <name>" for a single named gate, "Open door" otherwise
  let unlockTooltip = t('Common.Open door')
  if (gates.length === 1 && gates[0].name) {
    unlockTooltip = t('Streaming.Open gate name', { name: gates[0].name })
  }

  const unlockButton = (onClick?: () => void) => (
    <Button
      variant='primaryPhoneIsland'
      aria-label={unlockTooltip}
      size='full'
      data-tooltip-id={`secure-tooltip-${tooltipKey}`}
      data-tooltip-content={unlockTooltip}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={faLock} className='w-6 h-6' />
    </Button>
  )

  return (
    // kept visible while the gates menu is open
    <div
      ref={barRef}
      className='absolute bottom-0 left-0 right-0 bg-black/30 p-4 translate-y-full group-hover:translate-y-0 has-[[data-open]]:translate-y-0 transition-transform duration-200 ease-in-out flex justify-center gap-3'
    >
      {source.extension && (
        <>
          <Button
            variant='call'
            aria-label={t('Tooltip.Call') || undefined}
            size='full'
            data-tooltip-id={`call-tooltip-${tooltipKey}`}
            data-tooltip-content={t('Tooltip.Call')}
            onClick={() => onCallSource(source)}
          >
            <FontAwesomeIcon icon={faPhone} className='w-6 h-6' />
          </Button>
          <CustomThemedTooltip id={`call-tooltip-${tooltipKey}`} />
        </>
      )}

      <Button
        variant='primaryPhoneIsland'
        aria-label={t('Common.Take a screenshot') || undefined}
        size='full'
        disabled={!canSnapshot}
        data-tooltip-id={`screenshot-tooltip-${tooltipKey}`}
        data-tooltip-content={t('Common.Take a screenshot')}
        onClick={onSnapshot}
      >
        <FontAwesomeIcon icon={faCamera} className='w-6 h-6' />
      </Button>
      <CustomThemedTooltip id={`screenshot-tooltip-${tooltipKey}`} />

      {gates.length === 1 && unlockButton(() => onUnlockSource(source, gates[0]))}
      {gates.length > 1 && (
        <div onPointerDownCapture={measureMenuSpace} onKeyDownCapture={measureMenuSpace}>
          <Dropdown
            anchor='top'
            itemsStyle={
              menuMaxHeight
                ? ({ '--anchor-max-height': `${menuMaxHeight}px` } as React.CSSProperties)
                : undefined
            }
            items={
              <>
                <Dropdown.Header>
                  <span>{t('Streaming.Choose what to open')}</span>
                </Dropdown.Header>
                {gates.map((gate) => (
                  <Dropdown.Item
                    key={gate.id}
                    icon={faLock}
                    onClick={() => onUnlockSource(source, gate)}
                  >
                    <span className='truncate'>{gateLabel(gate)}</span>
                  </Dropdown.Item>
                ))}
              </>
            }
          >
            {unlockButton()}
          </Dropdown>
        </div>
      )}
      {gates.length > 0 && <CustomThemedTooltip id={`secure-tooltip-${tooltipKey}`} />}

      <Button
        variant='primaryPhoneIsland'
        aria-label={sizeAction.label}
        size='full'
        data-tooltip-id={`expand-tooltip-${tooltipKey}`}
        data-tooltip-content={sizeAction.tooltip}
        onClick={(e) => {
          e.stopPropagation()
          sizeAction.onClick()
        }}
      >
        <FontAwesomeIcon icon={sizeAction.icon} className='w-6 h-6' />
      </Button>
      <CustomThemedTooltip id={`expand-tooltip-${tooltipKey}`} />
    </div>
  )
}
