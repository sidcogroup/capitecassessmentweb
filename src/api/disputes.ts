import { ApiError, request } from './http'

/**
 * Disputes API.
 *
 * The backend dispute endpoints are not available yet, so this module exposes a
 * typed contract with two interchangeable implementations:
 *  - "mock" (default): an in-browser store (sessionStorage) for demoing the flow.
 *  - "live": REST calls to /api/v1/disputes. Adjust paths/payloads here only once
 *    the backend contract is final - no page component needs to change.
 */

export const DISPUTE_REASONS = [
  { value: 'Unauthorised', label: 'I did not authorise this transaction' },
  { value: 'Duplicate', label: 'I was charged more than once' },
  { value: 'IncorrectAmount', label: 'The amount charged is incorrect' },
  { value: 'NotReceived', label: 'I did not receive the goods or services' },
  { value: 'CancelledSubscription', label: 'I cancelled this subscription or debit order' },
  { value: 'Other', label: 'Other' },
] as const

export type DisputeReason = (typeof DISPUTE_REASONS)[number]['value']
export type DisputeStatus = 'Submitted' | 'UnderReview' | 'Resolved' | 'Rejected'

export interface CreateDisputeRequest {
  accountNumber: string
  transactionId: string
  reason: DisputeReason
  details: string
}

export interface Dispute {
  id: string
  reference: string
  accountNumber: string
  transactionId: string
  transactionDate: string
  transactionDescription: string | null
  transactionReference: string | null
  amount: number
  reason: DisputeReason
  details: string
  status: DisputeStatus
  createdAt: string
  updatedAt: string
}

/** Transaction snapshot kept with a mock dispute so history renders without re-fetching. */
export interface TransactionSnapshot {
  transactionDate: string
  description: string | null
  reference: string | null
  amount: number
}

export interface DisputesApi {
  list(signal?: AbortSignal): Promise<Dispute[]>
  create(
    input: CreateDisputeRequest,
    snapshot: TransactionSnapshot,
    idempotencyKey: string,
  ): Promise<Dispute>
}

export function reasonLabel(reason: DisputeReason): string {
  return DISPUTE_REASONS.find((r) => r.value === reason)?.label ?? reason
}

export const OPEN_STATUSES: readonly DisputeStatus[] = ['Submitted', 'UnderReview']

// ---------------------------------------------------------------- live

const liveDisputesApi: DisputesApi = {
  list(signal) {
    return request<Dispute[]>('/api/v1/disputes', { signal })
  },
  create(input, _snapshot, idempotencyKey) {
    return request<Dispute>('/api/v1/disputes', {
      method: 'POST',
      body: input,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  },
}

// ---------------------------------------------------------------- mock

const STORAGE_KEY = 'oba.mock.disputes'

function readStore(): Dispute[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Dispute[]) : []
  } catch {
    return []
  }
}

function writeStore(disputes: Dispute[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(disputes))
  } catch {
    /* storage unavailable - mock keeps working for this render only */
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function newReference(): string {
  const digits = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000
  return `DSP-${String(digits).padStart(8, '0')}`
}

const idempotencyCache = new Map<string, Dispute>()

export const mockDisputesApi: DisputesApi = {
  async list() {
    await delay(150)
    return readStore().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async create(input, snapshot, idempotencyKey) {
    await delay(300)
    const cached = idempotencyCache.get(idempotencyKey)
    if (cached) return cached

    const disputes = readStore()
    const existing = disputes.find(
      (d) => d.transactionId === input.transactionId && OPEN_STATUSES.includes(d.status),
    )
    if (existing) {
      throw new ApiError(
        409,
        `This transaction already has an open dispute (${existing.reference}).`,
      )
    }

    const now = new Date().toISOString()
    const dispute: Dispute = {
      id: crypto.randomUUID(),
      reference: newReference(),
      accountNumber: input.accountNumber,
      transactionId: input.transactionId,
      transactionDate: snapshot.transactionDate,
      transactionDescription: snapshot.description,
      transactionReference: snapshot.reference,
      amount: snapshot.amount,
      reason: input.reason,
      details: input.details,
      status: 'Submitted',
      createdAt: now,
      updatedAt: now,
    }
    writeStore([...disputes, dispute])
    idempotencyCache.set(idempotencyKey, dispute)
    return dispute
  },
}

export function clearMockDisputes() {
  idempotencyCache.clear()
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const isMockDisputes = (import.meta.env.VITE_DISPUTES_API ?? 'mock') !== 'live'

export const disputesApi: DisputesApi = isMockDisputes ? mockDisputesApi : liveDisputesApi
