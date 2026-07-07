// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { Fragment, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { useTranslation } from 'react-i18next'

interface MobileFilterDrawerProps {
  open: boolean
  setOpen: (open: boolean) => void
  title?: string
  children: ReactNode
  panelClassName?: string
}

export const MobileFilterDrawer: React.FC<MobileFilterDrawerProps> = ({
  open,
  setOpen,
  title,
  children,
  panelClassName,
}) => {
  const { t } = useTranslation()

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as='div' className='relative z-40 sm:hidden' onClose={setOpen}>
        <TransitionChild
          as={Fragment}
          enter='transition-opacity ease-linear duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='transition-opacity ease-linear duration-300'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='fixed inset-0 bg-black bg-opacity-25 dark:bg-black dark:bg-opacity-25' />
        </TransitionChild>

        <div className='fixed inset-0 z-40 flex'>
          <TransitionChild
            as={Fragment}
            enter='transition ease-in-out duration-300 transform'
            enterFrom='translate-x-full'
            enterTo='translate-x-0'
            leave='transition ease-in-out duration-300 transform'
            leaveFrom='translate-x-0'
            leaveTo='translate-x-full'
          >
            <DialogPanel
              className={
                panelClassName ||
                'relative ml-auto flex h-full w-full max-w-xs flex-col overflow-y-auto py-4 pb-6 shadow-xl bg-white dark:bg-gray-900 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-400 scrollbar-thumb-rounded-full scrollbar-thumb-opacity-50 scrollbar-track-gray-200 dark:scrollbar-track-gray-900 scrollbar-track-rounded-full scrollbar-track-opacity-25'
              }
            >
              <div className='flex items-center justify-between px-4'>
                <h2 className='text-lg font-medium text-gray-900 dark:text-gray-100'>
                  {title || t('Common.Filters')}
                </h2>
                <button
                  type='button'
                  className='-mr-2 flex h-10 w-10 items-center justify-center rounded-md focus:outline-none focus:ring-2 p-2 bg-white text-gray-400 hover:bg-gray-50 focus:ring-primaryLight dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-primaryDark'
                  onClick={() => setOpen(false)}
                >
                  <span className='sr-only'>{t('Common.Close menu')}</span>
                  <FontAwesomeIcon icon={faXmark} className='h-5 w-5' aria-hidden='true' />
                </button>
              </div>
              {children}
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
