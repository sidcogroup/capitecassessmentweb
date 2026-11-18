import { ApiError, request } from './http'
import type { PagedResponse } from './accounts'

/**
 * Disputes API.
 *
 * Two interchangeable implementations behind one typed contract:
 *  - "mock" (default): an in-browser store (sessionStorage) for demoing the flow.
 *  - "live": the real backend.
 *      POST /api/v1/transactions/dispute                        create a dispute
 *      GET  /api/v1/transactions/dispute/{disputeReference}/history    status history
 *      GET  /api/v1/disputes?Page=&PageSize=                    paged list, newest first
 */

export const DISPUTE_REASONS = [
  { value: 'Unauthorised', label: 'I did not authorise this transaction' },
  { value: 'Duplicate', label: 'I was charged more than once' },
  { value: 'IncorrectAmount', label: 'The amount charged is incorrect' },
  { value: 'NotReceived', label: 'I did not receive the goods or services' },
  {
    value: 'CancelledSubscription',
    label: 'I cancelled this subscription or debit order',
  },
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
  /** The live list endpoint does not return the transaction snapshot, so these may be null. */
  accountNumber: string | null
  transactionId: string
  transactionDate: string | null
  transactionDescription: string | null
  transactionReference: string | null
  transactionAmount: number | null
  reason: DisputeReason
  details: string | null
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

/** One status change in a dispute's lifecycle (GET .../dispute/{id}/history). */
export interface DisputeHistoryEntry {
  status: DisputeStatus
  changedAt: string
  note: string | null
}

/** Body of POST /api/v1/transactions/dispute. */
export interface CreateDisputeBody {
  transactionId: string
  /** 1-100 characters, not blank. */
  reason: string
  /** Up to 1000 characters; optional. */
  details?: string | null
}

export const REASON_MAX = 100
export const DETAILS_MAX = 1000

export interface DisputeQuery {
  /** 1-based; page 1 holds the most recent disputes. */
  page: number
  pageSize: number
}

export const DEFAULT_DISPUTE_PAGE_SIZE = 10

/** Upper bound on pages fetched when a screen needs the disputes as a flat list. */
const LOOKUP_MAX_PAGES = 10

export interface DisputesApi {
  /** One page of disputes, newest first. */
  listPage(query: DisputeQuery, signal?: AbortSignal): Promise<PagedResponse<Dispute>>
  /** Recent disputes as a flat list, for lookups. */
  list(signal?: AbortSignal): Promise<Dispute[]>
  create(
    input: CreateDisputeRequest,
    snapshot: TransactionSnapshot,
    idempotencyKey: string,
  ): Promise<Dispute>
  /** Status history, looked up by the dispute's reference (not its transactionId). */
  history(disputeReference: string, signal?: AbortSignal): Promise<DisputeHistoryEntry[]>
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The API may return "Under Review"; the UI uses the "UnderReview" form. */
export function normaliseStatus(status: unknown): DisputeStatus {
  const key = String(status ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
  switch (key) {
    case 'underreview':
      return 'UnderReview'
    case 'resolved':
      return 'Resolved'
    case 'rejected':
    case 'declined':
      return 'Rejected'
    default:
      return 'Submitted'
  }
}

export function reasonLabel(reason: DisputeReason): string {
  return DISPUTE_REASONS.find((r) => r.value === reason)?.label ?? reason
}

export const OPEN_STATUSES: readonly DisputeStatus[] = ['Submitted', 'UnderReview']

// ---------------------------------------------------------------- live

/** Response shape of the create endpoint is not documented; read it defensively. */
interface CreateDisputeResponse {
  id?: string
  disputeId?: string
  reference?: string | null
  disputeReference?: string | null
  status?: string | null
  createdAt?: string | null
}

export function buildCreateBody(input: CreateDisputeRequest): CreateDisputeBody {
  if (!UUID_PATTERN.test(input.transactionId)) {
    throw new ApiError(400, 'This transaction cannot be disputed.')
  }
  const reason = reasonLabel(input.reason).trim().slice(0, REASON_MAX)
  const details = input.details.trim()
  return {
    transactionId: input.transactionId,
    reason,
    details: details ? details.slice(0, DETAILS_MAX) : null,
  }
}

/** The API stores the reason as its label text; map it back to the enum value when it matches. */
function reasonFromApi(reason: string | undefined): DisputeReason {
  const match = DISPUTE_REASONS.find((r) => r.label === reason || r.value === reason)
  // Unknown text is kept as-is: reasonLabel() falls back to showing it.
  return (match?.value ?? reason ?? 'Other') as DisputeReason
}

/**
 * GET /api/v1/disputes returns disputeReference (not id), transactionId, reason, details, status,
 * timestamps and a few transaction fields. Fill the rest with safe defaults so the UI never
 * renders "NaN" or "undefined".
 */
function fromListItem(d: Partial<Dispute> & { disputeReference?: string }): Dispute {
  const reference = d.disputeReference ?? d.reference ?? ''
  const id = d.id ?? (reference || (d.transactionId ?? ''))
  return {
    id,
    reference,
    accountNumber: d.accountNumber ?? null,
    transactionId: d.transactionId ?? '',
    transactionDate: d.transactionDate ?? null,
    transactionDescription: d.transactionDescription ?? null,
    transactionReference: d.transactionReference ?? null,
    transactionAmount: typeof d.transactionAmount === 'number' ? d.transactionAmount : null,
    reason: reasonFromApi(d.reason),
    details: d.details ?? null,
    status: normaliseStatus(d.status),
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? d.createdAt ?? '',
  }
}

export const liveDisputesApi: DisputesApi = {
  async listPage(query, signal) {
    const params = new URLSearchParams({
      Page: String(query.page),
      PageSize: String(query.pageSize),
    })
    const res = await request<PagedResponse<Partial<Dispute>>>(`/api/v1/disputes?${params}`, {
      signal,
    })
    return { ...res, items: (res?.items ?? []).map(fromListItem) }
  },

  async list(signal) {
    // Walk the paged endpoint with the standard page size (larger sizes are rejected with 400).
    const all: Dispute[] = []
    for (let page = 1; page <= LOOKUP_MAX_PAGES; page++) {
      const res = await liveDisputesApi.listPage(
        { page, pageSize: DEFAULT_DISPUTE_PAGE_SIZE },
        signal,
      )
      all.push(...(res?.items ?? []))
      if (page >= (res?.totalPages ?? 0)) break
    }
    return all
  },

  async create(input, snapshot) {
    const res = await request<CreateDisputeResponse | undefined>('/api/v1/transactions/dispute', {
      method: 'POST',
      body: buildCreateBody(input),
    })
    const id = res?.id ?? res?.disputeId ?? input.transactionId
    const now = new Date().toISOString()
    return {
      id,
      reference: res?.disputeReference ?? res?.reference ?? id.slice(0, 8).toUpperCase(),
      accountNumber: input.accountNumber,
      transactionId: input.transactionId,
      transactionDate: snapshot.transactionDate,
      transactionDescription: snapshot.description,
      transactionReference: snapshot.reference,
      transactionAmount: snapshot.amount,
      reason: input.reason,
      details: input.details,
      status: normaliseStatus(res?.status),
      createdAt: res?.createdAt ?? now,
      updatedAt: res?.createdAt ?? now,
    }
  },

  async history(disputeReference, signal) {
    if (!disputeReference.trim()) throw new ApiError(404, 'Dispute not found.')
    const rows = await request<
      Array<{
        status?: string
        changedAt?: string
        createdAt?: string
        note?: string | null
      }>
    >(`/api/v1/transactions/dispute/${encodeURIComponent(disputeReference)}/history`, {
      signal,
    })
    return (rows ?? []).map((r) => ({
      status: normaliseStatus(r.status),
      changedAt: r.changedAt ?? r.createdAt ?? '',
      note: r.note ?? null,
    }))
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
  async listPage(query) {
    const all = await mockDisputesApi.list()
    const pageSize = Math.max(1, query.pageSize)
    const start = (Math.max(1, query.page) - 1) * pageSize
    return {
      items: all.slice(start, start + pageSize),
      page: query.page,
      pageSize,
      totalCount: all.length,
      totalPages: Math.ceil(all.length / pageSize),
    }
  },

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
      transactionAmount: snapshot.amount,
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

  async history(disputeReference) {
    await delay(150)
    const dispute = readStore().find((d) => d.reference === disputeReference)
    if (!dispute) throw new ApiError(404, 'Dispute not found.')
    return [{ status: dispute.status, changedAt: dispute.createdAt, note: null }]
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
