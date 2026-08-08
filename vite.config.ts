import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { createAiRunLogPlugin } from './scripts/ai-run-log-plugin'
import { createClientProviderDefinitions } from './scripts/client-provider-environment'
import { createCodexBridgeAssetPlugin } from './scripts/codex-bridge-asset-plugin'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const aiLoggingValue = env['SHOTLUMA_AI_LOGGING'] ?? env['FRAMEFLOW_AI_LOGGING']
  const isAiLoggingEnabled = aiLoggingValue?.trim().toLowerCase() === 'true'
  const moonshotProxy = {
    '/api/moonshot': {
      target: 'https://api.moonshot.ai',
      changeOrigin: true,
      rewrite: (requestPath: string) => requestPath.replace(/^\/api\/moonshot/, ''),
    },
  }

  return {
    define: {
      __SHOTLUMA_AI_LOGGING__: JSON.stringify(isAiLoggingEnabled),
      ...createClientProviderDefinitions(env, command),
    },
    plugins: [
      react(),
      tailwindcss(),
      createCodexBridgeAssetPlugin(),
      createAiRunLogPlugin({
        isEnabled: isAiLoggingEnabled,
        projectRoot: path.resolve(__dirname),
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: Number(process.env['PORT']) || 4173,
      proxy: moonshotProxy,
    },
    preview: {
      proxy: moonshotProxy,
    },
  }
})
