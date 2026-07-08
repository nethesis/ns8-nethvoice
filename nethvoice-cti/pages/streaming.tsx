// Copyright (C) 2025 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useTranslation } from 'react-i18next'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faMagnifyingGlass,
  faVideoSlash,
  faSortAmountAsc,
  faCheck,
} from '@fortawesome/free-solid-svg-icons'
import { TextInput, Button, Dropdown } from '../components/common'
import Link from 'next/link'
import { EmptyState } from '../components/common/EmptyState'
import { InlineNotification } from '../components/common/InlineNotification'
import { useVideoSources } from '../hooks/useVideoSources'
import { VideoSourcesGrid } from '../components/streaming/VideoSourcesGrid'
import { VideoSourceSkeleton } from '../components/streaming/VideoSourceSkeleton'
import { ExpandedVideoView } from '../components/streaming/ExpandedVideoView'
import { Breadcrumb } from '../components/common/Breadcrumb'
import { CustomThemedTooltip } from '../components/common/CustomThemedTooltip'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { savePreference, loadPreference } from '../lib/storage'

const Streaming: NextPage = () => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { username } = useSelector((state: RootState) => state.authentication)

  const getSavedSortOrder = (): 'name_asc' | 'name_desc' => {
    const savedValue = loadPreference('streaming_sort_order', username)
    return savedValue === 'name_desc' ? 'name_desc' : 'name_asc'
  }

  const [sortOrder, setSortOrder] = useState<'name_asc' | 'name_desc'>(getSavedSortOrder())

  const {
    videoSources,
    isLoaded,
    error: streamingError,
    failedImages,
    handleImageError,
    handleUnlockSource,
    handleCallSource,
  } = useVideoSources()

  useEffect(() => {
    if (username) {
      savePreference('streaming_sort_order', sortOrder, username)
    }
  }, [sortOrder, username])

  // Sort function
  const sortSources = useCallback((order: 'name_asc' | 'name_desc') => {
    setSortOrder(order)
  }, [])

  // Filter and sort sources
  const filteredAndSortedSources = useMemo(() => {
    // First filter by search query
    let sources = videoSources.filter((source) =>
      source.description?.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    // Then sort by name
    return sources.sort((a, b) => {
      const nameA = a.description?.toLowerCase() || ''
      const nameB = b.description?.toLowerCase() || ''
      return sortOrder === 'name_asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
    })
  }, [videoSources, searchQuery, sortOrder])

  const expandedSource = expandedId ? videoSources.find((source) => source.id === expandedId) : null

  return (
    <>
      <div className='p-4'>
        <Breadcrumb
          previousLink={{
            path: '/applications',
            label: t('Applications.Applications'),
          }}
          currentPage={t('Applications.Video sources')}
        />

        <h1 className='text-2xl font-semibold mb-6 text-primaryNeutral dark:text-primaryNeutralDark'>
          {t('Applications.Video sources')}
        </h1>

        {/* Search field and sort button */}
        <div className='mb-8 flex items-center gap-2'>
          <TextInput
            placeholder={t('Streaming.Filter sources') || ''}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={faMagnifyingGlass}
            className='max-w-xs'
          />

          {/* Sort dropdown */}
          <Dropdown
            items={
              <>
                <Dropdown.Header>
                  <span>{t('Common.Sort by')}</span>
                </Dropdown.Header>
                <Dropdown.Item onClick={() => sortSources('name_asc')}>
                  <span>{t('Operators.Alphabetic A-Z')}</span>
                  {sortOrder === 'name_asc' && (
                    <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                  )}
                </Dropdown.Item>
                <Dropdown.Item onClick={() => sortSources('name_desc')}>
                  <span>{t('Operators.Alphabetic Z-A')}</span>
                  {sortOrder === 'name_desc' && (
                    <FontAwesomeIcon icon={faCheck} className='ml-auto text-emerald-700' />
                  )}
                </Dropdown.Item>
              </>
            }
            position='left'
          >
            <Button
              className='h-9 w-9'
              variant='white'
              data-tooltip-id='sort-sources-tooltip'
              data-tooltip-content={t('Common.Sort by') || ''}
            >
              <FontAwesomeIcon icon={faSortAmountAsc} className='h-4 w-4' />
            </Button>
          </Dropdown>
          <CustomThemedTooltip id='sort-sources-tooltip' place='bottom' />
        </div>

        {/* Error notification */}
        {streamingError && (
          <div className='mb-6'>
            <InlineNotification type='error' title={t('Common.Error')}>
              {streamingError}
            </InlineNotification>
          </div>
        )}

        {/* Video sources grid with skeleton, empty state, or content */}
        {!isLoaded ? (
          // Skeleton loading state
          <VideoSourceSkeleton />
        ) : videoSources.length === 0 ? (
          // Empty state
          <EmptyState
            title={t('Streaming.No video sources available')}
            description={t('Streaming.No video sources have been configured') || ''}
            icon={<FontAwesomeIcon icon={faVideoSlash} className='h-12 w-12' />}
          >
            <p className='text-sm text-gray-500 dark:text-gray-400'>
              {t('Streaming.Contact your administrator to configure video sources')}
            </p>
          </EmptyState>
        ) : (
          // Loaded content - using filtered and sorted sources
          <VideoSourcesGrid
            sources={filteredAndSortedSources}
            failedImages={failedImages}
            onImageError={handleImageError}
            onUnlockSource={handleUnlockSource}
            onCallSource={handleCallSource}
            onExpand={setExpandedId}
          />
        )}
      </div>

      {/* Overlay expanded */}
      {expandedSource && (
        <ExpandedVideoView
          source={expandedSource}
          hasFailedImage={failedImages[expandedSource.id]}
          onClose={() => setExpandedId(null)}
          onImageError={handleImageError}
          onUnlockSource={handleUnlockSource}
          onCallSource={handleCallSource}
        />
      )}
    </>
  )
}

export default Streaming
