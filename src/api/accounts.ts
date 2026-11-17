import { request } from './http'

export interface Account {
  accountName: string | null
  accountNumber: string | null
  accountType: string | null
  balance: number
  currency: string | null
}

export interface Transaction {
  id: string
  transactionDate: string
  description: string | null
  merchant: string | null
  amount: number
  type: string | null
  reference: string | null
}

export interface PagedResponse<T> {
  items: T[] | null
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface TransactionQuery {
  days: number
  page: number
  pageSize: number
}

export const ACCOUNT_NUMBER_PATTERN = /^[0-9]{10}$/

export const accountsApi = {
  list(signal?: AbortSignal) {
    return request<Account[]>('/api/v1/accounts', { signal })
  },

  transactions(accountNumber: string, query: TransactionQuery, signal?: AbortSignal) {
    if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
      return Promise.reject(new Error('Invalid account number'))
    }
    const params = new URLSearchParams({
      Days: String(query.days),
      Page: String(query.page),
      PageSize: String(query.pageSize),
    })
    return request<PagedResponse<Transaction>>(
      `/api/v1/accounts/${encodeURIComponent(accountNumber)}/transactions?${params}`,
      { signal },
    )
  },
}

/** Debits are the only transactions a customer can dispute. */
export function isDebit(tx: Pick<Transaction, 'amount' | 'type'>): boolean {
  const type = tx.type?.toLowerCase()
  if (type === 'debit') return true
  if (type === 'credit') return false
  return tx.amount < 0
}
