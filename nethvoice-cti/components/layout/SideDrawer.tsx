// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 *
 * The SideDrawer component
 *
 */

import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
import { FC, Fragment, useMemo } from 'react'
import { ShowOperatorDrawerContent } from '../operators/ShowOperatorDrawerContent'
import { CreateOrEditContactDrawerContent } from '../phonebook/CreateOrEditContactDrawerContent'
import { ShowContactDrawerContent } from '../phonebook/ShowContactDrawerContent'
import { CreateOrEditSpeedDialDrawerContent } from './speed_dial/CreateOrEditSpeedDialDrawerContent'
import { ShowHistoryDrawerContent } from '../history/ShowHistoryDrawerContent'
import { NotificationsDrawerContent } from './NotificationsDrawerContent'
import { AddToPhonebookDrawerContent } from '../history/AddToPhonebookDrawer'
import { ShowQueueCallDrawerContent } from '../queues'
import { ShowPhoneLinesDrawerContent } from '../lines/ShowPhoneLinesDrawerContent'
import { EditAnnouncementDrawerContent } from '../lines'
import { ShowRuleDetailsContent } from '../lines'
import { SaveRecordedAnnouncementDrawerContent } from '../lines'
import { ShowMultiplePhoneLinesDrawerContent } from '../lines'
import { GravatarIconDrawerContent } from '../common/ProfilePicture/GravatarIconDrawerContent'
import { SelectProfilePictureDrawerContent } from '../common/ProfilePicture/SelectProfilePictureDrawerContent'
import { EditPhysicalPhoneDrawerContent } from '../devices/EditPhysicalPhoneDrawerContent'
import { SwitchInputOutputDrawerContent } from '../devices/SwitchInputOutputDrawerContent'
import { DownloadDesktopLinkContent } from '../devices/DownloadDesktopLinkContent'
import { UploadVoicemail } from '../lines/UploadVoicemail'
import { Setup2FADrawerContent } from '../settings/2fa/Setup2FADrawerContent'
import { customScrollbarClass } from '../../lib/utils'
import { CallSummaryDrawerContent } from '../summary/CallSummaryDrawerContent'

export type ContentType =
  | 'createOrEditContact'
  | 'showContact'
  | 'createOrEditSpeedDial'
  | 'showOperator'
  | 'showContactHistory'
  | 'notifications'
  | 'addToPhonebookDrawer'
  | 'showQueueCall'
  | 'showPhoneLines'
  | 'showMultiplePhoneLines'
  | 'showTelephoneAnnouncement'
  | 'showSaveRecordedAnnouncement'
  | 'showRuleDetails'
  | 'showGravatar'
  | 'showUploadProfilePicture'
  | 'showEditPhysicalPhone'
  | 'showSwitchDeviceInputOutput'
  | 'showDownloadLinkContent'
  | 'showUploadVoicemail'
  | 'setup2FA'
  | 'callSummary'

interface SideDrawerProps {
  isShown: boolean
  contentType: ContentType
  config: any
  drawerClosed: () => void
}

export const SideDrawer: FC<SideDrawerProps> = ({ isShown, contentType, config, drawerClosed }) => {
  const drawerComponentsMap = useMemo(
    () => ({
      createOrEditContact: CreateOrEditContactDrawerContent,
      showContact: ShowContactDrawerContent,
      createOrEditSpeedDial: CreateOrEditSpeedDialDrawerContent,
      showOperator: ShowOperatorDrawerContent,
      showContactHistory: ShowHistoryDrawerContent,
      notifications: NotificationsDrawerContent,
      addToPhonebookDrawer: AddToPhonebookDrawerContent,
      showQueueCall: ShowQueueCallDrawerContent,
      showPhoneLines: ShowPhoneLinesDrawerContent,
      showMultiplePhoneLines: ShowMultiplePhoneLinesDrawerContent,
      showTelephoneAnnouncement: EditAnnouncementDrawerContent,
      showSaveRecordedAnnouncement: SaveRecordedAnnouncementDrawerContent,
      showRuleDetails: ShowRuleDetailsContent,
      showGravatar: GravatarIconDrawerContent,
      showUploadProfilePicture: SelectProfilePictureDrawerContent,
      showEditPhysicalPhone: EditPhysicalPhoneDrawerContent,
      showSwitchDeviceInputOutput: SwitchInputOutputDrawerContent,
      showDownloadLinkContent: DownloadDesktopLinkContent,
      showUploadVoicemail: UploadVoicemail,
      setup2FA: Setup2FADrawerContent,
      callSummary: CallSummaryDrawerContent,
    }),
    [],
  )

  const DrawerContent = useMemo(
    () => drawerComponentsMap[contentType],
    [contentType, drawerComponentsMap],
  )

  return (
    <>
      <Transition show={isShown} as={Fragment}>
        <Dialog as='div' className='relative z-20' onClose={drawerClosed}>
          <div className='fixed top-16 right-0 bottom-0 z-40 flex'>
            <TransitionChild
              as={Fragment}
              enter='transition ease-in-out duration-300 transform'
              enterFrom='translate-x-full'
              enterTo='translate-x-0'
              leave='transition ease-in-out duration-300 transform'
              leaveFrom='translate-x-0'
              leaveTo='translate-x-full'
            >
              <DialogPanel className='relative flex w-[80vw] md:w-[60vw] lg:w-[40vw] 2xl:w-[33vw] 3xl:w-[36rem] flex-1 flex-col shadow-[0px_20px_40px_0_rgba(0,0,0,0.2)] bg-elevationL1 dark:bg-elevationL1Dark dark:shadow-[0px_20px_40px_0_rgba(0,0,0,0.6)]'>
                <div className={`h-0 flex-1 ${customScrollbarClass}`}>
                  <nav className='flex h-full flex-col'>
                    <div className='relative'>
                      {DrawerContent && <DrawerContent config={config} />}
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
