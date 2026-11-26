//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test, type MockApi } from '../fixtures/mockApi'
import { MODEL_VARIABLES, mockPhonesApi, mockStoredModel, TANCREDI } from './phones-data'

const TEMPLATE =
  "{% import 'yealink.macros' as macros %}\naccount.1.label = {{ account_display_name_1 }}\n"

const CUSTOM_TEMPLATES = [{ name: 'reception.tmpl', size: 64, mtime: 1767225600 }]

const drawer = (page: Page) => page.getByRole('dialog')

const chooseFile = (page: Page, name: string, content: string | Buffer = TEMPLATE) =>
  drawer(page)
    .locator('input[type=file]')
    .setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(content) })

const mockImport = (mockApi: MockApi) =>
  mockApi.on('POST', `${TANCREDI}/templates`, (request) => {
    const body = request.body as { name: string; content: string }
    return { status: 201, json: { name: body.name, size: body.content.length, mtime: 1767225600 } }
  })

const signInAsPhonesAdministrator = async (page: Page, mockApi: MockApi) => {
  await page.addInitScript(() => {
    localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
  })
  mockPermissions(mockApi, ['phones'], 'operator')
}

test.describe('physical phones: custom templates', () => {
  test.beforeEach(({ signedIn }) => {
    void signedIn
  })

  test('the superadmin imports a template from the models', async ({ page, mockApi }) => {
    mockImport(mockPhonesApi(mockApi))
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Import template' }).click()
    await expect(drawer(page).getByRole('heading', { name: 'Import template' })).toBeVisible()
    await chooseFile(page, 'reception.tmpl')
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()

    await expect(page.getByText('Template imported')).toBeVisible()
    await expect(page.getByText('Template reception.tmpl has been imported.')).toBeVisible()
    await expect(drawer(page)).toHaveCount(0)
    expect(mockApi.callsTo('POST', `${TANCREDI}/templates`).map((call) => call.body)).toEqual([
      { name: 'reception.tmpl', content: TEMPLATE, replace: false },
    ])
  })

  test('refuses a file that is not a template before sending it', async ({ page, mockApi }) => {
    mockImport(mockPhonesApi(mockApi))
    await page.goto('./phones/models')
    await page.getByRole('button', { name: 'Import template' }).click()

    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()
    await expect(drawer(page).getByText('Select a template file')).toBeVisible()
    await expect(drawer(page).locator('input[type=file]')).toBeFocused()

    await chooseFile(page, '../reception.php')
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()
    await expect(
      drawer(page).getByText(
        'Select a .tmpl file whose name contains only letters, numbers, "-", "_" and "."',
      ),
    ).toBeVisible()

    await chooseFile(page, 'reception.tmpl', Buffer.from([0x61, 0xff, 0x00]))
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()
    await expect(drawer(page).getByText('The file is not UTF-8 text')).toBeVisible()
    await expect(drawer(page).locator('input[type=file]')).toBeFocused()

    expect(mockApi.callsTo('POST', `${TANCREDI}/templates`)).toEqual([])
  })

  test('shows where the template has a syntax error', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('POST', `${TANCREDI}/templates`, {
      status: 400,
      contentType: 'application/problem+json',
      json: {
        type: 'https://nethesis.github.io/tancredi/problems/#template-syntax-error',
        title: 'The template has a syntax error',
        detail: 'Unexpected "}".',
        line: 2,
      },
    })
    await page.goto('./phones/models')
    await page.getByRole('button', { name: 'Import template' }).click()
    await chooseFile(page, 'reception.tmpl', 'ok\n{{ x }\n')
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()

    await expect(
      drawer(page).getByText('Syntax error at line 2: Unexpected "}".', { exact: true }),
    ).toBeVisible()
    await expect(drawer(page).locator('input[type=file]')).toBeFocused()
    await expect(page.getByText('Template imported')).toHaveCount(0)
  })

  test('warns before replacing a template already imported', async ({ page, mockApi }) => {
    mockImport(mockPhonesApi(mockApi)).on('GET', `${TANCREDI}/templates`, {
      json: CUSTOM_TEMPLATES,
    })
    await page.goto('./phones/models')
    await page.getByRole('button', { name: 'Import template' }).click()
    await chooseFile(page, 'reception.tmpl')

    await expect(drawer(page).getByText('Template already imported')).toBeVisible()
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Template imported')).toBeVisible()
    expect(mockApi.callsTo('POST', `${TANCREDI}/templates`)[0].body).toMatchObject({
      name: 'reception.tmpl',
      replace: true,
    })
  })

  test('the superadmin imports a template from a model and selects it', async ({
    page,
    mockApi,
  }) => {
    mockStoredModel(mockImport(mockPhonesApi(mockApi)), {
      name: 'yealink-T46',
      display_name: 'Yealink T46',
      variables: MODEL_VARIABLES,
    })
    await page.goto('./phones/models?model=yealink-T46')
    await page.getByRole('button', { name: 'Preferences' }).click()

    await page.getByRole('button', { name: 'Import template' }).click()
    await chooseFile(page, 'reception.tmpl')
    await drawer(page).getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByText('Template imported')).toBeVisible()

    await expect(page.getByRole('combobox', { name: 'Provisioning template' })).toHaveValue(
      'reception.tmpl',
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Model saved')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`).map((call) => call.body)).toEqual([
      { variables: { tmpl_phone: 'reception.tmpl' } },
    ])
  })

  test('a phones administrator chooses a template but cannot import one', async ({
    page,
    mockApi,
  }) => {
    await signInAsPhonesAdministrator(page, mockApi)
    mockStoredModel(
      mockPhonesApi(mockApi).on('GET', `${TANCREDI}/templates`, { json: CUSTOM_TEMPLATES }),
      { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    ).on('GET', `${TANCREDI}/models/:id/version/original`, {
      json: { name: 'yealink-T46', variables: { tmpl_phone: 'yealink.tmpl' } },
    })
    await page.goto('./phones/models')
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import template' })).toHaveCount(0)

    await page.goto('./phones/models?model=yealink-T46')
    await page.getByRole('button', { name: 'Preferences' }).click()
    const field = page.getByRole('combobox', { name: 'Provisioning template' })
    await expect(field).toHaveValue('yealink.tmpl')
    await expect(page.getByRole('button', { name: 'Import template' })).toHaveCount(0)

    await field.click()
    await page.getByRole('option', { name: 'reception.tmpl' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Model saved')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`).map((call) => call.body)).toEqual([
      { variables: { tmpl_phone: 'reception.tmpl' } },
    ])
    expect(mockApi.callsTo('POST', `${TANCREDI}/templates`)).toEqual([])
  })

  test('offers the default template of a custom model back', async ({ page, mockApi }) => {
    mockStoredModel(
      mockPhonesApi(mockApi).on('GET', `${TANCREDI}/templates`, { json: CUSTOM_TEMPLATES }),
      {
        name: 'fanvil-X4U-reception',
        display_name: 'Reception desk',
        variables: { ...MODEL_VARIABLES, tmpl_phone: 'reception.tmpl' },
      },
    ).on('GET', `${TANCREDI}/models/:id/version/original`, (request) => ({
      json: {
        name: request.path.split('/')[5],
        variables: { tmpl_phone: request.path.includes('/fanvil-X4U/') ? 'fanvil-X5.tmpl' : '' },
      },
    }))
    await page.goto('./phones/models?model=fanvil-X4U-reception')
    await page.getByRole('button', { name: 'Preferences' }).click()

    const field = page.getByRole('combobox', { name: 'Provisioning template' })
    await expect(field).toHaveValue('reception.tmpl')
    await field.click()
    await page.getByRole('option', { name: 'fanvil-X5.tmpl (default)' }).click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Model saved')).toBeVisible()
    expect(mockApi.callsTo('GET', `${TANCREDI}/models/:id/version/original`)[0].path).toBe(
      `${TANCREDI}/models/fanvil-X4U/version/original`,
    )
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`).map((call) => call.body)).toEqual([
      { variables: { tmpl_phone: 'fanvil-X5.tmpl' } },
    ])
  })
})
