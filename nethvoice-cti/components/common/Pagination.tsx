// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import { FC } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { t } from 'i18next'
import classNames from 'classnames'
import { Button } from './Button'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPreviousPage: () => void
  onNextPage: () => void
  /** Jump to an arbitrary page. When provided, the numbered NePaginator-style UI is rendered. */
  onSelectPage?: (page: number) => void
  /** Change the page size. When provided, a page-size selector is shown. */
  onSelectPageSize?: (pageSize: number) => void
  pageSizes?: number[]
  isLoading?: boolean
  itemsName?: string
  showingText?: string
  ofText?: string
  pageSizeLabel?: string
  previousPageText?: string
  nextPageText?: string
  className?: string
  labelVariant?: 'items' | 'page'
  bare?: boolean
}

// Build the list of page items to render, collapsing with '...' when there are
// many pages (mirrors the NePaginator behaviour from the Nethesis design system).
function getPageItems(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const items: (number | 'ellipsis')[] = [1]
  const firstPages = currentPage <= 4
  const lastPages = currentPage > totalPages - 4

  if (firstPages) {
    items.push(2, 3, 4, 5, 'ellipsis', totalPages)
  } else if (lastPages) {
    items.push(
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    )
  } else {
    items.push('ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages)
  }

  return items
}

export const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPreviousPage,
  onNextPage,
  onSelectPage,
  onSelectPageSize,
  pageSizes = [10, 25, 50, 100],
  isLoading = false,
  itemsName = 'items',
  showingText = t('Common.Showing'),
  ofText = t('Common.of'),
  pageSizeLabel = t('Common.Show'),
  previousPageText = t('Common.Previous page'),
  nextPageText = t('Common.Next page'),
  className = '',
  labelVariant = 'items',
  bare = false,
}) => {
  const firstRow = pageSize * (currentPage - 1) + 1
  const lastRow = Math.min(pageSize * (currentPage - 1) + pageSize, totalItems)
  const isPreviousDisabled = isLoading || currentPage <= 1
  const isNextDisabled = isLoading || currentPage >= totalPages

  const goToPage = (page: number) => {
    if (onSelectPage) {
      onSelectPage(page)
    } else if (page < currentPage) {
      onPreviousPage()
    } else if (page > currentPage) {
      onNextPage()
    }
  }

  // Legacy fallback: consumers that don't provide onSelectPage keep the old
  // Previous/Next-only layout, so nothing regresses while they migrate.
  if (!onSelectPage) {
    const label =
      labelVariant === 'page' ? (
        <p className='text-sm leading-5 text-tertiaryNeutral dark:text-tertiaryNeutralDark'>
          {t('Common.Page of', { current: currentPage, total: totalPages })}
        </p>
      ) : (
          <p className='text-sm text-gray-700 dark:text-gray-200'>
            {showingText} <span className='font-medium'>{firstRow}</span> -&nbsp;
            <span className='font-medium'>{lastRow}</span> {ofText}{' '}
            <span className='font-medium'>{totalItems}</span> {itemsName}
          </p>
      )

    const controls = (
      <>
        {bare ? label : <div className='hidden sm:block'>{label}</div>}
        <div
        className={classNames(
            'flex',
            bare ? 'items-center gap-4' : 'flex-1 justify-between sm:justify-end',
        )}
      >
          <Button
            type='button'
            variant='white'
            disabled={isPreviousDisabled}
            onClick={onPreviousPage}
            className='flex items-center'
          >
            <FontAwesomeIcon icon={faChevronLeft} className='mr-2 h-4 w-4' />
            <span>{previousPageText}</span>
          </Button>
          <Button
            type='button'
            variant='white'
            className={classNames('flex items-center', !bare && 'ml-3')}
            disabled={isNextDisabled}
            onClick={onNextPage}
          >
            <span>{nextPageText}</span>
            <FontAwesomeIcon icon={faChevronRight} className='ml-2 h-4 w-4' />
          </Button>
        </div>
      </>
    )

    if (bare) {
    return (
        <div className={classNames('flex items-center gap-4', className)} aria-label='Pagination'>
          {controls}
        </div>
      )
    }

    return (
      <nav
        className={classNames(
          'flex items-center justify-between border-t px-0 py-4 mb-8 border-gray-100 dark:border-gray-800',
          className,
        )}
        aria-label='Pagination'
      >
        {controls}
      </nav>
    )
  }

  const pageItems = getPageItems(currentPage, totalPages)

  const cellClass =
    'flex h-10 items-center justify-center border border-gray-300 bg-white px-4 leading-tight text-gray-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400'
  const cellHoverClass =
    'hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-900 dark:hover:text-white'
  const currentCellClass =
    'z-10 flex h-10 cursor-default items-center justify-center border border-gray-300 bg-gray-100 px-4 leading-tight text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-white'

  return (
    <nav
      className={classNames(
        'flex flex-col justify-between gap-4 border-t border-gray-200 px-0 py-4 mb-8 text-sm text-secondaryNeutral sm:flex-row sm:items-center bg-elevation0 dark:border-gray-800 dark:bg-elevation0Dark dark:text-secondaryNeutralDark',
        className,
      )}
      aria-label='Pagination'
    >
      {/* range info + page-size selector */}
      <div className='flex items-center gap-6'>
        <div>
          <span className='font-medium'>{firstRow}</span> -{' '}
          <span className='font-medium'>{lastRow}</span> {ofText}{' '}
          <span className='font-medium'>{totalItems}</span> {itemsName}
        </div>

        {onSelectPageSize && (
          <div className='flex items-center gap-2'>
            <label htmlFor='pagination-page-size'>{pageSizeLabel}</label>
            <select
              id='pagination-page-size'
              value={pageSize}
              disabled={isLoading}
              onChange={(e) => onSelectPageSize(Number(e.target.value))}
              className='rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-7 text-sm text-gray-700 focus:border-primaryLight focus:ring-primaryLight disabled:cursor-not-allowed dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-primaryDark dark:focus:ring-primaryDark'
            >
              {pageSizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* page selection */}
      <ul className='flex h-10 items-center -space-x-px text-base'>
        <li>
          <button
            type='button'
            disabled={isPreviousDisabled}
            aria-label={previousPageText || undefined}
            onClick={() => goToPage(currentPage - 1)}
            className='flex h-10 items-center justify-center rounded-s-lg border border-e-0 border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white'
          >
            <FontAwesomeIcon icon={faChevronLeft} className='h-3 w-3 shrink-0' aria-hidden='true' />
          </button>
        </li>
        {pageItems.map((item, index) =>
          item === 'ellipsis' ? (
            <li key={`ellipsis-${index}`}>
              <span className={classNames(cellClass, 'cursor-default')}>...</span>
            </li>
          ) : (
            <li key={item}>
              <button
                type='button'
                aria-current={item === currentPage ? 'page' : undefined}
                disabled={isLoading}
                onClick={() => goToPage(item)}
                className={classNames(
                  item === currentPage ? currentCellClass : cellClass,
                  item !== currentPage && cellHoverClass,
                  'disabled:cursor-not-allowed',
                )}
              >
                {item}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type='button'
            disabled={isNextDisabled}
            aria-label={nextPageText || undefined}
            onClick={() => goToPage(currentPage + 1)}
            className='flex h-10 items-center justify-center rounded-e-lg border border-gray-300 bg-white px-4 leading-tight text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-white'
          >
            <FontAwesomeIcon
              icon={faChevronRight}
              className='h-3 w-3 shrink-0'
              aria-hidden='true'
            />
          </button>
        </li>
      </ul>
    </nav>
  )
}
