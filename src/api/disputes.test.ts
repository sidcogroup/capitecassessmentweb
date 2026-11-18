import { beforeEach, describe, expect, it } from 'vitest'
import { mockApi } from '../test/utils'
import { buildCreateBody, clearMockDisputes, liveDisputesApi, mockDisputesApi } from './disputes'

const input = {
  accountNumber: '1052000101',
  transactionId: 'tx-1',
  reason: 'Duplicate' as const,
  details: 'I was charged twice for this.',
}
const snapshot = {
  transactionDate: '2026-11-10T08:30:00Z',
  description: 'Card purchase',
  reference: 'POS-001',
  amount: -100,
}

describe('mockDisputesApi', () => {
  beforeEach(() => clearMockDisputes())

  it('creates a dispute and lists it', async () => {
    const created = await mockDisputesApi.create(input, snapshot, 'key-1')
    expect(created.status).toBe('Submitted')
    expect(created.reference).toMatch(/^DSP-\d{8}$/)
    expect(await mockDisputesApi.list()).toEqual([created])
  })

  it('pages disputes newest first', async () => {
    for (let i = 0; i < 12; i++) {
      await mockDisputesApi.create({ ...input, transactionId: `tx-${i}` }, snapshot, `key-${i}`)
    }
    const p1 = await mockDisputesApi.listPage({ page: 1, pageSize: 10 })
    const p2 = await mockDisputesApi.listPage({ page: 2, pageSize: 10 })
    expect(p1.items).toHaveLength(10)
    expect(p2.items).toHaveLength(2)
    expect(p1).toMatchObject({ totalCount: 12, totalPages: 2 })
    expect(p1.items![0].createdAt >= p2.items![0].createdAt).toBe(true)
  })

  it('is idempotent for the same key', async () => {
    const a = await mockDisputesApi.create(input, snapshot, 'key-1')
    const b = await mockDisputesApi.create(input, snapshot, 'key-1')
    expect(b.id).toBe(a.id)
    expect(await mockDisputesApi.list()).toHaveLength(1)
  })

  it('rejects a second open dispute on the same transaction', async () => {
    await mockDisputesApi.create(input, snapshot, 'key-1')
    await expect(mockDisputesApi.create(input, snapshot, 'key-2')).rejects.toMatchObject({
      status: 409,
    })
  })
})

const TX_ID = '3f2b8c1e-9a4d-4e57-8b6a-1c2d3e4f5a6b'
const DISPUTE_ID = '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f'
const DISPUTE_REF = 'DSP-00000042'
const liveInput ={ ...input, transactionId: TX_ID }

describe('liveDisputesApi', () => {
  it('POSTs the documented body with the session cookie', async () => {
    const fetchMock = mockApi({
      'POST /api/v1/transactions/dispute': () => ({
        status: 201,
        body: { id: DISPUTE_ID, status: 'Submitted' },
      }),
    })
    const dispute = await liveDisputesApi.create(liveInput, snapshot, 'key-1')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/transactions/dispute')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(String(init.body))).toEqual({
      transactionId: TX_ID,
      reason: 'I was charged more than once',
      details: 'I was charged twice for this.',
    })
    expect(dispute).toMatchObject({
      id: DISPUTE_ID,
      status: 'Submitted',
      transactionId: TX_ID,
    })
  })

  it('sends null details when blank and rejects a non-UUID transaction id', () => {
    expect(buildCreateBody({ ...liveInput, details: '   ' }).details).toBeNull()
    expect(() => buildCreateBody(input)).toThrow(/cannot be disputed/i)
  })

  it.each([
    [409, 'This transaction already has an open dispute.'],
    [404, 'Transaction not found.'],
  ])('shows the ProblemDetails title on %i', async (status, title) => {
    mockApi({
      'POST /api/v1/transactions/dispute': () => ({
        status,
        body: { status, title },
      }),
    })
    await expect(liveDisputesApi.create(liveInput, snapshot, 'k')).rejects.toMatchObject({
      status,
      message: title,
    })
  })

  it('requests the paged disputes endpoint', async () => {
    const body = {
      items: [],
      page: 2,
      pageSize: 10,
      totalCount: 11,
      totalPages: 2,
    }
    const fetchMock = mockApi({
      'GET /api/v1/disputes': () => ({ status: 200, body }),
    })
    await expect(liveDisputesApi.listPage({ page: 2, pageSize: 10 })).resolves.toEqual(body)
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('/api/v1/disputes?Page=2&PageSize=10')
  })

  it('maps disputeReference and the reason label from the list response', async () => {
    mockApi({
      'GET /api/v1/disputes': () => ({
        status: 200,
        body: {
          items: [
            {
              transactionId: TX_ID,
              disputeReference: 'DISP20F7C413',
              reason: 'I did not authorise this transaction',
              status: 'Submitted',
              createdAt: '2026-11-18T06:49:40Z',
              updatedAt: '2026-11-18T06:49:40Z',
              transactionReference: 'CRD-1023F30CBA',
              transactionAmount: 119.06,
              accountNumber: '1052000101',
            },
          ],
          page: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      }),
    })
    const res = await liveDisputesApi.listPage({ page: 1, pageSize: 10 })
    expect(res.items![0]).toMatchObject({
      reference: 'DISP20F7C413',
      reason: 'Unauthorised',
      transactionId: TX_ID,
      transactionAmount: 119.06,
      accountNumber: '1052000101',
    })
  })

  it('loads and normalises dispute history', async () => {
    mockApi({
      [`GET /api/v1/transactions/dispute/${DISPUTE_REF}/history`]: () => ({
        status: 200,
        body: [
          { status: 'Submitted', changedAt: '2026-11-10T08:30:00Z' },
          {
            status: 'Under Review',
            changedAt: '2026-11-11T09:00:00Z',
            note: 'Assigned',
          },
        ],
      }),
    })
    await expect(liveDisputesApi.history(DISPUTE_REF)).resolves.toEqual([
      { status: 'Submitted', changedAt: '2026-11-10T08:30:00Z', note: null },
      {
        status: 'UnderReview',
        changedAt: '2026-11-11T09:00:00Z',
        note: 'Assigned',
      },
    ])
  })
})
