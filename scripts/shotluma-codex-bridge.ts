import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath, pathToFileURL } from 'node:url'

const BRIDGE_VERSION = 1
const BRIDGE_HOST = '127.0.0.1'
const BRIDGE_PORT = 47_447
const MAX_REQUEST_BYTES = 48 * 1024 * 1024
const MAX_EVENT_COUNT = 1_000
const LONG_POLL_TIMEOUT_MS = 20_000
const PAIRING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const CONTROL_SECRET_PATTERN = /^[A-Fa-f0-9]{64}$/
const BRIDGE_INITIALIZE_ID = 'shotluma-bridge-initialize'
const ALLOWED_RPC_METHODS = new Set([
  'account/read',
  'account/rateLimits/read',
  'model/list',
  'thread/start',
  'thread/delete',
  'turn/start',
  'turn/interrupt',
])

type JsonRpcMessage = Record<string, unknown>

export type BridgeCommand =
  | { type: 'help' }
  | { type: 'serve' }
  | { type: 'start'; pairingToken: string; allowedOrigin: string }
  | { type: 'stop' }

type BridgeConfig = {
  version: typeof BRIDGE_VERSION
  pairingToken: string
  allowedOrigin: string
  controlSecret: string
}

type BridgeEvent = {
  sequence: number
  message: JsonRpcMessage
}

const dataDirectory = path.join(homedir(), '.local', 'share', 'shotluma')
const configPath = path.join(dataDirectory, 'codex-bridge.json')
const workspacePath = path.join(dataDirectory, 'codex-workspace')
const bridgeScriptPath = fileURLToPath(import.meta.url)

const usage = `Shotluma Codex Bridge

Commands:
  start --pairing-token <token> --allowed-origin <origin>
  serve
  stop
`

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
}

const normalizeOrigin = (value: string): string | null => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.protocol === 'http:' && !isLoopbackHostname(url.hostname)) return null
  if (url.username || url.password) return null
  return url.origin
}

const readFlag = (args: string[], flag: string): string | null => {
  const index = args.indexOf(flag)
  if (index < 0) return null
  return args[index + 1] ?? null
}

export const parseBridgeCommand = (args: string[]): BridgeCommand => {
  const [command = 'help'] = args
  if (command === 'serve') return { type: 'serve' }
  if (command === 'stop') return { type: 'stop' }
  if (command !== 'start') return { type: 'help' }

  const pairingToken = readFlag(args, '--pairing-token')
  const allowedOriginValue = readFlag(args, '--allowed-origin')
  const allowedOrigin = allowedOriginValue ? normalizeOrigin(allowedOriginValue) : null
  if (!pairingToken || !PAIRING_TOKEN_PATTERN.test(pairingToken)) {
    throw new Error('The Shotluma pairing token is missing or invalid')
  }
  if (!allowedOrigin) throw new Error('The Shotluma browser origin is missing or invalid')
  return { type: 'start', pairingToken, allowedOrigin }
}

const equalSecret = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual)
  const expectedBytes = Buffer.from(expected)
  return actualBytes.length === expectedBytes.length
    && timingSafeEqual(actualBytes, expectedBytes)
}

export const isAuthorizedBridgeRequest = (options: {
  requestOrigin: string | undefined
  authorization: string | undefined
  config: Pick<BridgeConfig, 'allowedOrigin' | 'pairingToken'>
}): boolean => {
  if (options.requestOrigin !== options.config.allowedOrigin) return false
  const prefix = 'Bearer '
  if (!options.authorization?.startsWith(prefix)) return false
  return equalSecret(options.authorization.slice(prefix.length), options.config.pairingToken)
}

const isAllowedRpcMessage = (message: JsonRpcMessage): boolean => {
  if (typeof message['method'] === 'string') {
    return ALLOWED_RPC_METHODS.has(message['method'])
      && (typeof message['id'] === 'string' || typeof message['id'] === 'number')
  }
  return (typeof message['id'] === 'string' || typeof message['id'] === 'number')
    && ('result' in message || 'error' in message)
}

export const restrictRpcMessage = (message: JsonRpcMessage): JsonRpcMessage | null => {
  if (!isAllowedRpcMessage(message)) return null
  const method = message['method']
  if (method === 'thread/start') {
    const params = isObject(message['params']) ? message['params'] : {}
    return {
      ...message,
      params: {
        ...params,
        approvalPolicy: 'never',
        cwd: workspacePath,
        environments: [],
        sandbox: 'read-only',
        serviceName: 'shotluma',
      },
    }
  }
  if (method === 'turn/start') {
    const params = isObject(message['params']) ? message['params'] : {}
    return {
      ...message,
      params: {
        ...params,
        approvalPolicy: 'never',
        cwd: workspacePath,
        environments: [],
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
      },
    }
  }
  return message
}

