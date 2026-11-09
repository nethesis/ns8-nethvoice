// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMessage } from '@fortawesome/free-solid-svg-icons'
import { RootState } from '../../store'
import { Avatar, Button } from '../common'
import { DrawerHeader } from '../common/DrawerHeader'
import { Divider } from '../common/Divider'
import { openShowOperatorDrawer } from '../../lib/operators'
import { closeSideDrawer } from '../../lib/utils'
import { openChatWith } from './ChatIslandMount'
import { groupInitials, groupLook, isQueue } from './icons'
import type { ChatConversation } from '../../models/chat'

/** A chat group: its name and members; a member opens the operator's drawer. */
export const ShowChatGroupDrawerContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithRef<'div'> & { config: ChatConversation }
>(({ config: group, ...props }, ref) => {
  const { t } = useTranslation()
  const operators = useSelector((state: RootState) => state.operators.operators) as any
  const avatars = useSelector((state: RootState) => state.operators.avatars) as any
  const me = useSelector((state: RootState) => state.authentication.username)
  const members = [...(group?.members ?? [])].sort(
    (a, b) =>
      Number(a === me) - Number(b === me) ||
      (operators?.[a]?.name ?? a).localeCompare(operators?.[b]?.name ?? b),
  )

  return (
    <div ref={ref} {...props}>
      <DrawerHeader
        title={
          (isQueue(group?.name ?? '') ? t('Chat.Queue details') : t('Chat.Group details')) || ''
        }
      />
      <div className='px-6'>
        <Divider />
        <div className='flex items-center gap-6'>
          {group?.avatar ? (
            <Avatar src={group.avatar} size='extra_large' />
          ) : (
            <span
              className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-medium ${
                groupLook(group?.peer ?? '', group?.name ?? '').className
              }`}
            >
              {groupInitials(group?.name ?? '')}
            </span>
          )}
          <div className='min-w-0'>
            <div className='text-2xl font-medium text-gray-900 dark:text-gray-100 truncate'>
              {group?.name}
            </div>
            <div className='mt-2 text-gray-500 dark:text-gray-400'>
              {members.length} {t('Chat.members')}
            </div>
          </div>
        </div>
        <div className='mt-8'>
          <Button variant='primary' onClick={() => (closeSideDrawer(), openChatWith(group.peer))}>
            <FontAwesomeIcon icon={faMessage} className='h-4 w-4 mr-2' />
            {t('OperatorDrawer.Open chat')}
          </Button>
        </div>
        <h2 className='mt-10 mb-2 text-lg font-medium text-gray-900 dark:text-gray-100'>
          {t('Chat.Members')}
        </h2>
        <Divider />
        <ul className='divide-y divide-gray-200 dark:divide-gray-700'>
          {members.map((u) => {
            const guest = group?.guests?.[u]
            if (guest !== undefined)
              // Someone outside the PBX: a name in this group only, no presence, no operator's drawer.
              return (
                <li key={u} className='flex items-center gap-4 py-3'>
                  <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200'>
                    {(guest || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className='min-w-0 flex-1 font-medium text-gray-900 dark:text-gray-100 truncate'>
                    {guest || t('Chat.External')}
                  </div>
                  <span className='shrink-0 rounded-full px-2.5 py-0.5 text-xs leading-4 font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100'>
                    {t('Chat.External')}
                  </span>
                </li>
              )
            const op = operators?.[u]
            return (
              <li key={u}>
                <button
                  type='button'
                  disabled={!op || u === me}
                  onClick={() => openShowOperatorDrawer(op)}
                  className='w-full flex items-center gap-4 py-3 text-left disabled:cursor-default'
                >
                  <Avatar
                    src={avatars?.[u]}
                    size='base'
                    placeholderType='operator'
                    status={op?.mainPresence}
                  />
                  <div className='min-w-0'>
                    <div className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                      {op?.name ?? u}
                      {u === me && (
                        <span className='ml-1 text-gray-500 dark:text-gray-400'>
                          ({t('Chat.You')})
                        </span>
                      )}
                    </div>
                    <div className='text-sm text-gray-500 dark:text-gray-400'>@{u}</div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
})

ShowChatGroupDrawerContent.displayName = 'ShowChatGroupDrawerContent'
