import { proxyOpencodeRequest, rewriteOpencodeProxyUrl } from './opencode-proxy'

type AssetFetcher = {
  fetch: (request: Request) => Promise<Response>
}

export type ShotlumaWorkerEnv = {
  ASSETS: AssetFetcher
}

/**
 * Hosted same-origin CORS proxy for OpenCode Zen/Go. Browser keys stay on the
 * request; the worker only rewrites the URL so app.shotluma.com can call an
 * API that does not answer OPTIONS preflight.
 */
export default {
  async fetch(request: Request, env: ShotlumaWorkerEnv): Promise<Response> {
    if (rewriteOpencodeProxyUrl(new URL(request.url))) {
      return proxyOpencodeRequest(request)
    }
    return env.ASSETS.fetch(request)
  },
}
