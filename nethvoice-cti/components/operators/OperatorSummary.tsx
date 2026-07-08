// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { ComponentPropsWithRef, forwardRef, useState } from 'react'
import classNames from 'classnames'
import { ActionCall, Avatar, Badge, Button, ButtonDropdown, IconSwitch } from '../common'
import { useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  addOperatorToFavorites,
  openShowOperatorDrawer,
  reloadOperators,
  removeOperatorFromFavorites,
} from '../../lib/operators'
import { useSelector } from 'react-redux'
import { RootState, store } from '../../store'
import {
  faPlus,
  faStar as faStarSolid,
  faUserGroup,
  faVideo,
  faComment,
} from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarLight } from '@nethesis/nethesis-light-svg-icons'
import { t } from 'i18next'
import { isEmpty } from 'lodash'
import { Tooltip } from 'react-tooltip'
import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { CustomThemedTooltip } from '../common/CustomThemedTooltip'

export interface OperatorSummaryProps extends ComponentPropsWithRef<'div'> {
  operator: any
  isShownFavorite: boolean
  isShownSideDrawerLink: boolean
}

export const OperatorSummary = forwardRef<HTMLButtonElement, OperatorSummaryProps>(
  ({ operator, isShownFavorite, isShownSideDrawerLink = false, className, ...props }, ref) => {
    const auth = useSelector((state: RootState) => state.authentication)
    // Get selected operator information from operators store
    const operatorsStore = useSelector((state: RootState) => state.operators)
    const currentOperatorInformations = operatorsStore?.operators[operator?.username]
    const authStore = useSelector((state: RootState) => state.authentication)
    const [isFavorite, setFavorite] = useState(false)
    const operatorGroups = Array.from(
      new Set<string>(
        ((currentOperatorInformations?.groups || operator?.groups || []) as string[]).filter(
          (groupName): groupName is string => Boolean(groupName),
        ),
      ),
    )
    const maxVisibleGroupBadges = 3
    const visibleOperatorGroups =
      operatorGroups.length > maxVisibleGroupBadges
        ? operatorGroups.slice(0, maxVisibleGroupBadges - 1)
        : operatorGroups
    const hiddenOperatorGroups =
      operatorGroups.length > maxVisibleGroupBadges
        ? operatorGroups.slice(maxVisibleGroupBadges - 1)
        : []
    const hiddenGroupsTooltipId = `operator-groups-${operator?.username || operator?.name || 'unknown'}`

    useEffect(() => {
      setFavorite(operator?.favorite)
    }, [operator])

    const toggleFavorite = () => {
      if (isFavorite) {
        removeOperatorFromFavorites(
          operator?.username,
          auth?.username,
          operatorsStore?.favorites,
          operatorsStore?.favoritesObject[operator?.username],
        )
      } else {
        addOperatorToFavorites(
          operator?.username,
          operator?.endpoints?.mainextension?.[0]?.id,
          operator?.name,
        )
      }
      setFavorite(!isFavorite)
      reloadOperators()
    }

    const maybeShowSideDrawer = (operator: any) => {
      if (!isShownSideDrawerLink) {
        return
      }
      // close global search
      openShowOperatorDrawer(operator)
      store?.dispatch?.globalSearch?.setOpen(false)
      store?.dispatch?.globalSearch?.setFocused(false)

      // To avoid blur effect when click on operator information
      store?.dispatch?.globalSearch?.setRightSideTitleClicked(true)
    }

    const [operatorDevices, setOperatorDevices]: any = useState({})

    useEffect(() => {
      if (operator && operator?.endpoints) {
        const mainExtension = operator?.endpoints?.mainextension?.[0]?.id || null
        const cellphone = operator?.endpoints?.cellphone[0]?.id || null

        setOperatorDevices({
          mainExtension,
          cellphone,
        })
      }
    }, [operator])

    return (
      <>
        <div
          className={classNames('flex min-w-0 items-center justify-between', className)}
          {...props}
        >
          <div className='flex items-center'>
            <div className='flex-shrink-0 mr-4'>
              <Avatar
                size='extra_large'
                src={operator?.avatarBase64}
                placeholderType='operator'
                onClick={() => maybeShowSideDrawer(operator)}
                className={classNames(isShownSideDrawerLink && 'cursor-pointer')}
                status={currentOperatorInformations?.mainPresence}
              />
            </div>
            <div>
              <div className='ml-2'>
                <h2
                  className={classNames(
                    'text-lg inline-block font-medium leading-7 text-primaryNeutral dark:text-primaryNeutralDark mr-2',
                    isShownSideDrawerLink && 'cursor-pointer hover:underline',
                  )}
                  onClick={() => maybeShowSideDrawer(operator)}
                >
                  {operator?.name}
                </h2>
                {isShownFavorite && (
                  <>
                    <IconSwitch
                      on={isFavorite}
                      size='large'
                      onIcon={<FontAwesomeIcon icon={faStarSolid} />}
                      offIcon={<FontAwesomeIcon icon={faStarLight as IconProp} />}
                      changed={() => toggleFavorite()}
                      isFavorite={true}
                      className={'mr-5'}
                      data-tooltip-id={'tooltip-toggle-favorite'}
                      data-tooltip-content={
                        isFavorite
                          ? t('OperatorDrawer.Remove favorite operator') || ''
                          : t('OperatorDrawer.Set favorite operator') || ''
                      }
                    >
                      <span className='sr-only'>
                        {t('OperatorDrawer.Toggle favorite operator')}
                      </span>
                    </IconSwitch>
                    {/* Tooltip for favorite operators toggle */}
                    <Tooltip className='pi-z-20' id={'tooltip-toggle-favorite'} place='left' />
                  </>
                )}
              </div>

              <span className='text-base font-normal leading-5 text-secondaryNeutral dark:text-secondaryNeutralDark ml-2'>
                {operator?.endpoints?.mainextension?.[0]?.id}
              </span>
              {operatorGroups.length > 0 && (
                <div className='ml-2 mt-3 flex flex-wrap items-center gap-2'>
                  {visibleOperatorGroups.map((groupName) => (
                    <Badge
                      key={groupName}
                      variant='blueNethLink'
                      rounded='full'
                      size='small'
                      icon={<FontAwesomeIcon icon={faUserGroup} className='h-3.5 w-3.5' />}
                    >
                      {groupName}
                    </Badge>
                  ))}
                  {hiddenOperatorGroups.length > 0 && (
                    <>
                      <Badge
                        variant='blueNethLink'
                        rounded='full'
                        size='small'
                        icon={<FontAwesomeIcon icon={faPlus} className='h-3 w-3' />}
                        data-tooltip-id={hiddenGroupsTooltipId}
                        data-tooltip-content={hiddenOperatorGroups.join(', ')}
                      >
                        {hiddenOperatorGroups.length}
                      </Badge>
                      <CustomThemedTooltip id={hiddenGroupsTooltipId} place='top' />
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='mt-8'>
          {operatorsStore?.operators[authStore?.username]?.mainPresence === 'busy' &&
          operator?.mainPresence === 'online' ? (
            <ButtonDropdown
              operatorDevices={operatorDevices}
              operator={operator}
              isTransfer={true}
            ></ButtonDropdown>
          ) : (
            <ButtonDropdown operatorDevices={operatorDevices} operator={operator}></ButtonDropdown>
          )}

          {/* HIDDEN AT THE MOMENT */}
          {/* <Button
            variant='white'
            disabled={!isOperatorCallable(operator, auth.username)}
            className='mr-2'
          >
            <FontAwesomeIcon
              icon={faVideo}
              className='h-4 w-4 xl:mr-2 text-gray-500 dark:text-gray-400'
            />
            <span className='hidden xl:inline-block'>Videocall</span>
            <span className='sr-only'>Videocall</span>
          </Button>
          <Button variant='white' className='mr-2'>
            <FontAwesomeIcon
              icon={faComment}
              className='h-4 w-4 xl:mr-2 text-gray-500 dark:text-gray-400'
            />
            <span className='hidden xl:inline-block'>Chat</span>
            <span className='sr-only'>Chat</span>
          </Button> */}
        </div>
        {/* ongoing call info */}
        {!!operatorsStore?.operators[operator?.username]?.conversations?.length &&
          (operatorsStore?.operators[operator?.username]?.conversations?.[0]?.connected ||
            operatorsStore?.operators[operator?.username]?.conversations?.[0]?.inConference ||
            operatorsStore?.operators[operator?.username]?.conversations?.[0]?.chDest?.inConference ==
              true ||
            !isEmpty(operatorsStore?.operators[operator?.username]?.conversations?.[0])) && (
            <ActionCall config={operator} />
          )}
      </>
    )
  },
)

OperatorSummary.displayName = 'OperatorSummary'
