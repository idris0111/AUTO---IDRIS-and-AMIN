import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

let server, auth, api, garage, cart, app, i18n
const originals = Object.fromEntries(['window', 'document', 'localStorage', 'fetch'].map(key => [key, globalThis[key]]))
const values = new Map()
const user = { id: 'test-user', first_name: 'Test', email: 'test@example.test', role: 'customer' }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

before(async () => {
  globalThis.window = Object.assign(new EventTarget(), { location: { origin: 'http://localhost:5173' } })
  globalThis.document = { documentElement: { lang: '', classList: { toggle() {} } } }
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
  server = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom', server: { middlewareMode: true, watch: null, hmr: false }, optimizeDeps: { noDiscovery: true } })
  api = await server.ssrLoadModule('/src/lib/api.ts')
  ;({ useAuth: auth } = await server.ssrLoadModule('/src/stores/auth.ts'))
  ;({ useGarage: garage } = await server.ssrLoadModule('/src/stores/garage.ts'))
  ;({ useCart: cart } = await server.ssrLoadModule('/src/stores/cart.ts'))
  ;({ useApp: app } = await server.ssrLoadModule('/src/stores/app.ts'))
  ;({ default: i18n } = await server.ssrLoadModule('/src/i18n/index.ts'))
})
beforeEach(() => {
  api.clearTokens()
  values.clear()
  globalThis.fetch = async url => String(url).includes('/auth/login')
    ? Response.json({ access_token: 'access', refresh_token: 'refresh' }) : Response.json(user)
})
after(async () => {
  await server?.close()
  for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value }
})

test('language changes copy, html lang and persisted preference for all locales', async () => {
  for (const [locale, headline, login] of [['ru', 'АВТОЗАПЧАСТИ', 'Войти'], ['en', 'AUTO PARTS', 'Sign in'], ['tg', 'ҚИСМҲОИ МОШИН', 'Даромадан']]) {
    app.getState().setLocale(locale)
    await i18n.changeLanguage(locale)
    assert.equal(i18n.t('АВТОЗАПЧАСТИ'), headline)
    assert.equal(i18n.t('login'), login)
    assert.equal(document.documentElement.lang, locale)
    assert.equal(values.get('au_locale'), locale)
  }
})
test('every storefront phrase has an English and Tajik translation', async () => {
  const { storefront } = await server.ssrLoadModule('/src/i18n/storefront.ts')
  assert.deepEqual(Object.keys(storefront.en), Object.keys(storefront.ru))
  assert.deepEqual(Object.keys(storefront.tg), Object.keys(storefront.ru))
  for (const locale of ['ru', 'en', 'tg']) assert.ok(Object.values(storefront[locale]).every(Boolean))
})
test('login loads the authenticated user', async () => {
  await auth.getState().login('test@example.test', 'test-password')
  assert.equal(auth.getState().user.id, user.id)
  assert.equal(api.getAccessToken(), 'access')
  assert.equal(auth.getState().loading, false)
})
test('incorrect password does not attempt to refresh a different session', async () => {
  api.setTokens('old-access', 'old-refresh')
  const requests = []
  globalThis.fetch = async url => { requests.push(String(url)); return Response.json({ detail: 'Invalid credentials' }, { status: 401 }) }
  await assert.rejects(auth.getState().login('test@example.test', 'wrong-password'), /Invalid credentials/)
  assert.equal(requests.length, 1)
  assert.equal(auth.getState().user, null)
  assert.equal(api.getAccessToken(), null)
})
test('logout clears account data before the server responds', async () => {
  api.setTokens('access', 'refresh')
  auth.setState({ user })
  garage.setState({ vehicles: [{ id: 'car' }], selectedVehicleId: 'car' })
  cart.setState({ cart: { count: 3 } })
  const reply = deferred()
  globalThis.fetch = () => reply.promise
  const pending = auth.getState().logout()
  assert.equal(auth.getState().user, null)
  assert.equal(api.getRefreshToken(), null)
  assert.deepEqual(garage.getState().vehicles, [])
  assert.equal(garage.getState().selectedVehicleId, null)
  assert.equal(cart.getState().cart, null)
  reply.resolve(new Response(null, { status: 204 }))
  await pending
})
test('a late garage response cannot restore private data after logout', async () => {
  api.setTokens('access', 'refresh')
  const reply = deferred()
  globalThis.fetch = () => reply.promise
  const pending = garage.getState().loadGarage()
  api.clearTokens()
  reply.resolve(Response.json([{ id: 'old-car', is_primary: true }]))
  await assert.rejects(pending, /Session ended/)
  assert.deepEqual(garage.getState().vehicles, [])
})
test('a late token refresh cannot sign the user back in after logout', async () => {
  api.setTokens('expired', 'refresh')
  const reply = deferred(), started = deferred()
  globalThis.fetch = async url => {
    if (String(url).endsWith('/auth/refresh')) { started.resolve(); return reply.promise }
    return Response.json({ detail: 'Expired' }, { status: 401 })
  }
  const pending = api.api.get('/users/me')
  await started.promise
  api.clearTokens()
  reply.resolve(Response.json({ access_token: 'new', refresh_token: 'new-refresh' }))
  await assert.rejects(pending, /Session ended/)
  assert.equal(api.getAccessToken(), null)
  assert.equal(auth.getState().user, null)
})
