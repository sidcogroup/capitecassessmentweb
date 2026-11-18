import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { accounts, mockApi, renderApp, session, transactionsPage } from '../test/utils'

const consultantSession = { userId: 9, username: 'consultant1', role: 'Consultant' }
const USER_ID = 1000000001
const ACCOUNT_ID = '3f0c1b8e-6d4a-4c1e-9a77-2b5d1f0e9c11'

const clientsPage = {
  items: [
    { userId: USER_ID, username: 'bennsid', firstName: 'Benn', lastName: 'Sid', email: 'b@example.com' },
    { userId: 1000000002, username: 'jdoe', firstName: 'Jane', lastName: 'Doe', email: null },
  ],
  page: 1,
  pageSize: 5,
  totalCount: 7,
  totalPages: 2,
}

const clientProfile = {
  userId: USER_ID,
  username: 'bennsid',
  email: 'b@example.com',
  firstName: 'Benn',
  lastName: 'Sid',
  contactNumber: '0820000000',
  contactEmail: null,
  createdAt: '2026-01-15T09:00:00Z',
}

const clientAccounts = [{ ...accounts[0], accountId: ACCOUNT_ID }]

const dispute = {
  transactionId: '11111111-1111-1111-1111-111111111111',
  disputeReference: 'DSP-00000042',
  reason: 'I did not authorise this transaction',
  details: 'Card was stolen',
  status: 'Submitted',
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T10:00:00Z',
  transactionReference: 'POS-001',
  transactionAmount: -899.99,
  accountNumber: '1052000101',
}

const disputesPage = (items: unknown[]) => ({
  items,
  page: 1,
  pageSize: 10,
  totalCount: items.length,
  totalPages: 1,
})

function consultantRoutes() {
  let current = { ...dispute }
  return mockApi({
    'GET /api/v1/authenticate/me': () => ({ status: 200, body: consultantSession }),
    'GET /api/v1/consultant/clients': () => ({ status: 200, body: clientsPage }),
    [`GET /api/v1/consultant/clients/${USER_ID}`]: () => ({ status: 200, body: clientProfile }),
    [`GET /api/v1/consultant/clients/${USER_ID}/accounts`]: () => ({
      status: 200,
      body: clientAccounts,
    }),
    [`GET /api/v1/consultant/accounts/${ACCOUNT_ID}/transactions`]: () => ({
      status: 200,
      body: { ...transactionsPage, pageSize: 5 },
    }),
    'GET /api/v1/consultant/disputes': () => ({ status: 200, body: disputesPage([current]) }),
    [`GET /api/v1/consultant/clients/${USER_ID}/disputes`]: () => ({
      status: 200,
      body: disputesPage([current]),
    }),
    // Second client: no accounts and no disputes.
    'GET /api/v1/consultant/clients/1000000002/accounts': () => ({ status: 200, body: [] }),
    'GET /api/v1/consultant/clients/1000000002/disputes': () => ({
      status: 200,
      body: disputesPage([]),
    }),
    'PUT /api/v1/consultant/disputes/DSP-00000042': (body) => {
      const { status } = body as { status: string }
      current = { ...current, status, updatedAt: '2026-11-18T12:00:00Z' }
      return { status: 200, body: current }
    },
  })
}

