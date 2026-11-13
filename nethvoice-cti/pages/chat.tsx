// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { NextPage } from 'next'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faBellSlash,
  faCircleUser,
  faEllipsisVertical,
  faLock,
  faMagnifyingGlass,
  faMessage,
  faPaperclip,
  faRightFromBracket,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { enGB, it } from 'date-fns/locale'
import i18next from 'i18next'
import { RootState, store } from '../store'
import { Avatar, Button, ConfirmationModal, Dropdown, TextInput } from '../components/common'
import { Table, type TableColumn } from '../components/common/Table'
import { newChat, openChatWith, useChatAllowed } from '../components/chat'
import { MissingPermission } from '../components/common/MissingPermissionsPage'
import type { ChatConversation } from '../models/chat'
import { Pagination } from '../components/common/Pagination'
import { openShowOperatorDrawer } from '../lib/operators'
import { faNewChat, groupInitials, groupLook, isQueue } from '../components/chat/icons'

type Hit = { peer: string; id: string; ts: number; body: string; nick?: string }

/** The searched text marked, as in the chat window; case does not matter. */
const mark = (text: string, q: string): ReactNode =>
  q.length < 2
    ? text
    : text
        .split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
        .map((p, i) =>
          i % 2 ? (
            <mark key={i} className='rounded-sm bg-yellow-400 text-gray-900'>
              {p}
            </mark>
          ) : (
            p
          ),
        )

