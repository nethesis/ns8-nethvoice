import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const BASE = '/nethvoice/'
const PROXIED_PATHS = [
  '/freepbx/rest',
  '/freepbx/admin',
  '/freepbx/visualplan',
  '/api',
  '/tancredi',
]
const PHONE_ISLAND_RUNTIME = /^@\/lib\/adminPhone\/phoneIslandRuntime$/
const PHONE_ISLAND_E2E_STUB = fileURLToPath(
  new URL('./e2e/fixtures/phoneIslandStub.ts', import.meta.url),
)

const devRuntimeConfig = (): Plugin => ({
  name: 'nethvoice-ui-dev-runtime-config',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = request.url?.split('?')[0]

      if (path === `${BASE}config.json`) {
        response.setHeader('Content-Type', 'application/json')
        response.end(
          JSON.stringify({
            BRAND_NAME: 'NethVoice',
            BRAND_SITE: 'https://www.nethesis.it/soluzioni/nethvoice',
            BRAND_DOCS: 'https://docs.nethvoice.com/',
            NAVBAR_LOGO_URL: '',
            LOGIN_LOGO_URL: '',
            LOGIN_BACKGROUND_URL: '',
            FAVICON_URL: '',
          }),
        )
      } else if (path === '/' || path === '/nethvoice') {
        response.statusCode = 302
        response.setHeader('Location', BASE)
        response.end()
      } else {
        next()
      }
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isE2e = env.VITE_E2E === 'true'
  const pbxUrl = isE2e ? '' : env.NETHVOICE_PBX_URL

  return {
    base: BASE,
    plugins: [vue(), tailwindcss(), devRuntimeConfig()],
    resolve: {
      alias: [
        ...(isE2e ? [{ find: PHONE_ISLAND_RUNTIME, replacement: PHONE_ISLAND_E2E_STUB }] : []),
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
    optimizeDeps: {
      include: ['@nethesis/phone-island', 'react', 'react-dom/client'],
    },
    server: {
      host: '127.0.0.1',
      port: 5183,
      hmr: isE2e ? false : undefined,
      proxy: pbxUrl
        ? Object.fromEntries(
            PROXIED_PATHS.map((path) => [
              path,
              { target: pbxUrl, changeOrigin: true, secure: true },
            ]),
          )
        : undefined,
    },
  }
})
