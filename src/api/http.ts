/**
 * Thin fetch wrapper used by every API module.
 * - Always sends the httpOnly session cookie (credentials: 'include').
 * - Normalises RFC 7807 ProblemDetails into ApiError.
 * - Notifies the auth layer on 401 so the session can be torn down centrally.
 */

export interface ProblemDetails {
  type?: string | null
  title?: string | null
  status?: number | null
  detail?: string | null
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem?: ProblemDetails

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
  headers?: Record<string, string>
  /** Don't trigger the global session-expired flow on 401 (e.g. login, session probe). */
  skipUnauthorizedHandler?: boolean
}

const FRIENDLY_MESSAGES: Record<number, string> = {
  400: 'Some of the information provided is invalid. Please check and try again.',
  401: 'Your session is not valid. Please log in again.',
  403: 'You are not allowed to perform this action.',
  404: 'The requested information could not be found.',
  409: 'This request conflicts with an existing record.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
}

function messageFor(status: number, problem?: ProblemDetails): string {
  // Prefer server validation detail only for client errors; never surface 5xx internals.
  if (status >= 400 && status < 500 && status !== 401) {
    const firstFieldError = problem?.errors && Object.values(problem.errors).flat()[0]
    const serverMessage = problem?.detail || firstFieldError
    if (serverMessage) return serverMessage
  }
  return FRIENDLY_MESSAGES[status] ?? 'Something went wrong on our side. Please try again later.'
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, headers, skipUnauthorizedHandler } = options

  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'We could not reach Online Banking. Check your connection and try again.')
  }

  const data = await parseBody(response)

  if (!response.ok) {
    const problem = data && typeof data === 'object' ? (data as ProblemDetails) : undefined
    if (response.status === 401 && !skipUnauthorizedHandler) unauthorizedHandler?.()
    throw new ApiError(response.status, messageFor(response.status, problem), problem)
  }

  return data as T
}
