//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import type { Page } from '@playwright/test'
import { expect, mockPermissions, test, type MockApi } from '../fixtures/mockApi'

const REST = '/freepbx/rest'

const GROUPS = {
  superadmin: 'nethvoice3-admins',
  dashboard: 'nethvoice3-dashboard',
  users: 'nethvoice3-users',
  trunks: 'nethvoice3-trunks',
  routes: 'nethvoice3-routes',
  phones: 'nethvoice3-phones',
  integrations: 'nethvoice3-integrations',
  settings: 'nethvoice3-settings',
}

type Admin = {
  username: string
  display_name: string | null
  source: 'local' | 'domain' | 'domain_admin'
  permissions: string[]
  groups: string[]
  locked: boolean | null
  editable: boolean
  removable: boolean
  reason: string | null
}

const domainAdmin = (
  username: string,
  display_name: string,
  permissions: string[],
  overrides: Partial<Admin> = {},
): Admin => ({
  username,
  display_name,
  source: 'domain',
  permissions,
  groups: permissions.map(
    (permission) => GROUPS[permission as keyof typeof GROUPS] ?? `nethvoice3-${permission}`,
  ),
  locked: false,
  editable: true,
  removable: true,
  reason: null,
  ...overrides,
})

const ADMINS: Admin[] = [
  {
    username: 'admin',
    display_name: null,
    source: 'local',
    permissions: ['superadmin'],
    groups: [],
    locked: null,
    editable: false,
    removable: false,
    reason: 'builtin',
  },
  {
    username: 'operator',
    display_name: null,
    source: 'local',
    permissions: ['dashboard'],
    groups: [],
    locked: null,
    editable: false,
    removable: true,
    reason: 'local_account',
  },
  domainAdmin('a.miller', 'Anna Miller', ['users', 'phones']),
  domainAdmin('b.smith', 'Bob Smith', ['superadmin'], { locked: true }),
  domainAdmin('d.jones', 'Daniel Jones', ['superadmin'], {
    source: 'domain_admin',
    groups: [],
    editable: false,
    removable: false,
    reason: 'domain_admin',
  }),
]

const ACCOUNTS = [
  { username: 'a.miller', display_name: 'Anna Miller', admin_access: 'sections' },
  { username: 'b.smith', display_name: 'Bob Smith', admin_access: 'superadmin', locked: true },
  { username: 'c.davis', display_name: 'Christopher Davis', admin_access: null },
  { username: 'd.jones', display_name: 'Daniel Jones', domain_admin: true },
  { username: 'e.brown', display_name: 'Emma Brown', admin_access: 'superadmin' },
  { username: 'f.green', display_name: 'Frank Green', admin_access: 'other_instance' },
  { username: 'support-desk', display_name: 'Support desk', admin_access: null },
].map((account) => ({
  mail: '',
  locked: false,
  domain_admin: false,
  ...account,
}))

type ControlOptions = { manageable?: boolean; reason?: string | null; admins?: Admin[] }

const mockAdminsApi = (mockApi: MockApi, options: ControlOptions = {}) => {
  let admins = (options.admins ?? ADMINS).map((admin) => ({ ...admin }))

  mockApi
    .on('GET', `${REST}/users/domain`, { json: { manageable: true, reason: null } })
    .on('GET', `${REST}/users/domain/accounts`, { json: ACCOUNTS })
    .on('GET', `${REST}/admins`, () => ({
      json: {
        prefix: 'nethvoice3',
        groups: GROUPS,
        manageable: options.manageable ?? true,
        reason: options.reason ?? null,
        admins,
      },
    }))
    .on('PUT', `${REST}/admins/:username`, (request) => {
      const username = decodeURIComponent(request.path.split('/').at(-1) ?? '')
      const { permissions } = request.body as { permissions: string[] }
      const account = ACCOUNTS.find((candidate) => candidate.username === username)
      const updated = domainAdmin(username, account?.display_name ?? '', permissions)

      admins = admins.some((admin) => admin.username === username)
        ? admins.map((admin) => (admin.username === username ? updated : admin))
        : [...admins, updated]
      return { json: updated }
    })
    .on('DELETE', `${REST}/admins/:username`, (request) => {
      const username = decodeURIComponent(request.path.split('/').at(-1) ?? '')
      admins = admins.filter((admin) => admin.username !== username)
      return { status: 204 }
    })
  return mockApi
}