const parseConfig = (value: unknown): BridgeConfig | null => {
  if (!isObject(value)) return null
  const allowedOrigin = typeof value['allowedOrigin'] === 'string'
    ? normalizeOrigin(value['allowedOrigin'])
    : null
  if (
    value['version'] !== BRIDGE_VERSION
    || typeof value['pairingToken'] !== 'string'
    || !PAIRING_TOKEN_PATTERN.test(value['pairingToken'])
    || typeof value['controlSecret'] !== 'string'
    || !CONTROL_SECRET_PATTERN.test(value['controlSecret'])
    || !allowedOrigin
  ) return null
  return {
    version: BRIDGE_VERSION,
    pairingToken: value['pairingToken'],
    allowedOrigin,
    controlSecret: value['controlSecret'],
  }
}

const readConfig = async (): Promise<BridgeConfig | null> => {
  try {
    return parseConfig(JSON.parse(await readFile(configPath, 'utf8')))
  } catch {
    return null
  }
}

const saveConfig = async (config: BridgeConfig): Promise<void> => {
  await mkdir(dataDirectory, { recursive: true, mode: 0o700 })
  await mkdir(workspacePath, { recursive: true, mode: 0o700 })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
  await chmod(configPath, 0o600)
}

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request) {
    if (typeof chunk !== 'string' && !(chunk instanceof Uint8Array)) {
      throw new Error('Request body contains an unsupported chunk')
    }
    const bytes = Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_REQUEST_BYTES) throw new Error('Request body exceeds the bridge limit')
    chunks.push(bytes)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
) => {
  response.writeHead(statusCode, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  })
  response.end(JSON.stringify(body))
}

const corsHeaders = (allowedOrigin: string): Record<string, string> => ({
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Private-Network': 'true',
  Vary: 'Origin',
})

class AppServerPipe {
  private child: ChildProcessWithoutNullStreams
  private events: BridgeEvent[] = []
  private nextSequence = 1
  private droppedThrough = 0
  private waiters = new Set<() => void>()
  private initializationError: string | null = null
  private isInitialized = false

