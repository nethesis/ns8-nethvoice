// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC, ReactNode } from 'react'

interface AccountSectionProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
}

/**
 * A section of the Account settings page: title and description on the left,
 * content on the right
 */
export const AccountSection: FC<AccountSectionProps> = ({ title, description, children }) => (
  <section className='flex flex-col gap-6 pb-8 md:flex-row max-w-[48.375rem] border-b border-layoutDivider dark:border-layoutDividerDark'>
    <div className='flex flex-col gap-1 md:w-[18.75rem] md:shrink-0'>
      <h2 className='text-base font-medium text-primaryNeutral dark:text-primaryNeutralDark'>
        {title}
      </h2>
      {description && (
        <p className='text-sm text-tertiaryNeutral dark:text-tertiaryNeutralDark'>{description}</p>
      )}
    </div>
    <div className='flex-1 min-w-0'>{children}</div>
  </section>
)
