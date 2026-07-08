import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faAngleRight } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import { Button } from './Button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPreviousPage: () => void
  onNextPage: () => void
  isLoading?: boolean
  itemsName?: string
  showingText?: string
  ofText?: string
  previousPageText?: string
  nextPageText?: string
  className?: string
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPreviousPage,
  onNextPage,
  isLoading = false,
  itemsName = 'items',
  showingText = t('Common.Showing'),
  ofText = t('Common.of'),
  previousPageText = t('Common.Previous page'),
  nextPageText = t('Common.Next page'),
  className = '',
}) => {
  const isPreviousPageButtonDisabled = isLoading || currentPage <= 1
  const isNextPageButtonDisabled = isLoading || currentPage >= totalPages

  return (
    <nav
      className={`flex items-center justify-between border-t px-0 py-4 mb-8 border-gray-100 dark:border-gray-800 ${className}`}
      aria-label='Pagination'
    >
      <div className='hidden sm:block'>
        <p className='text-sm text-gray-700 dark:text-gray-200'>
          {showingText}{' '}
          <span className='font-medium'>{pageSize * (currentPage - 1) + 1}</span> -&nbsp;
          <span className='font-medium'>
            {pageSize * (currentPage - 1) + pageSize < totalItems
              ? pageSize * (currentPage - 1) + pageSize
              : totalItems}
          </span>{' '}
          {ofText} <span className='font-medium'>{totalItems}</span> {itemsName}
        </p>
      </div>
      <div className='flex flex-1 justify-between sm:justify-end'>
        <Button
          type='button'
          variant='white'
          disabled={isPreviousPageButtonDisabled}
          onClick={onPreviousPage}
          className='flex items-center'
        >
          <FontAwesomeIcon icon={faChevronLeft} className='mr-2 h-4 w-4' />
          <span>{previousPageText}</span>
        </Button>
        <Button
          type='button'
          variant='white'
          className='ml-3 flex items-center'
          disabled={isNextPageButtonDisabled}
          onClick={onNextPage}
        >
          <span>{nextPageText}</span>
          <FontAwesomeIcon icon={faAngleRight} className='ml-2 h-4 w-4' />
        </Button>
      </div>
    </nav>
  )
}
