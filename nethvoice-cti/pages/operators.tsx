// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import type { NextPage } from 'next'
import { EmptyState } from '../components/common'
import {
  AVAILABLE_STATUSES,
  getFilterValues,
  getInfiniteScrollOperatorsPageSize,
  getUserGroups,
  openShowOperatorDrawer,
  searchStringInOperator,
  sortByOperatorStatus,
  UNAVAILABLE_STATUSES,
} from '../lib/operators'
import { isEmpty, debounce } from 'lodash'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { Filter } from '../components/operators'
import { sortByFavorite, sortByProperty } from '../lib/utils'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBars, faFilter, faHeadset, IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { store } from '../store'
import { t } from 'i18next'
import { MissingPermission } from '../components/common/MissingPermissionsPage'
import { faGrid2, faGridDividers } from '@nethesis/nethesis-solid-svg-icons'
import { savePreference } from '../lib/storage'
import OperatorList from '../components/operators/OperatorList'
import CompactOperatorList from '../components/operators/CompactOperatorList'
import GroupedOperatorList from '../components/operators/GroupedOperatorList'
import { CustomThemedTooltip } from '../components/common/CustomThemedTooltip'
import { Button } from '../components/common'

const Operators: NextPage = () => {
  interface Operator {
    username?: string
    name?: string
    mainPresence?: string
    avatarBase64?: string
    favorite?: boolean
    conversations?: any[]
    endpoints?: any
    groups?: string[]
    [key: string]: any
  }

  interface OperatorCategory {
    category: string
    members: Operator[]
  }

  const [filteredOperators, setFilteredOperators] = useState<any>([])
  const operatorsStore = useSelector((state: RootState) => state?.operators)
  const [isApplyingFilters, setApplyingFilters] = useState(false)
  const infiniteScrollOperatorsPageSize = getInfiniteScrollOperatorsPageSize()
  const [infiniteScrollOperators, setInfiniteScrollOperators] = useState<
    Operator[] | OperatorCategory[]
  >([])
  const [infiniteScrollHasMore, setInfiniteScrollHasMore] = useState(false)
  const [infiniteScrollLastIndex, setInfiniteScrollLastIndex] = useState(
    infiniteScrollOperatorsPageSize,
  )
  const auth = useSelector((state: RootState) => state?.authentication)

  const [textFilter, setTextFilter]: any = useState('')
  const updateTextFilter = (newTextFilter: string) => {
    setTextFilter(newTextFilter)
  }

  const debouncedUpdateTextFilter = useMemo(() => debounce(updateTextFilter, 400), [])

  // stop invocation of debounced function after unmounting
  useEffect(() => {
    return () => {
      debouncedUpdateTextFilter?.cancel()
    }
  }, [debouncedUpdateTextFilter])

  const [groupFilter, setGroupFilter]: any = useState('')
  const updateGroupFilter = (newGroupFilter: string) => {
    setGroupFilter(newGroupFilter)
  }

  const [statusFilter, setStatusFilter]: any = useState('')
  const updateStatusFilter = (newStatusFilter: string) => {
    setStatusFilter(newStatusFilter)
  }

  const [sortByFilter, setSortByFilter]: any = useState('')
  const updateSort = (newSortBy: string) => {
    setSortByFilter(newSortBy)
  }

  const [groupedSortByFilter, setGroupedSortByFilter]: any = useState('')
  const updateGroupedSort = (newGroupedSortBy: string) => {
    setGroupedSortByFilter(newGroupedSortBy)
  }

  const [groupedGroupByFilter, setGroupedGroupByFilter]: any = useState('')
  const updateGroupedGroupBy = (newGroupedGroupBy: string) => {
    setGroupedGroupByFilter(newGroupedGroupBy)
  }

  const [layout, setLayout] = useState('')
  const { profile } = useSelector((state: RootState) => state?.user)

  const allowedGroupsIds = store?.select?.user?.allowedOperatorGroupsIds(store?.getState())
  const presencePanelPermissions = store?.select?.user?.presencePanelPermissions(store?.getState())
  const { username } = store?.getState()?.user

  const userGroups = useMemo(() => {
    return getUserGroups(
      allowedGroupsIds,
      operatorsStore?.groups,
      presencePanelPermissions?.['all_groups']?.value,
      username,
    )
  }, [allowedGroupsIds, operatorsStore?.groups, presencePanelPermissions, username])

  const applyFilters = useCallback(
    (operators: Record<string, Operator>) => {
      if (!(groupFilter && statusFilter && sortByFilter)) {
        return
      }
      setApplyingFilters(true)

      // text filter and exclude current user
      let filteredOperators: Operator[] = Object?.values(operators || {}).filter(
        (op) =>
          op &&
          typeof op === 'object' &&
          searchStringInOperator(op, textFilter) &&
          op?.username !== username,
      )

      if (layout !== 'grouped') {
        // group filter
        if (groupFilter === 'favorites') {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return op?.favorite && userGroups?.some((g) => op?.groups?.includes(g))
          })
        } else if (groupFilter === 'all') {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return userGroups?.some((g) => op?.groups?.includes(g))
          })
        } else {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return groupFilter === 'all' || op?.groups?.includes(groupFilter)
          })
        }

        // sort operators
        switch (sortByFilter) {
          case 'favorites':
            filteredOperators?.sort(sortByProperty('name'))
            // filteredOperators.sort(sortByOperatorStatus)
            filteredOperators?.sort(sortByFavorite)
            break
          case 'extension':
            filteredOperators?.sort((a: any, b: any) =>
              a?.endpoints?.extension[0]?.id > b?.endpoints?.extension[0]?.id ? 1 : -1,
            )
            break
          case 'az':
            // Sort operators alphabetically
            filteredOperators?.sort((a: any, b: any) => (a?.name > b?.name ? 1 : -1))
            break
          case 'za':
            // Sort operators reverse alphabetically
            filteredOperators?.sort((a: any, b: any) => (a?.name < b?.name ? 1 : -1))
            break
        }

        filteredOperators = filteredOperators?.filter((op: any) => {
          return (
            statusFilter === 'all' ||
            (statusFilter === 'available' && AVAILABLE_STATUSES?.includes(op?.mainPresence)) ||
            (statusFilter === 'unavailable' && UNAVAILABLE_STATUSES?.includes(op?.mainPresence)) ||
            (statusFilter === 'offline' && op?.mainPresence === 'offline') ||
            (statusFilter === 'allExceptOffline' && op?.mainPresence !== 'offline')
          )
        })
      } else {
        // group filter
        if (groupFilter === 'favorites') {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return op?.favorite && userGroups?.some((g) => op?.groups?.includes(g))
          })
        } else if (groupFilter === 'all') {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return userGroups.some((g) => op?.groups?.includes(g))
          })
        } else {
          filteredOperators = filteredOperators?.filter((op: any) => {
            return groupFilter === 'all' || op?.groups?.includes(groupFilter)
          })
        }

        // sort operators
        switch (groupedSortByFilter) {
          case 'extension':
            filteredOperators?.sort((a: any, b: any) =>
              a?.endpoints?.extension[0]?.id > b?.endpoints?.extension[0]?.id ? 1 : -1,
            )
            break
          case 'az':
            // Sort operators alphabetically
            filteredOperators?.sort((a: any, b: any) => (a?.name > b?.name ? 1 : -1))
            break
          case 'za':
            // Sort operators reverse alphabetically
            filteredOperators?.sort((a: any, b: any) => (a?.name < b?.name ? 1 : -1))
            break
          case 'favorites':
            filteredOperators?.sort(sortByProperty('name'))
            filteredOperators?.sort(sortByOperatorStatus)
            filteredOperators?.sort(sortByFavorite)
            break
        }

        // group filter
        switch (groupedGroupByFilter) {
          case 'az':
            // Group by first letter of name and sort alphabetically within each category
            const letterGroupsAZ: { [key: string]: any[] } = {}
            filteredOperators?.forEach((op: any) => {
              const firstLetter = op?.name?.charAt(0)?.toUpperCase()
              if (!letterGroupsAZ[firstLetter]) {
                letterGroupsAZ[firstLetter] = []
              }
              letterGroupsAZ[firstLetter]?.push(op)
            })
            filteredOperators = []
            Object?.keys(letterGroupsAZ)
              ?.sort()
              ?.forEach((letter: string) => {
                filteredOperators?.push({ category: letter, members: letterGroupsAZ[letter] })
              })
            break
          case 'za':
            // Group by first letter of name and sort reverse alphabetically within each category
            const letterGroupsZA: { [key: string]: any[] } = {}
            filteredOperators?.forEach((op: any) => {
              const firstLetter = op?.name?.charAt(0)?.toUpperCase()
              if (!letterGroupsZA[firstLetter]) {
                letterGroupsZA[firstLetter] = []
              }
              letterGroupsZA[firstLetter]?.push(op)
            })
            filteredOperators = []
            Object?.keys(letterGroupsZA)
              ?.sort()
              ?.reverse()
              ?.forEach((letter: string) => {
                filteredOperators?.push({ category: letter, members: letterGroupsZA[letter] })
              })
            break
          case 'team':
            // Group by team and sort alphabetically within each team
            const teams: { [key: string]: any[] } = {}
            filteredOperators?.forEach((op: any) => {
              op?.groups?.forEach((group: string) => {
                if (!teams[group]) {
                  teams[group] = []
                }
                teams[group]?.push(op)
              })
            })
            filteredOperators = []
            Object?.keys(teams)
              ?.sort()
              ?.forEach((team: string) => {
                filteredOperators?.push({
                  category: team,
                  members: teams[team],
                })
              })
            break
          case 'status':
            // Group by status and sort according to custom order within each status
            const statusGroups: { [key: string]: any[] } = {}
            filteredOperators?.forEach((op: any) => {
              let status = op?.mainPresence
              if (status === 'incoming' || status === 'ringing') {
                status = 'busy'
              }
              if (!statusGroups[status]) {
                statusGroups[status] = []
              }
              statusGroups[status]?.push(op)
            })
            filteredOperators = []
            // Define custom order for statuses
            const customStatusOrder = [
              'busy',
              'online',
              'cellphone',
              'callforward',
              'voicemail',
              'dnd',
              'offline',
            ]
            // Iterate through custom status order
            customStatusOrder?.forEach((status: string) => {
              // Check if status exists in statusGroups
              if (statusGroups?.hasOwnProperty(status)) {
                // Push category with sorted members according to custom order
                filteredOperators?.push({
                  category: status,
                  members: statusGroups[status],
                })
              }
            })
            break
        }

        // status filter
        // Filter operators by status within each category
        filteredOperators.forEach((category: any) => {
          category.members = category?.members?.filter((op: any) => {
            return (
              statusFilter === 'all' ||
              (statusFilter === 'available' && AVAILABLE_STATUSES?.includes(op?.mainPresence)) ||
              (statusFilter === 'unavailable' &&
                UNAVAILABLE_STATUSES?.includes(op?.mainPresence)) ||
              (statusFilter === 'offline' && op?.mainPresence === 'offline') ||
              (statusFilter === 'allExceptOffline' && op?.mainPresence !== 'offline')
            )
          })
        })

        // Filter categories based on the presence of members after status filtering
        filteredOperators = filteredOperators?.filter((category: any) => {
          return category?.members?.length > 0
        })
      }

      setFilteredOperators(filteredOperators as any)

      setInfiniteScrollOperators(filteredOperators?.slice(0, infiniteScrollLastIndex) as any)
      const hasMore = infiniteScrollLastIndex < filteredOperators?.length
      setInfiniteScrollHasMore(hasMore)
      setApplyingFilters(false)
    },
    [
      groupFilter,
      statusFilter,
      sortByFilter,
      textFilter,
      infiniteScrollLastIndex,
      layout,
      userGroups,
      groupedSortByFilter,
      groupedGroupByFilter,
      username,
    ],
  )

  // load operators when navigating to operators page
  useEffect(() => {
    store?.dispatch?.operators?.setOperatorsLoaded(false)
  }, [])

  // apply filters when operators data has been loaded
  useEffect(() => {
    if (operatorsStore?.isOperatorsLoaded) {
      applyFilters(operatorsStore?.operators)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operatorsStore?.isOperatorsLoaded])

  // filtered operators
  useEffect(() => {
    applyFilters(operatorsStore?.operators)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    operatorsStore?.operators,
    textFilter,
    groupFilter,
    statusFilter,
    sortByFilter,
    groupedSortByFilter,
    groupedGroupByFilter,
    layout,
    profile?.macro_permissions?.presence_panel?.permissions,
  ])

  const showMoreInfiniteScrollOperators = useCallback(() => {
    const lastIndex = infiniteScrollLastIndex + infiniteScrollOperatorsPageSize
    setInfiniteScrollLastIndex(lastIndex)
    setInfiniteScrollOperators(filteredOperators?.slice(0, lastIndex))
    const hasMore = lastIndex < filteredOperators?.length
    setInfiniteScrollHasMore(hasMore)
  }, [filteredOperators, infiniteScrollLastIndex, infiniteScrollOperatorsPageSize])

  const openDrawerOperator = useCallback((operator: any) => {
    if (operator) {
      openShowOperatorDrawer(operator)
    }
  }, [])

  const [selectedLayout, setSelectedLayout] = useState('standard')

  const [isGroupedLayot, setIsGroupedLayout] = useState(false)

  // edit selected operators layout
  const selectLayoutOperators = (layout: string) => {
    setSelectedLayout(layout)
    setLayout(layout)
    // save selected layout to local storage
    savePreference('operatorsLayout', layout, auth?.username)
    if (layout === 'grouped') {
      setIsGroupedLayout(true)
    } else {
      setIsGroupedLayout(false)
    }
  }

  // retrieve layout values from local storage
  useEffect(() => {
    const filterValues = getFilterValues(auth?.username)
    setLayout(filterValues?.layout)
    setSelectedLayout(filterValues?.layout)
    if (filterValues?.layout === 'grouped') {
      setIsGroupedLayout(true)
    } else {
      setIsGroupedLayout(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upperCaseFirstLetter = (string: string) => {
    return string?.charAt(0)?.toUpperCase() + string?.slice(1)
  }

  return (
    <>
      {profile?.macro_permissions?.presence_panel?.value ? (
        <div>
          <h1 className='text-2xl font-semibold mb-6 text-title dark:text-titleDark'>
            {t('Operators.Operators')}
          </h1>
          <div className='flex items-center'>
            <div className='grow items-center'>
              {layout === 'grouped' ? (
                <>
                  <Filter
                    groups={operatorsStore?.groups}
                    updateTextFilter={debouncedUpdateTextFilter}
                    updateGroupFilter={updateGroupFilter}
                    updateStatusFilter={updateStatusFilter}
                    updateSort={updateSort}
                    updateGroupedSort={updateGroupedSort}
                    updateGroupedGroupBy={updateGroupedGroupBy}
                    isGroupedLayot={isGroupedLayot}
                  />
                </>
              ) : (
                <>
                  <Filter
                    groups={operatorsStore?.groups}
                    updateTextFilter={debouncedUpdateTextFilter}
                    updateGroupFilter={updateGroupFilter}
                    updateStatusFilter={updateStatusFilter}
                    updateSort={updateSort}
                    updateGroupedSort={updateGroupedSort}
                    updateGroupedGroupBy={updateGroupedGroupBy}
                    isGroupedLayot={isGroupedLayot}
                  />
                </>
              )}
            </div>
            <div className='hidden sm:flex sm:justify-end sm:items-center mt-4'>
              <Button
                variant='ghost'
                onClick={() => selectLayoutOperators('standard')}
                data-tooltip-id='standard-layout-tooltip'
                data-tooltip-content={t('Operators.Standard layout') || ''}
              >
                <FontAwesomeIcon
                  icon={faGrid2 as IconDefinition}
                  className={`${
                    selectedLayout === 'standard'
                      ? 'text-primaryActive dark:text-primaryActiveDark'
                      : 'text-tertiaryNeutral dark:text-tertiaryNeutralDark'
                  }  h-5 w-5 pointer-events-none select-none`}
                  data-tooltip-id='standard-layout-tooltip'
                  data-tooltip-content={t('Operators.Standard layout') || ''}
                />
              </Button>
              <CustomThemedTooltip id='standard-layout-tooltip' place='top' />
              <Button
                variant='ghost'
                onClick={() => selectLayoutOperators('compact')}
                data-tooltip-id='compact-layout-tooltip'
                data-tooltip-content={t('Operators.Compact layout') || ''}
              >
                <FontAwesomeIcon
                  icon={faBars}
                  className={`${
                    selectedLayout === 'compact'
                      ? 'text-primaryActive dark:text-primaryActiveDark'
                      : 'text-tertiaryNeutral dark:text-tertiaryNeutralDark'
                  } h-5 w-5 pointer-events-none select-none`}
                />
              </Button>
              <CustomThemedTooltip id='compact-layout-tooltip' place='top' />
              <Button
                variant='ghost'
                onClick={() => selectLayoutOperators('grouped')}
                data-tooltip-id='grouped-layout-tooltip'
                data-tooltip-content={t('Operators.Grouped layout') || ''}
              >
                <FontAwesomeIcon
                  icon={faGridDividers as IconDefinition}
                  className={`${
                    selectedLayout === 'grouped'
                      ? 'text-primaryActive dark:text-primaryActiveDark'
                      : 'text-tertiaryNeutral dark:text-tertiaryNeutralDark'
                  } h-5 w-5 pointer-events-none select-none`}
                />
              </Button>
              <CustomThemedTooltip id='grouped-layout-tooltip' place='top' />
            </div>
          </div>
          <div className='sm:hidden space-x-4 pb-8'>
            <button className='bg-transparent' onClick={() => selectLayoutOperators('standard')}>
              <FontAwesomeIcon
                icon={faGrid2 as IconDefinition}
                className={`${
                  selectedLayout === 'standard'
                    ? 'text-primary dark:text-primaryDark'
                    : 'text-iconTertiaryNeutral dark:text-iconTertiaryNeutralDark'
                }, inline-block text-center h-5 w-5 cursor-pointer pointer-events-none select-none`}
              />
            </button>
            <button className='bg-transparent' onClick={() => selectLayoutOperators('compact')}>
              <FontAwesomeIcon
                icon={faBars}
                className={`${
                  selectedLayout === 'compact'
                    ? 'text-primary dark:text-primaryDark'
                    : 'text-iconTertiaryNeutral dark:text-iconTertiaryNeutralDark'
                }, inline-block text-center h-5 w-5 cursor-pointer pointer-events-none select-none`}
              />
            </button>
            <button className='bg-transparent' onClick={() => selectLayoutOperators('grouped')}>
              <FontAwesomeIcon
                icon={faGridDividers as IconDefinition}
                className={`${
                  selectedLayout === 'grouped'
                    ? 'text-primary dark:text-primaryDark'
                    : 'text-iconTertiaryNeutral dark:text-iconTertiaryNeutralDark'
                }, inline-block text-center h-5 w-5 cursor-pointer pointer-events-none select-none`}
              />
            </button>
          </div>

          <div className='mx-auto text-center flex justify-center'>
            {/* empty state */}
            {operatorsStore?.isOperatorsLoaded &&
              !operatorsStore?.errorMessage &&
              isEmpty(operatorsStore?.operators) && (
                <EmptyState
                  title='No operators'
                  description='There is no operator configured'
                  icon={
                    <FontAwesomeIcon
                      icon={faHeadset}
                      className='mx-auto h-12 w-12'
                      aria-hidden='true'
                    />
                  }
                ></EmptyState>
              )}
            {/* no search results */}
            {operatorsStore?.isOperatorsLoaded &&
              !operatorsStore?.errorMessage &&
              !isEmpty(operatorsStore?.operators) &&
              isEmpty(filteredOperators) && (
                <EmptyState
                  title='No operators'
                  description='Try changing your search filters'
                  icon={
                    <FontAwesomeIcon
                      icon={faFilter}
                      className='mx-auto h-12 w-12'
                      aria-hidden='true'
                    />
                  }
                />
              )}

            {/* standard layout */}
            {layout === 'standard' && (
              <OperatorList
                operators={infiniteScrollOperators}
                hasMore={infiniteScrollHasMore}
                showMore={showMoreInfiniteScrollOperators}
                isLoading={!operatorsStore?.isOperatorsLoaded || isApplyingFilters}
              />
            )}

            {/* compact layout */}
            {layout === 'compact' && (
              <CompactOperatorList
                operators={infiniteScrollOperators}
                hasMore={infiniteScrollHasMore}
                showMore={showMoreInfiniteScrollOperators}
                isLoading={!operatorsStore?.isOperatorsLoaded || isApplyingFilters}
              />
            )}

            {/* grouped layout */}
            {layout === 'grouped' && (
              <GroupedOperatorList
                operators={infiniteScrollOperators}
                hasMore={infiniteScrollHasMore}
                showMore={showMoreInfiniteScrollOperators}
                isLoading={!operatorsStore?.isOperatorsLoaded || isApplyingFilters}
                upperCaseFirstLetter={upperCaseFirstLetter}
              />
            )}
          </div>
        </div>
      ) : operatorsStore?.isOperatorsLoaded ? (
        <MissingPermission />
      ) : (
        <> </>
      )}
    </>
  )
}

export default React.memo(Operators)
