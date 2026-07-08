// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPhone, faCalendar } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { useSelector } from 'react-redux'
import { Skeleton } from '../common/Skeleton'
import { formatDateLoc } from '../../lib/dateTime'
import { callPhoneNumber, transferCallToExtension } from '../../lib/utils'
import { getEffectiveCnam } from '../../lib/history'
import { RootState } from '../../store'

export interface SummaryCallInfo {
  src?: string
  dst?: string
  cnam?: string
  dst_cnam?: string
  call_timestamp?: string
}

interface CallInformationSectionProps {
  callInfo: SummaryCallInfo
  isLoading: boolean
}

interface CallInfoPhoneValueProps {
  phoneNumber?: string
  primaryValue?: string
  secondaryValue?: string
}

const textClassName = 'text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'

const normalizeExtension = (value?: string) => value?.toString().trim()

const CallInfoPhoneValue: FC<CallInfoPhoneValueProps> = ({
  phoneNumber,
  primaryValue,
  secondaryValue,
}) => {
  const authStore = useSelector((state: RootState) => state?.authentication)
  const operatorsStore = useSelector((state: RootState) => state?.operators)
  const userMainExtension = useSelector((state: RootState) => state?.user?.mainextension)
  const userExtensions = useSelector((state: RootState) => state?.user?.endpoints?.extension)
  const userMainExtensions = useSelector((state: RootState) => state?.user?.endpoints?.mainextension)

  if (!phoneNumber) {
    return <div className={textClassName}>-</div>
  }

  const currentUserExtensions = [
    normalizeExtension(userMainExtension),
    ...(userExtensions?.map((extension: any) => normalizeExtension(extension?.id)) || []),
    ...(userMainExtensions?.map((extension: any) => normalizeExtension(extension?.id)) || []),
  ].filter(Boolean)

  const isOwnNumber = currentUserExtensions.includes(normalizeExtension(phoneNumber))

  const handleClick = () => {
    if (isOwnNumber) {
      return
    }

    if (operatorsStore?.operators?.[authStore?.username]?.mainPresence === 'busy') {
      transferCallToExtension(phoneNumber)
      return
    }

    callPhoneNumber(phoneNumber)
  }

  const renderPhoneNumber = () => {
    const numberLabel = secondaryValue || primaryValue || phoneNumber

    return (
      <button
        type='button'
        onClick={handleClick}
        disabled={isOwnNumber}
        className={`border-0 bg-transparent p-0 text-left text-primaryActive dark:text-primaryActiveDark ${
          isOwnNumber ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {numberLabel}
      </button>
    )
  }

  return (
    <div className='flex items-start gap-2 shrink-0'>
      <FontAwesomeIcon
        icon={faPhone}
        className='mt-0.5 h-4 w-4 shrink-0 text-tertiaryNeutral dark:text-tertiaryNeutralDark'
      />
      <div className={textClassName}>
        {secondaryValue ? (
          <>
            <div>{primaryValue || phoneNumber}</div>
            {renderPhoneNumber()}
          </>
        ) : (
          renderPhoneNumber()
        )}
      </div>
    </div>
  )
}

export const CallInformationSection: FC<CallInformationSectionProps> = ({ callInfo, isLoading }) => {
  return (
    <div className='mt-6 flex flex-col gap-4'>
      <div className='flex items-start gap-8 w-full'>
        <div className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark w-[90px] shrink-0'>
          {t('History.Source')}
        </div>
        {isLoading ? (
          <div className='flex items-start gap-2 flex-1'>
            <Skeleton variant='rectangular' width={16} height={16} className='mt-0.5 shrink-0' />
            <div className='flex flex-col gap-1 flex-1'>
              <Skeleton width={128} />
              <Skeleton width={80} />
            </div>
          </div>
        ) : (
          <CallInfoPhoneValue
            phoneNumber={callInfo?.src}
            primaryValue={getEffectiveCnam(callInfo?.cnam, callInfo?.src) || callInfo?.src}
            secondaryValue={getEffectiveCnam(callInfo?.cnam, callInfo?.src) ? callInfo?.src : undefined}
          />
        )}
      </div>

      <div className='flex items-start gap-8 w-full'>
        <div className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark w-[90px] shrink-0'>
          {t('History.Destination')}
        </div>
        {isLoading ? (
          <div className='flex items-start gap-2 flex-1'>
            <Skeleton variant='rectangular' width={16} height={16} className='mt-0.5 shrink-0' />
            <div className='flex flex-col gap-1 flex-1'>
              <Skeleton width={128} />
              <Skeleton width={80} />
            </div>
          </div>
        ) : (
          <CallInfoPhoneValue
            phoneNumber={callInfo?.dst}
            primaryValue={getEffectiveCnam(callInfo?.dst_cnam, callInfo?.dst) || callInfo?.dst}
            secondaryValue={getEffectiveCnam(callInfo?.dst_cnam, callInfo?.dst) ? callInfo?.dst : undefined}
          />
        )}
      </div>

      <div className='flex items-start gap-8 w-full'>
        <div className='text-sm font-medium text-secondaryNeutral dark:text-secondaryNeutralDark w-[90px] shrink-0'>
          {t('History.Date')}
        </div>
        {isLoading ? (
          <div className='flex items-start gap-2 flex-1'>
            <Skeleton variant='rectangular' width={16} height={16} className='mt-0.5 shrink-0' />
            <Skeleton width={160} />
          </div>
        ) : callInfo?.call_timestamp ? (
          <div className='flex items-start gap-2 shrink-0'>
            <FontAwesomeIcon
              icon={faCalendar}
              className='mt-0.5 h-4 w-4 shrink-0 text-tertiaryNeutral dark:text-tertiaryNeutralDark'
            />
            <div className={textClassName}>
              {formatDateLoc(new Date(callInfo?.call_timestamp), 'dd MMM yyyy HH:mm')}
            </div>
          </div>
        ) : (
          <div className={textClassName}>-</div>
        )}
      </div>
    </div>
  )
}