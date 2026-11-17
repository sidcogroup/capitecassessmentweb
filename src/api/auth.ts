import { request } from './http'

export interface RequestOtpResponse {
  message: string | null
}

export interface Session {
  userId: number
  username: string | null
  role: string | null
}

export const authApi = {
  requestOtp(accountNumber: string) {
    return request<RequestOtpResponse>('/api/v2/authenticate/request-otp', {
      method: 'POST',
      body: { accountNumber },
      skipUnauthorizedHandler: true,
    })
  },

  /** On success the backend sets the httpOnly session cookie. */
  verifyOtp(accountNumber: string, code: string) {
    return request<Session>('/api/v1/authenticate/verify-otp', {
      method: 'POST',
      body: { accountNumber, code },
      skipUnauthorizedHandler: true,
    })
  },

  /** Session probe used on load / to keep the session alive. */
  me(signal?: AbortSignal) {
    return request<Session>('/api/v1/authenticate/me', { signal, skipUnauthorizedHandler: true })
  },

  logout() {
    return request<void>('/api/v1/authenticate/logout', {
      method: 'POST',
      skipUnauthorizedHandler: true,
    })
  },
}
