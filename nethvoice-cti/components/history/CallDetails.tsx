// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { CallTypes, getEffectiveCnam } from '../../lib/history'
import { getOperatorByPhoneNumber, openShowOperatorDrawer } from '../../lib/operators'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { openChatWith, useChatAllowed } from '../chat'
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
  lastCallsType?: string
  tooltipPlace?: 'top' | 'right' | 'bottom' | 'left'
  hideChat?: boolean
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
  lastCallsType,
  tooltipPlace = 'bottom',
  hideChat,
}) => {
  const authStore = useSelector((state: RootState) => state.authentication)
  const operatorsStore = useSelector((state: RootState) => state.operators)
  const chatAllowed = useChatAllowed()
  const incomingNumber = call.src || call.cnum
  const chatWith: string | undefined = (getOperatorByPhoneNumber(direction === 'in' ? incomingNumber : call.dst, operators) as any)?.username

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
    const phoneNumber =
      direction === 'in'
        ? userInformation?.src || userInformation?.cnum
        : userInformation?.dst
    const operatorFound: any = getOperatorByPhoneNumber(phoneNumber, operators)

    if (operatorFound) {
      openShowOperatorDrawer({
        ...operatorFound,
        lastCallsType: lastCallsType || 'user',
      })
      return
    }

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
                'truncate text-primaryNeutral dark:text-primaryNeutralDark leading-5 font-medium text-sm whitespace-nowrap cursor-pointer hover:underline',
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
                    : 'text-textPlaceholder dark:text-textPlaceholderDark'
                } ${fromHistory || (!fromHistory && isQueueBadgeAvailable) ? 'truncate' : ''}`}
              >
                {direction === 'in' ? incomingNumber : call.dst}
                {chatAllowed && !hideChat && chatWith && chatWith !== authStore?.username && (
                  <button
                    type='button'
                    className='ml-2 text-gray-500 dark:text-gray-300 hover:text-primary dark:hover:text-primaryDark'
                    title={t('Common.Chat') || ''}
                    onClick={() => openChatWith(chatWith)}
                  >
                    <FontAwesomeIcon icon={faMessage} className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>
            )}
        </>
      ) : (
        <>
          {/* Use incomingNumber (src || cnum), the same party the name is resolved
              against: on a transferred incoming call cnum is the transfer initiator,
              so using it here showed a number belonging to someone else. */}
          {(direction === 'in' ? incomingNumber : call.dst) && (
            <div
              className='truncate text-primary dark:text-primaryDark'
              onClick={() =>
                operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy'
                  ? transferCallToExtension(direction === 'in' ? incomingNumber : call.dst)
                  : callPhoneNumber(direction === 'in' ? incomingNumber : call.dst)
              }
            >
              {direction === 'in'
                ? formatPhoneNumber(incomingNumber)
                : formatPhoneNumber(call.dst)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
