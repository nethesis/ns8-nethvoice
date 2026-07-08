import React, { useMemo, useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleRight, faCircleNotch, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import InfiniteScroll from 'react-infinite-scroll-component'
import { Badge } from '../common'
import CompactOperatorCard from './CompactOperatorCard'

interface GroupedOperatorListProps {
  operators: any[]
  hasMore: boolean
  showMore: () => void
  isLoading?: boolean
  upperCaseFirstLetter: (string: string) => string
}

const GroupedOperatorList = ({
  operators,
  hasMore,
  showMore,
  isLoading = false,
  upperCaseFirstLetter,
}: GroupedOperatorListProps) => {
  const authUsername = useSelector((state: RootState) => state?.authentication?.username)
  const authUserMainPresence = useSelector(
    (state: RootState) => state.operators?.operators[state?.authentication?.username]?.mainPresence,
  )
  const actionInformation = useSelector((state: RootState) => state?.userActions)
  const isSidebarOpen = useSelector((state: RootState) => state?.rightSideMenu?.isShown)

  // Filter out the current user from all groups with proper type checking
  const filteredOperators = useMemo(() => {
    if (!Array?.isArray(operators)) return []

    return operators
      .map((category) => ({
        ...category,
        members: Array?.isArray(category?.members)
          ? category?.members.filter(
              (member: any) =>
                member && typeof member === 'object' && member?.username !== authUsername,
            )
          : [],
      }))
      .filter((category) => category?.members?.length > 0)
  }, [operators, authUsername])

  const mainUserIsBusy = useMemo(() => authUserMainPresence === 'busy', [authUserMainPresence])

  const classNameSidebarOpen =
    'grid grid-cols-1 gap-x-5 gap-y-4 2xl:grid-cols-2 3xl:grid-cols-3 5xl:grid-cols-4 6xl:grid-cols-5 7xl:grid-cols-6'
  const classNameSidebarClosed =
    'grid grid-cols-1 gap-x-5 gap-y-4 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 5xl:grid-cols-5 6xl:grid-cols-6'

  const [currentCols, setCurrentCols] = useState(1)
  const gridRef = useRef<HTMLUListElement>(null)

  // Detect current breakpoint by checking computed grid-template-columns
  useEffect(() => {
    const detectGridCols = () => {
      if (gridRef.current) {
        const computedStyle = window.getComputedStyle(gridRef.current)
        const gridCols = computedStyle?.gridTemplateColumns
        const colCount = gridCols?.split(' ')?.length
        setCurrentCols(colCount)
      }
    }

    detectGridCols()
    window.addEventListener('resize', detectGridCols)

    return () => window.removeEventListener('resize', detectGridCols)
  }, [isSidebarOpen])

  // Calculate skeleton items to show exactly 4 rows based on current breakpoint
  const skeletonItemsCount = useMemo(() => {
    const count = currentCols * 1
    return count
  }, [currentCols])

  if (isLoading) {
    return (
      <div>
        {Array.from(Array(6)).map((_, categoryIndex) => (
          <div key={categoryIndex} className='mb-4'>
            <div className='flex items-start'>
              <Badge
                size='small'
                variant='category'
                rounded='full'
                className='overflow-hidden ml-1 mb-5 mt-4'
                icon={<FontAwesomeIcon icon={faUserGroup} className='h-4 w-4' />}
              >
                <div className='animate-pulse h-4 w-20 bg-skeletonBg dark:bg-skeletonBgDark rounded'></div>
              </Badge>
            </div>

            <ul
              ref={gridRef}
              role='list'
              className={`${isSidebarOpen ? classNameSidebarOpen : classNameSidebarClosed}`}
            >
              {Array.from(Array(skeletonItemsCount)).map((e, operatorIndex) => (
                <li key={operatorIndex} className='min-w-[384px]'>
                  <div className='group flex w-full items-center justify-between rounded-lg py-2 px-3 h-16 gap-3 text-left focus:outline-none focus:ring-2 focus:ring-offset-2 bg-cardBackgroud dark:bg-cardBackgroudDark focus:ring-primary dark:focus:ring-primary'>
                    {/* Avatar skeleton */}
                    <span className='flex-shrink-0'>
                      <div className='animate-pulse rounded-full h-14 w-14 bg-skeletonBg dark:bg-skeletonBgDark border-2 border-gray-200 dark:border-gray-500'></div>
                    </span>

                    {/* Name and extension skeleton */}
                    <div className='flex-1 min-w-0 overflow-hidden'>
                      <div className='flex items-center space-x-2 min-w-0'>
                        <div className='animate-pulse h-5 w-32 rounded bg-skeletonBg dark:bg-skeletonBgDark'></div>
                        <div className='animate-pulse h-4 w-12 rounded bg-skeletonBg dark:bg-skeletonBgDark'></div>
                      </div>
                      <div className='mt-1'>
                        <div className='animate-pulse h-4 w-40 rounded bg-skeletonBg dark:bg-skeletonBgDark'></div>
                      </div>
                    </div>

                    {/* Action buttons skeleton */}
                    <div className='flex items-center space-x-2'>
                      <div className='animate-pulse h-8 w-20 rounded bg-skeletonBg dark:bg-skeletonBgDark'></div>
                      <FontAwesomeIcon
                        icon={faAngleRight}
                        className='h-4 w-4 text-cardIcon dark:text-cardIconDark'
                        aria-hidden='true'
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  }

  return (
    <InfiniteScroll
      dataLength={filteredOperators?.length}
      next={showMore}
      hasMore={hasMore}
      scrollableTarget='main-content'
      loader={
        <FontAwesomeIcon
          icon={faCircleNotch}
          className='inline-block text-center fa-spin h-8 m-10 text-gray-400 dark:text-gray-500'
        />
      }
    >
      {filteredOperators.map((category: any, categoryIndex: number) => (
        <div key={categoryIndex} className='mb-4'>
          <div className='flex items-start'>
            <Badge
              size='small'
              variant='category'
              rounded='full'
              className='overflow-hidden ml-1 mb-5 mt-4'
              icon={<FontAwesomeIcon icon={faUserGroup} className='h-4 w-4' />}
            >
              <div className='text-xs font-medium leading-4 w-auto max-w-[150px] px-1 truncate'>
                {upperCaseFirstLetter(category?.category)}
              </div>
            </Badge>
          </div>

          <ul
            ref={gridRef}
            role='list'
            className={`${isSidebarOpen ? classNameSidebarOpen : classNameSidebarClosed}`}
          >
            {category?.members?.map((operator: any, operatorIndex: number) => (
              <li
                key={operator?.username || `${categoryIndex}-${operatorIndex}`}
                className='min-w-[384px]'
              >
                <CompactOperatorCard
                  operator={operator}
                  authUsername={authUsername}
                  mainUserIsBusy={mainUserIsBusy}
                  actionInformation={actionInformation}
                  index={`${categoryIndex}-${operatorIndex}`}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </InfiniteScroll>
  )
}

export default React.memo(GroupedOperatorList)

GroupedOperatorList.displayName = 'GroupedOperatorList'
