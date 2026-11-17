import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountsApi, type TransactionQuery } from './accounts'
import { profileApi } from './profile'
import { disputesApi, type CreateDisputeRequest, type TransactionSnapshot } from './disputes'

export const queryKeys = {
  profile: ['profile'] as const,
  accounts: ['accounts'] as const,
  transactions: (accountNumber: string, q: TransactionQuery) =>
    ['accounts', accountNumber, 'transactions', q] as const,
  disputes: ['disputes'] as const,
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
  return { ...query, account: query.data?.find((a) => a.accountNumber === accountNumber) }
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
