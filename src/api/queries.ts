import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { accountsApi, type TransactionQuery } from './accounts'
import {
  buildAccountDirectory,
  clientDisputeSummary,
  consultantApi,
  type PageQuery,
  type UpdateDisputeBody,
} from './consultant'
import { profileApi } from './profile'
import {
  disputesApi,
  type CreateDisputeRequest,
  type DisputeQuery,
  type TransactionSnapshot,
} from './disputes'

export const queryKeys = {
  profile: ['profile'] as const,
  accounts: ['accounts'] as const,
  transactions: (accountNumber: string, q: TransactionQuery) =>
    ['accounts', accountNumber, 'transactions', q] as const,
  disputes: ['disputes'] as const,
  disputeHistory: (disputeReference: string) =>
    ['disputes', disputeReference, 'history'] as const,
}

/** Shared (cached) profile; fetched in parallel with accounts on first app render. */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: ({ signal }) => profileApi.get(signal),
    staleTime: 5 * 60_000,
  })
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: ({ signal }) => accountsApi.list(signal),
  })
}

export function useAccount(accountNumber: string) {
  const query = useAccounts()
  return {
    ...query,
    account: query.data?.find((a) => a.accountNumber === accountNumber),
  }
}

export function useTransactions(accountNumber: string, q: TransactionQuery) {
  return useQuery({
    queryKey: queryKeys.transactions(accountNumber, q),
    queryFn: ({ signal }) => accountsApi.transactions(accountNumber, q, signal),
    placeholderData: keepPreviousData,
  })
}

export function useDisputes() {
  return useQuery({
    queryKey: queryKeys.disputes,
    queryFn: ({ signal }) => disputesApi.list(signal),
  })
}

export function useDisputesPage(q: DisputeQuery) {
  return useQuery({
    queryKey: [...queryKeys.disputes, 'page', q] as const,
    queryFn: ({ signal }) => disputesApi.listPage(q, signal),
    placeholderData: keepPreviousData,
  })
}

/** Lazily fetched: pass `enabled=false` until the user opens the history. */
export function useDisputeHistory(disputeReference: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.disputeHistory(disputeReference),
    queryFn: ({ signal }) => disputesApi.history(disputeReference, signal),
    enabled,
  })
}

export function useCreateDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      input: CreateDisputeRequest
      snapshot: TransactionSnapshot
      idempotencyKey: string
    }) => disputesApi.create(vars.input, vars.snapshot, vars.idempotencyKey),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.disputes }),
  })
}

// ---------------------------------------------------------------- consultant

export const consultantKeys = {
  all: ['consultant'] as const,
  clients: (q: PageQuery) => ['consultant', 'clients', q] as const,
  client: (userId: string) => ['consultant', 'client', userId] as const,
  clientAccounts: (userId: string) => ['consultant', 'client', userId, 'accounts'] as const,
  accountTransactions: (accountId: string, q: PageQuery) =>
    ['consultant', 'account', accountId, 'transactions', q] as const,
  disputes: ['consultant', 'disputes'] as const,
  directory: ['consultant', 'directory'] as const,
}

export function useConsultantClients(q: PageQuery) {
  return useQuery({
    queryKey: consultantKeys.clients(q),
    queryFn: ({ signal }) => consultantApi.clients(q, signal),
    placeholderData: keepPreviousData,
  })
}

export function useConsultantClient(userId: string) {
  return useQuery({
    queryKey: consultantKeys.client(userId),
    queryFn: ({ signal }) => consultantApi.client(userId, signal),
  })
}

export function useConsultantClientAccounts(userId: string) {
  return useQuery({
    queryKey: consultantKeys.clientAccounts(userId),
    queryFn: ({ signal }) => consultantApi.clientAccounts(userId, signal),
  })
}

export function useConsultantTransactions(accountId: string, q: PageQuery) {
  return useQuery({
    queryKey: consultantKeys.accountTransactions(accountId, q),
    queryFn: ({ signal }) => consultantApi.accountTransactions(accountId, q, signal),
    placeholderData: keepPreviousData,
  })
}

/** Pass `userId` to scope to one client; omit it for every client's disputes. */
export function useConsultantDisputes(q: PageQuery, userId?: string) {
  return useQuery({
    queryKey: [...consultantKeys.disputes, userId ?? 'all', q] as const,
    queryFn: ({ signal }) =>
      userId ? consultantApi.clientDisputes(userId, q, signal) : consultantApi.disputes(q, signal),
    placeholderData: keepPreviousData,
  })
}

export function useUpdateDispute() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { reference: string; body: UpdateDisputeBody }) =>
      consultantApi.updateDispute(vars.reference, vars.body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consultantKeys.disputes }),
  })
}

/** accountNumber -> owning client and accountId, for linking disputes back to clients. */
export function useAccountDirectory() {
  return useQuery({
    queryKey: consultantKeys.directory,
    queryFn: ({ signal }) => buildAccountDirectory(signal),
    staleTime: 5 * 60_000,
  })
}

/** Dispute counts for each listed client; keyed under disputes so updates refresh them. */
export function useClientDisputeSummaries(userIds: number[]) {
  return useQueries({
    queries: userIds.map((id) => ({
      queryKey: [...consultantKeys.disputes, String(id), 'summary'] as const,
      queryFn: ({ signal }: { signal: AbortSignal }) => clientDisputeSummary(String(id), signal),
    })),
    combine: (results) => new Map(userIds.map((id, i) => [id, results[i]?.data] as const)),
  })
}
