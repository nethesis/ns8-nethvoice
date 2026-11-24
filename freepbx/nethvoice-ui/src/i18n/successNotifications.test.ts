//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { describe, expect, it } from 'vitest'
import en from './en/translation.json'
import itMessages from './it/translation.json'

type Messages = { [key: string]: string | Messages }

const flatten = (messages: Messages, prefix = ''): [string, string][] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : flatten(value, `${prefix}${key}.`),
  )

const isObjectNotification = (key: string) => /_(created|updated|deleted)_description$/.test(key)

const english = flatten(en).filter(
  ([key, text]) => isObjectNotification(key) && /\{name\} has been/.test(text),
)
const keys = new Set(english.map(([key]) => key))
const italian = new Map(flatten(itMessages).filter(([key]) => keys.has(key)))

describe('object notifications', () => {
  it('name the object type before the name, without "successfully"', () => {
    const generic = english.filter(
      ([, text]) =>
        /successfully/.test(text) || !/^[A-Z][A-Za-z ]* \{name\} has been \w+\.$/.test(text),
    )

    expect(english.length).toBeGreaterThan(30)
    expect(generic).toEqual([])
  })

  it('agree in gender with the object type in Italian', () => {
    const wrong = [...italian].filter(([, text]) => {
      const feminine = /^La /.test(text)
      const masculine = /^(Il|L') /.test(text) || /^L'(utente|URL|amministratore) /.test(text)

      return (
        /correttamente/.test(text) ||
        (feminine && !/ è stata \w+a\.$/.test(text)) ||
        (masculine && !/ è stato \w+o\.$/.test(text)) ||
        (!feminine && !masculine)
      )
    })

    expect(italian.get('integrations.video.source_created_description')).toBe(
      'La sorgente video {name} è stata creata.',
    )
    expect(italian.get('groups.group_deleted_description')).toBe(
      'Il gruppo {name} è stato eliminato.',
    )
    expect(wrong).toEqual([])
  })
})
