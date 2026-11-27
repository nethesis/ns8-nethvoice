//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, type MockApi, mockWizardState, test } from '../fixtures/mockApi'

const WIZARD_PATH = '/freepbx/rest/configuration/wizard'

const LANGUAGES = { it: { default: false }, en: { default: true } }

const failFirstReadAfterSave = (
  mockApi: MockApi,
  readPath: string,
  savePath: string,
  read: () => unknown,
) => {
  let saves = 0

  return mockApi.on('GET', readPath, () => {
    const current = mockApi.callsTo('POST', savePath).length

    if (current > saves) {
      saves = current
      return { status: 500, json: { message: 'busy' } }
    }
    return { json: read() }
  })
}

const failFirstWizardReadAfterSave = (mockApi: MockApi) =>
  failFirstReadAfterSave(mockApi, WIZARD_PATH, WIZARD_PATH, () => {
    const saved = mockApi.callsTo('POST', WIZARD_PATH).at(-1)
    return saved ? [saved.body] : []
  })

test.describe('setup wizard: welcome and system settings', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockWizardState(mockApi, null)
    mockApi
      .on('GET', '/freepbx/rest/settings/languages', { json: LANGUAGES })
      .on('GET', '/freepbx/rest/outboundroutes/supportedLocales', {
        json: ['it', 'en', 'de', 'es', 'fr'],
      })
      .on('GET', '/freepbx/rest/outboundroutes', { json: [] })
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

  test('welcome page starts the wizard when only reading the progress again fails', async ({
    page,
    mockApi,
  }) => {
    failFirstWizardReadAfterSave(mockApi)

    await page.goto('./setup')
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/system$/)
    await expect(page.getByText('Cannot save the setup progress')).toHaveCount(0)
  })

  test('welcome page links the documentation in a new tab', async ({ page }) => {
    await page.goto('./setup')

    const help = page.getByRole('link', { name: 'Need help? (opens in a new tab)' })
    await expect(help).toHaveAttribute('target', '_blank')
    await expect(help).toHaveAttribute('rel', /noopener/)
  })

  test('welcome page shows the titles in sentence case and Sign out under Need help', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./setup')

    const title = page.getByRole('heading', { level: 1 })
    await expect(title).toHaveCSS('font-size', '24px')
    const topic = page.getByRole('heading', { name: 'PBX settings', level: 2 })
    await expect(topic).toHaveCSS('font-size', '16px')
    await expect(topic).toHaveCSS('font-weight', '500')
    await expect(topic).toHaveCSS('text-transform', 'none')

    const sidebar = page.getByRole('complementary')
    const help = sidebar.getByRole('link', { name: 'Need help? (opens in a new tab)' })
    const signOut = sidebar.getByRole('button', { name: 'Sign out' })
    const helpBox = await help.boundingBox()
    const signOutBox = await signOut.boundingBox()
    expect(signOutBox!.y).toBeGreaterThan(helpBox!.y + helpBox!.height)
    expect(
      Math.abs(signOutBox!.x + signOutBox!.width / 2 - (helpBox!.x + helpBox!.width / 2)),
    ).toBeLessThanOrEqual(1)

    await expect(sidebar.locator('xpath=../..')).toHaveCSS('border-radius', '16px')
  })

  test('shows the step label under the current step of the progress bar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('./setup/system')

    const bar = await page.getByRole('progressbar', { name: 'Setup progress' }).boundingBox()
    const label = await page.getByText('Step 1/7', { exact: true }).boundingBox()
    expect(Math.abs(label!.x + label!.width / 2 - (bar!.x + bar!.width / 14))).toBeLessThanOrEqual(
      1,
    )
    expect(label!.y).toBeGreaterThan(bar!.y + bar!.height)
  })

  test('explains what the country and the language are used for', async ({ page }) => {
    await page.goto('./setup/system')

    await expect(page.getByRole('heading', { name: 'System settings', level: 1 })).toBeVisible()
    await expect(
      page.getByText(
        'Configure the core system settings of your PBX. These settings are used across the system.',
      ),
    ).toBeVisible()
    await expect(page.getByText('Used to generate the default outbound routes.')).toBeVisible()
    await expect(
      page.getByText('Language of the system prompts and automated voice messages.'),
    ).toBeVisible()
  })

  test('welcome page stays put and reports the error when the wizard cannot start', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/configuration/wizard', { status: 500 })

    await page.goto('./setup')
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page.getByRole('main').getByText('Cannot save the setup progress')).toBeVisible()
    await expect(page.getByTestId('toast-notifications')).not.toContainText('Cannot save')
    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
  })

  test('preselects the PBX language and the matching country', async ({ page }) => {
    await page.goto('./setup/system')

    await expect(page.getByRole('heading', { name: 'System settings' })).toBeVisible()
    await expect(page.getByText('Step 1/7')).toBeVisible()
    await expect(page.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
    await expect(page.getByRole('combobox', { name: 'PBX country' })).toHaveValue('United States')
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
  })

  test('preselects the country of the PBX time zone over the PBX language', async ({ page }) => {
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { TIMEZONE: 'Europe/Rome' } }),
    )

    await page.goto('./setup/system')

    await expect(page.getByRole('combobox', { name: 'PBX country' })).toHaveValue('Italy')
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('nethvoiceSetupCountry')))
      .toBe('it')
  })

  test('waits for the PBX time zone before preselecting the country', async ({ page }) => {
    let releaseConfig = () => {}
    const configHeld = new Promise<void>((resolve) => {
      releaseConfig = resolve
    })
    await page.route('**/nethvoice/config.json', async (route) => {
      await configHeld
      await route.fulfill({ json: { TIMEZONE: 'Europe/Rome' } })
    })
    const settingsLoaded = Promise.all([
      page.waitForResponse('**/freepbx/rest/settings/languages'),
      page.waitForResponse('**/freepbx/rest/outboundroutes/supportedLocales'),
      page.waitForResponse('**/freepbx/rest/outboundroutes'),
    ])

    await page.goto('./setup/system')
    await settingsLoaded
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
    releaseConfig()

    await expect(page.getByRole('combobox', { name: 'PBX country' })).toHaveValue('Italy')
  })

  test('keeps the country chosen before over the one of the PBX time zone', async ({ page }) => {
    await page.route('**/nethvoice/config.json', (route) =>
      route.fulfill({ json: { TIMEZONE: 'Europe/Rome' } }),
    )
    await page.addInitScript(() => localStorage.setItem('nethvoiceSetupCountry', 'de'))

    await page.goto('./setup/system')

    await expect(page.getByRole('combobox', { name: 'PBX country' })).toHaveValue('Germany')
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

  test('moves to the users step when only reading the saved data again fails', async ({
    page,
    mockApi,
  }) => {
    mockApi.allowUnmockedCalls()
    failFirstWizardReadAfterSave(mockApi)
    failFirstReadAfterSave(
      mockApi,
      '/freepbx/rest/settings/languages',
      '/freepbx/rest/settings/defaultlanguage',
      () => LANGUAGES,
    )

    await page.goto('./setup/system')
    await page.getByRole('combobox', { name: 'PBX language' }).click()
    await page.getByRole('option', { name: 'Italiano' }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    await expect(page.getByText('Cannot save the setup progress')).toHaveCount(0)
    expect(mockApi.callsTo('POST', WIZARD_PATH).at(-1)?.body).toEqual({ step: 1, status: 'true' })
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

    await expect(page.getByRole('main').getByText('Cannot save PBX language')).toBeVisible()
    await expect(page.getByTestId('toast-notifications')).not.toContainText('Cannot save')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/system$/)
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)
  })

  test('stays on the step and shows the error when saving the progress fails', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/configuration/wizard', { status: 500 })

    await page.goto('./setup/system')
    await page.getByRole('button', { name: 'Next' }).click()

    await expect(page.getByRole('main').getByText('Cannot save the setup progress')).toBeVisible()
    await expect(page.getByTestId('toast-notifications')).not.toContainText('Cannot save')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/system$/)
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  test('keeps the settings when reading them again fails', async ({ page, mockApi }) => {
    let failing = false
    mockApi.on('GET', '/freepbx/rest/settings/languages', () =>
      failing
        ? { status: 500, json: { message: 'db down' } }
        : { json: { it: { default: false }, en: { default: true } } },
    )

    await page.clock.install()
    await page.goto('./setup/system')
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')

    failing = true
    await page.clock.runFor(10_000)
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'))
      window.dispatchEvent(new Event('focus'))
    })

    await expect(page.getByText('Cannot retrieve system settings')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  test('shows a load error and blocks Next when settings cannot be read', async ({
    page,
    mockApi,
  }) => {
    let failing = true
    mockApi.on('GET', '/freepbx/rest/settings/languages', () =>
      failing
        ? { status: 500, json: { message: 'db down' } }
        : { json: { it: { default: false }, en: { default: true } } },
    )

    await page.goto('./setup/system')

    await expect(page.getByText('Cannot retrieve system settings')).toBeVisible()
    await expect(page.getByText('db down')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(page.getByRole('combobox', { name: 'PBX language' })).toHaveValue('English')
    await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  test('Previous saves the first step and goes back to the welcome page', async ({
    page,
    mockApi,
  }) => {
    await page.goto('./setup/system')
    await page.getByRole('button', { name: 'Previous' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
    await expect(page.getByRole('button', { name: 'Start setup' })).toBeVisible()
    expect(mockApi.callsTo('POST', WIZARD_PATH).map((call) => call.body)).toEqual([
      { step: 0, status: 'true' },
    ])
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

  test('does not pick a country when Tab leaves the emptied field', async ({ page, mockApi }) => {
    await page.goto('./setup/system')

    const country = page.getByRole('combobox', { name: 'PBX country' })
    await expect(country).toHaveValue('United States')
    await country.fill('')
    await country.press('Tab')

    await expect(country).toHaveValue('')
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Choose a country')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/configuration/wizard')).toHaveLength(0)
  })

  test('moves the focus to the title of the step', async ({ page }) => {
    await page.goto('./setup/system')

    await expect(page.getByRole('heading', { name: 'System settings', level: 1 })).toBeFocused()
    await expect(page.getByRole('progressbar', { name: 'Setup progress' })).toHaveAttribute(
      'aria-valuetext',
      'Step 1 of 7: System settings',
    )
  })

  test('shows the product name in the page title', async ({ page }) => {
    await page.goto('./setup')

    await expect(page).toHaveTitle('Welcome to NethVoice setup wizard - NethVoice')
  })
})
