import type { PagedResponse, Transaction } from './accounts'
import { normaliseStatus, type DisputeStatus } from './disputes'
import { ApiError, request } from './http'

/**
 * Consultant API (role: Consultant). Contract taken from the backend's OpenAPI spec:
 *   GET /api/v1/consultant/clients?Page=&PageSize=                  ClientSummary page
 *   GET /api/v1/consultant/clients/{userId}                         ClientProfile
 *   GET /api/v1/consultant/clients/{userId}/accounts                ClientAccount[]
 *   GET /api/v1/consultant/accounts/{accountId}/transactions?Page=&PageSize=
 *   GET /api/v1/consultant/disputes?Page=&PageSize=                 all clients' disputes
 *   GET /api/v1/consultant/clients/{userId}/disputes?Page=&PageSize=
 *   PUT /api/v1/consultant/disputes/{disputeReference}              { status, note }
 */

export interface ClientSummary {
  userId: number
  username: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
}

export interface ClientProfile {
  userId: number
  username: string | null
  email: string | null
  firstName: string | null
  lastName: string | null
  contactNumber: string | null
  contactEmail: string | null
  createdAt: string
}

export interface ClientAccount {
  accountId: string
  accountName: string | null
  accountNumber: string | null
  accountType: string | null
  balance: number
  currency: string | null
}

export interface ConsultantDispute {
  transactionId: string
  reference: string
  reason: string | null
  details: string | null
  status: DisputeStatus
  createdAt: string
  updatedAt: string
  transactionReference: string | null
  transactionAmount: number | null
  accountNumber: string | null
}

export interface PageQuery {
  page: number
  pageSize: number
}

/** Values the PUT endpoint accepts, in workflow order. */
export const API_DISPUTE_STATUSES = ['Submitted', 'Under Review', 'Resolved', 'Rejected'] as const
export type ApiDisputeStatus = (typeof API_DISPUTE_STATUSES)[number]
export const NOTE_MAX = 500

export function toApiStatus(status: DisputeStatus): ApiDisputeStatus {
  return status === 'UnderReview' ? 'Under Review' : status
}

export interface UpdateDisputeBody {
  status: ApiDisputeStatus
  note: string
}

const USER_ID_PATTERN = /^[1-9][0-9]{0,18}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isValidUserId = (value: string) => USER_ID_PATTERN.test(value)
export const isValidAccountId = (value: string) => UUID_PATTERN.test(value)

function notFound(): Promise<never> {
  return Promise.reject(new ApiError(404, 'The requested information could not be found.'))
}

function pageParams(q: PageQuery) {
  return new URLSearchParams({
    Page: String(q.page),
    PageSize: String(q.pageSize),
  })
}

type RawDispute = Partial<Omit<ConsultantDispute, 'status' | 'reference'>> & {
  disputeReference?: string | null
  status?: string | null
}

function fromApiDispute(d: RawDispute): ConsultantDispute {
  return {
    transactionId: d.transactionId ?? '',
    reference: d.disputeReference ?? '',
    reason: d.reason ?? null,
    details: d.details ?? null,
    status: normaliseStatus(d.status),
    createdAt: d.createdAt ?? '',
    updatedAt: d.updatedAt ?? d.createdAt ?? '',
    transactionReference: d.transactionReference ?? null,
    transactionAmount: typeof d.transactionAmount === 'number' ? d.transactionAmount : null,
    accountNumber: d.accountNumber ?? null,
  }
}

async function disputePage(path: string, signal?: AbortSignal) {
  const res = await request<PagedResponse<RawDispute>>(path, { signal })
  return { ...res, items: (res?.items ?? []).map(fromApiDispute) }
}

