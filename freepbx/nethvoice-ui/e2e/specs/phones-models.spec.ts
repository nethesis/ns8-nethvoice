//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, test } from '../fixtures/mockApi'
import { MODEL_VARIABLES, mockPhonesApi, TANCREDI, TANCREDI_MODELS } from './phones-data'

test.describe('physical phones: models', () => {
  test.beforeEach(({ signedIn }) => {
    void signedIn
  })

  test('lists used and custom models with their phones count', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/models')

    await expect(page.getByRole('row')).toHaveCount(4)
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toContainText('Default')
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toContainText('1')
    await expect(page.getByRole('row', { name: /Reception desk/ })).toContainText('Custom')
    await expect(page.getByRole('row', { name: /Reception desk/ })).toContainText('0')
    await expect(page.getByRole('row', { name: /Snom D785/ })).toHaveCount(0)

    await page.getByRole('textbox', { name: 'Filter models' }).fill('reception')
    await expect(page.getByRole('row')).toHaveCount(2)
  })

  test('shows the empty state when no model is in use', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi, { phones: [] })
    mockApi.on('GET', `${TANCREDI}/models`, {
      json: [{ name: 'yealink-T46', display_name: 'Yealink T46' }],
    })
    await page.goto('./phones/models')

    await expect(page.getByText('No models configured')).toBeVisible()
    await page.getByRole('button', { name: 'Go to Phones' }).click()
    await expect(page).toHaveURL(/\/phones\/phones$/)
  })

  test('reports a load error', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    mockApi.on('GET', `${TANCREDI}/models`, { status: 500, json: { title: 'Broken storage' } })
    await page.goto('./phones/models')

    await expect(page.getByText('Cannot load models')).toBeVisible()
    await expect(page.getByText(/Broken storage/)).toBeVisible()
  })

  test('adds a custom model copying the base model', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, (request) => {
        const name = request.path.split('/').pop() ?? ''
        return {
          json: {
            name,
            display_name: name.endsWith('Front_office') ? 'Front office' : 'Yealink T46',
            variables: MODEL_VARIABLES,
          },
        }
      })
      .on('POST', `${TANCREDI}/models`, (request) => {
        const body = request.body as { name: string; display_name: string }
        return { status: 201, json: { ...body, variables: MODEL_VARIABLES } }
      })
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Add model' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(drawer.getByText('Enter a name')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Reception desk')
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(drawer.getByText('A model with this name already exists')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Front office')
    await drawer.getByRole('combobox', { name: 'Base model' }).fill('T46')
    await page.getByRole('option', { name: /Yealink T46/ }).click()
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(page.getByText('Model added')).toBeVisible()
    expect(mockApi.callsTo('POST', `${TANCREDI}/models`)[0].body).toEqual({
      name: 'yealink-T46-Front_office',
      display_name: 'Front office',
      variables: MODEL_VARIABLES,
    })
    await expect(page.getByRole('heading', { name: 'Front office' })).toBeVisible()
    await expect(page).toHaveURL(/\/phones\/models\?model=yealink-T46-Front_office$/)
  })

  test('offers every Tancredi model as base model', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Add model' }).click()
    await page.getByRole('dialog').getByRole('combobox', { name: 'Base model' }).click()
    await expect(page.getByRole('option')).toHaveCount(TANCREDI_MODELS.length)
  })

  test('duplicates a model with a prefilled name', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, {
        json: { name: 'fanvil-X4U', display_name: 'Fanvil X4U', variables: MODEL_VARIABLES },
      })
      .on('POST', `${TANCREDI}/models`, (request) => ({ status: 201, json: request.body }))
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Open the menu of model Fanvil X4U' }).click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer.getByRole('textbox', { name: 'Name' })).toHaveValue('Fanvil X4U copy')
    await drawer.getByRole('button', { name: 'Duplicate' }).click()

    await expect(page.getByText('Model duplicated')).toBeVisible()
    expect(mockApi.callsTo('POST', `${TANCREDI}/models`)[0].body).toMatchObject({
      name: 'fanvil-X4U-Fanvil_X4U_copy',
      display_name: 'Fanvil X4U copy',
    })
  })

  test('resets a default model to the original settings', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, {
        json: {
          name: 'yealink-T46',
          display_name: 'Yealink T46',
          variables: { ...MODEL_VARIABLES, ringtone: '4', vlan_id_phone: '20' },
        },
      })
      .on('GET', `${TANCREDI}/models/:id/version/original`, {
        json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
      })
      .on('PATCH', `${TANCREDI}/models/:id`, { json: {} })
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Open the menu of model Yealink T46' }).click()
    await page.getByRole('menuitem', { name: 'Reset to original settings' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reset' }).click()

    await expect(page.getByText('Model reset')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`)[0].body).toEqual({
      variables: { ...MODEL_VARIABLES, vlan_id_phone: null },
    })
  })

  test('deletes an unused custom model and blocks a used one', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('DELETE', `${TANCREDI}/models/:id`, { status: 204 })
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Open the menu of model Reception desk' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByText('Model deleted')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${TANCREDI}/models/:id`)[0].path).toBe(
      `${TANCREDI}/models/fanvil-X4U-reception`,
    )
  })

  test('edits the settings of a model and saves only the changes', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, {
        json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
      })
      .on('PATCH', `${TANCREDI}/models/:id`, { json: {} })
    await page.goto('./phones/models')

    await page
      .getByRole('row', { name: /Yealink T46/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await expect(page.getByRole('heading', { name: 'Yealink T46' })).toBeVisible()
    await expect(page).toHaveURL(/\/phones\/models\?model=yealink-T46$/)
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()

    await page.getByRole('button', { name: 'Display and ringtone' }).click()
    await page.getByRole('combobox', { name: 'Ringtone' }).click()
    await page.getByRole('option', { name: '4', exact: true }).click()
    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByRole('textbox', { name: 'NTP server address' }).fill('ntp.example.com')
    await page.getByRole('button', { name: 'Soft keys' }).click()
    await page.getByRole('textbox', { name: 'Label of Soft key 1' }).fill('Calls')
    await expect(page.getByText('1 unsaved change')).toHaveCount(3)

    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Model saved')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`)[0]).toMatchObject({
      path: `${TANCREDI}/models/yealink-T46`,
      body: {
        variables: { ringtone: '4', ntp_server: 'ntp.example.com', softkey_label_1: 'Calls' },
      },
    })
  })

  test('opens a model from its address and goes back to the list', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, {
      json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    })
    await page.goto('./phones/models?model=yealink-T46')

    await expect(page.getByRole('heading', { name: 'Yealink T46' })).toBeVisible()
    await page.getByRole('button', { name: 'Models', exact: true }).first().click()
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toBeVisible()
    await expect(page).toHaveURL(/\/phones\/models$/)
  })

  test('tells when the model in the address does not exist', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, {
      status: 404,
      contentType: 'application/problem+json',
      json: { title: 'Resource not found' },
    })
    await page.goto('./phones/models?model=missing')

    await expect(page.getByText('Model not found')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Models', exact: true }).first().click()
    await expect(page).toHaveURL(/\/phones\/models$/)
  })

  test('asks before leaving a model with unsaved changes', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, {
      json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    })
    await page.goto('./phones/models')

    await page
      .getByRole('row', { name: /Yealink T46/ })
      .getByRole('button', { name: /Edit/ })
      .click()
    await page.getByRole('button', { name: 'Network' }).click()
    await page.getByRole('textbox', { name: 'Phone VLAN ID' }).fill('30')
    await page.getByRole('button', { name: 'Models', exact: true }).first().click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await modal.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByRole('textbox', { name: 'Phone VLAN ID' })).toHaveValue('30')

    await page.getByRole('button', { name: 'Models', exact: true }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`)).toHaveLength(0)
  })
})
