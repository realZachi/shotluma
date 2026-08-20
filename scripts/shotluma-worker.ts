import { proxyOpencodeRequest, rewriteOpencodeProxyUrl } from './opencode-proxy'
import { handleShareRequest, type ShareApiEnv } from './share-api'

export type ShotlumaWorkerEnv = ShareApiEnv

/**
 * Single Worker entry for app.shotluma.com. It mounts the share API and
 * share pages (`scripts/share-api.ts`) and the hosted same-origin CORS proxy
 * for OpenCode Zen/Go — browser keys stay on the request; the worker only
 * rewrites the URL so app.shotluma.com can call an API that does not answer
 * OPTIONS preflight. Everything else is served from static assets.
 */
export default {
  async fetch(request: Request, env: ShotlumaWorkerEnv): Promise<Response> {
    const shareResponse = handleShareRequest(request, env)
    if (shareResponse) return shareResponse
    if (rewriteOpencodeProxyUrl(new URL(request.url))) {
      return proxyOpencodeRequest(request)
    }
    return env.ASSETS.fetch(request)
  },
}
