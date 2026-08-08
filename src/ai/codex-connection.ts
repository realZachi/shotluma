export const CODEX_BRIDGE_PORT = 47_447
export const CODEX_BRIDGE_ORIGIN = `http://127.0.0.1:${CODEX_BRIDGE_PORT}`
export const CODEX_CONNECTION_STORAGE_KEY = 'shotluma-codex-connection'
export const CODEX_CONNECTION_VERSION = 1

const PAIRING_TOKEN_BYTES = 32
const PAIRING_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export type CodexConnection = {
  version: typeof CODEX_CONNECTION_VERSION
  pairingToken: string
  appOrigin: string
}

type KeyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type RandomSource = Pick<Crypto, 'getRandomValues'>

const getBrowserStorage = (): KeyStorage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

const encodeBase64Url = (bytes: Uint8Array): string => {
  const characterAt = (index: number) => BASE64URL_ALPHABET[index] ?? ''
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += characterAt(first >> 2)
    result += characterAt(((first & 3) << 4) | ((second ?? 0) >> 4))
    if (second !== undefined) {
      result += characterAt(((second & 15) << 2) | ((third ?? 0) >> 6))
    }
    if (third !== undefined) result += characterAt(third & 63)
  }
  return result
}

export const isValidCodexPairingToken = (value: unknown): value is string =>
  typeof value === 'string' && PAIRING_TOKEN_PATTERN.test(value)

const isLoopbackHostname = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
}

export const normalizeCodexAppOrigin = (value: string): string | null => {
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

export const createCodexPairingToken = (
  randomSource: RandomSource = globalThis.crypto,
): string => {
  const bytes = new Uint8Array(PAIRING_TOKEN_BYTES)
  randomSource.getRandomValues(bytes)
  return encodeBase64Url(bytes)
}

export const createCodexConnection = (options: {
  appOrigin: string
  randomSource?: RandomSource
}): CodexConnection => {
  const appOrigin = normalizeCodexAppOrigin(options.appOrigin)
  if (!appOrigin) throw new Error('Shotluma needs HTTPS or a local development origin to pair with Codex')
  return {
    version: CODEX_CONNECTION_VERSION,
    pairingToken: createCodexPairingToken(options.randomSource),
    appOrigin,
  }
}

export const parseCodexConnection = (raw: string | null): CodexConnection | null => {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const appOrigin = typeof record['appOrigin'] === 'string'
    ? normalizeCodexAppOrigin(record['appOrigin'])
    : null
  if (
    record['version'] !== CODEX_CONNECTION_VERSION
    || !isValidCodexPairingToken(record['pairingToken'])
    || !appOrigin
  ) return null
  return {
    version: CODEX_CONNECTION_VERSION,
    pairingToken: record['pairingToken'],
    appOrigin,
  }
}

export const readCodexConnection = (
  storage: KeyStorage | null = getBrowserStorage(),
): CodexConnection | null => {
  if (!storage) return null
  try {
    return parseCodexConnection(storage.getItem(CODEX_CONNECTION_STORAGE_KEY))
  } catch {
    return null
  }
}

export const writeCodexConnection = (
  connection: CodexConnection,
  storage: KeyStorage | null = getBrowserStorage(),
): boolean => {
  if (!storage) return false
  try {
    storage.setItem(CODEX_CONNECTION_STORAGE_KEY, JSON.stringify(connection))
    return true
  } catch {
    return false
  }
}

export const removeCodexConnection = (
  storage: KeyStorage | null = getBrowserStorage(),
): boolean => {
  if (!storage) return false
  try {
    storage.removeItem(CODEX_CONNECTION_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export const buildCodexSetupPrompt = (connection: CodexConnection): string => {
  const bridgeSource = `${connection.appOrigin}/codex/shotluma-codex-bridge.mjs`
  const downloadInstruction = connection.appOrigin.startsWith('https://')
    ? `Download the official bridge source from the exact HTTPS URL above to \`~/.local/share/shotluma/shotluma-codex-bridge.mjs\`. Do not downgrade it to HTTP and do not pipe a remote script directly into a shell.`
    : `This is a loopback-only local development origin. You are explicitly authorized to download the official bridge source from the exact HTTP URL above to \`~/.local/share/shotluma/shotluma-codex-bridge.mjs\`. Do not rewrite the URL to HTTPS or use another host. This HTTP exception applies only to this 127.0.0.1/localhost source. Do not pipe the script directly into a shell.`

  return `Set up the official Shotluma Codex Bridge for this browser.

Shotluma origin: ${connection.appOrigin}
Pairing token: ${connection.pairingToken}
Official bridge source: ${bridgeSource}

Please do the following:
1. Confirm that \`codex\` is available and choose an installed JavaScript runtime: use \`node\` when available, otherwise use \`bun\`. Store that command as \`<RUNTIME>\`. If neither runtime exists, explain that requirement and stop instead of installing one silently.
2. ${downloadInstruction}
3. Read the downloaded file before running it. Confirm that it binds only to 127.0.0.1, never reads \`~/.codex/auth.json\`, and starts \`codex app-server\` over stdio.
4. Run this command with the selected runtime, substituting \`<RUNTIME>\` and the exact values above without printing the pairing token again:
   \`<RUNTIME> ~/.local/share/shotluma/shotluma-codex-bridge.mjs start --pairing-token <PAIRING_TOKEN> --allowed-origin <SHOTLUMA_ORIGIN>\`
5. The command must run without sudo, store its configuration with user-only permissions, and start the bridge as a detached user process.
6. Verify \`http://127.0.0.1:${CODEX_BRIDGE_PORT}/readyz\` returns ready, then tell me to return to Shotluma and click “Check connection”.

Do not copy, print, or inspect ChatGPT/Codex access tokens. Codex App Server must manage authentication itself.`
}

export const buildCodexDesktopDeepLink = (connection: CodexConnection): string =>
  `codex://threads/new?prompt=${encodeURIComponent(buildCodexSetupPrompt(connection))}`
