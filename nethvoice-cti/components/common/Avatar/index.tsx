// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 *
 * It can be used to render a Avatar or User's profile image.
 *
 * @param rounded - Indicate the radius of the avatar.
 * @param status - Indicate the status of the status circle.
 * @param src - The path of the image.
 * @param initials - The initials to render if the image isn't present.
 * @param placeholder - The image to show as placeholder.
 * @param bordered - Adds a white border to the avatar.
 * @param altText - The alt text for required for usability.
 * @param size - The size of the avatar.
 * @param unoptimized - It is usefull when it's necessary to load images from an external domain.
 *
 */

import { ComponentProps, FC } from 'react'
import { useTheme } from '../../../theme/Context'
import classNames from 'classnames'
import Image from 'next/image'
import { AvatarGroup, AvatarGroupProps as GroupProps } from './AvatarGroup'
import type { StatusTypes } from '../../../theme/Types'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faBuilding, faStar, faHeadset, faTimes } from '@fortawesome/free-solid-svg-icons'
import { StatusDot } from '../StatusDot'
import { removeAvatar } from '../../../lib/profilePicture'
import { t } from 'i18next'
export type AvatarGroupProps = GroupProps

export interface AvatarProps extends Omit<ComponentProps<'div'>, 'placeholder'> {
  rounded?: 'base' | 'full'
  status?: StatusTypes
  src?: string
  initials?: string
  placeholder?: FC<ComponentProps<'svg'>>
  placeholderType?: string
  bordered?: boolean
  altText?: string
  size?: 'extra_small' | 'small' | 'base' | 'large' | 'extra_large'
  unoptimized?: boolean
  star?: boolean
  deleteAvatar?: boolean
  isUploadAvatar?: boolean
  isRinging?: boolean
}

const AvatarComponent: FC<AvatarProps> = ({
  rounded = 'full',
  status,
  src,
  initials,
  placeholder: Placeholder,
  placeholderType,
  bordered,
  altText = 'Avatar image',
  size = 'base',
  unoptimized = true,
  star,
  deleteAvatar,
  isUploadAvatar,
  isRinging,
  className,
  ...props
}) => {
  const { avatar: theme } = useTheme().theme

  return (
    <div
      className={classNames(
        theme.base,
        theme.sizes[size],
        initials && theme.initials.background,
        Placeholder && theme.placeholder.background,
        placeholderType && theme.placeholderType.background,
        theme.rounded[rounded],
        bordered && theme.bordered,
        className,
      )}
      {...props}
    >
      {src && (
        <Image
          className={classNames(theme.image, theme.rounded[rounded])}
          src={src}
          alt={altText}
          fill
          unoptimized={unoptimized}
        />
      )}
      {initials && <div className={theme.initials.base}>{initials}</div>}
      {Placeholder && <Placeholder className={theme.placeholder.base} />}
      {placeholderType && (
        <div className={theme.placeholderType.base}>
          {placeholderType == 'person' && (
            <FontAwesomeIcon
              icon={faUser}
              className={classNames(theme.placeholderType, theme.placeholderType.sizes[size])}
              aria-hidden='true'
            />
          )}
          {placeholderType == 'company' && (
            <FontAwesomeIcon
              icon={faBuilding}
              className={classNames(theme.placeholderType, theme.placeholderType.sizes[size])}
              aria-hidden='true'
            />
          )}
          {placeholderType == 'operator' && (
            <FontAwesomeIcon
              icon={faHeadset}
              className={classNames(theme.placeholderType, theme.placeholderType.sizes[size])}
              aria-hidden='true'
            />
          )}
        </div>
      )}
      {status && (
        <div>
          <StatusDot
            size={size}
            status={status}
            animate={isRinging}
            className={`absolute bottom-0 right-0 ${
              size === 'extra_large' ? 'h-5 w-5' : size === 'large' ? 'h-3 w-3' : 'h-2 w-2'
            }`}
          />
        </div>
      )}
      {star && (
        <>
          {/* White star behind the primary */}
          <FontAwesomeIcon
            icon={faStar}
            aria-hidden='true'
            className={classNames(theme.star.base, theme.star.sizes[size])}
            style={{
              color: '#FFFFFF',
              filter: 'drop-shadow(0 0 1px #FFFFFF)',
              transform: 'scale(1.3)',
            }}
          />
          {/* Primary star */}
          <FontAwesomeIcon
            icon={faStar}
            aria-hidden='true'
            className={classNames(theme.star.base, theme.star.sizes[size])}
          />
        </>
      )}
      {deleteAvatar && (
        <button
          className={classNames(theme.deleteAvatar.button)}
          data-tooltip-id={'tooltip-remove-profile-picture'}
          data-tooltip-content={t('Settings.Delete profile picture') || ''}
        >
          <FontAwesomeIcon
            icon={faTimes}
            aria-hidden='true'
            className={classNames(theme.deleteAvatar.base)}
            onClick={() => removeAvatar('')}
          />
        </button>
      )}
    </div>
  )
}

AvatarGroup.displayName = 'Avatar.Group'

export const Avatar = Object.assign(AvatarComponent, {
  Group: AvatarGroup,
})
