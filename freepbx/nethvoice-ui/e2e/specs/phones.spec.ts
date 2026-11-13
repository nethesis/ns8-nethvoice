//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import {
  ASSIGNED_MAC,
  DEFAULTS,
  mockPhonesApi,
  REST,
  TANCREDI,
  TANCREDI_MODELS,
  UNASSIGNED_MAC,
} from './phones-data'

const PHONE_EXISTS = {
  status: 409,
  contentType: 'application/problem+json',
  json: {
    type: 'https://nethesis.github.io/tancredi/problems/#phone-exists',
    title: 'The phone mac address is already registered',
  },
}

test.describe('physical phones: inventory', () => {
  test.beforeEach(({ signedIn }) => {
    void signedIn
  })

  test('copies the MAC address with a click', async ({ page, context, mockApi }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')

    const mac = page.getByRole('button', { name: '00:15:65:AB:CD:01', exact: true })
    await mac.hover()
    await expect(page.getByRole('tooltip', { name: 'Click to copy' })).toBeVisible()

    await mac.click()
    await expect(page.getByRole('tooltip', { name: 'Copied!' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('00:15:65:AB:CD:01')
    await expect(page.getByRole('button', { name: /^Copy/ })).toHaveCount(0)
  })

  test('lists phones with model, user and encryption', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')

    const assigned = page.getByRole('row', { name: /00:15:65:AB:CD:01/ })
    await expect(assigned).toContainText('Yealink T46')
    await expect(assigned).toContainText('Anna Miller')
    await expect(assigned).toContainText('a.miller · 91300')
    await expect(assigned).toContainText('Not encrypted')
    await expect(assigned).toContainText('Registered')
    await expect(assigned).toContainText('192.0.2.10 · Yealink SIP-T46U 108.86.0.45')

    const unassigned = page.getByRole('row', { name: /0C:38:3E:00:00:02/ })
    await expect(unassigned).toContainText('Fanvil X4U')
    await expect(unassigned).toContainText('Unassigned')
    expect(await page.content()).not.toContain('invented-sip-secret')
  })

  test('filters phones by text and user', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')
    await expect(page.getByRole('row')).toHaveCount(3)

    await page.getByRole('textbox', { name: 'Filter phones' }).fill('miller')
    await expect(page.getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('row', { name: /Anna Miller/ })).toBeVisible()

    await page.getByRole('textbox', { name: 'Filter phones' }).fill('nothing-matches')
    await expect(page.getByText('No phones found')).toBeVisible()
    await page.getByRole('button', { name: 'Reset filters' }).last().click()
    await expect(page.getByRole('row')).toHaveCount(3)

    await page.getByRole('button', { name: 'Open filter Status' }).click()
    await page.getByRole('checkbox', { name: 'Registered', exact: true }).check()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('row', { name: /00:15:65:AB:CD:01/ })).toBeVisible()
  })

  test('disables adding and editing phones when the defaults cannot be loaded', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/defaults`, { status: 500, json: { title: 'x' } })
    await page.goto('./phones/phones')

    await expect(page.getByText('Cannot load the default settings of the phones')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add phones' })).toBeDisabled()
    await expect(
      page.getByRole('row', { name: /00:15:65:AB:CD:01/ }).getByRole('button', { name: /Edit/ }),
    ).toBeDisabled()
  })

  test('shows the empty state and changes the admin password of the phones', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi, { phones: [] })
      .on('PATCH', `${TANCREDI}/defaults`, { status: 204 })
      .on('POST', `${REST}/physicalextensions/adminpw`, { status: 200 })
    await page.goto('./phones/phones')

    await expect(page.getByText('No phones configured')).toBeVisible()
    await expect(page.getByText('A default admin password is currently in use.')).toBeVisible()
    await page.getByRole('button', { name: 'Change admin password' }).click()

    const drawer = page.getByRole('dialog')
    await expect(drawer.getByText('Changes will apply after the next provisioning.')).toBeVisible()
    await drawer.getByLabel('New password', { exact: true }).fill('weak')
    await drawer.getByLabel('Confirm password').fill('weak')
    await drawer.getByRole('button', { name: 'Change password' }).click()
    await expect(drawer.getByText('The password does not meet the requirements')).toBeVisible()

    await drawer.getByLabel('New password', { exact: true }).fill('Phones-2026!')
    await drawer.getByLabel('Confirm password').fill('Phones-2026?')
    await drawer.getByRole('button', { name: 'Change password' }).click()
    await expect(drawer.getByText('Passwords do not match')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/defaults`)).toHaveLength(0)

    await drawer.getByLabel('Confirm password').fill('Phones-2026!')
    await drawer.getByRole('button', { name: 'Change password' }).click()

    await expect(page.getByText('Admin password changed')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/defaults`)[0].body).toEqual({
      adminpw: 'Phones-2026!',
    })
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions/adminpw`)[0].body).toEqual({
      password: 'Phones-2026!',
    })
  })

  test('hides the admin password action when a custom password is in use', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi, { phones: [] }).on('GET', `${TANCREDI}/defaults`, {
      json: { ...DEFAULTS, adminpw: 'Custom-2026!' },
    })
    await page.goto('./phones/phones')

    await expect(page.getByText('No phones configured')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add phones' })).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Change admin password' })).toHaveCount(0)
  })

  test('restores the previous admin password when the PBX update fails', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi, { phones: [] })
      .on('PATCH', `${TANCREDI}/defaults`, { status: 204 })
      .on('POST', `${REST}/physicalextensions/adminpw`, { status: 500, json: {} })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Change admin password' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByLabel('New password', { exact: true }).fill('Phones-2026!')
    await drawer.getByLabel('Confirm password').fill('Phones-2026!')
    await drawer.getByRole('button', { name: 'Change password' }).click()

    await expect(drawer.getByText('Cannot change password')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/defaults`).map((call) => call.body)).toEqual([
      { adminpw: 'Phones-2026!' },
      { adminpw: 'invented-admin' },
    ])
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi, { phonesStatus: 500, phones: { title: 'Internal error' } })
    await page.goto('./phones/phones')

    await expect(page.getByText('Cannot load phones')).toBeVisible()
    mockPhonesApi(mockApi)
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByRole('row', { name: /00:15:65:AB:CD:01/ })).toBeVisible()
  })

  test('adds phones in two steps and assigns one to a user', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('POST', `${TANCREDI}/phones`, (request) => ({
        status: 201,
        json: { mac: (request.body as { mac: string }).mac },
      }))
      .on('GET', `${TANCREDI}/phones/:mac`, (request) => ({
        json: {
          mac: request.path.split('/').pop(),
          provisioning_url1: 'https://pbx.example.com/provisioning/first/phone.cfg',
          provisioning_url2: 'https://pbx.example.com/provisioning/token/phone.cfg',
        },
      }))
      .on('POST', `${REST}/physicalextensions`, (request) => ({
        json: (request.body as { mainextension?: string }).mainextension
          ? { extension: '91301' }
          : undefined,
      }))
      .on('POST', `${REST}/phones/rps/:mac`, { status: 200 })
      .on('POST', `${REST}/extensions/:extension/srtp/:enabled`, { status: 200 })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Next' }).click()
    await expect(modal.getByText('Enter at least one MAC address')).toBeVisible()

    await modal
      .getByRole('textbox', { name: 'MAC addresses' })
      .fill('00:15:65:ab:cd:01\n001565ABCD02\n0c-38-3e-00-00-09')
    await modal.getByRole('button', { name: 'Next' }).click()

    await expect(modal.getByText('3 phones to configure')).toBeVisible()
    await expect(modal.getByText('A phone with this MAC address already exists')).toBeVisible()
    await modal.getByRole('button', { name: 'Remove 00:15:65:AB:CD:01' }).click()
    await expect(modal.getByText('2 phones to configure')).toBeVisible()

    await modal.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(modal.getByText('Choose a model')).toHaveCount(2)

    const firstRow = modal.getByTestId('phone-row-0')
    await firstRow.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: 'Yealink T54' }).click()
    await firstRow.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: /John Smith/ }).click()

    const secondRow = modal.getByTestId('phone-row-1')
    await secondRow.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: 'Fanvil X4U', exact: true }).click()

    await modal.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.getByText('Phones added')).toBeVisible()
    await expect(modal).toHaveCount(0)

    expect(mockApi.callsTo('POST', `${TANCREDI}/phones`).map((call) => call.body)).toEqual([
      { mac: '00-15-65-AB-CD-02', model: 'yealink-T54', display_name: 'Yealink' },
      { mac: '0C-38-3E-00-00-09', model: 'fanvil-X4U', display_name: 'Fanvil' },
    ])
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions`).map((call) => call.body)).toEqual([
      {
        mac: '00-15-65-AB-CD-02',
        model: 'yealink-T54',
        line: null,
        web_user: 'admin',
        web_password: 'invented-admin',
      },
      {
        mac: '00-15-65-AB-CD-02',
        model: 'yealink-T54',
        mainextension: '301',
        clear_temporary: true,
        line: null,
        web_user: 'admin',
        web_password: 'invented-admin',
      },
      {
        mac: '0C-38-3E-00-00-09',
        model: 'fanvil-X4U',
        line: null,
        web_user: 'admin',
        web_password: 'invented-admin',
      },
    ])
    expect(mockApi.callsTo('POST', `${REST}/phones/rps/:mac`)[0]).toMatchObject({
      path: `${REST}/phones/rps/00-15-65-AB-CD-02`,
      body: { url: 'https://pbx.example.com/provisioning/first/phone.cfg' },
    })
    expect(mockApi.callsTo('POST', `${REST}/extensions/:extension/srtp/:enabled`)[0].path).toBe(
      `${REST}/extensions/91301/srtp/true`,
    )
  })

  test('validates the MAC addresses before the second step', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    const macs = modal.getByRole('textbox', { name: 'MAC addresses' })
    await macs.fill('FF:FF:FF:FF:FF:FF\n0011.2233.4455\nxyz')
    await modal.getByRole('button', { name: 'Next' }).click()
    await expect(modal.getByText('Invalid MAC addresses: FF:FF:FF:FF:FF:FF, xyz')).toBeVisible()

    await macs.fill('0011.2233.4455\n00 11 22 33 44 56')
    await modal.getByRole('button', { name: 'Next' }).click()
    await expect(modal.getByText('2 phones to configure')).toBeVisible()
    await expect(modal.getByTestId('phone-row-0').getByRole('textbox')).toHaveValue(
      '00:11:22:33:44:55',
    )
    await expect(modal.getByTestId('phone-row-1').getByRole('textbox')).toHaveValue(
      '00:11:22:33:44:56',
    )
  })

  test('counts a phone added without its user and does not add it again', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi)
      .on('POST', `${TANCREDI}/phones`, (request) => ({
        status: 201,
        json: { mac: (request.body as { mac: string }).mac },
      }))
      .on('GET', `${TANCREDI}/phones/:mac`, { json: { mac: 'x', provisioning_url1: '' } })
      .on('POST', `${REST}/physicalextensions`, (request) =>
        (request.body as { mainextension?: string }).mainextension
          ? { status: 500, json: { status: "There aren't available extension numbers" } }
          : { json: undefined },
      )
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('textbox', { name: 'MAC addresses' }).fill('00:15:65:00:00:07')
    await modal.getByRole('button', { name: 'Next' }).click()
    const row = modal.getByTestId('phone-row-0')
    await row.getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: 'Yealink T54' }).click()
    await row.getByRole('combobox').nth(1).click()
    await page.getByRole('option', { name: /John Smith/ }).click()
    await modal.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText('Phone added', { exact: true })).toBeVisible()
    await expect(page.getByText('Phone not assigned', { exact: true })).toBeVisible()
    await expect(modal).toHaveCount(0)
    expect(mockApi.callsTo('POST', `${TANCREDI}/phones`)).toHaveLength(1)
  })

  test('keeps the modal open while phones are being added', async ({ page, mockApi }) => {
    let release: () => void = () => undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    mockPhonesApi(mockApi)
      .on('POST', `${TANCREDI}/phones`, async (request) => {
        await pending
        return { status: 201, json: { mac: (request.body as { mac: string }).mac } }
      })
      .on('GET', `${TANCREDI}/phones/:mac`, { json: { mac: 'x', provisioning_url1: '' } })
      .on('POST', `${REST}/physicalextensions`, { json: undefined })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('textbox', { name: 'MAC addresses' }).fill('00:15:65:00:00:08')
    await modal.getByRole('button', { name: 'Next' }).click()
    await modal.getByTestId('phone-row-0').getByRole('combobox').nth(0).click()
    await page.getByRole('option', { name: 'Yealink T54' }).click()
    await modal.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(modal.getByText('Adding phone 1 of 1…')).toBeVisible()
    await page.keyboard.press('Escape')
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(modal.getByText('Adding phone 1 of 1…')).toBeVisible()
    release()
    await expect(page.getByText('Phone added', { exact: true })).toBeVisible()
    await expect(modal).toHaveCount(0)
  })

  test('keeps the option menus of the last phone inside the modal', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    await modal
      .getByRole('textbox', { name: 'MAC addresses' })
      .fill('00:11:22:33:44:55\n00:11:22:33:44:56')
    await modal.getByRole('button', { name: 'Next' }).click()

    const lastRow = modal.getByTestId('phone-row-1')
    await lastRow.getByRole('combobox').nth(0).click()
    const listbox = page.getByRole('listbox')
    await expect(listbox.getByRole('option')).toHaveCount(TANCREDI_MODELS.length)

    const clipped = await listbox.evaluate((element) => {
      const bottom = element.getBoundingClientRect().bottom
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (
          getComputedStyle(parent).overflow !== 'visible' &&
          parent.getBoundingClientRect().bottom < bottom
        ) {
          return true
        }
      }
      return false
    })
    expect(clipped).toBe(false)

    await page.getByRole('option', { name: 'Snom D785' }).click()
    await expect(lastRow.getByRole('combobox').nth(0)).toHaveValue('Snom D785')
  })

  test('shows a duplicate MAC reported by Tancredi on its row', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('POST', `${TANCREDI}/phones`, PHONE_EXISTS)
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Add phones' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('textbox', { name: 'MAC addresses' }).fill('E0:E6:56:00:00:07')
    await modal.getByRole('button', { name: 'Next' }).click()
    await modal.getByRole('combobox', { name: 'Model', exact: true }).click()
    await page.getByRole('option', { name: 'Snom D785' }).click()
    await modal.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(modal.getByText('A phone with this MAC address already exists')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/physicalextensions`)).toHaveLength(0)
  })

  test('edits model, user and encryption of a phone', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('PATCH', `${TANCREDI}/phones/:mac`, { json: {} })
      .on('PATCH', `${REST}/physicalextensions/:mac`, { status: 200 })
      .on('POST', `${REST}/extensions/:extension/srtp/:enabled`, { status: 200 })
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /00:15:65:AB:CD:01/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('textbox', { name: 'MAC address' })).toHaveValue(
      '00:15:65:AB:CD:01',
    )
    await drawer.getByRole('combobox', { name: 'Model' }).click()
    await page.getByRole('option', { name: 'Yealink T54' }).click()
    await expect(drawer.getByRole('checkbox')).not.toBeChecked()
    await drawer.getByText('Disabled', { exact: true }).click()
    await expect(drawer.getByRole('checkbox')).toBeChecked()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Phone updated')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/phones/:mac`)[0]).toMatchObject({
      path: `${TANCREDI}/phones/${ASSIGNED_MAC}`,
      body: { model: 'yealink-T54' },
    })
    expect(mockApi.callsTo('PATCH', `${REST}/physicalextensions/:mac`)[0]).toMatchObject({
      path: `${REST}/physicalextensions/${ASSIGNED_MAC}`,
      body: { model: 'yealink-T54' },
    })
    expect(mockApi.callsTo('POST', `${REST}/extensions/:extension/srtp/:enabled`)[0].path).toBe(
      `${REST}/extensions/91300/srtp/true`,
    )
  })

  test('asks before discarding the changes to a phone', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /00:15:65:AB:CD:01/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const heading = page.getByRole('heading', { name: 'Edit phone' })
    await page.getByRole('combobox', { name: 'Model' }).click()
    await page.getByRole('option', { name: 'Yealink T54' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByRole('combobox', { name: 'Model' })).toHaveValue('Yealink T54')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(heading).toBeHidden()
  })

  test('removes the user of a phone by deleting its extension', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('DELETE', `${REST}/physicalextensions/:id`, { status: 200 })
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /00:15:65:AB:CD:01/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: /^User/ }).fill('')
    await drawer.getByRole('combobox', { name: /^User/ }).press('Escape')
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Phone updated')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${REST}/physicalextensions/:id`)[0].path).toBe(
      `${REST}/physicalextensions/91300`,
    )
  })

  test('assigns the new user before removing the previous extension', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('POST', `${REST}/physicalextensions`, { json: { extension: '91301' } })
      .on('POST', `${REST}/extensions/:extension/srtp/:enabled`, { status: 200 })
      .on('DELETE', `${REST}/physicalextensions/:id`, { status: 200 })
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /00:15:65:AB:CD:01/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: /^User/ }).click()
    await page.getByRole('option', { name: /John Smith/ }).click()
    await expect(
      drawer.getByText('User: Anna Miller (a.miller) → John Smith (j.smith).'),
    ).toBeVisible()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Phone updated')).toBeVisible()
    const writes = mockApi.calls
      .filter((call) => call.method !== 'GET')
      .map((call) => `${call.method} ${call.path}`)
    expect(writes).toEqual([
      `POST ${REST}/physicalextensions`,
      `POST ${REST}/extensions/91301/srtp/false`,
      `DELETE ${REST}/physicalextensions/91300`,
    ])
  })

  test('keeps the previous user when the new assignment fails', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('POST', `${REST}/physicalextensions`, {
      status: 500,
      json: { status: "There aren't available extension numbers" },
    })
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /00:15:65:AB:CD:01/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('combobox', { name: /^User/ }).click()
    await page.getByRole('option', { name: /John Smith/ }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save phone')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${REST}/physicalextensions/:id`)).toHaveLength(0)
  })

  test('shows the error of a failed save inside the drawer', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('PATCH', `${TANCREDI}/phones/:mac`, {
      status: 500,
      json: { title: 'Storage failure' },
    })
    await page.goto('./phones/phones')

    await page
      .getByRole('row', { name: /0C:38:3E:00:00:02/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('checkbox')).toBeDisabled()
    await drawer.getByRole('combobox', { name: 'Model' }).click()
    await page.getByRole('option', { name: 'Reception desk' }).click()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save phone')).toBeVisible()
    await expect(drawer.getByText(/Storage failure/)).toBeVisible()
  })

  test('deletes a phone from Tancredi and from the PBX', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('DELETE', `${TANCREDI}/phones/:mac`, { status: 204 })
      .on('DELETE', `${REST}/physicalextensions/:id`, { status: 200 })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Open the menu of phone 0C:38:3E:00:00:02' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toContainText('0C:38:3E:00:00:02')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Phone deleted')).toBeVisible()
    expect(
      mockApi.calls.filter((call) => call.method === 'DELETE').map((call) => call.path),
    ).toEqual([
      `${REST}/physicalextensions/${UNASSIGNED_MAC}`,
      `${TANCREDI}/phones/${UNASSIGNED_MAC}`,
    ])
  })

  test('keeps the phone in Tancredi when the PBX deletion fails', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('DELETE', `${REST}/physicalextensions/:id`, {
      status: 500,
      json: {},
    })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Open the menu of phone 0C:38:3E:00:00:02' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal.getByText('Cannot delete phone')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${TANCREDI}/phones/:mac`)).toHaveLength(0)
  })

  test('runs provisioning on the assigned phones', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('POST', `${REST}/phones/reconfigure`, { status: 200 })
    await page.goto('./phones/phones')
    await expect(page.getByRole('row')).toHaveCount(3)

    await page.getByRole('button', { name: 'Actions' }).click()
    await page.getByRole('menuitem', { name: 'Run provisioning' }).click()

    await expect(page.getByText('Configuration is being applied to 1 phone')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/phones/reconfigure`).map((call) => call.body)).toEqual([
      { extension: '91300' },
    ])
  })

  test('copies the provisioning URL of a phone', async ({ page, mockApi, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/phones/:mac`, {
      json: {
        mac: UNASSIGNED_MAC,
        provisioning_url1: null,
        provisioning_url2: 'https://pbx.example.com/provisioning/token/0c383e000002.cfg',
      },
    })
    await page.goto('./phones/phones')

    await page.getByRole('button', { name: 'Open the menu of phone 0C:38:3E:00:00:02' }).click()
    await page.getByRole('menuitem', { name: 'Copy provisioning URL' }).click()

    await expect(page.getByText('Provisioning URL copied')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'https://pbx.example.com/provisioning/token/0c383e000002.cfg',
    )
  })
})
