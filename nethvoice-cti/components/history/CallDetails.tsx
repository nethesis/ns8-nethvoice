// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { CallTypes, getEffectiveCnam } from '../../lib/history'
import { getOperatorByPhoneNumber } from '../../lib/operators'
import classNames from 'classnames'
import {
  callPhoneNumber,
  cleanString,
  formatPhoneNumber,
  transferCallToExtension,
} from '../../lib/utils'
import { t } from 'i18next'
import { openCreateLastCallContact, openShowContactDrawer } from '../../lib/phonebook'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

interface CallDetailsProps {
  call: CallTypes
  hideName?: boolean
  hideNumber?: boolean
  highlightNumber?: boolean
  operators: any
  isExtensionNumberLastCalls?: boolean
  fromHistory?: boolean
  isQueueBadgeAvailable?: boolean
  direction: 'in' | 'out'
  tooltipPlace?: 'top' | 'right' | 'bottom' | 'left'
}

export function getCallName(call: CallTypes, direction: 'in' | 'out'): string {
  const incomingNumber = call.src || call.cnum
  return direction === 'in'
    ? getEffectiveCnam(call.cnam, incomingNumber) || call.ccompany || t('Common.Unknown')
    : getEffectiveCnam(call.dst_cnam, call.dst) || call.dst_ccompany || t('Common.Unknown')
}

export const CallDetails: FC<CallDetailsProps> = ({
  call,
  hideName,
  hideNumber,
  highlightNumber,
  operators,
  isExtensionNumberLastCalls,
  fromHistory,
  isQueueBadgeAvailable,
  direction,
  tooltipPlace = 'bottom',
}) => {
  const authStore = useSelector((state: RootState) => state.authentication)
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const incomingNumber = call.src || call.cnum

  if ((direction === 'in' && !getEffectiveCnam(call.cnam, incomingNumber)) || (direction === 'out' && !getEffectiveCnam(call.dst_cnam, call.dst))) {
    const phoneNumber = direction === 'in' ? incomingNumber : call.dst
    const operatorFound: any = getOperatorByPhoneNumber(phoneNumber, operators)
    if (operatorFound) {
      direction === 'in' ? (call.cnam = operatorFound.name) : (call.dst_cnam = operatorFound.name)
    }
  }

  const openLastCardUserDrawer = (userInformation: any) => {
    let updatedUserInformation: any = {}
    let createContactObject: any = {}

    if (direction === 'in') {
      const incomingNum = userInformation.src || userInformation.cnum
      const effectiveCnam = getEffectiveCnam(userInformation.cnam, incomingNum)
      if (effectiveCnam || userInformation?.ccompany) {
        updatedUserInformation.displayName = effectiveCnam || userInformation.ccompany || '-'
        updatedUserInformation.kind = 'person'
        if (userInformation.src) updatedUserInformation.extension = userInformation.src
        openShowContactDrawer(updatedUserInformation)
      } else if (userInformation.src) {
        createContactObject.extension = userInformation.src
        openCreateLastCallContact(createContactObject)
      }
    } else {
      const effectiveDstCnam = getEffectiveCnam(userInformation.dst_cnam, userInformation.dst)
      if (effectiveDstCnam || userInformation?.dst_ccompany) {
        updatedUserInformation.displayName =
          effectiveDstCnam || userInformation.dst_ccompany || '-'
        updatedUserInformation.kind = 'person'
        if (userInformation.dst) updatedUserInformation.extension = userInformation.dst
        openShowContactDrawer(updatedUserInformation)
      } else if (userInformation.dst) {
        createContactObject.extension = userInformation.dst
        openCreateLastCallContact(createContactObject)
      }
    }
  }

  return (
    <div className={`flex flex-col justify-center overflow-hidden`}>
      {!isExtensionNumberLastCalls ? (
        <>
          {/* name */}
          {!hideNumber && (
            <div
              className={classNames(
                `tooltip-${direction === 'in' ? 'dest' : 'source'}-${cleanString(
                  getCallName(call, direction) || '-',
                )}`,
                'truncate text-primaryNeutral dark:text-primaryNeutralDark leading-4 font-medium text-sm whitespace-nowrap cursor-pointer hover:underline',
              )}
              onClick={() => openLastCardUserDrawer(call)}
              data-tooltip-id={`tooltip-${cleanString(getCallName(call, direction) || '-')}`}
              data-tooltip-content={
                getCallName(call, direction)
                  ? `${t('Phonebook.Show contact')}: ${getCallName(call, direction)}`
                  : t('Phonebook.Create contact')
              }
            >
              {getCallName(call, direction) || '-'}
            </div>
          )}

          <CustomThemedTooltip
            id={`tooltip-${cleanString(getCallName(call, direction) || '-')}`}
            className='pi-z-20'
            place={tooltipPlace}
          />

          {/* phone number */}
          {!hideName &&
            ((direction === 'in' && incomingNumber) || (direction === 'out' && call.dst)) && (
              <div
                className={`${
                  highlightNumber
                    ? 'text-textLink dark:text-textLinkDark'
                    : 'text-gray-500 dark:text-gray-200'
                } ${fromHistory || (!fromHistory && isQueueBadgeAvailable) ? 'truncate' : ''}`}
              >
                {direction === 'in' ? incomingNumber : call.dst}
              </div>
            )}
        </>
      ) : (
        <>
          {(direction === 'in' ? call.cnum : call.dst) && (
            <div
              className='truncate text-primary dark:text-primaryDark'
              onClick={() =>
                operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                  ? transferCallToExtension(direction === 'in' ? call.cnum : call.dst)
                  : callPhoneNumber(direction === 'in' ? call.cnum : call.dst)
              }
            >
              {direction === 'in' ? formatPhoneNumber(call.cnum) : formatPhoneNumber(call.dst)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
