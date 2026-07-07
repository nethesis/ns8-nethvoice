// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The MobileNavBar component for narrow views
 *
 * @param closeMobileMenu - The callback on menu close events
 * @param items - The array with the navigation info
 * @param show - The parameter to show or hide the
 *
 */

import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
import { FC, Fragment } from 'react'
import classNames from 'classnames'
import type { NavItemsProps } from '../../config/routes'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import Logo from '../../public/navbar_logo.svg'
import { customScrollbarClass, getConfiguredNavbarLogoUrl } from '../../lib/utils'
import { useTranslation } from 'react-i18next'
interface MobileNavBarProps {
  show: boolean
  items: NavItemsProps[]
  closeMobileMenu: () => void
}

export const MobileNavBar: FC<MobileNavBarProps> = ({ closeMobileMenu, show, items }) => {
  const { t } = useTranslation()

  return (
    <>
      {/* Mobile menu */}
      <Transition show={show} as={Fragment}>
        <Dialog as='div' className='relative z-[1000] md:hidden' onClose={closeMobileMenu}>
          <TransitionChild
            as={Fragment}
            enter='transition-opacity ease-linear duration-300'
            enterFrom='opacity-0'
            enterTo='opacity-100'
            leave='transition-opacity ease-linear duration-300'
            leaveFrom='opacity-100'
            leaveTo='opacity-0'
          >
            <div className='fixed inset-0 bg-opacity-75 dark:bg-opacity-75 bg-gray-600 dark:bg-gray-600' />
          </TransitionChild>

          <div className='fixed inset-0 z-40 flex'>
            <TransitionChild
              as={Fragment}
              enter='transition ease-in-out duration-300 transform'
              enterFrom='-translate-x-full'
              enterTo='translate-x-0'
              leave='transition ease-in-out duration-300 transform'
              leaveFrom='translate-x-0'
              leaveTo='-translate-x-full'
            >
              <DialogPanel className='relative flex w-full max-w-xs flex-1 flex-col pt-4 pb-4 bg-gray-600 dark:bg-gray-700'>
                <TransitionChild
                  as={Fragment}
                  enter='ease-in-out duration-300'
                  enterFrom='opacity-0'
                  enterTo='opacity-100'
                  leave='ease-in-out duration-300'
                  leaveFrom='opacity-100'
                  leaveTo='opacity-0'
                >
                  <div className='absolute top-1 right-0 -mr-14 p-1'>
                    <button
                      type='button'
                      className='flex h-12 w-12 items-center justify-center rounded-full'
                      onClick={closeMobileMenu}
                    >
                      <FontAwesomeIcon
                        icon={faXmark}
                        className='h-6 w-6 text-white'
                        aria-hidden='true'
                      />
                      <span className='sr-only'>{t('Common.Close menu')}</span>
                    </button>
                  </div>
                </TransitionChild>
                <div className='flex flex-shrink-0 items-center px-4'>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className='h-8 max-w-[3.5rem] w-auto cursor-pointer object-contain object-center'
                    src={getConfiguredNavbarLogoUrl()}
                    alt='logo'
                  />
                </div>
                <div className={`mt-4 h-0 flex-1 ${customScrollbarClass} px-4`}>
                  <nav className='flex h-full flex-col'>
                    <div className='space-y-1'>
                      {items.map((item) => (
                        <Link key={item.name} href={item.href}>
                          <div
                            className={classNames(
                              item.current
                                ? 'text-white bg-gray-700 dark:bg-gray-500'
                                : 'text-gray-100 hover:text-white hover:bg-gray-700 dark:hover:bg-gray-500',
                              'group py-4 px-3 rounded-md flex items-center text-sm font-medium',
                            )}
                            aria-current={item.current ? 'page' : undefined}
                          >
                            <FontAwesomeIcon
                              icon={item.current ? (item.iconActive as any) : (item.icon as any)}
                              className={classNames(
                                item.current
                                  ? 'text-white'
                                  : 'text-gray-100 group-hover:text-white',
                                'mr-3 h-6 w-6',
                              )}
                              aria-hidden='true'
                            />
                            <span>{t(`Common.${item.name}`)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </nav>
                </div>
              </DialogPanel>
            </TransitionChild>
            <div className='w-14 flex-shrink-0' aria-hidden='true'>
              {/* Dummy element to force sidebar to shrink to fit close icon */}
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  )
}
