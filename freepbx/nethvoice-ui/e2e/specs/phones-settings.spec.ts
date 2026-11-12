//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { DEFAULTS, REST, TANCREDI } from './phones-data'

test.describe('physical phones: settings', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', `${TANCREDI}/defaults`, { json: DEFAULTS })
  })

  test('shows and saves the default phone configuration', async ({ page, mockApi }) => {
    mockApi.on('PATCH', `${TANCREDI}/defaults`, { status: 204 })
    await page.goto('./phones/settings')

    await expect(page.getByRole('combobox', { name: 'Phone language' })).toHaveValue('Italiano')
    await expect(page.getByRole('combobox', { name: 'Tone region' })).toHaveValue('Italy')
    await expect(page.getByRole('radio', { name: 'Every day' })).toBeChecked()

    await page.getByRole('combobox', { name: 'Phone language' }).click()
    await page.getByRole('option', { name: 'English' }).click()
    await page.getByText('Only at startup').click()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Default configuration saved')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/defaults`)[0].body).toEqual({
      language: 'en',
      tonezone: 'it',
      provisioning_freq: 'never',
    })
  })

  test('reveals the current passwords and changes the user password', async ({ page, mockApi }) => {
    mockApi.on('PATCH', `${TANCREDI}/defaults`, { status: 204 })
    await page.goto('./phones/settings')

    const userPassword = page.getByLabel('Current user password')
    await expect(userPassword).toHaveAttribute('type', 'password')
    await expect(userPassword).toHaveValue('invented-user')

    await page.getByRole('button', { name: 'Change user password' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByLabel('New password', { exact: true }).fill('Desk-phone-9')
    await drawer.getByLabel('Confirm password').fill('Desk-phone-9')
    await drawer.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByText('User password changed')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/defaults`)[0].body).toEqual({
      userpw: 'Desk-phone-9',
    })
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions/adminpw`)).toHaveLength(0)
  })

  test('shows a save error next to the form', async ({ page, mockApi }) => {
    mockApi.on('PATCH', `${TANCREDI}/defaults`, {
      status: 500,
      json: { title: 'Cannot write defaults' },
    })
    await page.goto('./phones/settings')

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Cannot save phone settings')).toBeVisible()
    await expect(page.getByText(/Cannot write defaults/)).toBeVisible()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    mockApi.on('GET', `${TANCREDI}/defaults`, { status: 500, json: { title: 'Down' } })
    await page.goto('./phones/settings')

    await expect(page.getByText('Cannot load phone settings')).toBeVisible()
    mockApi.on('GET', `${TANCREDI}/defaults`, { json: DEFAULTS })
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('combobox', { name: 'Tone region' })).toHaveValue('Italy')
  })

  test('signs out when Tancredi rejects the credentials', async ({ page, mockApi }) => {
    mockApi.on('GET', `${TANCREDI}/defaults`, {
      status: 403,
      contentType: 'application/problem+json',
      json: {
        type: 'https://nethesis.github.io/tancredi/problems#forbidden',
        title: 'Access to resource is forbidden with current client privileges',
      },
    })
    await page.goto('./phones/settings')

    await expect(page).toHaveURL(/\/nethvoice\/login/)
  })
})
