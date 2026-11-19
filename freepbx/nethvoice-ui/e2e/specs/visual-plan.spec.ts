//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { expect, mockPermissions, test } from '../fixtures/mockApi'
import { VISUAL_PLAN } from './visual-plan-data'

const REST = '/freepbx/rest'

test.describe('visual plan', () => {
  test.beforeEach(async ({ signedIn, mockApi }) => {
    void signedIn
    mockApi.on('GET', `${REST}/visualplan`, { json: VISUAL_PLAN })
    mockApi.on('POST', `${REST}/visualplan/layout`, { status: 204 })
  })

  test('draws the call flow of an inbound route', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')

    const canvas = page.locator('.vue-flow')
    await expect(canvas.getByText('Office hours')).toBeVisible()
    await expect(canvas.getByText('Main menu')).toBeVisible()
    await expect(canvas.getByText('Sales (401)')).toBeVisible()
    await expect(canvas.getByText('Support (600)')).toBeVisible()
    await expect(canvas.getByText('Alice Fox (201)')).toBeVisible()
    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(8)
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('edits a node and saves only what changed', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/visualplan`, { json: { refs: { '4': '4' } } })
    await page.goto('./routes/visual-plan?route=0721405516%2F')

    await page.locator('.vue-flow').getByText('Main menu').click()
    const inspector = page.getByRole('complementary', { name: 'Properties' })
    await inspector.getByLabel('Name', { exact: true }).fill('Reception menu')
    await expect(page.getByText('Unsaved changes')).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Call flow saved')).toBeVisible()

    const [call] = mockApi.callsTo('POST', `${REST}/visualplan`)
    expect(call?.body).toEqual({
      changes: [
        {
          type: 'ivr',
          ref: '4',
          isNew: false,
          data: {
            id: 4,
            name: 'Reception menu',
            description: 'Sales or support',
            announcement: 3,
            directDial: true,
            invalidDestination: 'app-blackhole,hangup,1',
            timeoutDestination: '',
            entries: [
              { selection: '1', destination: 'ext-queues,401,1' },
              { selection: '2', destination: 'ext-group,600,1' },
            ],
          },
        },
      ],
    })
  })

  test('creates a new route with a new announcement', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/visualplan`, {
      json: { refs: { 'new-1': '0721999/', 'new-2': '9' } },
    })
    await page.goto('./routes/visual-plan')

    const inspector = page.getByRole('complementary', { name: 'Properties' })
    await expect(inspector.getByText('Inbound route')).toBeVisible()
    await inspector.getByLabel('DID number').fill('0721999')

    await page
      .getByRole('complementary', { name: 'Add to flow' })
      .getByRole('button', { name: 'Announcement' })
      .click()
    await inspector.getByLabel('Name', { exact: true }).fill('Holiday')
    await inspector.getByRole('combobox', { name: 'Recording' }).click()
    await page.getByRole('option', { name: /closed/ }).click()

    await page.getByRole('button', { name: 'Fit to screen' }).click()
    await page.locator('.vue-flow').getByText('0721999').click()
    await inspector.getByRole('combobox', { name: 'Next' }).click()
    await page.getByRole('option', { name: /Holiday/ }).click()

    await expect(page.getByText(/error/)).toHaveCount(0)
    await page.getByRole('button', { name: 'Save' }).click()

    const [call] = mockApi.callsTo('POST', `${REST}/visualplan`)
    expect(call?.body).toEqual({
      changes: [
        {
          type: 'inboundRoute',
          ref: 'new-1',
          isNew: true,
          data: {
            extension: '0721999',
            cidnum: '',
            description: '',
            alertinfo: '',
            grppre: '',
            destination: 'new:new-2',
          },
        },
        {
          type: 'announcement',
          ref: 'new-2',
          isNew: true,
          data: { id: null, description: 'Holiday', recording: 5, destination: '' },
        },
      ],
    })
  })

  test('shows the errors returned by the server', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/visualplan`, {
      status: 422,
      json: {
        message: 'Validation failed',
        errors: [{ ref: '4', field: 'name', message: 'required' }],
      },
    })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Main menu').click()
    await page
      .getByRole('complementary', { name: 'Properties' })
      .getByLabel(/^Description/)
      .fill('Changed')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Cannot save call flow')).toBeVisible()
    await expect(page.getByText('Required')).toBeVisible()
  })

  test('finds an item and opens it', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')

    await page.getByRole('combobox', { name: 'Find in flow' }).fill('401')
    await expect(page.getByText('1 item found')).toBeVisible()
    await page.getByRole('option', { name: /Sales \(401\)/ }).click()

    const inspector = page.getByRole('complementary', { name: 'Properties' })
    await expect(inspector.getByRole('heading', { name: 'Sales (401)' })).toBeVisible()
  })

  test('adds a connected item by dropping a destination on the canvas', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(8)

    const handle = canvas.locator('.vue-flow__handle[data-handleid="timeoutDestination"]')
    const box = await handle.boundingBox()
    if (!box) throw new Error('missing handle')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 160, box.y + 140, { steps: 10 })
    await page.mouse.up()

    await page
      .getByRole('dialog', { name: 'Add and connect' })
      .getByRole('option', { name: 'Announcement' })
      .click()
    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(9)
    await expect(
      page
        .getByRole('complementary', { name: 'Properties' })
        .getByText('Announcement', { exact: true })
        .first(),
    ).toBeVisible()
  })

  test('connects a new item dragged next to a free destination', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')

    await page
      .getByRole('complementary', { name: 'Add to flow' })
      .getByRole('button', { name: 'Conference' })
      .click()
    await page.keyboard.press('Escape')
    const handle = await canvas
      .locator('.vue-flow__handle[data-handleid="timeoutDestination"]')
      .boundingBox()
    const card = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Conference' })
      .boundingBox()
    if (!handle || !card) throw new Error('missing elements')

    await page.mouse.move(card.x + card.width / 2, card.y + 20)
    await page.mouse.down()
    await page.mouse.move(handle.x + 60 + card.width / 2, handle.y + 20, { steps: 15 })
    await page.mouse.up()

    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(9)
  })

  test('selects an area and arranges or removes the selected items', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    const pane = await canvas.boundingBox()
    const first = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Sales (401)' })
      .boundingBox()
    const last = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Support (600)' })
      .boundingBox()
    if (!pane || !first || !last) throw new Error('missing elements')

    await page.getByRole('button', { name: 'Select an area (V)' }).click()
    await page.mouse.move(first.x - 8, first.y - 8)
    await page.mouse.down()
    await page.mouse.move(last.x + last.width + 8, last.y + last.height + 4, { steps: 10 })
    await expect(page.locator('.vue-flow__selection')).toBeVisible()
    await page.mouse.up()

    const panel = page.getByRole('complementary', { name: 'Properties' })
    await expect(panel.getByRole('heading', { name: '2 items' })).toBeVisible()
    await page.keyboard.press('Delete')
    await expect(canvas.getByText('Sales (401)')).toHaveCount(0)
    await expect(canvas.getByText('Support (600)')).toHaveCount(0)

    await page.keyboard.press('Control+z')
    await expect(canvas.getByText('Sales (401)')).toBeVisible()
    await expect(panel.getByRole('heading', { name: '2 items' })).toBeVisible()
    await panel.getByRole('button', { name: 'Align top' }).click()
    await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled()
  })

  test('moves the canvas by dragging and selects an area with Shift', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    const viewport = canvas.locator('.vue-flow__transformationpane')
    await expect(canvas.getByText('Main menu')).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error('missing canvas')
    const before = await viewport.getAttribute('style')

    await page.mouse.move(box.x + 40, box.y + 40)
    await page.mouse.down()
    await page.mouse.move(box.x + 140, box.y + 90, { steps: 8 })
    await page.mouse.up()
    expect(await viewport.getAttribute('style')).not.toBe(before)
    await expect(page.getByRole('complementary', { name: 'Properties' })).toHaveCount(0)

    const sales = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Sales (401)' })
      .boundingBox()
    if (!sales) throw new Error('missing node')
    await page.keyboard.down('Shift')
    await page.mouse.move(sales.x - 8, sales.y - 8)
    await page.mouse.down()
    await page.mouse.move(sales.x + sales.width + 8, sales.y + sales.height - 10, { steps: 8 })
    await page.mouse.up()
    await page.keyboard.up('Shift')
    await expect(
      page
        .getByRole('complementary', { name: 'Properties' })
        .getByRole('heading', { name: 'Sales (401)' }),
    ).toBeVisible()
  })

  test('drags the selected items together', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    const sales = canvas.locator('.vue-flow__node').filter({ hasText: 'Sales (401)' })
    const support = canvas.locator('.vue-flow__node').filter({ hasText: 'Support (600)' })
    await sales.click()
    await page.getByRole('button', { name: 'Fit to screen' }).click()
    await support.click({ modifiers: ['Control'] })
    await page.getByRole('button', { name: 'Fit to screen' }).click()
    await expect(
      page
        .getByRole('complementary', { name: 'Properties' })
        .getByRole('heading', { name: '2 items' }),
    ).toBeVisible()
    const before = await support.boundingBox()
    const grab = await sales.boundingBox()
    if (!before || !grab) throw new Error('missing nodes')

    await page.mouse.move(grab.x + 30, grab.y + 15)
    await page.mouse.down()
    await page.mouse.move(grab.x + 30, grab.y + 115, { steps: 8 })
    await page.mouse.up()

    const after = await support.boundingBox()
    expect(after && after.y - before.y).toBeGreaterThan(50)
  })

  test('shows the keyboard and mouse shortcuts', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await expect(page.locator('.vue-flow').getByText('Main menu')).toBeVisible()

    await page.locator('.vue-flow__pane').click({ position: { x: 20, y: 20 } })
    await page.keyboard.press('?')
    await expect(page.getByRole('heading', { name: 'Keyboard and mouse' })).toBeVisible()
    await expect(page.getByText('Add or remove an item from the selection')).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(page.getByText('Add or remove an item from the selection')).toBeHidden()

    await page.getByRole('button', { name: 'Show keyboard and mouse shortcuts' }).click()
    await expect(page.getByText('Add or remove an item from the selection')).toBeVisible()
  })

  test('collapses and expands a branch', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')

    await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Main menu' })
      .getByRole('button', { name: 'Collapse branch' })
      .click()
    await expect(canvas.getByText('Sales (401)')).toHaveCount(0)
    await expect(canvas.getByText('Alice Fox (201)')).toHaveCount(0)

    await canvas.getByRole('button', { name: '4 hidden items' }).click()
    await expect(canvas.getByText('Sales (401)')).toBeVisible()
  })

  test('simulates a call through the flow', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.getByRole('button', { name: 'Simulate call' }).click()

    const panel = page.getByRole('complementary', { name: 'Call simulation' })
    await panel.getByLabel('Call date and time').fill('2026-11-18T10:30')
    await expect(panel.getByText('The time matches the time group')).toBeVisible()

    await panel.getByRole('combobox', { name: 'Digit pressed' }).click()
    await page.getByRole('option', { name: 'Digit 1' }).click()
    await panel.getByRole('heading', { name: 'Call path' }).click()
    await expect(panel.getByText('Call answered')).toBeVisible()
    await expect(panel.getByText('The call is answered by Sales (401).')).toBeVisible()

    await panel.getByText('Someone answers', { exact: true }).click()
    await expect(panel.getByText('The call ends at Alice Fox (201).')).toBeVisible()

    await panel.getByLabel('Call date and time').fill('2026-11-21T10:30')
    await expect(panel.getByText('The time does not match the time group')).toBeVisible()
    await expect(panel.getByText('The call ends at Hang up.')).toBeVisible()

    await panel.getByRole('heading', { name: 'Call path' }).click()
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  })

  test('downloads the flow as an image', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await expect(page.locator('.vue-flow').getByText('Main menu')).toBeVisible()

    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('menuitem', { name: 'Download image' }).click()
    expect((await download).suggestedFilename()).toBe('visual-plan-0721405516.png')
  })

  test('asks before leaving with unsaved changes', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/inboundroutes`, { json: { destinations: {}, routes: [] } })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Main menu').click()
    await page
      .getByRole('complementary', { name: 'Properties' })
      .getByLabel('Name', { exact: true })
      .fill('X')

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Your changes to the call flow will be lost')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page).toHaveURL(/visual-plan/)

    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('button', { name: 'Discard changes' }).click()
    await expect(page).toHaveURL(/\/routes\/inbound$/)
  })

  test('saves once when the shortcut is pressed twice', async ({ page, mockApi }) => {
    let release: () => void = () => undefined
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    mockApi.on('POST', `${REST}/visualplan`, async () => {
      await pending
      return { json: { refs: { '4': '4' } } }
    })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Main menu').click()
    await page
      .getByRole('complementary', { name: 'Properties' })
      .getByLabel('Name', { exact: true })
      .fill('Twice')

    await page.keyboard.press('Control+s')
    await page.keyboard.press('Control+s')
    release()
    await expect(page.getByText('Call flow saved')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/visualplan`)).toHaveLength(1)
  })

  test('shows a server error and keeps the changes', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/visualplan`, {
      status: 500,
      json: { error: 'Internal server error' },
    })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Main menu').click()
    await page
      .getByRole('complementary', { name: 'Properties' })
      .getByLabel('Name', { exact: true })
      .fill('Broken')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Cannot save call flow')).toBeVisible()
    await expect(page.getByText('Unsaved changes')).toBeVisible()
  })

  test('does not allow saving when some data could not be loaded', async ({ page, mockApi }) => {
    mockApi.on('GET', `${REST}/visualplan`, { json: { ...VISUAL_PLAN, unavailable: ['queues'] } })
    await page.goto('./routes/visual-plan?route=0721405516%2F')

    await expect(page.getByText('Cannot load some data')).toBeVisible()
    await page.locator('.vue-flow').getByText('Main menu').click()
    await page
      .getByRole('complementary', { name: 'Properties' })
      .getByLabel('Name', { exact: true })
      .fill('X')
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let failing = true
    mockApi.on('GET', `${REST}/visualplan`, () =>
      failing ? { status: 500, json: { error: 'Internal server error' } } : { json: VISUAL_PLAN },
    )
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await expect(page.getByText('Cannot load call flow')).toBeVisible()

    failing = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.locator('.vue-flow').getByText('Main menu')).toBeVisible()
  })

  test('uploads a recording and selects it', async ({ page, mockApi }) => {
    mockApi.on('POST', `${REST}/visualplan/recordings`, {
      json: { id: 12, name: 'holiday', description: '' },
    })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Closed').click()
    const inspector = page.getByRole('complementary', { name: 'Properties' })
    await inspector.getByRole('button', { name: 'Upload recording' }).click()

    const modal = page.getByRole('dialog', { name: 'Upload recording' })
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'holiday.wav',
      mimeType: 'audio/wav',
      buffer: Buffer.from('RIFF0000WAVEfmt '),
    })
    await expect(modal.getByLabel('Recording name')).toHaveValue('holiday')
    await modal.getByRole('button', { name: 'Upload' }).click()

    await expect(inspector.getByRole('combobox', { name: 'Recording' })).toHaveValue('holiday')
    expect(mockApi.callsTo('POST', `${REST}/visualplan/recordings`)).toHaveLength(1)
  })

  test('inserts an item dropped on a link', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(8)

    await page
      .getByRole('complementary', { name: 'Add to flow' })
      .getByRole('button', { name: 'Set caller ID' })
      .click()
    await page.keyboard.press('Escape')
    const from = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Inbound route' })
      .locator('.vue-flow__handle[data-handleid="destination"]')
      .boundingBox()
    const to = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Office hours' })
      .locator('.vue-flow__handle[data-handleid="in"]')
      .boundingBox()
    const card = await canvas
      .locator('.vue-flow__node')
      .filter({ hasText: 'Set caller ID' })
      .boundingBox()
    if (!from || !to || !card) throw new Error('missing elements')

    await page.mouse.move(card.x + card.width / 2, card.y + 20)
    await page.mouse.down()
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2 - card.height / 2 + 20, {
      steps: 20,
    })
    await page.mouse.up()

    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(9)
  })

  test('guides to the errors when saving', async ({ page, mockApi }) => {
    await page.goto('./routes/visual-plan')
    await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText('Fix 1 item before saving')).toBeVisible()
    await expect(page.getByRole('button', { name: /1 error/ })).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/visualplan`)).toHaveLength(0)
  })

  test('saves only the layout when only positions changed', async ({ page, mockApi }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const card = await page.locator('.vue-flow__node').filter({ hasText: 'Closed' }).boundingBox()
    if (!card) throw new Error('missing node')
    await page.mouse.move(card.x + 40, card.y + 15)
    await page.mouse.down()
    await page.mouse.move(card.x + 40, card.y + 200, { steps: 8 })
    await page.mouse.up()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Layout saved')).toBeVisible()
    expect(mockApi.callsTo('POST', `${REST}/visualplan`)).toHaveLength(0)
    const [call] = mockApi.callsTo('POST', `${REST}/visualplan/layout`)
    expect(call?.body).toMatchObject({ route: '0721405516/', positions: expect.any(Object) })
    await expect(page.getByText('Unsaved changes')).toHaveCount(0)
  })

  test('sends a destination to an existing item that is not in the flow', async ({
    page,
    mockApi,
  }) => {
    mockApi.on('GET', `${REST}/visualplan`, {
      json: {
        ...VISUAL_PLAN,
        ringGroups: [
          ...VISUAL_PLAN.ringGroups,
          {
            id: '601',
            description: 'Hotline',
            members: ['201'],
            strategy: 'ringall',
            ringTime: 20,
            destination: '',
          },
        ],
      },
    })
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    await page.locator('.vue-flow').getByText('Closed').click()
    const inspector = page.getByRole('complementary', { name: 'Properties' })
    await inspector.getByRole('combobox', { name: 'Next' }).click()
    await page.getByRole('option', { name: /Hotline \(601\)/ }).click()

    await expect(page.locator('.vue-flow').getByText('Hotline (601)')).toBeVisible()
    await expect(page.locator('.vue-flow .vue-flow__edge')).toHaveCount(8)
  })

  test('connects a destination dropped on the body of an item', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=0721405516%2F')
    const canvas = page.locator('.vue-flow')
    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(8)
    const handle = await canvas
      .locator('.vue-flow__handle[data-handleid="timeoutDestination"]')
      .boundingBox()
    const card = await canvas.locator('.vue-flow__node').filter({ hasText: 'Closed' }).boundingBox()
    if (!handle || !card) throw new Error('missing elements')

    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(card.x + card.width / 2, card.y + 25, { steps: 12 })
    await page.mouse.up()

    await expect(canvas.locator('.vue-flow__edge')).toHaveCount(9)
  })

  test('is read only without the superadmin permission', async ({ page, mockApi }) => {
    mockPermissions(mockApi, ['routes'])
    await page.goto('./routes/visual-plan?route=0721405516%2F')

    await expect(page.locator('.vue-flow').getByText('Main menu')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
    await expect(page.getByRole('complementary', { name: 'Add to flow' })).toHaveCount(0)
    await expect(page.getByText('Read-only access')).toBeVisible()
  })

  test('shows when the route does not exist', async ({ page }) => {
    await page.goto('./routes/visual-plan?route=999%2F')
    await expect(page.getByText('Inbound route not found')).toBeVisible()
  })
})
