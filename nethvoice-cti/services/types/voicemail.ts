// Copyright (C) 2024 Nethesis S.r.l.
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface VoiceMailType {
    origtime?: string
    duration?: string
    id?: number
    dir?: string
    callerid?: string
    mailboxuser?: string
    type?: string
    caller_operator?: object
  }
