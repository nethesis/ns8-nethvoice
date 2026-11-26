//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test } from '../fixtures/mockApi'
import {
  BACKUP_TRUNK,
  FXS_GATEWAY,
  GATEWAY_TRUNK,
  ISDN_GATEWAY,
  mockTrunksApi,
  VOIP_TRUNK,
} from './trunks-data'

const island = (page: Page) => page.getByTestId('phone-island-stub')

const SECOND_ISDN_TRUNK = {
  ...GATEWAY_TRUNK,
  trunkid: 6,
  channelid: 'Patton_0b1cdd_isdn_1',
  name: 'Patton_0b1cdd_isdn_1',
  username: 'Patton_0b1cdd_isdn_1',
}

const openCallModal = async (page: Page, name: RegExp | string) => {
  await page.getByRole('button', { name: `Open the menu of ${name}` }).click()
  await page.getByRole('menuitem', { name: 'Call through this trunk' }).click()
  return page.getByRole('dialog', { name: 'Call through this trunk' })
}

test.describe('trunks: call through a trunk', () => {
  const pageErrors: string[] = []

  test.beforeEach(({ page }) => {
    pageErrors.length = 0
    page.on('pageerror', (error) => pageErrors.push(error.message))
  })

  test.afterEach(() => {
    expect(pageErrors).toEqual([])
  })

  test.beforeEach(async ({ signedIn }) => {
    void signedIn
  })

  test('calls a number from the administrator phone through a VoIP trunk', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')
    await expect(island(page)).toHaveCount(1)

    const dialog = await openCallModal(page, 'main_trunk')
    await expect(dialog.getByText('The call will be placed using trunk main_trunk.')).toBeVisible()
    const number = dialog.getByRole('textbox', { name: 'Phone number' })
    await expect(number).toBeFocused()
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await number.fill('+39 02 123-4567')
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()

    await expect(dialog).toHaveCount(0)
    await expect(island(page)).toHaveAttribute('data-calls', '***2*+39021234567')
    expect(mockApi.calls.filter((call) => call.method !== 'GET')).toEqual([])
  })

  test('checks the number before calling', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')
    await expect(island(page)).toHaveCount(1)

    const dialog = await openCallModal(page, 'main_trunk')
    const number = dialog.getByRole('textbox', { name: 'Phone number' })
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()
    await expect(dialog.getByText('Enter the phone number')).toBeVisible()
    await expect(number).toBeFocused()

    await number.fill('02*1234')
    await number.press('Enter')
    await expect(
      dialog.getByText(
        'Use only digits, optionally starting with +. Spaces, dots, dashes and brackets are removed',
      ),
    ).toBeVisible()

    await number.fill('1'.repeat(31))
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()
    await expect(dialog.getByText('The phone number can contain at most 30 digits')).toBeVisible()
    await expect(island(page)).not.toHaveAttribute('data-calls', /.+/)

    await number.fill('021234567')
    await number.press('Enter')
    await expect(dialog).toHaveCount(0)
    await expect(island(page)).toHaveAttribute('data-calls', '***2*021234567')
  })

  test('cannot call through a disabled trunk', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, { trunks: [VOIP_TRUNK, { ...BACKUP_TRUNK, disabled: 'on' }] })
    await page.goto('./trunks/voip')

    await page.getByRole('button', { name: 'Open the menu of backup_trunk' }).click()
    await expect(page.getByRole('menuitem', { name: 'Call through this trunk' })).toBeDisabled()
    await expect(page.getByTestId('trunk-call-disabled-3')).toHaveText(
      'Calls through this trunk are not available because it is disabled',
    )
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Open the menu of main_trunk' }).click()
    await expect(page.getByRole('menuitem', { name: 'Call through this trunk' })).toBeEnabled()
    await expect(page.getByTestId('trunk-call-disabled-2')).toHaveCount(0)
  })

  test('waits for the end of the current call of the administrator phone', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    let dialog = await openCallModal(page, 'main_trunk')
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill('021234567')
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()
    await expect(island(page)).toHaveAttribute('data-calls', '***2*021234567')

    dialog = await openCallModal(page, 'main_trunk')
    await expect(dialog.getByTestId('trunk-call-phone-notice')).toContainText(
      'The administrator phone is already in a call',
    )
    await expect(dialog.getByRole('button', { name: 'Call', exact: true })).toBeDisabled()

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('phone-island-call-end')))
    await expect(dialog.getByTestId('trunk-call-phone-notice')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Call', exact: true })).toBeEnabled()
  })

  test('explains that the administrator phone cannot connect', async ({ page, mockApi }) => {
    await page.addInitScript(() => Reflect.set(window, 'phoneIslandStubFailure', true))
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')

    const dialog = await openCallModal(page, 'main_trunk')
    await expect(dialog.getByTestId('trunk-call-phone-notice')).toContainText(
      'The phone cannot connect to the PBX and keeps trying',
    )
    await expect(dialog.getByRole('button', { name: 'Call', exact: true })).toBeDisabled()
  })

  test('chooses the line of a gateway with several trunks', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, {
      trunks: [VOIP_TRUNK, GATEWAY_TRUNK, SECOND_ISDN_TRUNK],
      gateways: [
        {
          ...ISDN_GATEWAY,
          trunks_isdn: [
            { name: 5, type: 'pmp' },
            { name: 6, type: 'pmp' },
          ],
        },
        FXS_GATEWAY,
      ],
    })
    await page.goto('./trunks/physical')
    await expect(island(page)).toHaveCount(1)

    const dialog = await openCallModal(page, 'Patton TRINITY ISDN 2 Porte')
    await expect(
      dialog.getByText('The call will be placed using trunk Patton TRINITY ISDN 2 Porte.'),
    ).toBeVisible()
    await expect(dialog.getByRole('radio', { name: 'ISDN port 0' })).toBeChecked()
    await dialog.getByText('ISDN port 1', { exact: true }).click()
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill('021234567')
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '***6*021234567')
  })

  test('offers only the enabled lines of a gateway', async ({ page, mockApi }) => {
    mockTrunksApi(mockApi, {
      trunks: [VOIP_TRUNK, { ...GATEWAY_TRUNK, disabled: 'on' }, SECOND_ISDN_TRUNK],
      gateways: [
        {
          ...ISDN_GATEWAY,
          trunks_isdn: [
            { name: 5, type: 'pmp' },
            { name: 6, type: 'pmp' },
          ],
        },
      ],
    })
    await page.goto('./trunks/physical')
    await expect(island(page)).toHaveCount(1)

    const dialog = await openCallModal(page, 'Patton TRINITY ISDN 2 Porte')
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill('021234567')
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '***6*021234567')
  })

  test('cannot call through a gateway with only FXS ports or only disabled lines', async ({
    page,
    mockApi,
  }) => {
    mockTrunksApi(mockApi, {
      trunks: [VOIP_TRUNK, { ...GATEWAY_TRUNK, disabled: 'on' }],
    })
    await page.goto('./trunks/physical')

    await page
      .getByRole('button', { name: 'Open the menu of Grandstream HT802 SIP 2 Porte FXS' })
      .click()
    await expect(page.getByRole('menuitem', { name: 'Call through this trunk' })).toBeDisabled()
    await expect(page.getByTestId('trunk-call-disabled-4')).toHaveText(
      'This gateway has only FXS ports, so there are no lines to call through',
    )
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Open the menu of Patton TRINITY ISDN 2 Porte' }).click()
    await expect(page.getByRole('menuitem', { name: 'Call through this trunk' })).toBeDisabled()
    await expect(page.getByTestId('trunk-call-disabled-3')).toHaveText(
      'Calls through this trunk are not available because it is disabled',
    )
  })

  test('lets an administrator with only the trunks section call through a trunk', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['trunks'], 'operator')
    mockTrunksApi(mockApi)
    await page.goto('./trunks/voip')
    await expect(island(page)).toHaveCount(1)

    const dialog = await openCallModal(page, 'main_trunk')
    await dialog.getByRole('textbox', { name: 'Phone number' }).fill('021234567')
    await dialog.getByRole('button', { name: 'Call', exact: true }).click()

    await expect(island(page)).toHaveAttribute('data-calls', '***2*021234567')
  })
})
