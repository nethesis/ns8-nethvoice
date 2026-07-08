// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from 'react'
import Link from 'next/link'

interface BreadcrumbProps {
  previousLink: {
    path: string
    label: string
  }
  currentPage: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ previousLink, currentPage }) => {
  return (
    <div className='flex items-center mb-2'>
      <Link href={previousLink.path}>
        <span className='text-sm text-primaryActive dark:text-primaryActiveDark hover:underline cursor-pointer'>
          {previousLink.label}
        </span>
      </Link>
      <span className='text-sm text-gray-500 dark:text-gray-400 mx-1'>{'>'}</span>
      <span className='text-sm text-gray-500 dark:text-gray-400'>{currentPage}</span>
    </div>
  )
}
