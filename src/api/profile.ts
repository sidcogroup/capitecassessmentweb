import { request } from './http'

export interface UserProfile {
  userId: number
  firstName: string | null
  lastName: string | null
  fullName: string | null
}

export const profileApi = {
  get(signal?: AbortSignal) {
    return request<UserProfile>('/api/v1/users/profile', { signal })
  },
}
