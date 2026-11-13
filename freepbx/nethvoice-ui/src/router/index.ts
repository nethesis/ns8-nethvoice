//  Copyright (C) 2026 Nethesis S.r.l.
//  SPDX-License-Identifier: GPL-3.0-or-later

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { APP_BASE_PATH } from '@/lib/config'
import { useLoginStore } from '@/stores/login'
import { SETUP_STEPS } from '@/lib/setup/steps'
import { getInternalRedirect, getWizardRedirect } from '@/lib/setup/guard'
import { loadWizardState } from '@/queries/setup/wizardState'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: 'app' | 'blank'
    titleKey?: string
    public?: boolean
  }
}

const setupStepRoutes: RouteRecordRaw[] = SETUP_STEPS.map((step) => ({
  path: step.path,
  name: `setup-${step.id}`,
  component: step.component,
  meta: { layout: 'blank', titleKey: `setup.${step.i18n}.title` },
}))

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: { name: 'dashboard' } },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { layout: 'blank', public: true },
  },
  {
    path: '/setup',
    component: () => import('@/views/SetupView.vue'),
    meta: { layout: 'blank' },
    children: [
      {
        path: '',
        name: 'setup',
        component: () => import('@/components/setup/SetupWelcome.vue'),
        meta: { layout: 'blank', titleKey: 'setup.welcome.title' },
      },
      ...setupStepRoutes,
    ],
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { titleKey: 'dashboard.title' },
  },
  {
    path: '/users/:tab(overview|users|groups|profiles)?',
    name: 'users',
    component: () => import('@/views/UsersView.vue'),
    meta: { titleKey: 'users.title' },
  },
  {
    path: '/trunks/:tab(voip|physical)?',
    name: 'trunks',
    component: () => import('@/views/TrunksView.vue'),
    meta: { titleKey: 'trunks.title' },
  },
  {
    path: '/routes/:tab(inbound|outbound)?',
    name: 'routes',
    component: () => import('@/views/RoutesView.vue'),
    meta: { titleKey: 'routes.title' },
  },
  {
    path: '/phones/:tab(phones|models|settings)?',
    name: 'phones',
    component: () => import('@/views/PhonesView.vue'),
    meta: { titleKey: 'phones.title' },
  },
  {
    path: '/integrations/:tab(phonebook|video-sources|parameterized-urls|customer-cards|external-services)?',
    name: 'integrations',
    component: () => import('@/views/IntegrationsView.vue'),
    meta: { titleKey: 'integrations.title' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { titleKey: 'settings.title' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { titleKey: 'not_found.title' },
  },
]

const router = createRouter({
  history: createWebHistory(APP_BASE_PATH),
  routes,
})

router.beforeEach(async (to) => {
  const loginStore = useLoginStore()

  if (!to.meta.public && !loginStore.isAuthenticated) {
    return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  }

  if (to.name === 'login' && loginStore.isAuthenticated) {
    return getInternalRedirect(to.query.redirect) ?? { name: 'dashboard' }
  }

  if (to.meta.public) {
    return true
  }
  const wizardState = await loadWizardState()

  if (!wizardState) {
    return true
  }
  return getWizardRedirect(to.name, wizardState) ?? true
})

export default router