export const consultantApi = {
  clients(q: PageQuery, signal?: AbortSignal) {
    return request<PagedResponse<ClientSummary>>(`/api/v1/consultant/clients?${pageParams(q)}`, {
      signal,
    })
  },

  client(userId: string, signal?: AbortSignal) {
    if (!isValidUserId(userId)) return notFound()
    return request<ClientProfile>(`/api/v1/consultant/clients/${userId}`, {
      signal,
    })
  },

  clientAccounts(userId: string, signal?: AbortSignal) {
    if (!isValidUserId(userId)) return notFound()
    return request<ClientAccount[]>(`/api/v1/consultant/clients/${userId}/accounts`, { signal })
  },

  accountTransactions(accountId: string, q: PageQuery, signal?: AbortSignal) {
    if (!isValidAccountId(accountId)) return notFound()
    return request<PagedResponse<Transaction>>(
      `/api/v1/consultant/accounts/${accountId}/transactions?${pageParams(q)}`,
      { signal },
    )
  },

  disputes(q: PageQuery, signal?: AbortSignal) {
    return disputePage(`/api/v1/consultant/disputes?${pageParams(q)}`, signal)
  },

  clientDisputes(userId: string, q: PageQuery, signal?: AbortSignal) {
    if (!isValidUserId(userId)) return notFound()
    return disputePage(`/api/v1/consultant/clients/${userId}/disputes?${pageParams(q)}`, signal)
  },

  async updateDispute(disputeReference: string, body: UpdateDisputeBody) {
    if (!disputeReference.trim()) throw new ApiError(404, 'Dispute not found.')
    const res = await request<RawDispute>(
      `/api/v1/consultant/disputes/${encodeURIComponent(disputeReference)}`,
      {
        method: 'PUT',
        body: {
          status: body.status,
          note: body.note.trim().slice(0, NOTE_MAX),
        },
      },
    )
    return fromApiDispute(res ?? {})
  },
}

/** Disputes carry an account number but no client id; this maps one back to its owner. */
export interface AccountOwner {
  client: ClientSummary
  accountId: string
}

/** Largest page the API accepts, and a cap so a huge client base can't trigger unbounded calls. */
const DIRECTORY_PAGE_SIZE = 100
const DIRECTORY_MAX_PAGES = 10

/**
 * Builds accountNumber -> owner by walking every client and their accounts.
 * Costs 1 call per 100 clients plus 1 per client; replace with a client id on DisputeResponse
 * when the backend provides one.
 */
export async function buildAccountDirectory(signal?: AbortSignal) {
  const clients: ClientSummary[] = []
  for (let page = 1; page <= DIRECTORY_MAX_PAGES; page++) {
    const res = await consultantApi.clients({ page, pageSize: DIRECTORY_PAGE_SIZE }, signal)
    clients.push(...(res?.items ?? []))
    if (page >= (res?.totalPages ?? 0)) break
  }
  const owned = await Promise.all(
    clients.map(async (client) => {
      const accounts = await consultantApi.clientAccounts(String(client.userId), signal)
      return (accounts ?? []).map(
        (a) => [a.accountNumber, { client, accountId: a.accountId }] as const,
      )
    }),
  )
  const directory = new Map<string, AccountOwner>()
  for (const [accountNumber, owner] of owned.flat()) {
    if (accountNumber) directory.set(accountNumber, owner)
  }
  return directory
}

export interface ClientDisputeSummary {
  total: number
  open: number
}

const OPEN = new Set<DisputeStatus>(['Submitted', 'UnderReview'])

/** Total and open disputes for one client (open counted over the newest 100). */
export async function clientDisputeSummary(
  userId: string,
  signal?: AbortSignal,
): Promise<ClientDisputeSummary> {
  const res = await consultantApi.clientDisputes(userId, { page: 1, pageSize: 100 }, signal)
  return {
    total: res?.totalCount ?? 0,
    open: (res?.items ?? []).filter((d) => OPEN.has(d.status)).length,
  }
}

export function clientName(c: Pick<ClientSummary, 'firstName' | 'lastName' | 'username'>): string {
  const full = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return full || c.username || '—'
}