const table = (page: Page) => page.getByRole('grid', { name: 'Administrators' })

const row = (page: Page, username: string) => page.getByTestId(`admin-${username}`)

const toasts = (page: Page) => page.getByTestId('toast-notifications')

const pickUser = async (page: Page, username: string) => {
  const combobox = page.getByRole('combobox', { name: 'User' })
  await combobox.click()
  await combobox.fill(username)
  await page.getByRole('option', { name: new RegExp(username) }).click()
}

test.describe('admin control', () => {
  test.beforeEach(({ signedIn, mockApi }) => {
    void signedIn
    mockAdminsApi(mockApi)
  })

  test('lists the administrators with their access and the domain groups', async ({ page }) => {
    await page.goto('./admin-control')

    await expect(page.getByRole('heading', { name: 'Admin control', level: 3 })).toBeVisible()
    await expect(table(page).getByRole('row')).toHaveCount(ADMINS.length + 1)

    await expect(row(page, 'a.miller')).toContainText('Anna Miller')
    await expect(row(page, 'a.miller')).toContainText('Users and groups')
    await expect(row(page, 'a.miller')).toContainText('Physical phones')
    await expect(row(page, 'a.miller')).toContainText('Domain group')
    await expect(row(page, 'b.smith')).toContainText('Full access')
    await expect(page.getByTestId('admin-disabled-b.smith')).toHaveText('Disabled')
    await expect(row(page, 'd.jones')).toContainText('Domain administrator')
    await expect(row(page, 'admin')).toContainText('Local account')
    await expect(row(page, 'admin')).toContainText('Full access')
    await expect(row(page, 'operator')).toContainText('Dashboard')

    const groups = page.getByTestId('admin-control-groups')
    await expect(groups).toContainText('Domain groups')
    for (const group of Object.values(GROUPS)) {
      await expect(groups.getByRole('button', { name: group, exact: true })).toBeVisible()
    }
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Admin control' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  test('shows why some administrators are read only', async ({ page }) => {
    await page.goto('./admin-control')

    for (const [username, reason] of [
      [
        'admin',
        'Built-in administrator, always with full access. Change its password in Settings.',
      ],
      [
        'd.jones',
        'Domain administrators always have full access. You can change them from the Domains and users page of NethServer 8.',
      ],
      [
        'operator',
        "Local administrator created in the previous interface: its access can't be changed, only removed.",
      ],
    ]) {
      await expect(row(page, username).getByRole('button', { name: /^Edit/ })).toHaveCount(0)
      const readOnly = page.getByTestId(`admin-read-only-${username}`)
      await expect(readOnly).toContainText(reason)
      await readOnly.hover()
      await expect(page.locator('[data-tippy-root]').getByText(reason)).toBeVisible()
    }

    await expect(page.getByRole('button', { name: 'Actions for admin' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions for d.jones' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Actions for operator' })).toBeVisible()
  })

  test('adds an administrator for some sections', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Add administrator' }).click()

    const drawer = page.getByRole('dialog', { name: 'Add administrator' })
    await expect(drawer.getByRole('combobox', { name: 'User' })).toBeFocused()
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(drawer.getByText('Choose a user', { exact: true }).last()).toBeVisible()
    await expect(drawer.getByText('Choose at least one section')).toBeVisible()
    await expect(drawer.getByRole('combobox', { name: 'User' })).toBeFocused()

    await pickUser(page, 'c.davis')
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(drawer.getByText('Choose at least one section')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/admins/:username`)).toHaveLength(0)

    await drawer.getByRole('checkbox', { name: /^Trunks/ }).check()
    await drawer.getByRole('checkbox', { name: /^Routes/ }).check()
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(toasts(page).getByText('Administrator added')).toBeVisible()
    await expect(toasts(page).getByText('Administrator c.davis has been added.')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/admins/c.davis`)[0].body).toEqual({
      permissions: ['trunks', 'routes'],
    })
    await expect(row(page, 'c.davis')).toContainText('Trunks')
    await expect(row(page, 'c.davis')).toContainText('Routes')
  })

  test('adds an administrator with full access', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Add administrator' }).click()

    const drawer = page.getByRole('dialog', { name: 'Add administrator' })
    await pickUser(page, 'f.green')
    await drawer.getByText('Full access', { exact: true }).click()
    await expect(drawer.getByRole('radio', { name: /^Full access/ })).toBeChecked()
    await expect(drawer.getByRole('checkbox', { name: /^Trunks/ })).toHaveCount(0)
    await drawer.getByRole('button', { name: 'Add', exact: true }).click()

    await expect(toasts(page).getByText('Administrator added')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/admins/f.green`)[0].body).toEqual({
      permissions: ['superadmin'],
    })
    await expect(row(page, 'f.green')).toContainText('Full access')
  })

  test('tells which users cannot be added', async ({ page }) => {
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Add administrator' }).click()
    await page.getByRole('combobox', { name: 'User' }).click()

    for (const [username, reason] of [
      ['a.miller', 'Already an administrator'],
      ['d.jones', 'Already an administrator'],
      ['e.brown', 'Already has full access'],
      ['support-desk', 'Reserved username'],
    ]) {
      const option = page.getByRole('option', { name: new RegExp(`^${username}`) })
      await expect(option).toContainText(reason)
      await expect(option).toHaveAttribute('aria-disabled', 'true')
    }
    await expect(page.getByRole('option', { name: /^c\.davis/ })).toContainText('Christopher Davis')
    await expect(page.getByRole('option', { name: /^c\.davis/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
    await expect(page.getByRole('option', { name: /^admin\b/ })).toHaveCount(0)
  })

  test('changes the sections of an administrator', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await row(page, 'a.miller').getByRole('button', { name: 'Edit a.miller' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit administrator' })
    await expect(drawer.getByRole('combobox', { name: 'User' })).toBeDisabled()
    await expect(drawer.getByRole('checkbox', { name: /^Users and groups/ })).toBeChecked()
    await expect(drawer.getByRole('checkbox', { name: /^Physical phones/ })).toBeChecked()

    await drawer.getByRole('checkbox', { name: /^Users and groups/ }).uncheck()
    await drawer.getByRole('checkbox', { name: /^Physical phones/ }).uncheck()
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(drawer.getByText('Choose at least one section')).toBeVisible()

    await drawer.getByRole('checkbox', { name: /^Integrations/ }).check()
    await drawer.getByRole('checkbox', { name: /^Settings/ }).check()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(toasts(page).getByText('Administrator updated')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/admins/a.miller`)[0].body).toEqual({
      permissions: ['integrations', 'settings'],
    })
    await expect(row(page, 'a.miller')).toContainText('Integrations')
    await expect(row(page, 'a.miller')).not.toContainText('Physical phones')
  })

  test('gives full access to an administrator of some sections', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await row(page, 'a.miller').getByRole('button', { name: 'Edit a.miller' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit administrator' })
    await drawer.getByText('Full access', { exact: true }).click()
    await expect(drawer.getByRole('radio', { name: /^Full access/ })).toBeChecked()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(toasts(page).getByText('Administrator updated')).toBeVisible()
    expect(mockApi.callsTo('PUT', `${REST}/admins/a.miller`)[0].body).toEqual({
      permissions: ['superadmin'],
    })
    await expect(row(page, 'a.miller')).toContainText('Full access')
  })

  test('shows why the server refused a change in the drawer', async ({ page, mockApi }) => {
    mockApi.on('PUT', `${REST}/admins/:username`, {
      status: 403,
      json: { code: 'domain_admin', message: 'invented server detail' },
    })
    await page.goto('./admin-control')
    await row(page, 'a.miller').getByRole('button', { name: 'Edit a.miller' }).click()

    const drawer = page.getByRole('dialog', { name: 'Edit administrator' })
    await drawer.getByRole('checkbox', { name: /^Dashboard/ }).check()
    await drawer.getByRole('button', { name: 'Save' }).click()

    await expect(drawer.getByText('Cannot save administrator')).toBeVisible()
    await expect(
      drawer.getByText(
        'Domain administrators always have full access. You can change them from the Domains and users page of NethServer 8.',
      ),
    ).toBeVisible()
    await expect(drawer.getByText('invented server detail')).toHaveCount(0)
  })

  test('removes a domain administrator', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()

    const modal = page.getByRole('dialog', { name: 'Remove administrator' })
    await expect(modal).toContainText(
      'Administrator a.miller will be removed and signed out at once.',
    )
    await expect(modal).toContainText(
      'The user is removed from the administrator groups. The account itself is kept in the account provider.',
    )
    await modal.getByRole('button', { name: 'Remove', exact: true }).click()

    await expect(toasts(page).getByText('Administrator removed')).toBeVisible()
    expect(mockApi.callsTo('DELETE', `${REST}/admins/a.miller`)).toHaveLength(1)
    await expect(row(page, 'a.miller')).toHaveCount(0)
  })

  test('removes a local administrator of the previous interface', async ({ page, mockApi }) => {
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Actions for operator' }).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()

    const modal = page.getByRole('dialog', { name: 'Remove administrator' })
    await expect(modal).toContainText('The local account is deleted.')
    await modal.getByRole('button', { name: 'Remove', exact: true }).click()

    await expect(row(page, 'operator')).toHaveCount(0)
    expect(mockApi.callsTo('DELETE', `${REST}/admins/operator`)).toHaveLength(1)
  })

  test('shows a failed removal in the modal', async ({ page, mockApi }) => {
    mockApi.on('DELETE', `${REST}/admins/:username`, {
      status: 503,
      json: { code: 'domain_unavailable' },
    })
    await page.goto('./admin-control')
    await page.getByRole('button', { name: 'Actions for a.miller' }).click()
    await page.getByRole('menuitem', { name: 'Remove' }).click()

    const modal = page.getByRole('dialog', { name: 'Remove administrator' })
    await modal.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(modal.getByText('Cannot remove administrator')).toBeVisible()
    await expect(
      modal.getByText("The account provider can't be reached. Try again later."),
    ).toBeVisible()
    await expect(row(page, 'a.miller')).toBeVisible()
  })

  test('opens the drawer and the modal with the keyboard and returns the focus', async ({
    page,
  }) => {
    await page.goto('./admin-control')
    const edit = page.getByRole('button', { name: 'Edit a.miller' })
    await edit.focus()
    await page.keyboard.press('Enter')

    const drawer = page.getByRole('dialog', { name: 'Edit administrator' })
    await expect(drawer.getByRole('radio', { name: /^Full access/ })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(drawer.getByRole('radio', { name: /^Full access/ })).toBeHidden()
    await expect(edit).toBeFocused()

    const menuButton = page.getByRole('button', { name: 'Actions for a.miller' })
    await menuButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', { name: 'Remove' })).toBeVisible()
    await page.keyboard.press('Enter')
    const modal = page.getByRole('dialog', { name: 'Remove administrator' })
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(modal.getByRole('button', { name: 'Cancel' })).toBeHidden()
    await expect(menuButton).toBeFocused()
  })

  test('fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('./admin-control')
    await expect(row(page, 'a.miller')).toBeVisible()
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
    expect(await overflow()).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'Edit a.miller' }).click()
    const drawer = page.getByRole('dialog', { name: 'Edit administrator' })
    await drawer.getByRole('button', { name: 'Save' }).scrollIntoViewIfNeeded()
    await expect(drawer.getByRole('button', { name: 'Save' })).toBeInViewport()
    expect(await overflow()).toBeLessThanOrEqual(0)
  })
})