  constructor() {
    this.child = spawn('codex', ['app-server', '--listen', 'stdio://'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    this.child.once('error', (error) => {
      this.initializationError = `Unable to start Codex App Server: ${error.message}`
      this.wakeWaiters()
    })
    this.child.once('exit', (code) => {
      this.initializationError = `Codex App Server stopped${code === null ? '' : ` with code ${code}`}`
      this.isInitialized = false
      this.wakeWaiters()
    })
    this.child.stdin.on('error', (error) => {
      this.initializationError = `Codex App Server input failed: ${error.message}`
      this.isInitialized = false
      this.wakeWaiters()
    })
    this.child.stderr.resume()
    const lines = createInterface({ input: this.child.stdout })
    lines.on('line', (line) => this.handleLine(line))
    this.write({
      id: BRIDGE_INITIALIZE_ID,
      method: 'initialize',
      params: {
        clientInfo: {
          name: 'shotluma',
          title: 'Shotluma',
          version: String(BRIDGE_VERSION),
        },
        capabilities: { experimentalApi: true },
      },
    })
  }

  getStatus() {
    return {
      ready: this.isInitialized,
      error: this.initializationError,
      sequence: this.nextSequence - 1,
    }
  }

  send(message: JsonRpcMessage) {
    if (!this.isInitialized) {
      throw new Error(this.initializationError ?? 'Codex App Server is not ready')
    }
    this.write(message)
  }

  async readEvents(after: number): Promise<{
    events: BridgeEvent[]
    sequence: number
    droppedThrough: number
  }> {
    const available = this.events.filter((event) => event.sequence > after)
    if (available.length > 0) return this.eventBatch(after)
    if (this.initializationError) throw new Error(this.initializationError)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        this.waiters.delete(done)
        resolve()
      }, LONG_POLL_TIMEOUT_MS)
      const done = () => {
        clearTimeout(timeout)
        this.waiters.delete(done)
        resolve()
      }
      this.waiters.add(done)
    })
    const nextAvailable = this.events.some((event) => event.sequence > after)
    if (!nextAvailable && this.initializationError) throw new Error(this.initializationError)
    return this.eventBatch(after)
  }

  stop() {
    this.child.kill('SIGTERM')
  }

  private handleLine(line: string) {
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      return
    }
    if (!isObject(message)) return
    if (message['id'] === BRIDGE_INITIALIZE_ID) {
      if ('error' in message) {
        this.initializationError = 'Codex App Server rejected the Shotluma handshake'
        this.wakeWaiters()
        return
      }
      try {
        this.write({ method: 'initialized', params: {} })
        this.isInitialized = true
      } catch (error) {
        this.initializationError = error instanceof Error
          ? error.message
          : 'Codex App Server input is unavailable'
        this.isInitialized = false
      }
      this.wakeWaiters()
      return
    }
    this.events.push({ sequence: this.nextSequence, message })
    this.nextSequence += 1
    while (this.events.length > MAX_EVENT_COUNT) {
      const dropped = this.events.shift()
      if (dropped) this.droppedThrough = dropped.sequence
    }
    this.wakeWaiters()
  }

  private write(message: JsonRpcMessage) {
    if (this.child.stdin.destroyed || !this.child.stdin.writable) {
      throw new Error(this.initializationError ?? 'Codex App Server input is unavailable')
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`)
  }

  private eventBatch(after: number) {
    return {
      events: this.events.filter((event) => event.sequence > after),
      sequence: this.nextSequence - 1,
      droppedThrough: this.droppedThrough,
    }
  }

  private wakeWaiters() {
    for (const resolve of this.waiters) resolve()
    this.waiters.clear()
  }
}

const isControlRequest = (request: IncomingMessage, config: BridgeConfig): boolean => {
  const value = request.headers['x-shotluma-control']
  return typeof value === 'string' && equalSecret(value, config.controlSecret)
}

type BridgeRequestContext = {
  request: IncomingMessage
  response: ServerResponse
  requestUrl: URL
  config: BridgeConfig
  appServer: AppServerPipe
}

const handleControlRequest = async (options: BridgeRequestContext & {
  onReload: (config: BridgeConfig) => void
  onStop: () => void
}): Promise<boolean> => {
  const { request, response, requestUrl, config, onReload, onStop } = options
  if (requestUrl.pathname === '/v1/control/reload' && request.method === 'POST') {
    if (!isControlRequest(request, config)) {
      writeJson(response, 401, { error: 'Unauthorized' })
      return true
    }
    const nextConfig = await readConfig()
    if (nextConfig?.controlSecret !== config.controlSecret) {
      writeJson(response, 409, { error: 'Config reload failed' })
      return true
    }
    onReload(nextConfig)
    writeJson(response, 200, { reloaded: true })
    return true
  }
  if (requestUrl.pathname !== '/v1/control/stop' || request.method !== 'POST') return false
  if (!isControlRequest(request, config)) {
    writeJson(response, 401, { error: 'Unauthorized' })
    return true
  }
  writeJson(response, 200, { stopped: true })
  onStop()
  return true
}

const handleRpcRequest = async (options: BridgeRequestContext, headers: Record<string, string>) => {
  const { request, response, appServer } = options
  try {
    const parsed: unknown = JSON.parse(await readRequestBody(request))
    const message = isObject(parsed) ? restrictRpcMessage(parsed) : null
    if (!message) {
      writeJson(response, 400, { error: 'RPC method is not allowed' }, headers)
      return
    }
    appServer.send(message)
    writeJson(response, 202, { accepted: true }, headers)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid RPC body'
    writeJson(response, appServer.getStatus().ready ? 400 : 503, { error: message }, headers)
  }
}

const handleAuthorizedRequest = async (
  options: BridgeRequestContext,
  headers: Record<string, string>,
): Promise<void> => {
  const { request, response, requestUrl, appServer } = options
  if (requestUrl.pathname === '/v1/status' && request.method === 'GET') {
    writeJson(response, 200, {
      bridgeVersion: BRIDGE_VERSION,
      appServer: appServer.getStatus(),
    }, headers)
    return
  }
  if (requestUrl.pathname === '/v1/events' && request.method === 'GET') {
    const afterValue = Number(requestUrl.searchParams.get('after') ?? 0)
    const after = Number.isSafeInteger(afterValue) && afterValue >= 0 ? afterValue : 0
    try {
      writeJson(response, 200, await appServer.readEvents(after), headers)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Codex App Server is unavailable'
      writeJson(response, 503, { error: message }, headers)
    }
    return
  }
  if (requestUrl.pathname === '/v1/rpc' && request.method === 'POST') {
    await handleRpcRequest(options, headers)
    return
  }
  writeJson(response, 404, { error: 'Not found' }, headers)
}

const handleBridgeRequest = async (options: BridgeRequestContext & {
  onReload: (config: BridgeConfig) => void
  onStop: () => void
}): Promise<void> => {
  const { request, response, requestUrl, config, appServer } = options
  if (requestUrl.pathname === '/readyz' && request.method === 'GET') {
    const status = appServer.getStatus()
    writeJson(response, status.ready ? 200 : 503, { ready: status.ready })
    return
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders(config.allowedOrigin))
    response.end()
    return
  }
  if (await handleControlRequest(options)) return

  const headers = corsHeaders(config.allowedOrigin)
  if (!isAuthorizedBridgeRequest({
    requestOrigin: request.headers.origin,
    authorization: request.headers.authorization,
    config,
  })) {
    writeJson(response, 401, { error: 'Unauthorized' }, headers)
    return
  }
  await handleAuthorizedRequest(options, headers)
}

const startHttpBridge = async () => {
  const storedConfig = await readConfig()
  if (!storedConfig) throw new Error(`Missing or invalid bridge config at ${configPath}`)
  let config: BridgeConfig = storedConfig
  const appServer = new AppServerPipe()
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${BRIDGE_HOST}:${BRIDGE_PORT}`)
    void handleBridgeRequest({
      request,
      response,
      requestUrl,
      config,
      appServer,
      onReload: (nextConfig) => { config = nextConfig },
      onStop: () => {
        appServer.stop()
        server.close()
      },
    }).catch((error: unknown) => {
      if (response.headersSent) return
      const message = error instanceof Error ? error.message : 'Bridge request failed'
      console.error(`Shotluma Codex Bridge request failed: ${message}`)
      writeJson(response, 500, { error: 'Bridge request failed' })
    })
  })
  await new Promise<void>((resolve, reject) => {
    const handleListenError = (error: NodeJS.ErrnoException) => {
      appServer.stop()
      const reason = error.code === 'EADDRINUSE'
        ? `Port ${BRIDGE_PORT} is already in use`
        : error.message
      reject(new Error(reason))
    }
    server.once('error', handleListenError)
    server.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
      server.off('error', handleListenError)
      resolve()
    })
  })
  server.on('error', (error) => {
    appServer.stop()
    console.error(`Shotluma Codex Bridge server failed: ${error.message}`)
    process.exitCode = 1
  })
}