describe('consultant dashboard', () => {
  it('lands on the consultant dashboard and lists clients', async () => {
    const fetchMock = consultantRoutes()
    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Consultant Dashboard' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Benn Sid' })).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 2 · 7 clients')).toBeInTheDocument()
    // Customer-only endpoints are never called for a consultant.
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/v1/accounts'))).toBe(false)

    const clientsCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith('/api/v1/consultant/clients?'),
    )
    expect(String(clientsCall?.[0])).toContain('Page=1&PageSize=5')
  })

  it('shows client details, accounts, disputes and account transactions', async () => {
    const user = userEvent.setup()
    consultantRoutes()
    renderApp('/consultant')

    await user.click(await screen.findByRole('link', { name: 'Benn Sid' }))

    expect(await screen.findByRole('heading', { name: 'Benn Sid' })).toBeInTheDocument()
    expect(await screen.findByText('0820000000')).toBeInTheDocument()
    expect(await screen.findByText('DSP-00000042')).toBeInTheDocument()

    await user.click(await screen.findByRole('link', { name: '1052000101' }))
    expect(await screen.findByRole('heading', { name: /transaction history/i })).toBeInTheDocument()
    expect(await screen.findByText('Card purchase')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Benn Sid' })).toBeInTheDocument()
  })

  it('updates a dispute status with a note', async () => {
    const user = userEvent.setup()
    const fetchMock = consultantRoutes()
    renderApp('/consultant/disputes')

    const row = (await screen.findByText('DSP-00000042')).closest('tr')!
    expect(within(row).getByText('Submitted')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: /update dispute/i }))

    const dialog = await screen.findByRole('dialog', { name: /update dispute DSP-00000042/i })
    await user.click(within(dialog).getByRole('button', { name: /save update/i }))
    expect(await within(dialog).findByText(/change the status or add a note/i)).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByLabelText(/new status/i), 'Under Review')
    await user.type(within(dialog).getByLabelText(/note/i), '  Investigating with merchant ')
    await user.click(within(dialog).getByRole('button', { name: /save update/i }))

    expect(
      await screen.findByText('Dispute DSP-00000042 is now Under Review.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      status: 'Under Review',
      note: 'Investigating with merchant',
    })
    // The list is refetched and shows the new status.
    const updatedRow = (await screen.findByText('DSP-00000042')).closest('tr')!
    expect(await within(updatedRow).findByText('Under Review')).toBeInTheDocument()
  })

  it('marks clients that have disputes on the dashboard', async () => {
    const user = userEvent.setup()
    consultantRoutes()
    renderApp('/consultant')

    const bennRow = (await screen.findByRole('link', { name: 'Benn Sid' })).closest('tr')!
    const janeRow = screen.getByRole('link', { name: 'Jane Doe' }).closest('tr')!
    expect(await within(bennRow).findByText('1 open')).toBeInTheDocument()
    expect(bennRow).toHaveClass('row--flagged')
    expect(await within(janeRow).findByText('None')).toBeInTheDocument()
    expect(janeRow).not.toHaveClass('row--flagged')

    await user.click(within(bennRow).getByText('1 open'))
    expect(await screen.findByRole('heading', { name: 'Benn Sid' })).toBeInTheDocument()
  })

  it('links each dispute to its client and account', async () => {
    const user = userEvent.setup()
    consultantRoutes()
    renderApp('/consultant/disputes')

    const row = (await screen.findByText('DSP-00000042')).closest('tr')!
    const clientLink = await within(row).findByRole('link', { name: 'Benn Sid' })
    expect(clientLink).toHaveAttribute('href', `/consultant/clients/${USER_ID}`)
    expect(
      within(row).getByRole('link', { name: /view transactions for account 1052000101/i }),
    ).toHaveAttribute('href', `/consultant/clients/${USER_ID}/accounts/${ACCOUNT_ID}`)

    await user.click(clientLink)
    expect(await screen.findByRole('heading', { name: 'Benn Sid' })).toBeInTheDocument()
  })

  it('keeps customers out of the consultant area', async () => {
    mockApi({
      'GET /api/v1/authenticate/me': () => ({ status: 200, body: session }),
      'GET /api/v1/accounts': () => ({ status: 200, body: accounts }),
      'GET /api/v1/users/profile': () => ({ status: 200, body: { userId: 1, fullName: 'Benn' } }),
    })
    renderApp('/consultant/disputes')

    expect(await screen.findByRole('heading', { name: /my banking portfolio/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Consultant Dashboard' })).not.toBeInTheDocument()
  })
})