test.describe('admin control without a manageable account provider', () => {
  test.beforeEach(({ signedIn }) => {
    void signedIn
  })

  test('is read only with an external account provider', async ({ page, mockApi }) => {
    mockAdminsApi(mockApi, {
      manageable: false,
      reason: 'external',
      admins: ADMINS.filter((admin) => admin.source === 'local'),
    })
    await page.goto('./admin-control')

    const notice = page.getByTestId('admin-control-not-manageable')
    await expect(notice).toContainText("Domain users can't be administrators")
    await expect(page.getByRole('button', { name: 'Add administrator' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Actions for operator' })).toHaveCount(0)
    await expect(page.getByTestId('admin-read-only-operator')).toBeVisible()
    await expect(page.getByTestId('admin-control-groups')).toHaveCount(0)
  })

  test('is read only while the account provider cannot be reached', async ({ page, mockApi }) => {
    mockAdminsApi(mockApi, { manageable: false, reason: 'unavailable' })
    await page.goto('./admin-control')

    const notice = page.getByTestId('admin-control-not-manageable')
    await expect(notice).toContainText('Cannot reach the account provider')
    await expect(page.getByRole('button', { name: 'Add administrator' })).toBeDisabled()
    await expect(page.getByRole('button', { name: /^Edit/ })).toHaveCount(0)
    await page.getByTestId('admin-read-only-a.miller').hover()
    await expect(
      page
        .locator('[data-tippy-root]')
        .getByText("Administrators can't be added, changed or removed now. Try again later."),
    ).toBeVisible()
  })

  test('reports a load error and retries', async ({ page, mockApi }) => {
    let fail = true
    mockAdminsApi(mockApi)
    mockApi.on('GET', `${REST}/admins`, () =>
      fail
        ? { status: 500, json: { message: 'invented failure' } }
        : {
            json: {
              prefix: 'nethvoice3',
              groups: GROUPS,
              manageable: true,
              reason: null,
              admins: ADMINS,
            },
          },
    )
    await page.goto('./admin-control')

    await expect(page.getByText('Cannot retrieve administrators')).toBeVisible()
    fail = false
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(row(page, 'a.miller')).toBeVisible()
  })

  test('shows the empty state', async ({ page, mockApi }) => {
    mockAdminsApi(mockApi, { admins: [] })
    await page.goto('./admin-control')

    await expect(page.getByText('No administrators configured')).toBeVisible()
    await page.getByRole('button', { name: 'Add administrator' }).last().click()
    await expect(
      page
        .getByRole('dialog', { name: 'Add administrator' })
        .getByRole('combobox', { name: 'User' }),
    ).toBeFocused()
  })
})

test.describe('admin control for a limited administrator', () => {
  test.beforeEach(async ({ page, mockApi }) => {
    await page.addInitScript(() => {
      localStorage.setItem('secretkey', JSON.stringify({ user: 'operator', hash: 'e2e-secret' }))
    })
    mockPermissions(mockApi, ['settings'], 'operator')
    mockApi.on('GET', `${REST}/settings/languages`, {
      json: { it: { default: false }, en: { default: true } },
    })
  })

  test('cannot see the section nor open it', async ({ page, mockApi }) => {
    await page.goto('./settings')
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Admin control' }),
    ).toHaveCount(0)

    await page.goto('./admin-control')
    await expect(page).toHaveURL(/\/nethvoice\/settings$/)
    await expect(toasts(page).getByText('Section not available')).toBeVisible()
    expect(mockApi.callsTo('GET', `${REST}/admins`)).toHaveLength(0)
  })
})
