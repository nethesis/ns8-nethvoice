import React from 'react'
import classNames from 'classnames'

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'avatar'
  width?: string | number
  height?: string | number
  className?: string
  count?: number
  gap?: number | string
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className,
  count = 1,
  gap = 0,
}) => {
  const baseClasses = 'animate-pulse bg-gray-300 dark:bg-gray-600'

  const getSkeletonClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full'
      case 'avatar':
        return 'rounded-full h-12 w-12'
      case 'rectangular':
        return 'rounded'
      case 'text':
      default:
        return 'h-4 rounded'
    }
  }

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height && variant !== 'avatar') style.height = height

  const skeletonClasses = classNames(baseClasses, getSkeletonClasses(), className)

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className={skeletonClasses} style={style} />
        ))}
      </div>
    )
  }

  return <div className={skeletonClasses} style={style} />
}

export const CallSkeleton: React.FC = () => {
  return (
    <div className='flex justify-between gap-3'>
      <div className='flex shrink-0 h-min items-center min-w-[48px]'>
        <div className='h-2 w-2 flex'>
          <span className='h-2 w-2'></span>
        </div>
        <Skeleton variant='avatar' />
      </div>
      <div className='flex flex-col gap-1.5 min-w-0 flex-1'>
        <Skeleton width='75%' />
        <Skeleton width='50%' />
        <Skeleton width='25%' />
        <Skeleton width='25%' />
      </div>
    </div>
  )
}

interface TableSkeletonProps {
  columns?: number
  rows?: number
  headerHeight?: number | string
  rowHeight?: number | string
  className?: string
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  columns = 7,
  rows = 8,
  headerHeight = '1.25rem',
  rowHeight = '4rem',
  className = '',
}) => {
  return (
    <table className={`min-w-full divide-y divide-gray-300 dark:divide-gray-700 bg-white dark:bg-gray-950 overflow-hidden rounded-lg ${className}`}>
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, index) => (
            <th key={`th-${index}`} className='px-6 py-3.5'>
              <Skeleton height={headerHeight} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <tr
            key={`tr-${rowIndex}`}
            className='border-t border-gray-300 dark:border-gray-700'
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <td key={`td-${rowIndex}-${colIndex}`} className='px-6 py-4'>
                <div className='space-y-2'>
                  <Skeleton />
                  <Skeleton width='75%' />
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
