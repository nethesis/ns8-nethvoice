// Copyright (C) 2026 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faUserGroup, faUsers } from '@fortawesome/free-solid-svg-icons'

export const faNewChat = {
  prefix: 'fas',
  iconName: 'new-chat',
  icon: [
    512,
    512,
    [],
    '',
    'M0 352L0 128C0 75 43 32 96 32l320 0c53 0 96 43 96 96l0 224c0 53-43 96-96 96l-120 0c-5.2 0-10.2 1.7-14.4 4.8L166.4 539.2c-4.2 3.1-9.2 4.8-14.4 4.8-13.3 0-24-10.7-24-24l0-72-32 0c-53 0-96-43-96-96zM232 152v64h-64v48h64v64h48v-64h64v-48h-64v-64z',
  ],
} as unknown as IconDefinition

const QUEUE_PREFIX = 'Queue - '
export const isQueue = (name: string) => name.startsWith(QUEUE_PREFIX)

/** A group's look, as in the island: CTI operator groups (cti-…) blue like their badge, queue chats indigo with the Queues icon, the ones people create gray. */
export const groupLook = (peer: string, name: string) => ({
  icon: name.startsWith(QUEUE_PREFIX) ? faUsers : faUserGroup,
  className: peer.startsWith('cti-')
    ? 'bg-surfaceBadgeBlueNethLink text-textBadgeBlueNethLink dark:bg-surfaceBadgeBlueNethLinkDark dark:text-textBadgeBlueNethLinkDark'
    : name.startsWith(QUEUE_PREFIX)
      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100'
      : 'bg-gray-700 text-white dark:bg-gray-200 dark:text-gray-950',
})

/** Two letters for a group, as the island's chat heads: a one-word name's first two, else the first two words' initials. */
export const groupInitials = (name: string) => {
  const words = (name.startsWith(QUEUE_PREFIX) ? name.slice(QUEUE_PREFIX.length) : name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
  if (!words.length) return 'G'
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}
