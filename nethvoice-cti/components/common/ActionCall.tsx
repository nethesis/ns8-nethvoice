// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faEarListen,
  faPhoneSlash,
  faHandPointUp,
  faArrowLeft,
  faCirclePause,
  faMicrophoneSlash,
  faRecordVinyl,
  faCheck,
  faAngleDown,
  faCalendarCheck,
  faPhone,
} from '@fortawesome/free-solid-svg-icons'
import { Button, Dropdown } from '../common'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import { CallDuration } from '../operators/CallDuration'
import { get, isEmpty } from 'lodash'
import {
  postRecallOnBusy,
  hangup,
  startListen,
  toggleRecord,
  intrude,
  pickup,
  hangupMainExt,
} from '../../lib/operators'
import { eventDispatch } from '../../lib/hooks/eventDispatch'
import { isNethlinkOnline, openToast } from '../../lib/utils'
import { faPhoneArrowDownLeft, faRecord } from '@nethesis/nethesis-solid-svg-icons'

interface ActionCallProps {
  config: any
}

export const ActionCall: React.FC<ActionCallProps> = ({ config }) => {
  const { t } = useTranslation()
  const operators = useSelector((state: RootState) => state.operators)
  const profile = useSelector((state: RootState) => state.user)

  const currentConversation = operators?.operators[config?.username]?.conversations?.[0]
  const canShowActions =
    currentConversation?.chDest?.callerName !== profile?.name &&
    currentConversation?.chSource?.callerName !== profile?.name

  const getRecordingIcon = () => {
    if (!currentConversation?.recording) return faRecordVinyl
    switch (currentConversation.recording) {
      case 'true':
        return faCirclePause
      case 'false':
        return faRecordVinyl
      case 'mute':
        return faMicrophoneSlash
      default:
        return faRecordVinyl
    }
  }

  const getRecordingText = () => {
    if (!currentConversation?.recording) return t('OperatorDrawer.Start recording')
    switch (currentConversation.recording) {
      case 'true':
        return t('OperatorDrawer.Stop recording')
      case 'false':
        return t('OperatorDrawer.Start recording')
      default:
        return t('OperatorDrawer.Restart recording')
    }
  }

  const actions = {
    recallOnBusy: async () => {
      if (!profile?.mainextension || !currentConversation?.id) return

      const recallInfo = {
        caller: profile.mainextension,
        called: operators?.operators[config?.username]?.endpoints?.mainextension?.[0]?.id,
      }

      try {
        const res = await postRecallOnBusy(recallInfo)
        openToast(
          'success',
          `${t('Operators.Recall on busy message', { extensionWaiting: res.waitingExtensions })}`,
          `${t('Operators.Recall on busy', { extensionWaiting: res.waitingExtensions })}`,
        )
      } catch (e) {
        console.error(e)
      }
    },

    hangup: async () => {
      if (!currentConversation?.id || !currentConversation?.owner) return

      try {
        await hangupMainExt({
          exten: config?.endpoints?.mainextension?.[0]?.id,
        })
      } catch (e) {
        console.error(e)
      }
    },

    listen: async () => {
      if (!isConversationActive() || !currentConversation?.id) return

      const conversationId = currentConversation.id
      const numberToListen = conversationId?.match(/\/(\d+)-/)
      if (!numberToListen) return

      const endpointId = numberToListen[1]
      const destId = profile?.default_device?.id?.toString() || ''

      store.dispatch.userActions.updateListeningInformation({
        isListening: true,
        listening_id: conversationId.toString(),
      })

      const isNethLinkActive = isNethlinkOnline()

      try {
        await startListen({
          convid: conversationId.toString(),
          destId,
          endpointId: endpointId.toString(),
        })
        if (isNethLinkActive) {
          // Use nethlink protocol to update listen information inside phone-island
          window.location.href = `nethlink://listen?to=${endpointId}`
        } else {
          eventDispatch('phone-island-call-listen', { to: endpointId })
        }
      } catch (e) {
        console.error(e)
      }
    },

    intrude: async () => {
      if (!isConversationActive() || !currentConversation?.id) return

      const conversationId = currentConversation.id
      const numberToIntrude = conversationId?.match(/\/(\d+)-/)
      if (!numberToIntrude) return

      const endpointId = numberToIntrude[1]
      const destId = profile?.default_device?.id?.toString() || ''

      store.dispatch.userActions.updateIntrudeInformation({
        isIntrude: true,
        intrude_id: conversationId.toString(),
      })

      const isNethLinkActive = isNethlinkOnline()

      try {
        await intrude({
          convid: conversationId.toString(),
          destId,
          endpointId: endpointId.toString(),
        })
        if (isNethLinkActive) {
          // Use nethlink protocol to update intrude information inside phone-island
          window.location.href = `nethlink://intrude?to=${endpointId}`
        } else {
          eventDispatch('phone-island-call-intrude', { to: endpointId })
        }
      } catch (e) {
        console.error(e)
      }
    },

    pickup: async () => {
      const operatorInfo = config
      if (
        !operators?.operators[operatorInfo?.username]?.conversations?.[0]?.id ||
        !profile?.default_device?.id ||
        !operatorInfo?.endpoints?.mainextension?.[0]?.id
      )
        return

      try {
        await pickup({
          convid: operators.operators[operatorInfo.username].conversations?.[0].id,
          endpointId: operatorInfo.endpoints.mainextension?.[0].id,
          destId: profile.default_device.id,
        })
      } catch (e) {
        console.error(e)
      }
    },

    toggleRecord: async () => {
      if (!isConversationActive() || !currentConversation?.id) return

      const conversationId = currentConversation.id
      const match = conversationId?.match(/\/(\d+)-/)
      if (!match) return

      const endpointId = match[1]

      let recordingValues = ''
      switch (currentConversation?.recording) {
        case 'false':
          recordingValues = 'not_started'
          break
        case 'true':
          recordingValues = 'started'
          break
        case 'mute':
          recordingValues = 'muted'
          break
      }

      try {
        await toggleRecord(recordingValues, {
          convid: conversationId.toString(),
          endpointId: endpointId.toString(),
        })
      } catch (e) {
        console.error(e)
      }
    },
  }

  function isConversationActive() {
    return (
      !!operators?.operators[config?.username]?.conversations?.length &&
      (currentConversation?.connected ||
        currentConversation?.inConference ||
        currentConversation?.chDest?.inConference === true ||
        !isEmpty(currentConversation))
    )
  }

  const getCallActionsMenu = () => (
    <>
      {profile?.recallOnBusy &&
        operators?.operators[config?.username]?.mainPresence !== 'ringing' && (
          <Dropdown.Item icon={faCalendarCheck} onClick={actions.recallOnBusy}>
            {t('OperatorDrawer.Book')}
          </Dropdown.Item>
        )}

      {profile?.profile?.macro_permissions?.presence_panel?.permissions?.hangup?.value && (
        <Dropdown.Item
          icon={faPhone}
          iconClassName='transform rotate-[135deg]'
          onClick={actions.hangup}
        >
          {operators?.operators[config?.username]?.mainPresence !== 'ringing'
            ? t('OperatorDrawer.Hangup')
            : t('Common.Reject')}
        </Dropdown.Item>
      )}

      {profile?.profile?.macro_permissions?.settings?.permissions?.spy?.value &&
        operators?.operators[config?.username]?.mainPresence !== 'ringing' && (
          <Dropdown.Item icon={faEarListen} onClick={actions.listen}>
            {t('OperatorDrawer.Listen')}
          </Dropdown.Item>
        )}

      {profile?.profile?.macro_permissions?.settings?.permissions?.intrude?.value &&
        operators?.operators[config?.username]?.mainPresence !== 'ringing' && (
          <Dropdown.Item icon={faHandPointUp} onClick={actions.intrude}>
            {t('OperatorDrawer.Intrude')}
          </Dropdown.Item>
        )}

      {profile?.profile?.macro_permissions?.settings?.permissions?.pickup?.value &&
        operators?.operators[config?.username]?.mainPresence === 'ringing' && (
          <Dropdown.Item icon={faPhoneArrowDownLeft as any} onClick={actions.pickup}>
            {t('OperatorDrawer.Pickup')}
          </Dropdown.Item>
        )}

      {profile?.profile?.macro_permissions?.presence_panel?.permissions?.ad_recording?.value &&
        operators?.operators[config?.username]?.mainPresence !== 'ringing' && (
          <Dropdown.Item icon={getRecordingIcon()} onClick={actions.toggleRecord}>
            {getRecordingText()}
          </Dropdown.Item>
        )}
    </>
  )

  const menuHasChildrens = () => {
    const menu = getCallActionsMenu()
    const children = menu?.props?.children
    const hasVisibleActions = Array.isArray(children)
      ? children.some((child) => !!child)
      : !!children

    return hasVisibleActions
  }

  return (
    <div className='bg-elevationL2Invert dark:bg-elevationL2InvertDark rounded-md shadow-sm'>
      {/* Header */}
      <div className='p-4 flex items-center'>
        <h4 className='text-sm font-medium leading-5 text-primaryNeutral dark:text-primaryNeutralDark flex-1'>
          {t('OperatorDrawer.Current call')}
        </h4>
        {canShowActions && menuHasChildrens() && (
          <Dropdown items={getCallActionsMenu()} position='left'>
            <Button variant='white'>
              <span className='mr-2'>{t('Common.Actions')}</span>
              <FontAwesomeIcon icon={faAngleDown} className='h-4 w-4' />
            </Button>
          </Dropdown>
        )}
      </div>

      {/* Divider  */}
      <div className='px-4 relative'>
        <div className='border-b border-layoutDivider dark:border-layoutDividerDark'></div>
      </div>

      <div className='px-4 py-4 mt-2'>
        <dl className='grid grid-cols-[120px_1fr] gap-y-6 mb-1'>
          {/* Call duration */}
          <dt className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('Common.Call duration')}
          </dt>
          <dd className='text-base font-medium leading-6 text-textStatusBusy dark:text-textStatusBusyDark overflow-hidden whitespace-nowrap text-ellipsis'>
            <CallDuration startTime={currentConversation?.startTime} />
          </dd>

          {/* Contact */}
          <dt className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('OperatorDrawer.Contact')}
          </dt>
          <dd className='text-sm leading-5 text-textStatusBusy dark:text-textStatusBusyDark max-w-full overflow-hidden'>
            {currentConversation?.counterpartName !== currentConversation?.counterpartNum && (
              <div className='overflow-hidden whitespace-nowrap text-ellipsis font-medium'>
                {currentConversation?.counterpartName || '-'}
              </div>
            )}
            <div className='font-normal text-textStatusBusy dark:text-textStatusBusyDark overflow-hidden whitespace-nowrap text-ellipsis'>
              {currentConversation?.counterpartNum || '-'}
            </div>
          </dd>

          {/* Direction */}
          <dt className='text-sm font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark'>
            {t('OperatorDrawer.Direction')}
          </dt>
          <dd className='flex items-center text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
            <FontAwesomeIcon
              icon={currentConversation?.direction === 'out' ? faArrowLeft : faCheck}
              className={`flex-shrink-0 mr-2 h-4 w-4 text-iconStatusOnline dark:text-iconStatusOnlineDark ${
                currentConversation?.direction === 'out' ? 'rotate-[135deg]' : ''
              }`}
              aria-hidden='true'
            />
            <span className='overflow-hidden whitespace-nowrap text-ellipsis'>
              {currentConversation?.direction === 'out'
                ? t('OperatorDrawer.Outgoing')
                : t('OperatorDrawer.Incoming')}
            </span>
          </dd>
        </dl>
      </div>
    </div>
  )
}

ActionCall.displayName = 'ActionCall'
