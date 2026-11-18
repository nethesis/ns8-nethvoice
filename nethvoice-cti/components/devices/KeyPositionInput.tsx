// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretDown, faCaretUp } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { TextInput } from '../common'

interface KeyPositionInputProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  className?: string
}

export const KeyPositionInput: FC<KeyPositionInputProps> = ({
  value,
  min = 1,
  max,
  onChange,
  className,
}) => {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const clamp = (newValue: number) => Math.min(Math.max(newValue, min), max)

  const commit = (newValue: number) => {
    const clampedValue = clamp(newValue)
    setDraft(String(clampedValue))
    if (clampedValue !== value) {
      onChange(clampedValue)
    }
  }

  const commitDraft = () => {
    if (draft === '') {
      setDraft(String(value))
      return
    }
    commit(Number(draft))
  }

  const stepper = (
    <div className='flex flex-col items-center justify-center'>
      <button
        type='button'
        aria-label={t('Devices.Move key up') || ''}
        onClick={() => commit(value - 1)}
        disabled={value <= min}
        className='flex h-[11px] w-5 items-end justify-center text-inputIcon dark:text-inputIconDark disabled:opacity-50 disabled:cursor-not-allowed'
      >
        <FontAwesomeIcon icon={faCaretUp} className='h-3.5 w-3.5' />
      </button>
      <button
        type='button'
        aria-label={t('Devices.Move key down') || ''}
        onClick={() => commit(value + 1)}
        disabled={value >= max}
        className='flex h-[11px] w-5 items-start justify-center text-inputIcon dark:text-inputIconDark disabled:opacity-50 disabled:cursor-not-allowed'
      >
        <FontAwesomeIcon icon={faCaretDown} className='h-3.5 w-3.5' />
      </button>
    </div>
  )

  return (
    <TextInput
      type='text'
      inputMode='numeric'
      value={draft}
      onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commitDraft}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          commitDraft()
        }
      }}
      trailingComponent={stepper}
      className={className}
    />
  )
}

KeyPositionInput.displayName = 'KeyPositionInput'
