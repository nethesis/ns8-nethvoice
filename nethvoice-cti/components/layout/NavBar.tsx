// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 *
 * The Sidebar component
 *
 * @param items - The array with the navigation info
 *
 */

import { FC } from 'react'
import classNames from 'classnames'
import type { NavItemsProps } from '../../config/routes'
import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { useTranslation } from 'react-i18next'
import { customScrollbarClass, getConfiguredNavbarLogoUrl } from '../../lib/utils'

interface NavBarProps {
  items: NavItemsProps[]
}

const activeStyles = {
  width: '.25rem',
  height: '2.25rem',
  left: '0',
  top: '.44rem',
  borderRadius: '0rem .375rem .375rem 0rem',
  position: 'absolute',
} as React.CSSProperties

export const NavBar: FC<NavBarProps> = ({ items }) => {
  const { profile } = useSelector((state: RootState) => state.user)

  const permissionsUser: any = {
    Operators: profile?.macro_permissions?.presence_panel?.value ? true : false,
    Phonebook: profile?.macro_permissions?.phonebook?.value ? true : false,
    History: profile?.macro_permissions?.cdr?.value ? true : false,
    Queues: profile?.macro_permissions?.queue_agent?.value ? true : false,
    Queuemanager: profile?.macro_permissions?.qmanager?.value ? true : false,
    Applications: true,
    Settings: true,
  }

  // New user object to manage page permissions
  const itemsWithPermissions = items.map((item: any) => ({
    ...item,
    permission: permissionsUser[item.name],
  }))
  const { theme } = useSelector((state: RootState) => state.darkTheme)

  const { t } = useTranslation()

  return (
    <div
      className={`hidden w-20 ${customScrollbarClass} md:block border-r border-gray-200 dark:border-gray-700 bg-sidebar dark:bg-sidebarDark`}
    >
      <div className='flex w-full flex-col items-center py-2 h-full'>
        <div className='flex flex-shrink-0 items-center'>
          <Link href='/operators'>
            <div>
              {/* Nextjs <Image> is not suitable for rebranding: it always uses the aspect ratio of the original logo  */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className='h-[3.1875rem] max-w-[3.1875rem] w-auto cursor-pointer object-contain object-center'
                src={getConfiguredNavbarLogoUrl(
                  theme === 'dark' ||
                    (theme === 'system' &&
                      window.matchMedia('(prefers-color-scheme: dark)').matches),
                )}
                alt='logo'
              />
            </div>
          </Link>
        </div>
        <div className='mt-6 w-fit h-full flex flex-col space-y-5 px-2.5 justify-center'>
          {itemsWithPermissions.map((item, index: number) => (
            <div key={index} className={`${item.permission ? '' : 'hidden'}`}>
              <Link href={item.href}>
                <div
                  className={classNames(
                    item.current
                      ? 'text-currentSidebarIconText dark:text-currentSidebarIconTextDark bg-sidebarIconBackground dark:bg-sidebarIconBackgroundDark'
                      : 'text-sidebarIconText dark:text-sidebarIconTextDark dark:hover:text-currentSidebarIconTextDark hover:text-currentSidebarIconText hover:bg-sidebarIconBackground dark:hover:bg-sidebarIconBackgroundDark ',
                    'group rounded-md flex flex-col items-center text-xs font-medium justify-center',
                    'relative',
                  )}
                  data-tooltip-id={`tooltip-${item.name}`}
                  data-tooltip-content={t('Common.' + item.name)}
                  style={{
                    height: '3.125rem',
                    width: '3.125rem',
                  }}
                  aria-current={item.current ? 'page' : undefined}
                >
                  <FontAwesomeIcon
                    icon={item.current ? item.iconActive : item.icon}
                    className='h-6 w-6'
                    aria-hidden='true'
                  />
                  {item.current && (
                    <div
                      style={activeStyles}
                      className='bg-currentBadgePrimary dark:bg-currentBadgePrimaryDark'
                    />
                  )}
                </div>
              </Link>
              <CustomThemedTooltip id={`tooltip-${item.name}`} place='right' offset={20} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
