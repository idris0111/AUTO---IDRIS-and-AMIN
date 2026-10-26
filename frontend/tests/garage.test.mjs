import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// Use Vite's existing TypeScript loader so these tests exercise the actual store.
let server
let useGarage
let requests
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalStorage = globalThis.localStorage
const makes = [{ id: 'toyota', name: 'Toyota', models: [] }]

before(async () => {
  globalThis.window = { location: { origin: 'http://localhost:5173' } }
  const values = new Map()
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    appType: 'custom',
    server: { middlewareMode: true, watch: null },
  })
  ;({ useGarage } = await server.ssrLoadModule('/src/stores/garage.ts'))
})

beforeEach(() => {
  requests = []
  useGarage.setState({ vehicleTree: [] })
  globalThis.fetch = async url => {
    requests.push(url)
    return Response.json(makes)
  }
})

after(async () => {
  await server?.close()
  globalThis.fetch = originalFetch
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  if (originalStorage === undefined) delete globalThis.localStorage
  else globalThis.localStorage = originalStorage
})

test('vehicle query returns fetched data and stores it for the configurator', async () => {
  const result = await useGarage.getState().loadVehicleTree()
  assert.deepEqual(result, makes)
  assert.strictEqual(result, useGarage.getState().vehicleTree)
  assert.equal(requests.length, 1)
  assert.equal(new URL(requests[0]).pathname, '/api/v1/vehicles')
})

test('cached vehicle query returns data without another request', async () => {
  const first = await useGarage.getState().loadVehicleTree()
  const cached = await useGarage.getState().loadVehicleTree()
  assert.deepEqual(cached, makes)
  assert.strictEqual(cached, first)
  assert.equal(requests.length, 1)
})

test('an empty vehicle catalog returns an array rather than undefined', async () => {
  globalThis.fetch = async () => Response.json([])
  assert.deepEqual(await useGarage.getState().loadVehicleTree(), [])
})

test('failed vehicle queries can be retried without caching an error', async () => {
  globalThis.fetch = async () => Response.json({ detail: 'Unavailable' }, { status: 503 })
  await assert.rejects(useGarage.getState().loadVehicleTree(), /Unavailable/)
  assert.deepEqual(useGarage.getState().vehicleTree, [])
  globalThis.fetch = async () => Response.json(makes)
  assert.deepEqual(await useGarage.getState().loadVehicleTree(), makes)
})
