import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformWithOxc, type Plugin } from 'vite'

export const CODEX_BRIDGE_ASSET_PATH = '/codex/shotluma-codex-bridge.mjs'

const bridgeSourcePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'shotluma-codex-bridge.ts',
)

export const buildCodexBridgeAsset = async (): Promise<string> => {
  const source = await readFile(bridgeSourcePath, 'utf8')
  const result = await transformWithOxc(source, bridgeSourcePath, {
    lang: 'ts',
    target: 'es2023',
  })
  return result.code
}

export const createCodexBridgeAssetPlugin = (): Plugin => ({
  name: 'shotluma-codex-bridge-asset',
  async buildStart() {
    this.emitFile({
      type: 'asset',
      fileName: CODEX_BRIDGE_ASSET_PATH.slice(1),
      source: await buildCodexBridgeAsset(),
    })
  },
  configureServer(server) {
    server.middlewares.use(CODEX_BRIDGE_ASSET_PATH, (_request, response) => {
      void buildCodexBridgeAsset().then((source) => {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.setHeader('Cache-Control', 'no-store')
        response.end(source)
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Bridge build failed'
        console.error(`Unable to build the Shotluma Codex Bridge asset: ${message}`)
        response.statusCode = 500
        response.end('Bridge build failed')
      })
    })
  },
})
