//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, mockWizardState, test } from '../fixtures/mockApi'

const WIZARD = '/freepbx/rest/configuration/wizard'

test.describe('setup wizard: navigation guard', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockApi.allowUnmockedCalls()
  })

  test('keeps a completed wizard away from the setup pages', async ({ page, mockApi }) => {
    for (const path of ['./setup', './setup/system', './setup/summary']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    }

    await expect(page.getByRole('button', { name: 'Start setup' })).toHaveCount(0)
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
    expect(mockApi.callsTo('GET', WIZARD)).toHaveLength(3)
  })

  test('reads the wizard state once while navigating inside the app', async ({ page, mockApi }) => {
    await page.goto('./dashboard')
    await expect(page.getByRole('link', { name: 'Users' }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Users' }).first().click()
    await expect(page).toHaveURL(/\/nethvoice\/users/)

    expect(mockApi.callsTo('GET', WIZARD)).toHaveLength(1)
  })

  test('sends the app pages to the saved step while the wizard is in progress', async ({
    page,
    mockApi,
  }) => {
    mockWizardState(mockApi, 3)

    for (const path of ['./dashboard', './settings', './users/users']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/nethvoice\/setup\/voip-trunks$/)
    }
    await expect(page.getByRole('heading', { name: 'VoIP trunks', level: 1 })).toBeVisible()
  })

  test('does not skip ahead of the saved step but allows the previous ones', async ({
    page,
    mockApi,
  }) => {
    mockWizardState(mockApi, 3)

    await page.goto('./setup/outbound-routes')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/voip-trunks$/)

    await page.goto('./setup/summary')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/voip-trunks$/)

    await page.goto('./setup/users')
    await expect(page).toHaveURL(/\/nethvoice\/setup\/users$/)
    await expect(page.getByText('Step 2 of 7')).toBeVisible()
  })

  test('resumes from the saved step when the welcome page is opened again', async ({
    page,
    mockApi,
  }) => {
    mockWizardState(mockApi, 3)

    await page.goto('./setup')
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/setup\/voip-trunks$/)
    await expect(page.getByRole('heading', { name: 'VoIP trunks', level: 1 })).toBeFocused()
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
  })

  test('signs out from the setup', async ({ page, mockApi }) => {
    mockWizardState(mockApi, 3)

    await page.goto('./setup/voip-trunks')
    await page.getByRole('button', { name: 'Sign out' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/login$/)
    expect(mockApi.callsTo('GET', '/freepbx/rest/logout')).toHaveLength(1)
    expect(await page.evaluate(() => localStorage.getItem('secretkey'))).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('nethvoiceSetupCountry'))).toBe('')
  })

  test('keeps help and sign out reachable on a narrow screen', async ({ page, mockApi }) => {
    mockWizardState(mockApi, 3)
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('./setup/voip-trunks')

    await expect(page.getByRole('link', { name: 'Need help?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })

  test('reports an unknown setup status and never restarts the wizard', async ({
    page,
    mockApi,
  }) => {
    let failing = true
    mockApi.on('GET', WIZARD, () =>
      failing
        ? { status: 500, json: { message: 'db down' } }
        : { json: [{ step: 13, status: 'false' }] },
    )

    await page.goto('./setup')

    const error = page.getByTestId('setup-state-error')
    await expect(error).toContainText('Cannot check the setup status')
    await expect(page.getByRole('button', { name: 'Start setup' })).toHaveCount(0)

    failing = false
    await error.getByRole('button', { name: 'Retry' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
  })

  test('does not restart a wizard completed in another session from the welcome page', async ({
    page,
    mockApi,
  }) => {
    mockWizardState(mockApi, null)

    await page.goto('./setup')
    await expect(page.getByRole('button', { name: 'Start setup' })).toBeVisible()
    mockApi.on('GET', WIZARD, { json: [{ step: 13, status: 'false' }] })
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
    await expect(page.getByText('Setup already completed')).toBeVisible()
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
  })

  test('does not post from the welcome page when the status cannot be read', async ({
    page,
    mockApi,
  }) => {
    mockWizardState(mockApi, null)

    await page.goto('./setup')
    await expect(page.getByRole('button', { name: 'Start setup' })).toBeVisible()
    mockApi.on('GET', WIZARD, { status: 500, json: { message: 'db down' } })
    await page.getByRole('button', { name: 'Start setup' }).click()

    await expect(page.getByText('Cannot check the setup status').first()).toBeVisible()
    await expect(page).toHaveURL(/\/nethvoice\/setup$/)
    expect(mockApi.callsTo('POST', WIZARD)).toHaveLength(0)
  })

  test('opens the app from the pending page once the setup is completed', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['dashboard'], 'operator')
    mockWizardState(mockApi, 3)

    await page.goto('./dashboard')
    await expect(page).toHaveURL(/\/nethvoice\/setup-pending$/)

    await page.getByRole('button', { name: 'Check again' }).click()
    await expect(page).toHaveURL(/\/nethvoice\/setup-pending$/)

    mockApi.on('GET', WIZARD, { json: [{ step: 13, status: 'false' }] })
    await page.getByRole('button', { name: 'Check again' }).click()

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
  })

  test('checks the setup again by itself on the pending page', async ({ page, mockApi }) => {
    await page.clock.install()
    mockPermissions(mockApi, ['dashboard'], 'operator')
    mockWizardState(mockApi, 3)

    await page.goto('./dashboard')
    await expect(page).toHaveURL(/\/nethvoice\/setup-pending$/)

    mockApi.on('GET', WIZARD, { json: [{ step: 13, status: 'false' }] })
    await page.clock.runFor(30_000)

    await expect(page).toHaveURL(/\/nethvoice\/dashboard$/)
  })
})
