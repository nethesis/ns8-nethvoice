import React, { useMemo, useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import OperatorCard from './OperatorCard'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleNotch } from '@fortawesome/free-solid-svg-icons'
import InfiniteScroll from 'react-infinite-scroll-component'

interface OperatorListProps {
  operators: any[]
  hasMore: boolean
  showMore: () => void
  isLoading?: boolean
}

const OperatorList = ({ operators, hasMore, showMore, isLoading = false }: OperatorListProps) => {
  const authUsername = useSelector((state: RootState) => state?.authentication?.username)
  const authUserMainPresence = useSelector(
    (state: RootState) =>
      state?.operators?.operators[state?.authentication?.username]?.mainPresence,
  )
  const actionInformation = useSelector((state: RootState) => state?.userActions)
  const isSidebarOpen = useSelector((state: RootState) => state?.rightSideMenu?.isShown)

  // Filter out the current user from the operators list
  const filteredOperators = useMemo(() => {
    return operators?.filter((operator) => operator?.username !== authUsername)
  }, [operators, authUsername])

  const mainUserIsBusy = useMemo(() => authUserMainPresence === 'busy', [authUserMainPresence])

  const classNameSidebarOpen =
    'mx-auto gap-x-8 gap-y-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 5xl:grid-cols-8 6xl:grid-cols-9'
  const classNameSidebarClosed =
    'mx-auto gap-x-8 gap-y-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9 6xl:grid-cols-10'

  const [currentCols, setCurrentCols] = useState(2)
  const gridRef = useRef<HTMLUListElement>(null)

  // Detect current breakpoint by checking computed grid-template-columns
  useEffect(() => {
    const detectGridCols = () => {
      if (gridRef?.current) {
        const computedStyle = window?.getComputedStyle(gridRef?.current)
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
    const count = currentCols * 4
    return count
  }, [currentCols])

  if (isLoading) {
    return (
      <div className='space-y-8 sm:space-y-12 py-8'>
        <ul
          ref={gridRef}
          role='list'
          className={`${isSidebarOpen ? classNameSidebarOpen : classNameSidebarClosed}`}
        >
          {Array.from(Array(skeletonItemsCount)).map((e, index) => (
            <li key={index}>
              <div className='space-y-2 w-[200px]'>
                {/* avatar skeleton */}
                <div className='animate-pulse rounded-full h-24 w-24 mx-auto bg-gray-300 dark:bg-gray-600 border-2 border-gray-200 dark:border-gray-500'></div>

                <div className='space-y-1'>
                  {/* name skeleton */}
                  <div className='text-center'>
                    <div className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600 max-w-[150px] mx-auto'></div>
                  </div>

                  {/* extension skeleton */}
                  <div className='text-center'>
                    <div className='animate-pulse h-5 rounded bg-gray-300 dark:bg-gray-600 max-w-[80px] mx-auto'></div>
                  </div>
                </div>

                {/* min-h-9 area (buttons/status) */}
                <div className='min-h-9 flex justify-center items-center'>
                  <div className='animate-pulse h-9 w-28 rounded bg-gray-300 dark:bg-gray-600'></div>
                </div>

                {/* min-h-[24px] area (counterpart/status text) */}
                <div className='min-h-[24px] flex justify-center items-center'>
                  <div className='animate-pulse h-4 w-36 rounded bg-gray-300 dark:bg-gray-600'></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className='space-y-8 sm:space-y-12 py-8'>
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
        <ul
          ref={gridRef}
          role='list'
          className={`${isSidebarOpen ? classNameSidebarOpen : classNameSidebarClosed}`}
        >
          {filteredOperators.map((operator, index) => (
            <li key={operator?.username || index}>
              <OperatorCard
                operator={operator}
                authUsername={authUsername}
                mainUserIsBusy={mainUserIsBusy}
                actionInformation={actionInformation}
                index={index}
              />
            </li>
          ))}
        </ul>
      </InfiniteScroll>
    </div>
  )
}

export default React.memo(OperatorList)

OperatorList.displayName = 'OperatorList'
