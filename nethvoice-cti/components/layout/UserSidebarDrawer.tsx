// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
import { FC, Fragment, useState } from 'react'
import { SpeedDialContent } from '../common/UserRightSideMenu/SpeedDialContent'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { UserLastCallsContent } from '../common/UserRightSideMenu/UserLastCallsContent'
import { VoiceMailContent } from '../common/UserRightSideMenu/VoiceMailContent'
import { customScrollbarClass } from '../../lib/utils'

interface UserSidebarDrawerProps {
  isShown: boolean
}

export const UserSidebarDrawer: FC<UserSidebarDrawerProps> = ({ isShown }) => {
  const rightSideStatus: any = useSelector((state: RootState) => state.rightSideMenu)

  return (
    <>
      <Transition show={isShown} as={Fragment}>
        <Dialog
          as='div'
          className={`${rightSideStatus.isShown ? 'relative z-20 lg:hidden' : 'hidden'}`}
          onClose={() => {}}
        >
          <div className='fixed top-16 right-[3.2rem] bottom-0 z-40 flex'>
            <TransitionChild
              as={Fragment}
              enter='transition ease-in-out duration-300 transform'
              enterFrom='translate-x-full'
              enterTo='translate-x-0'
              leave='transition ease-in-out duration-300 transform'
              leaveFrom='translate-x-0'
              leaveTo='translate-x-full'
            >
              <DialogPanel className='relative flex w-72 lg:w-72 xl:w-80 2xl:w-96 flex-1 flex-col shadow-[-10px_10px_20px_0_rgba(0,0,0,0.2)] bg-sidebar dark:bg-sidebarDark dark:shadow-[-10px_10px_20px_0_rgba(0,0,0,0.6)]'>
                <div className={`h-0 flex-1 ${customScrollbarClass}`}>
                  <nav className='flex h-full flex-col'>
                    <div className='overflow-x-hidden relative'>
                      {rightSideStatus?.actualTab && rightSideStatus?.actualTab === 'speed_dial' ? (
                        <SpeedDialContent />
                      ) : rightSideStatus?.actualTab &&
                        rightSideStatus?.actualTab === 'last_calls' ? (
                        <UserLastCallsContent />
                      ) : rightSideStatus?.actualTab &&
                        rightSideStatus?.actualTab === 'voice_mails' ? (
                        <VoiceMailContent />
                      ) : null}
                    </div>
                  </nav>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
