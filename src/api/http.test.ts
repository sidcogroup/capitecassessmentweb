import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi } from '../test/utils'
import { ApiError, request, setUnauthorizedHandler } from './http'

describe('request', () => {
  afterEach(() => setUnauthorizedHandler(null))

  it('sends credentials and JSON body', async () => {
    const fetchMock = mockApi({ 'POST /api/x': (body) => ({ status: 200, body: { echo: body } }) })
    await expect(request('/api/x', { method: 'POST', body: { a: 1 } })).resolves.toEqual({
      echo: { a: 1 },
    })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('invokes the unauthorized handler on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockApi({ 'GET /api/x': () => ({ status: 401 }) })
    await expect(request('/api/x')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledOnce()
  })

  it('does not invoke the handler when skipUnauthorizedHandler is set', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    mockApi({ 'GET /api/x': () => ({ status: 401 }) })
    await expect(request('/api/x', { skipUnauthorizedHandler: true })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it('surfaces ProblemDetails for 4xx but hides 5xx internals', async () => {
    mockApi({
      'GET /api/bad': () => ({ status: 400, body: { title: 'Bad', detail: 'Days must be > 0' } }),
      'GET /api/boom': () => ({ status: 500, body: { detail: 'NullReferenceException at ...' } }),
    })
    await expect(request('/api/bad')).rejects.toThrow('Days must be > 0')
    const err: unknown = await request('/api/boom').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).not.toContain('NullReference')
  })
})
