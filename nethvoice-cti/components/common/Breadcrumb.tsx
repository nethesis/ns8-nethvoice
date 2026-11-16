// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import Link from 'next/link'
import classNames from 'classnames'

interface BreadcrumbProps {
  previousLink: {
    path?: string
    label: string
    onClick?: () => void
  }
  currentPage: string
  size?: 'sm' | 'xs'
  className?: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  previousLink,
  currentPage,
  size = 'sm',
  className,
}) => {
  const textClasses = size === 'xs' ? 'text-xs font-medium leading-4' : 'text-sm'
  const previousLabel = (
    <span
      className={classNames(
        textClasses,
        'text-primaryActive dark:text-primaryActiveDark hover:underline cursor-pointer',
      )}
    >
          {previousLink.label}
        </span>
  )

  return (
    <div className={classNames('flex items-center mb-2', className)}>
      {previousLink.onClick ? (
        <button type='button' onClick={previousLink.onClick}>
          {previousLabel}
        </button>
      ) : (
        <Link href={previousLink.path || '#'}>{previousLabel}</Link>
      )}
      <span
        className={classNames(
          textClasses,
          'mx-1 text-tertiaryNeutral dark:text-tertiaryNeutralDark',
        )}
      >
        {'>'}
      </span>
      <span
        className={classNames(textClasses, 'text-tertiaryNeutral dark:text-tertiaryNeutralDark')}
      >
        {currentPage}
      </span>
    </div>
  )
}
