//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockWizardState, test } from '../fixtures/mockApi'

test.describe('setup wizard: welcome and system settings', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, null)
    mockApi
      .on('GET', '/freepbx/rest/settings/languages', {
        json: { it: { default: false }, en: { default: true } },
      })
      .on('GET', '/freepbx/rest/outboundroutes/supportedLocales', {
        json: ['it', 'en', 'de', 'es', 'fr'],
      })
      .on('POST', '/freepbx/rest/settings/defaultlanguage', { status: 200 })
  })

  test('welcome page starts the wizard at the first step', async ({ page, mockApi }) => {
    await page.goto('./setup')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Welcome to NethVoice setup wizard',
    )
    for (const topic of [
      'PBX settings',
      'Extensions',
      'Physical and VoIP trunks',
      'Call routing',
    ]) {
      await expect(page.getByRole('heading', { name: topic, level: 2 })).toBeVisible()
    }

    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/system$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')[0].body).toEqual({
      step: 0,
      status: 'true',
    })
  })

  test('welcome page stays put and reports the error when the wizard cannot start', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/configuration/wizard', { status: 500 })

    await page.goto('./setup')
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page.getByText('Cannot save the setup progress').first()).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
  })

  test('preselects the PBX language and the matching country', async ({ page }) => {
    await page.goto('./setup/system')

    await expect(page.getByRole('heading', { name: 'System settings' })).toBeVisible()
    await expect(page.getByText('Step 1 of 7')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    await expect(page.getByRole('combobox', { name: 'PBX country' })).toHaveValue('United States')
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
  })

  test('saves a changed language, remembers the country and moves to the users step', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./setup/system')

    await page.getByRole('combobox', { name: 'PBX country' }).click()
    await page.getByRole('option', { name: 'Italy' }).click()
    await page.getByRole('combobox', { name: 'PBX language' }).click()
    await page.getByRole('option', { name: 'Italiano' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/settings/defaultlanguage')[0].body).toEqual({
      lang: 'it',
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard').at(-1)?.body).toEqual({
      step: 1,
      status: 'true',
    })
    expect(await page.evaluate(() => localStorage.getItem('nethvoiceSetupCountry'))).toBe('it')
  })

  test('does not write the language when it did not change', async ({ page, mockApi }) => {
    mockApi.allowUnmockedCalls()

    await page.goto('./setup/system')
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/settings/defaultlanguage')).toHaveLength(0)
  })

  test('stays on the step when saving the language fails', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/settings/defaultlanguage', { status: 500 })

    await page.goto('./setup/system')
    await page.getByRole('combobox', { name: 'PBX language' }).click()
    await page.getByRole('option', { name: 'Italiano' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('Cannot save PBX language').first()).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/setup\/system$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)
  })

  test('shows a load error and blocks Next when settings cannot be read', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', '/freepbx/rest/settings/languages', { status: 500 })

    await page.goto('./setup/system')

    await expect(page.getByText('Cannot load system settings')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  test('Previous goes back to the welcome page', async ({ page }) => {
    await page.goto('./setup/system')
    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
  })

  test('moves the focus to the first field that is not valid', async ({ page, mockApi }) => {
    await page.goto('./setup/system')

    const country = page.getByRole('combobox', { name: 'PBX country' })
    await expect(country).toHaveValue('United States')
    await country.fill('')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByText('Choose a country')).toBeVisible()
    await expect(country).toBeFocused()
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)
  })

  test('shows the product name in the page title', async ({ page }) => {
    await page.goto('./setup')

    await expect(page).toHaveTitle('Welcome to NethVoice setup wizard - NethVoice')
  })
})
