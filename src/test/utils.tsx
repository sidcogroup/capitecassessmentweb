import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { AuthProvider } from '../auth/AuthContext'
import { createQueryClient } from '../lib/queryClient'

type Handler = (body: unknown, url: URL) => { status: number; body?: unknown }
export type Routes = Record<string, Handler>

/**
 * Stubs global fetch with a route table keyed by "METHOD /path".
 * Returns the mock so tests can assert on calls.
 */
export function mockApi(routes: Routes) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = (init?.method ?? 'GET').toUpperCase()
    const handler = routes[`${method} ${url.pathname}`]
    if (!handler) return new Response(null, { status: 404 })
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const res = handler(body, url)
    return new Response(res.body === undefined ? null : JSON.stringify(res.body), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const session = { userId: 1000000001, username: 'bennsid', role: 'Customer' }

export const accounts = [
  {
    accountName: 'Global One Account',
    accountNumber: '1052000101',
    accountType: 'Transact',
    balance: -50720.56,
    currency: 'ZAR',
  },
  {
    accountName: 'Flexi Savings',
    accountNumber: '1052000102',
    accountType: 'Savings',
    balance: 40900,
    currency: 'ZAR',
  },
]

export const transactionsPage = {
  items: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      transactionDate: '2026-11-10T08:30:00Z',
      description: 'Card purchase',
      merchant: 'Woolworths',
      amount: -899.99,
      type: 'Debit',
      reference: 'POS-001',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      transactionDate: '2026-11-01T06:00:00Z',
      description: 'Salary',
      merchant: null,
      amount: 25000,
      type: 'Credit',
      reference: 'SAL-NOV',
    },
  ],
  page: 1,
  pageSize: 10,
  totalCount: 2,
  totalPages: 1,
}

export function renderApp(route = '/') {
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
