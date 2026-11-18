// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition, faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

interface SectionToggleHeaderProps {
  icon: IconDefinition
  title: string
  expanded: boolean
  onToggle: () => void
  className?: string
}

export const SectionToggleHeader: FC<SectionToggleHeaderProps> = ({
  icon,
  title,
  expanded,
  onToggle,
  className = '',
}) => (
  <div className={`flex items-center ${className}`}>
    <div className='flex items-center'>
      <FontAwesomeIcon
        icon={icon}
        className='h-4 w-4 mr-2 py-2 cursor-pointer flex items-center'
        aria-hidden='true'
      />
      <h2 className='text-base font-semibold text-gray-900 dark:text-gray-100 mr-4'>{title}</h2>
    </div>
    <div className='flex-grow'></div>
    <div className='flex items-center justify-end h-6 w-6'>
      <FontAwesomeIcon
        icon={expanded ? faChevronUp : faChevronDown}
        className='h-3.5 w-3.5 pl-2 py-2 cursor-pointer flex items-center'
        aria-hidden='true'
        onClick={onToggle}
      />
    </div>
  </div>
)
