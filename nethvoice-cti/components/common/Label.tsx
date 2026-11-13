// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Label component for form controls with optional icon and tooltip
 *
 * @example
 * // Simple label
 * <Label>Username</Label>
 *
 * @example
 * // Label with icon and tooltip
 * <Label
 *   icon={faCircleInfo}
 *   tooltipId="help-tooltip"
 *   tooltipContent="This is a helpful tooltip"
 *   tooltipPlace="top"
 * >
 *   Field name
 * </Label>
 *
 * @example
 * // Label associated with input
 * <Label htmlFor="email-input">Email</Label>
 * <TextInput id="email-input" />
 */

import { FC, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { CustomThemedTooltip } from './CustomThemedTooltip'
import classNames from 'classnames'

export interface LabelProps {
  /**
   * Label text content
   */
  children?: ReactNode
  /**
   * Optional icon to display next to label
   */
  icon?: IconDefinition
  /**
   * Tooltip ID (required if icon is provided)
   */
  tooltipId?: string
  /**
   * Tooltip content to display on icon hover
   */
  tooltipContent?: string
  /**
   * Tooltip placement
   * @default 'top'
   */
  tooltipPlace?: 'top' | 'right' | 'bottom' | 'left'
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * For attribute to associate label with form control
   */
  htmlFor?: string
}

export const Label: FC<LabelProps> = ({
  children,
  icon,
  tooltipId,
  tooltipContent,
  tooltipPlace = 'top',
  className,
  htmlFor,
}) => {
  const hasTooltip = icon && tooltipId && tooltipContent

  return (
    <label
      htmlFor={htmlFor}
      className={classNames(
        'text-sm mb-2 font-medium leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark',
        {
          'flex items-center gap-2': icon,
        },
        className,
      )}
    >
      {children}
      {icon && (
        <>
          <FontAwesomeIcon
            icon={icon}
            className='h-4 w-4 text-iconInfo dark:text-iconInfoDark cursor-auto'
            aria-hidden='true'
            data-tooltip-id={tooltipId}
            data-tooltip-content={tooltipContent}
          />
          {hasTooltip && <CustomThemedTooltip id={tooltipId} place={tooltipPlace} />}
        </>
      )}
    </label>
  )
}
