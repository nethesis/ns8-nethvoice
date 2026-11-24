//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, test } from '../fixtures/mockApi'
import {
  MODEL_VARIABLES,
  mockPhonesApi,
  mockStoredModel,
  TANCREDI,
  TANCREDI_MODELS,
} from './phones-data'

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
    await expect(
      page.getByText('The server could not complete the request (error 500). Try again later.'),
    ).toBeVisible()
    await expect(page.getByText(/Broken storage/)).toHaveCount(0)
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
        return { status: 201, json: { name: body.name, variables: MODEL_VARIABLES } }
      })
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Create model' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer.getByText('Enter a name')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Reception desk')
    await drawer.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(drawer.getByText('A model with this name already exists')).toBeVisible()

    await drawer.getByRole('textbox', { name: 'Name' }).fill('Front office')
    await drawer.getByRole('combobox', { name: 'Base model' }).fill('T46')
    await page.getByRole('option', { name: /Yealink T46/ }).click()
    await drawer.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Model created')).toBeVisible()
    await expect(page.getByText('Model Front office has been created.')).toBeVisible()
    expect(mockApi.callsTo('POST', `${TANCREDI}/models`)[0].body).toEqual({
      name: 'yealink-T46-Front_office',
      display_name: 'Front office',
      variables: MODEL_VARIABLES,
    })
    await expect(page.getByRole('heading', { name: 'Front office' })).toBeVisible()
    await expect(page).toHaveURL(/\/phones\/models\?model=yealink-T46-Front_office$/)
  })

  test('reports a model that the PBX did not save and stays on the list', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, (request) => {
        const name = request.path.split('/').pop() ?? ''
        return name === 'yealink-T46'
          ? { json: { name, display_name: 'Yealink T46', variables: MODEL_VARIABLES } }
          : { status: 404, json: { title: 'Resource not found' } }
      })
      .on('POST', `${TANCREDI}/models`, (request) => ({ status: 201, json: request.body }))
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Create model' }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('textbox', { name: 'Name' }).fill('Front office')
    await drawer.getByRole('combobox', { name: 'Base model' }).fill('T46')
    await page.getByRole('option', { name: /Yealink T46/ }).click()
    await drawer.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page.getByText('Cannot create model')).toBeVisible()
    await expect(page.getByText('Model created')).toHaveCount(0)
    await expect(page.getByText('Model not found')).toHaveCount(0)
    await expect(page).toHaveURL(/\/phones\/models$/)
  })

  test('offers every Tancredi model as base model', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Create model' }).click()
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
    mockStoredModel(mockPhonesApi(mockApi), {
      name: 'yealink-T46',
      display_name: 'Yealink T46',
      variables: { ...MODEL_VARIABLES, ringtone: '4', vlan_id_phone: '20' },
    }).on('GET', `${TANCREDI}/models/:id/version/original`, {
      json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    })
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
    mockStoredModel(mockPhonesApi(mockApi), {
      name: 'yealink-T46',
      display_name: 'Yealink T46',
      variables: MODEL_VARIABLES,
    })
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
    await expect(page.getByText('Upload firmware', { exact: true })).toBeVisible()
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

  test('shows the LDAP password of a model to the superadmin', async ({ page, mockApi }) => {
    mockStoredModel(mockPhonesApi(mockApi), {
      name: 'yealink-T46',
      display_name: 'Yealink T46',
      variables: MODEL_VARIABLES,
    })
    await page.goto('./phones/models?model=yealink-T46')

    await page.getByRole('button', { name: 'LDAP phonebook' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
  })

  test('saves a model without the LDAP password for an administrator with the phones section', async ({
    page,
    mockApi,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['phones'], 'operator')
    mockStoredModel(mockPhonesApi(mockApi), {
      name: 'yealink-T46',
      display_name: 'Yealink T46',
      variables: MODEL_VARIABLES,
    })
    await page.goto('./phones/models?model=yealink-T46')

    await page.getByRole('button', { name: 'LDAP phonebook' }).click()
    await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Username' }).fill('cn=phones,dc=example,dc=org')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('Model saved')).toBeVisible()
    expect(mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`).map((call) => call.body)).toEqual([
      { variables: { ldap_user: 'cn=phones,dc=example,dc=org' } },
    ])
  })

  test('keeps the changes of a model that the PBX did not store', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, {
        json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
      })
      .on('PATCH', `${TANCREDI}/models/:id`, { json: {} })
    await page.goto('./phones/models?model=yealink-T46')

    await page.getByRole('button', { name: 'Preferences' }).click()
    await page.getByRole('textbox', { name: 'NTP server address' }).fill('ntp.example.com')
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    await expect(page.getByText('The PBX did not save the changes. Try again.')).toBeVisible()
    await expect(page.getByText('Model saved')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'NTP server address' })).toHaveValue(
      'ntp.example.com',
    )
  })

  test('reports a reset that the PBX did not store', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi)
      .on('GET', `${TANCREDI}/models/:id`, {
        json: {
          name: 'yealink-T46',
          display_name: 'Yealink T46',
          variables: { ...MODEL_VARIABLES, ringtone: '4' },
        },
      })
      .on('GET', `${TANCREDI}/models/:id/version/original`, {
        json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
      })
      .on('PATCH', `${TANCREDI}/models/:id`, { json: {} })
    await page.goto('./phones/models')

    await page.getByRole('button', { name: 'Open the menu of model Yealink T46' }).click()
    await page.getByRole('menuitem', { name: 'Reset to original settings' }).click()
    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: 'Reset' }).click()

    await expect(modal.getByText('The PBX did not save the changes. Try again.')).toBeVisible()
    await expect(page.getByText('Model reset')).toHaveCount(0)
  })

  test('opens a model from its address and goes back to the list', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, {
      json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    })
    await page.goto('./phones/models?model=yealink-T46')

    await expect(page.getByRole('heading', { name: 'Yealink T46' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Physical phones' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Models', exact: true })).toHaveCount(1)
    await page.getByRole('button', { name: 'Models', exact: true }).click()
    await expect(page.getByRole('row', { name: /Yealink T46/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Physical phones' })).toBeVisible()
    await expect(page).toHaveURL(/\/phones\/models$/)
  })

  test('asks before discarding the changes to a model', async ({ page, mockApi }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, {
      json: { name: 'yealink-T46', display_name: 'Yealink T46', variables: MODEL_VARIABLES },
    })
    await page.goto('./phones/models?model=yealink-T46')

    await page.getByRole('button', { name: 'Network' }).click()
    const vlan = page.getByRole('textbox', { name: 'Phone VLAN ID' })
    await vlan.fill('30')
    await page.getByRole('button', { name: 'Discard changes' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal.getByRole('heading', { name: 'Discard changes' })).toBeVisible()
    await expect(modal.getByText('Unsaved changes to this model will be lost.')).toBeVisible()
    await modal.getByRole('button', { name: 'Cancel' }).click()
    await expect(vlan).toHaveValue('30')

    await page.getByRole('button', { name: 'Discard changes' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(vlan).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
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

  test('asks again before leaving another model opened from the browser history', async ({
    page,
    mockApi,
  }) => {
    mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models/:id`, (request) => {
      const name = request.path.split('/').pop() ?? ''
      const model = TANCREDI_MODELS.find((item) => item.name === name)

      return {
        json: { name, display_name: model?.display_name ?? name, variables: MODEL_VARIABLES },
      }
    })
    await page.goto('./phones/models')
    const vlan = page.getByRole('textbox', { name: 'Phone VLAN ID' })
    const unsaved = page.getByRole('dialog', { name: 'Unsaved changes' })

    for (const name of ['Fanvil X4U', 'Yealink T46']) {
      await page
        .getByRole('row', { name: new RegExp(name) })
        .getByRole('button', { name: /Edit/ })
        .click()
      await expect(page.getByRole('heading', { name })).toBeVisible()
      if (name === 'Fanvil X4U') {
        await page.getByRole('button', { name: 'Models', exact: true }).first().click()
      }
    }
    await page.getByRole('button', { name: 'Network' }).click()
    await vlan.fill('30')

    await page.evaluate(() => history.go(-2))
    await expect(unsaved.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await unsaved.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page.getByRole('heading', { name: 'Fanvil X4U' })).toBeVisible()
    await expect(page).toHaveURL(/\?model=fanvil-X4U$/)

    await expect(vlan).toHaveValue('')
    await vlan.fill('40')
    await page.evaluate(() => history.back())
    await expect(unsaved.getByRole('heading', { name: 'Unsaved changes' })).toBeVisible()
    await unsaved.getByRole('button', { name: 'Keep editing' }).click()
    await expect(vlan).toHaveValue('40')
    await expect(page).toHaveURL(/\?model=fanvil-X4U$/)
  })

  test.describe('last update', () => {
    test.use({ timezoneId: 'UTC' })

    const NOW = new Date('2026-11-20T09:38:00Z')
    const EDITED_AT = Date.UTC(2026, 10, 18, 9, 38) / 1000
    const EDITED_LABEL = 'Nov 18, 2026, 09:38 AM (2 days ago)'
    const UNKNOWN = /^(Last update)?\s*-$/

    const modelsWithLastEdit = (lastEdit: Record<string, number>) =>
      TANCREDI_MODELS.map((model) =>
        model.name in lastEdit ? { ...model, last_edit_time: lastEdit[model.name] } : model,
      )

    test.beforeEach(async ({ page }) => {
      await page.clock.setFixedTime(NOW)
    })

    for (const width of [1440, 390]) {
      test(`shows when each model was last changed at ${width} px`, async ({ page, mockApi }) => {
        mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models`, {
          json: modelsWithLastEdit({ 'fanvil-X4U-reception': EDITED_AT }),
        })
        await page.setViewportSize({ width, height: 900 })
        await page.goto('./phones/models')

        const edited = page
          .getByRole('row', { name: /Reception desk/ })
          .getByRole('gridcell')
          .nth(4)
        const neverEdited = page
          .getByRole('row', { name: /Yealink T46/ })
          .getByRole('gridcell')
          .nth(4)

        if (width === 1440) {
          await expect(page.getByRole('columnheader')).toHaveText([
            'Model',
            'Brand',
            'Phones',
            'Type',
            'Last update',
            'Actions',
          ])
          await expect(edited).toContainText(EDITED_LABEL)
          await expect(edited.getByText('Last update')).toBeHidden()
          await expect(neverEdited).toHaveText(UNKNOWN)
        } else {
          await expect(edited).toContainText(EDITED_LABEL)
          await expect(edited.getByText('Last update')).toBeVisible()
          await expect(neverEdited).toHaveText(UNKNOWN)
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            ),
          ).toBe(0)
        }
        await expect(edited.getByText(EDITED_LABEL)).toBeVisible()
      })
    }

    test('sorts the models by last update', async ({ page, mockApi }) => {
      mockPhonesApi(mockApi).on('GET', `${TANCREDI}/models`, {
        json: modelsWithLastEdit({
          'fanvil-X4U-reception': EDITED_AT,
          'yealink-T54': EDITED_AT - 60,
        }),
      })
      await page.goto('./phones/models')

      await page.getByRole('button', { name: 'Sort by', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Last update' }).click()
      await expect(page.getByRole('row').nth(-1)).toContainText('Reception desk')
    })

    test('refreshes the last update after a model is saved', async ({ page, mockApi }) => {
      mockStoredModel(mockPhonesApi(mockApi), {
        name: 'yealink-T46',
        display_name: 'Yealink T46',
        variables: MODEL_VARIABLES,
      }).on('GET', `${TANCREDI}/models`, () => ({
        json: modelsWithLastEdit(
          mockApi.callsTo('PATCH', `${TANCREDI}/models/:id`).length > 0
            ? { 'yealink-T46': EDITED_AT }
            : {},
        ),
      }))
      await page.goto('./phones/models')

      const lastUpdate = page
        .getByRole('row', { name: /Yealink T46/ })
        .getByRole('gridcell')
        .nth(4)
      await expect(lastUpdate).toHaveText(UNKNOWN)
      await page
        .getByRole('row', { name: /Yealink T46/ })
        .getByRole('button', { name: /Edit/ })
        .click()
      await page.getByRole('button', { name: 'Network' }).click()
      await page.getByRole('textbox', { name: 'Phone VLAN ID' }).fill('30')
      await page.getByRole('button', { name: 'Save', exact: true }).click()
      await expect(page.getByText('Model saved')).toBeVisible()
      await page.getByRole('button', { name: 'Models', exact: true }).first().click()

      await expect(lastUpdate).toContainText(EDITED_LABEL)
    })

    test('shows the last update of a duplicated model', async ({ page, mockApi }) => {
      mockPhonesApi(mockApi)
        .on('GET', `${TANCREDI}/models/:id`, {
          json: { name: 'fanvil-X4U', display_name: 'Fanvil X4U', variables: MODEL_VARIABLES },
        })
        .on('POST', `${TANCREDI}/models`, (request) => ({
          status: 201,
          json: { ...(request.body as object), last_edit_time: EDITED_AT },
        }))
        .on('GET', `${TANCREDI}/models`, () => ({
          json: [
            ...TANCREDI_MODELS,
            ...mockApi.callsTo('POST', `${TANCREDI}/models`).map((call) => ({
              ...(call.body as object),
              last_edit_time: EDITED_AT,
            })),
          ],
        }))
      await page.goto('./phones/models')

      await page.getByRole('button', { name: 'Open the menu of model Fanvil X4U' }).click()
      await page.getByRole('menuitem', { name: 'Duplicate' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Duplicate' }).click()

      await expect(
        page
          .getByRole('row', { name: /Fanvil X4U copy/ })
          .getByRole('gridcell')
          .nth(4),
      ).toContainText(EDITED_LABEL)
    })
  })
})
