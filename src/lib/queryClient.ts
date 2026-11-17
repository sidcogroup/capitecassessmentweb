import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Never retry client errors (401/403/404...) - only transient failures.
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}