/** The conversations: a row (or Open chat) opens the chat in the island, the menu the operator's (or the group's) drawer. */
const Chat: NextPage = () => {
  const { t } = useTranslation()
  const { conversations, status, ready } = useSelector((state: RootState) => state.chat)
  const operators = useSelector((state: RootState) => state.operators.operators) as any
  const avatars = useSelector((state: RootState) => state.operators.avatars) as any
  const [query, setQuery] = useState('')
  const allowed = useChatAllowed()
  const [toDelete, setToDelete] = useState<ChatConversation | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  // Messages found in the whole archive: the newest per conversation, and how many.
  const [found, setFound] = useState<Record<string, Hit & { count: number }>>({})
  // The query the archive has answered: until then an empty list is still loading, not empty.
  const [searched, setSearched] = useState('')
  const q = query.trim()

  useEffect(() => {
    setFound({})
    if (q.length < 2) return
    const onResults = (e: Event) => {
      const { query: asked, results } = (e as CustomEvent).detail as { query: string; results: Hit[] }
      if (asked !== q) return
      const byPeer: Record<string, Hit & { count: number }> = {}
      for (const h of results) byPeer[h.peer] = byPeer[h.peer] ? { ...byPeer[h.peer], count: byPeer[h.peer].count + 1 } : { ...h, count: 1 }
      setFound(byPeer)
      setSearched(q)
    }
    window.addEventListener('chat-island-search-results', onResults)
    const timer = window.setTimeout(() => window.dispatchEvent(new CustomEvent('chat-island-search', { detail: { query: q } })), 300)
    // No answer (the island offline): what matched here is all there is.
    const giveUp = window.setTimeout(() => setSearched(q), 5000)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(giveUp)
      window.removeEventListener('chat-island-search-results', onResults)
    }
  }, [q])

  const list = useMemo(() => {
    const lq = q.toLowerCase()
    return lq
      ? conversations.filter(
          (c) =>
            c.name.toLowerCase().includes(lq) ||
            c.peer.includes(lq) ||
            c.last?.body.toLowerCase().includes(lq) ||
            !!found[c.peer],
        )
      : conversations
  }, [conversations, q, found])
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))
  const current = Math.min(page, totalPages)
  const rows = list.slice((current - 1) * pageSize, current * pageSize)
  // Skeleton until groups and recent messages are in, instead of raw room ids.
  const loading = !ready && status !== 'error' && status !== 'unauthorized'

  const displayName = (username?: string) =>
    (username && operators?.[username]?.name) || username || ''
  const showDetails = (c: ChatConversation) =>
    c.kind === 'group'
      ? store.dispatch.sideDrawer.update({ isShown: true, contentType: 'showChatGroup', config: c })
      : operators?.[c.peer] && openShowOperatorDrawer(operators[c.peer])
  const openChat = (c: ChatConversation) =>
    openChatWith(c.peer, found[c.peer] && { query: q, id: found[c.peer].id })
  const locale = i18next?.languages?.[0] === 'it' ? it : enGB

  if (!allowed) return <MissingPermission />
  const columns: TableColumn[] = [
    {
      header: t('Chat.Conversation'),
      cell: (c: ChatConversation) => (
        <div className='flex items-center min-w-0'>
          <div className='relative h-10 w-10 flex-shrink-0'>
            {c.kind === 'group' && c.avatar ? (
              <Avatar src={c.avatar} size='base' />
            ) : c.kind === 'group' ? (
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-base font-normal dark:font-medium ${
                  groupLook(c.peer, c.name).className
                }`}
              >
                {groupInitials(c.name)}
              </span>
            ) : (
              <Avatar
                src={avatars?.[c.peer] ?? c.avatar}
                size='base'
                placeholderType='operator'
                status={operators?.[c.peer]?.mainPresence ?? 'offline'}
              />
            )}
          </div>
          <div className='ml-4 min-w-0'>
            <div className='flex items-center gap-2 min-w-0'>
              <span
                className={`truncate ${
                  c.unread
                    ? 'font-semibold text-gray-900 dark:text-gray-100'
                    : 'font-medium text-gray-900 dark:text-gray-100'
                }`}
              >
                {mark(c.name, q)}
              </span>
              {c.guests && (
                // Open to people outside the PBX: the island's badge, with a lock once its link is closed.
                <span className='shrink-0 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs leading-4 font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100'>
                  {c.locked && <FontAwesomeIcon icon={faLock} className='h-3 w-3' aria-hidden='true' />}
                  {t('Chat.External chat')}
                </span>
              )}
              {c.muted && (
                <FontAwesomeIcon
                  icon={faBellSlash}
                  className='h-3.5 w-3.5 shrink-0 text-indigo-700 dark:text-indigo-400'
                  title={t('Chat.Muted') || ''}
                />
              )}
            </div>
            <div className='text-sm text-gray-500 dark:text-gray-400 truncate'>
              {c.kind === 'group'
                ? `${c.members?.length ?? 0} ${t('Chat.members')}`
                : c.inactive
                ? t('Chat.No longer active')
                : `@${c.peer}`}
            </div>
          </div>
        </div>
      ),
    },
    {
      header: t('Chat.Last message'),
      cell: (c: ChatConversation) => (
        // the table grows with its content: a max width lets truncate cut a long message
        <div className='flex items-center gap-3 min-w-0 max-w-[14rem] sm:max-w-xs md:max-w-md lg:max-w-xl 2xl:max-w-3xl'>
          <span
            className={`truncate text-sm ${
              c.unread
                ? 'font-medium text-gray-900 dark:text-gray-100'
                : 'text-gray-700 dark:text-gray-200'
            }`}
          >
            {found[c.peer] ? (
              <>
                {found[c.peer].nick ? `${displayName(found[c.peer].nick)}: ` : ''}
                {mark(found[c.peer].body, q)}
              </>
            ) : c.last ? (
              <>
                {c.last.mine
                  ? `${t('Chat.You')}: `
                  : c.kind === 'group' && c.last.nick
                  ? `${displayName(c.last.nick)}: `
                  : ''}
                {c.last.oob ? (
                  <>
                    <FontAwesomeIcon icon={faPaperclip} className='h-3.5 w-3.5 mr-1' />
                    {t('Chat.Attachment')}
                  </>
                ) : (
                  mark(c.last.body, q)
                )}
              </>
            ) : (
              t('Chat.No messages')
            )}
          </span>
          {found[c.peer]?.count > 1 && (
            <span className='shrink-0 text-xs text-gray-500 dark:text-gray-400'>
              {t('Chat.{{count}} matches', { count: found[c.peer].count })}
            </span>
          )}
          {c.unread > 0 && (
            <span className='shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary dark:bg-primaryDark text-white dark:text-gray-950 text-xs font-medium flex items-center justify-center'>
              {c.unread}
            </span>
          )}
        </div>
      ),
    },
    {
      header: t('Chat.Date'),
      width: '16rem',
      // As the last calls: how long ago, then the date.
      cell: (c: ChatConversation) =>
        found[c.peer] || c.last ? (
          <span className='text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap'>
            {formatDistanceToNowStrict((found[c.peer] ?? c.last)!.ts, { addSuffix: true, locale })} (
            {format((found[c.peer] ?? c.last)!.ts, 'd MMM yyyy HH:mm', { locale })})
          </span>
        ) : (
          <span className='text-gray-500 dark:text-gray-400'>-</span>
        ),
    },
    {
      header: '',
      width: '13rem',
      className: 'text-right',
      // The menu is not the row: it does not open the chat.
      cell: (c: ChatConversation) => (
        <div className='flex items-center justify-end gap-2' onClick={(e) => e.stopPropagation()}>
          <Button
            variant='ghost'
            className='whitespace-nowrap text-primaryActive dark:text-primaryActiveDark'
            onClick={() => openChat(c)}
          >
            <FontAwesomeIcon icon={faMessage} className='h-4 w-4 mr-2' />
            {t('OperatorDrawer.Open chat')}
          </Button>
          <Dropdown
            items={
              // The items take no colour of their own: not the table cell's grey.
              <div className='text-gray-700 dark:text-gray-200'>
                <div
                  className={
                    c.peer.startsWith('cti-') ? '' : 'border-b border-gray-200 dark:border-gray-700'
                  }
                >
                  <Dropdown.Item
                    icon={c.muted ? faBell : faBellSlash}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('chat-island-mute', {
                          detail: { peer: c.peer, muted: !c.muted },
                        }),
                      )
                    }
                  >
                    {c.muted ? t('Chat.Unmute') : t('Chat.Mute')}
                  </Dropdown.Item>
                  {(c.kind === 'group' || operators?.[c.peer]) && (
                    <Dropdown.Item
                      icon={c.kind === 'group' ? groupLook(c.peer, c.name).icon : faCircleUser}
                      onClick={() => showDetails(c)}
                    >
                      {c.kind !== 'group'
                        ? t('OperatorDrawer.Operator details')
                        : isQueue(c.name)
                        ? t('Chat.Queue details')
                        : t('Chat.Group details')}
                    </Dropdown.Item>
                  )}
                </div>
                {/* A CTI group's chat follows the CTI: nothing to leave or delete here. */}
                {!c.peer.startsWith('cti-') && (
                  <Dropdown.Item
                    icon={c.kind === 'group' && !c.owner ? faRightFromBracket : faTrash}
                    isRed
                    onClick={() => setToDelete(c)}
                  >
                    {c.kind === 'group' && !c.owner ? t('Chat.Leave') : t('Chat.Delete')}
                  </Dropdown.Item>
                )}
              </div>
            }
            anchor='bottom end'
          >
            <Button variant='ghost' className='py-2 px-2 h-9 w-9'>
              <FontAwesomeIcon icon={faEllipsisVertical} className='h-4 w-4' />
              <span className='sr-only'>{t('Chat.Open menu')}</span>
            </Button>
          </Dropdown>
        </div>
      ),
    },
  ]

  return (
    <div>
      <ConfirmationModal
        show={!!toDelete}
        onClose={() => setToDelete(null)}
        title={toDelete?.kind === 'group' && !toDelete.owner ? t('Chat.Leave') : t('Chat.Delete')}
        description={
          toDelete?.kind === 'group'
            ? toDelete.owner
              ? t('Chat.Delete group confirm', { name: toDelete.name })
              : t('Chat.Leave confirm', { name: toDelete.name })
            : t('Chat.Delete confirm', { name: toDelete?.name ?? '' })
        }
        confirmLabel={
          toDelete?.kind === 'group' && !toDelete.owner ? t('Chat.Leave') : t('Common.Delete')
        }
        onConfirm={() => {
          if (toDelete)
            window.dispatchEvent(
              new CustomEvent('chat-island-delete', { detail: { username: toDelete.peer } }),
            )
          setToDelete(null)
        }}
      />
      <h1 className='text-2xl font-medium text-gray-900 dark:text-gray-100 mb-6'>
        {t('Chat.Conversations')}
      </h1>
      <div className='flex items-center justify-between gap-4 mb-6'>
        <div className='min-w-0 flex-1'>
          <TextInput
            placeholder={t('Chat.Search') || ''}
            className='max-w-xs'
            icon={faMagnifyingGlass}
            value={query}
            onChange={(e: any) => (setQuery(e.target.value), setPage(1))}
          />
        </div>
        <div className='flex shrink-0 items-center gap-3'>
          {status !== 'online' && (
            <span className='whitespace-nowrap text-sm text-gray-500 dark:text-gray-400'>
              {t('Chat.Offline')}
            </span>
          )}
          <Button
            variant='primary'
            className='whitespace-nowrap'
            onClick={newChat}
            disabled={status !== 'online'}
          >
            <FontAwesomeIcon icon={faNewChat} className='h-4 w-4 sm:mr-2' />
            <span className='sr-only sm:not-sr-only'>{t('Chat.New chat')}</span>
          </Button>
        </div>
      </div>
      <Table
        columns={columns}
        data={rows}
        onRowClick={openChat}
        isLoading={loading || (!list.length && q.length > 1 && searched !== q)}
        loadingRows={5}
        emptyState={{
          title: q ? t('Chat.No results') : t('Chat.No conversations'),
          description: (q ? t('Chat.No results description') : t('Chat.No conversations description')) || '',
          icon: (
            <FontAwesomeIcon
              icon={q ? faMagnifyingGlass : faMessage}
              className='mx-auto h-12 w-12'
              aria-hidden='true'
            />
          ),
        }}
        rowKey={(c: ChatConversation) => c.peer}
        trClassName='h-[68px]'
        scrollable={true}
        maxHeight='calc(100vh - 18rem)'
        footer={
          list.length > 0 && !loading ? (
            <Pagination
              currentPage={current}
              totalPages={totalPages}
              totalItems={list.length}
              pageSize={pageSize}
              onPreviousPage={() => setPage(Math.max(1, current - 1))}
              onNextPage={() => setPage(Math.min(totalPages, current + 1))}
              onSelectPage={setPage}
              onSelectPageSize={(size) => (setPageSize(size), setPage(1))}
              itemsName={t('Chat.conversations') || ''}
              className='!mb-0 !px-6'
            />
          ) : undefined
        }
      />
    </div>
  )
}

export default Chat
