//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test } from '../fixtures/mockApi'

const PROFILES = [
  { id: 1, name: 'Base', macro_permissions: {} },
  { id: 2, name: 'Standard', macro_permissions: {} },
  { id: 3, name: 'Advanced', macro_permissions: {} },
  { id: 5, name: 'Reception', macro_permissions: {} },
]

const CRM = 'https://crm.example.com/contacts/search?phone=$CALLER_NUMBER&name=$CALLER_NAME'
const HELPDESK = 'https://helpdesk.example.com/tickets/new?caller=$CALLER_NUMBER&call=$UNIQUEID'

const URLS = [
  { id: 4, url: CRM, profiles: '2', only_queues: false, names: { '2': 'CRM contact' } },
  { id: 7, url: HELPDESK, profiles: '3', only_queues: true, names: { '3': 'Helpdesk ticket' } },
]

const DESCRIPTION =
  'A parameterized URL opens a web page with the data of the incoming call in NethVoice CTI.'

const cell = (text: string) => new RegExp(`${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

const grid = (page: Page) => page.getByRole('grid', { name: 'Parameterized URLs' })
const toasts = (page: Page) => page.getByTestId('toast-notifications')
const drawer = (page: Page) => page.getByRole('dialog')
const nameField = (page: Page) => drawer(page).getByRole('textbox', { name: 'Name' })
const urlField = (page: Page) => drawer(page).getByRole('textbox', { name: 'URL' })
const profileField = (page: Page) => drawer(page).getByRole('combobox', { name: 'Profile' })

test.describe('integrations: parameterized URLs', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi
      .on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES })
      .on('GET', '/freepbx/rest/cti/paramurls', { json: URLS })
  })

  test('lists one row per profile with name, URL, profile and calls', async ({ page }) => {
    await page.goto('./integrations/parameterized-urls')

    await expect(page.getByText(DESCRIPTION)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toBeEnabled()

    const rows = grid(page).getByRole('row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(0).getByRole('columnheader')).toHaveText([
      'Name',
      'URL',
      'Profile',
      'Calls',
      'Actions',
    ])
    await expect(rows.nth(1).getByRole('gridcell')).toHaveText([
      cell('CRM contact'),
      cell(CRM),
      cell('Standard'),
      cell('All calls'),
      /Edit/,
    ])
    await expect(rows.nth(2).getByRole('gridcell')).toHaveText([
      cell('Helpdesk ticket'),
      cell(HELPDESK),
      cell('Advanced'),
      cell('Queue calls only'),
      /Edit/,
    ])
    await expect(rows.nth(1).getByTestId('click-to-copy')).toHaveText(CRM)
    await expect(rows.nth(1).getByRole('button', { name: 'Edit CRM contact' })).toBeVisible()

    await rows.nth(1).getByRole('button', { name: 'Open the menu of CRM contact' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem')).toHaveText(['Duplicate', 'Delete'])
  })

  test('waits for the profiles before listing the URLs', async ({ page, mockApi }) => {
    let releaseProfiles = () => {}
    const profilesLoaded = new Promise<void>((resolve) => {
      releaseProfiles = resolve
    })

    mockApi.on('GET', '/freepbx/rest/cti/profiles', async () => {
      await profilesLoaded
      return { json: PROFILES }
    })
    await page.goto('./integrations/parameterized-urls')

    const table = grid(page)
    await expect(table.locator('.animate-pulse').first()).toBeVisible()
    await expect(table).not.toContainText('CRM contact')
    await expect(page.getByText(/#\d/)).toHaveCount(0)

    releaseProfiles()
    await expect(table.getByRole('row').nth(1)).toContainText('Standard')
  })

  test('splits a URL shared by several profiles into one row each', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/paramurls', {
      json: [
        {
          id: 4,
          url: CRM,
          profiles: '2,1',
          only_queues: '1',
          names: { '1': 'CRM base', '2': 'CRM standard' },
        },
      ],
    })

    await page.goto('./integrations/parameterized-urls')

    const rows = grid(page).getByRole('row')
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1).getByRole('gridcell')).toHaveText([
      cell('CRM base'),
      cell(CRM),
      cell('Base'),
      cell('Queue calls only'),
      /Edit/,
    ])
    await expect(rows.nth(2).getByRole('gridcell')).toHaveText([
      cell('CRM standard'),
      cell(CRM),
      cell('Standard'),
      cell('Queue calls only'),
      /Edit/,
    ])
  })

  test('filters the rows and clears the filter', async ({ page }) => {
    await page.goto('./integrations/parameterized-urls')
    const filter = page.getByRole('textbox', { name: 'Filter parameterized URLs' })
    const rows = grid(page).getByRole('row')

    await filter.fill('advanced')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('helpdesk.example.com')

    await filter.fill('crm cont')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(1)).toContainText('CRM contact')

    await filter.fill('queue calls')
    await expect(rows).toHaveCount(2)

    await filter.fill('nothing matches')
    await expect(page.getByText('No parameterized URLs found')).toBeVisible()
    await expect(page.getByText('Try different or fewer words.')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filter' }).click()
    await expect(filter).toHaveValue('')
    await expect(rows).toHaveCount(3)
  })

  test('shows the empty state with the only create button', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/paramurls', { json: [] })

    await page.goto('./integrations/parameterized-urls')

    await expect(page.getByText('No parameterized URLs configured')).toBeVisible()
    await expect(page.getByText(DESCRIPTION)).toHaveCount(1)
    await expect(page.getByRole('grid')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Filter parameterized URLs' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toHaveCount(1)

    await page.getByRole('button', { name: 'Create parameterized URL' }).click()
    await expect(
      drawer(page).getByRole('heading', { name: 'Create parameterized URL' }),
    ).toBeVisible()
  })

  test('shows the skeleton while loading', async ({ page, mockApi }) => {
    let release = () => {}
    const pending = new Promise<void>((resolve) => (release = resolve))

    mockApi.on('GET', '/freepbx/rest/cti/paramurls', async () => {
      await pending
      return { json: URLS }
    })

    await page.goto('./integrations/parameterized-urls')

    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toBeDisabled()
    await expect(grid(page)).toBeVisible()
    await expect(page.getByText(CRM)).toHaveCount(0)
    release()
    await expect(grid(page).getByRole('row')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toBeEnabled()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true

    mockApi.on('GET', '/freepbx/rest/cti/paramurls', () =>
      failing ? { status: 500 } : { json: URLS },
    )

    await page.goto('./integrations/parameterized-urls')
    await expect(page.getByText('Cannot retrieve the parameterized URLs')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()

    await expect(grid(page).getByRole('row')).toHaveCount(3)
  })

  test('validates each field, then creates a URL with its name and shows the toast', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('POST', '/freepbx/rest/cti/paramurl', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Create parameterized URL' }).click()

    await expect(
      drawer(page).getByRole('heading', { name: 'Create parameterized URL' }),
    ).toBeVisible()
    await expect(nameField(page)).toBeFocused()
    await expect(nameField(page)).toHaveAttribute('placeholder', 'e.g. CRM contact')
    await expect(urlField(page)).toHaveAttribute(
      'placeholder',
      'e.g. https://crm.example.com/search?phone=$CALLER_NUMBER',
    )
    await expect(
      drawer(page).getByText(
        'Add the call data with $CALLER_NUMBER, $CALLER_NAME, $CALLED, and $UNIQUEID.',
      ),
    ).toBeVisible()
    await expect(
      drawer(page).getByText(
        'Users with this profile open the URL in NethVoice CTI. Each profile can have one URL.',
      ),
    ).toBeVisible()
    await expect(drawer(page).getByText('Disabled', { exact: true })).toBeVisible()

    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer(page).getByText('Enter a name')).toBeVisible()
    await expect(drawer(page).getByText('Enter the URL')).toBeVisible()
    await expect(drawer(page).getByText('Select a profile')).toBeVisible()
    await expect(nameField(page)).toBeFocused()

    await nameField(page).fill('crm CONTACT')
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(
      drawer(page).getByText(
        'A parameterized URL with this name already exists. Enter another name.',
      ),
    ).toBeVisible()
    await expect(nameField(page)).toBeFocused()

    await nameField(page).fill('a'.repeat(51))
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer(page).getByText('Use at most 50 characters')).toBeVisible()

    await nameField(page).fill('Reception\tCRM')
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(
      drawer(page).getByText('Remove tabs, line breaks and other invisible characters'),
    ).toBeVisible()
    await nameField(page).fill(' Reception CRM ')
    await nameField(page).blur()
    await expect(nameField(page)).toHaveValue('Reception CRM')

    await urlField(page).fill('crm.example.com/reception?caller=$CALLER_NUMBER')
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(
      drawer(page).getByText('Enter a URL starting with http:// or https://, without spaces'),
    ).toBeVisible()

    await urlField(page).fill(`https://crm.example.com/${'a'.repeat(240)}`)
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer(page).getByText('Use at most 255 characters')).toBeVisible()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')).toHaveLength(0)

    await urlField(page).fill('https://crm.example.com/reception?caller=')
    await drawer(page).getByRole('button', { name: 'Insert placeholder $CALLER_NUMBER' }).click()
    await expect(urlField(page)).toHaveValue(
      'https://crm.example.com/reception?caller=$CALLER_NUMBER',
    )
    await expect(urlField(page)).toBeFocused()
    await urlField(page).evaluate((element) => {
      if (element instanceof HTMLInputElement) {
        element.setSelectionRange(0, 0)
      }
    })
    await drawer(page).getByRole('button', { name: 'Insert placeholder $CALLER_NAME' }).click()
    await expect(urlField(page)).toHaveValue(
      '$CALLER_NAMEhttps://crm.example.com/reception?caller=$CALLER_NUMBER',
    )
    await urlField(page).fill('https://crm.example.com/reception?caller=$CALLER_NUMBER')

    await profileField(page).click()
    await expect(page.getByRole('option')).toHaveText(['Base', 'Reception'])
    await page.getByRole('option', { name: 'Reception' }).click()

    await drawer(page).getByRole('button', { name: 'About Queue calls only' }).hover()
    await expect(page.getByText('Open the URL only for calls that ring in a queue')).toBeVisible()
    await drawer(page).getByText('Disabled', { exact: true }).click()
    await expect(drawer(page).getByText('Enabled', { exact: true })).toBeVisible()
    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')[0].body).toEqual({
      url: 'https://crm.example.com/reception?caller=$CALLER_NUMBER',
      profiles: [5],
      only_queues: true,
      names: { '5': 'Reception CRM' },
    })
    await expect(toasts(page).getByText('Parameterized URL created')).toBeVisible()
    await expect(
      toasts(page).getByText('Parameterized URL Reception CRM has been created.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toBeFocused()
  })

  test('duplicates a URL for another profile', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/paramurl/:id', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Open the menu of Helpdesk ticket' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()

    await expect(
      drawer(page).getByRole('heading', { name: 'Create parameterized URL' }),
    ).toBeVisible()
    await expect(nameField(page)).toHaveValue('Helpdesk ticket (copy)')
    await expect(nameField(page)).toBeFocused()
    await expect(urlField(page)).toHaveValue(HELPDESK)
    await expect(profileField(page)).toHaveValue('')
    await expect(drawer(page).getByText('Enabled', { exact: true })).toBeVisible()

    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer(page).getByText('Select a profile')).toBeVisible()

    await profileField(page).click()
    await expect(page.getByRole('option')).toHaveText(['Base', 'Reception'])
    await page.getByRole('option', { name: 'Base' }).click()

    await drawer(page).getByText('Enabled', { exact: true }).click()
    await expect(drawer(page).getByText('Other profiles use this URL')).toBeVisible()
    await expect(
      drawer(page).getByText('Queue calls only will also change for Advanced.'),
    ).toBeVisible()
    await drawer(page).getByText('Disabled', { exact: true }).click()
    await expect(drawer(page).getByText('Other profiles use this URL')).toHaveCount(0)

    await drawer(page).getByRole('button', { name: 'Create', exact: true }).click()

    await expect(drawer(page)).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/paramurl/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/paramurl/7')
    expect(put[0].body).toEqual({
      id: '7',
      url: HELPDESK,
      profiles: [1, 3],
      only_queues: true,
      names: { '1': 'Helpdesk ticket (copy)' },
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')).toHaveLength(0)
    await expect(toasts(page).getByText('Parameterized URL created')).toBeVisible()
    await expect(
      toasts(page).getByText('Parameterized URL Helpdesk ticket (copy) has been created.'),
    ).toBeVisible()
  })

  test('disables create and duplicate when every profile has a URL', async ({ page, mockApi }) => {
    mockApi.on('GET', '/freepbx/rest/cti/profiles', { json: PROFILES.slice(1, 3) })

    await page.goto('./integrations/parameterized-urls')

    await expect(page.getByRole('button', { name: 'Create parameterized URL' })).toBeDisabled()
    await page.getByTestId('create-url-disabled').hover()
    await expect(page.getByText('All profiles already have a parameterized URL')).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page.getByText('All profiles already have a parameterized URL')).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Filter parameterized URLs' }).focus()
    await page.keyboard.press('Shift+Tab')
    await expect(page.getByTestId('create-url-disabled')).toBeFocused()
    await expect(page.getByText('All profiles already have a parameterized URL')).toBeVisible()

    await page.getByRole('button', { name: 'Open the menu of CRM contact' }).click()
    await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Delete'])
  })

  test('edits a URL and keeps the drawer in sync with the row', async ({ page, mockApi }) => {
    mockApi
      .on('PUT', '/freepbx/rest/cti/paramurl/:id', { status: 200 })
      .on('POST', '/freepbx/rest/cti/paramurl/delete', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    const edit = page.getByRole('button', { name: 'Edit Helpdesk ticket' })
    await edit.click()

    await expect(
      drawer(page).getByRole('heading', { name: 'Edit parameterized URL' }),
    ).toBeVisible()
    await expect(nameField(page)).toHaveValue('Helpdesk ticket')
    await expect(nameField(page)).toBeFocused()
    await expect(urlField(page)).toHaveValue(HELPDESK)
    await expect(profileField(page)).toHaveValue('Advanced')
    await expect(drawer(page).getByText('Enabled', { exact: true })).toBeVisible()

    await profileField(page).click()
    await expect(page.getByRole('option')).toHaveText(['Advanced', 'Base', 'Reception'])
    await page.getByRole('option', { name: 'Reception' }).click()
    await urlField(page).fill('https://helpdesk.example.com/v2?caller=$CALLER_NUMBER')
    await nameField(page).fill('CRM contact')
    await drawer(page).getByRole('button', { name: 'Save' }).click()
    await expect(
      drawer(page).getByText(
        'A parameterized URL with this name already exists. Enter another name.',
      ),
    ).toBeVisible()
    expect(mockApi.callsTo('PUT', '/freepbx/rest/cti/paramurl/:id')).toHaveLength(0)
    await nameField(page).fill('Helpdesk v2')
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page)).toBeHidden()
    const put = mockApi.callsTo('PUT', '/freepbx/rest/cti/paramurl/:id')
    expect(put[0].path).toBe('/freepbx/rest/cti/paramurl/7')
    expect(put[0].body).toEqual({
      id: '7',
      url: 'https://helpdesk.example.com/v2?caller=$CALLER_NUMBER',
      profiles: [5],
      only_queues: true,
      names: { '5': 'Helpdesk v2' },
    })
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl/delete')[0].body).toEqual({
      url: HELPDESK,
      profiles: [3],
    })
    await expect(toasts(page).getByText('Parameterized URL updated')).toBeVisible()
    await expect(
      toasts(page).getByText('Parameterized URL Helpdesk v2 has been updated.'),
    ).toBeVisible()
    await expect(edit).toBeFocused()
  })

  test('shows a server error in the drawer and keeps it open', async ({ page, mockApi }) => {
    mockApi.on('PUT', '/freepbx/rest/cti/paramurl/:id', {
      status: 400,
      json: { status: 'Invalid CTI profile id' },
    })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Edit Helpdesk ticket' }).click()
    await drawer(page).getByRole('button', { name: 'Save' }).click()

    await expect(drawer(page).getByText('Cannot save the parameterized URL')).toBeVisible()
    await expect(drawer(page).getByText('Invalid CTI profile id')).toBeVisible()

    mockApi.on('PUT', '/freepbx/rest/cti/paramurl/:id', {
      status: 500,
      json: { status: 'SQLSTATE[23000] internal detail' },
    })
    await drawer(page).getByRole('button', { name: 'Save' }).click()
    await expect(drawer(page).getByText('Cannot save the parameterized URL')).toBeVisible()
    await expect(drawer(page).getByText('SQLSTATE[23000] internal detail')).toHaveCount(0)
  })

  test('asks before discarding the changes', async ({ page }) => {
    await page.goto('./integrations/parameterized-urls')
    const edit = page.getByRole('button', { name: 'Edit CRM contact' })

    await edit.click()
    await drawer(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(drawer(page)).toBeHidden()
    await expect(edit).toBeFocused()

    await edit.click()
    await urlField(page).fill('https://crm.example.com/changed')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(urlField(page)).toHaveValue('https://crm.example.com/changed')

    await drawer(page).getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(edit).toBeFocused()
  })

  test('deletes the URL of one profile', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/paramurl/delete', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    await page.getByRole('button', { name: 'Open the menu of CRM contact' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Delete parameterized URL' })).toBeVisible()
    await expect(modal).toContainText(
      "Parameterized URL CRM contact will be permanently deleted. Users with profile Standard won't be able to open it in NethVoice CTI anymore.",
    )
    await modal.getByRole('button', { name: 'Delete' }).click()

    await expect(modal).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl/delete')[0].body).toEqual({
      url: CRM,
      profiles: [2],
    })
    await expect(toasts(page).getByText('Parameterized URL deleted')).toBeVisible()
    await expect(
      toasts(page).getByText('Parameterized URL CRM contact has been deleted.'),
    ).toBeVisible()
  })

  test('works with the keyboard only', async ({ page, mockApi }) => {
    mockApi.on('POST', '/freepbx/rest/cti/paramurl', { status: 200 })

    await page.goto('./integrations/parameterized-urls')
    const create = page.getByRole('button', { name: 'Create parameterized URL' })

    await create.focus()
    await page.keyboard.press('Enter')
    await expect(nameField(page)).toBeFocused()
    await page.keyboard.type('ERP call')
    await page.keyboard.press('Tab')
    await expect(urlField(page)).toBeFocused()
    await page.keyboard.type('https://erp.example.com/?from=$CALLER_NUMBER')

    await profileField(page).focus()
    await page.keyboard.type('Rece')
    await expect(page.getByRole('option')).toHaveText(['Reception'])
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('option', { name: 'Reception' })).toHaveAttribute(
      'data-headlessui-state',
      /active/,
    )
    await page.keyboard.press('Enter')
    await expect(profileField(page)).toHaveValue('Reception')
    await page.keyboard.press('Enter')

    await expect(drawer(page)).toBeHidden()
    expect(mockApi.callsTo('POST', '/freepbx/rest/cti/paramurl')[0].body).toEqual({
      url: 'https://erp.example.com/?from=$CALLER_NUMBER',
      profiles: [5],
      only_queues: false,
      names: { '5': 'ERP call' },
    })
    await expect(create).toBeFocused()
  })

  test('shows the rows as cards on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./integrations/parameterized-urls')

    const firstRow = grid(page).getByRole('row').nth(0)
    await expect(firstRow).toContainText('Name')
    await expect(firstRow).toContainText('CRM contact')
    await expect(firstRow).toContainText('Profile')
    await expect(firstRow).toContainText('Standard')
    await expect(firstRow.getByTestId('click-to-copy')).toHaveText(CRM)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(390)
  })

  test('uses the tertiary text token in dark and light theme', async ({ page }) => {
    await page.goto('./integrations/parameterized-urls')
    const description = page.getByText(DESCRIPTION)

    await expect(page.locator('html')).toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.707 0.022 261.325)')

    await page.getByRole('button', { name: 'Open account menu' }).click()
    await page.getByRole('menuitem', { name: 'Switch to light theme' }).click()
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
    await expect(description).toHaveCSS('color', 'oklch(0.446 0.03 256.802)')
  })

  test('works for an administrator with only the Integrations section', async ({
    page,
    mockApi,
  }) => {
    mockPermissions(mockApi, ['integrations'], 'integrator')

    await page.goto('./integrations/parameterized-urls')

    await expect(grid(page).getByRole('row')).toHaveCount(3)
    await page.getByRole('button', { name: 'Edit CRM contact' }).click()
    await expect(nameField(page)).toHaveValue('CRM contact')
    await expect(urlField(page)).toHaveValue(CRM)
  })
})
