import React, { ReactNode } from 'react'
import { Skeleton } from './Skeleton'
import { EmptyState } from './EmptyState'
import { Dropdown } from './Dropdown'
import classNames from 'classnames'
import { t } from 'i18next'
import { customScrollbarClass } from '../../lib/utils'

export interface TableColumn {
  header: ReactNode
  accessor?: string
  cell?: (data: any, rowIndex: number) => ReactNode
  width?: string
  className?: string
}

interface TableProps {
  columns: TableColumn[]
  data?: any[] | null
  isLoading?: boolean
  loadingRows?: number
  emptyState?: {
    title: string
    description?: string
    icon?: ReactNode
  }
  className?: string
  theadClassName?: string
  tbodyClassName?: string
  trClassName?: string
  thClassName?: string
  tdClassName?: string
  onRowClick?: (row: any) => void
  rowKey?: string | ((row: any, index: number) => string)
  containerClassName?: string
  maxHeight?: string | number
  scrollable?: boolean
  getRowClassName?: (row: any, index: number) => string
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  isLoading = false,
  loadingRows = 8,
  emptyState,
  className = '',
  theadClassName = 'sticky top-0 bg-gray-100 dark:bg-gray-800 z-[1]',
  tbodyClassName = 'bg-white dark:bg-gray-950 text-gray-700 text-sm',
  trClassName = 'border-t border-gray-300 dark:border-gray-600',
  thClassName = 'px-6 py-3.5 text-left text-sm font-semibold text-gray-700 dark:text-gray-100',
  tdClassName = 'px-6 py-4',
  onRowClick,
  rowKey,
  containerClassName = '',
  maxHeight = '32rem',
  scrollable = false,
  getRowClassName,
}) => {
  const tableClasses = classNames(
    'min-w-full divide-y divide-gray-300 dark:divide-gray-700',
    className,
  )

  const wrapperClasses = classNames(
    'overflow-hidden shadow ring-1 md:rounded-lg ring-opacity-5 dark:ring-opacity-5 ring-gray-900 dark:ring-gray-100 border-[1px] border-solid rounded-xl dark:border-gray-600',
    containerClassName,
  )

  const scrollableClasses = customScrollbarClass

  // Handle loading state
  if (isLoading) {
    return (
      <div className={wrapperClasses}>
        <div
          className={scrollable ? scrollableClasses : ''}
          style={scrollable && maxHeight ? { maxHeight } : {}}
        >
          <table className={tableClasses}>
            <thead className={theadClassName}>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={`th-${index}`}
                    className={column.className || thClassName}
                    style={column.width ? { width: column.width } : {}}
                  >
                    <Skeleton height='1.25rem' />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, rowIndex) => (
                <tr
                  key={`loading-row-${rowIndex}`}
                  className={`${trClassName} ${rowIndex === 0 ? '' : 'border-t border-gray-300 dark:border-gray-700'}`}
                  style={trClassName.includes('h-[') ? {} : { height: '84px' }}
                >
                  {columns.map((column, colIndex) => (
                    <td key={`td-${rowIndex}-${colIndex}`} className={tdClassName}>
                      <div className='space-y-1'>
                        <Skeleton height='18px' />
                        {column.width !== '5%' && <Skeleton width='75%' height='14px' />}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Handle empty state
  if (!data || data.length === 0) {
    return (
      <div className={wrapperClasses}>
        {emptyState ? (
          <EmptyState
            title={emptyState.title}
            description={emptyState.description || ''}
            icon={emptyState.icon}
          />
        ) : (
          <div className='py-8 text-center text-gray-500 dark:text-gray-400'>
            {t('Common.No data to show')}
          </div>
        )}
      </div>
    )
  }

  // Generate a key for each row
  const getRowKey = (row: any, index: number) => {
    if (typeof rowKey === 'function') {
      return rowKey(row, index)
    }

    if (rowKey && row[rowKey]) {
      return row[rowKey]
    }

    return `row-${index}`
  }

  // Render data
  return (
    <div className={wrapperClasses}>
      <div
        className={scrollable ? scrollableClasses : ''}
        style={scrollable && maxHeight ? { maxHeight } : {}}
      >
        <table className={tableClasses}>
          <thead className={theadClassName}>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={`th-${index}`}
                  className={column.className || thClassName}
                  style={column.width ? { width: column.width } : {}}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={tbodyClassName}>
            {data.map((row, rowIndex) => (
              <tr
                key={getRowKey(row, rowIndex)}
                data-row-key={getRowKey(row, rowIndex)}
                className={`${trClassName} ${
                  rowIndex === 0 ? '' : 'border-t border-gray-300 dark:border-gray-600'
                } ${onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900' : ''} ${
                  getRowClassName ? getRowClassName(row, rowIndex) : ''
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column, colIndex) => (
                  <td key={`td-${rowIndex}-${colIndex}`} className={tdClassName}>
                    {column.cell
                      ? column.cell(row, rowIndex)
                      : column.accessor
                      ? row[column.accessor]
                      : null}
                    {rowIndex !== 0 && colIndex === 0 ? (
                      <div className='absolute -top-[0.03rem] left-6 right-0 h-px bg-gray-300 dark:bg-gray-600' />
                    ) : null}
                    {rowIndex !== 0 && colIndex === columns.length - 1 ? (
                      <div className='absolute -top-[0.03rem] left-0 right-6 h-px bg-gray-300 dark:bg-gray-600' />
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
