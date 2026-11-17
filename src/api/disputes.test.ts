import { beforeEach, describe, expect, it } from 'vitest'
import { clearMockDisputes, mockDisputesApi } from './disputes'

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