const controlRequest = async (pathName: string, controlSecret: string): Promise<boolean> => {
  try {
    const response = await fetch(`http://${BRIDGE_HOST}:${BRIDGE_PORT}${pathName}`, {
      method: 'POST',
      headers: { 'X-Shotluma-Control': controlSecret },
      signal: AbortSignal.timeout(1_500),
    })
    return response.ok
  } catch {
    return false
  }
}

const waitUntilReady = async (): Promise<boolean> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://${BRIDGE_HOST}:${BRIDGE_PORT}/readyz`, {
        signal: AbortSignal.timeout(500),
      })
      if (response.ok) return true
    } catch {
      // The detached process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return false
}

const startDetachedBridge = async (command: Extract<BridgeCommand, { type: 'start' }>) => {
  const existingConfig = await readConfig()
  const config: BridgeConfig = {
    version: BRIDGE_VERSION,
    pairingToken: command.pairingToken,
    allowedOrigin: command.allowedOrigin,
    controlSecret: existingConfig?.controlSecret ?? randomBytes(32).toString('hex'),
  }
  await saveConfig(config)
  if (await controlRequest('/v1/control/reload', config.controlSecret)) {
    process.stdout.write('Shotluma Codex Bridge pairing updated.\n')
    return
  }

  const child = spawn(process.execPath, [bridgeScriptPath, 'serve'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  if (!await waitUntilReady()) {
    throw new Error('The bridge started but Codex App Server did not become ready')
  }
  process.stdout.write('Shotluma Codex Bridge is ready on localhost.\n')
}

const stopBridge = async () => {
  const config = await readConfig()
  if (!config || !await controlRequest('/v1/control/stop', config.controlSecret)) {
    process.stdout.write('Shotluma Codex Bridge is not running.\n')
    return
  }
  process.stdout.write('Shotluma Codex Bridge stopped.\n')
}

const main = async () => {
  const command = parseBridgeCommand(process.argv.slice(2))
  if (command.type === 'help') {
    process.stdout.write(usage)
    return
  }
  if (command.type === 'serve') {
    await startHttpBridge()
    return
  }
  if (command.type === 'stop') {
    await stopBridge()
    return
  }
  await startDetachedBridge(command)
}

const entryPath = process.argv[1]
if (entryPath && import.meta.url === pathToFileURL(path.resolve(entryPath)).href) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Shotluma Codex Bridge: ${message}`)
    process.exitCode = 1
  })
}
