// Pages Function: same-origin proxy for /api/* so the httpOnly session cookie
// issued by the backend works on the Pages domain (mirrors the Vite dev proxy).
interface Env {
  API_PROXY_TARGET?: string
}

const DEFAULT_TARGET =
  'https://capitecassessment-api.lemonbush-17bdcca3.southafricanorth.azurecontainerapps.io'

export const onRequest = async ({
  request,
  env,
}: {
  request: Request
  env: Env
}): Promise<Response> => {
  const target = (env.API_PROXY_TARGET || DEFAULT_TARGET).replace(/\/$/, '')
  const url = new URL(request.url)
  const upstream = new Request(target + url.pathname + url.search, request)
  const res = await fetch(upstream)

  // Drop any Domain attribute so the cookie binds to the Pages host.
  const headers = new Headers(res.headers)
  const cookies = res.headers.getSetCookie()
  if (cookies.length) {
    headers.delete('set-cookie')
    for (const c of cookies) {
      headers.append('set-cookie', c.replace(/;\s*Domain=[^;]*/i, ''))
    }
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}
