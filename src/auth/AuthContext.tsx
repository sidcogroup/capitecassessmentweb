import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi, type Session } from '../api/auth'
import { setUnauthorizedHandler } from '../api/http'

/**
 * Session state lives in memory only. The credential itself is an httpOnly cookie
 * the browser manages; on load we ask the backend (/authenticate/me) whether it is valid.
 */

type AuthStatus = 'loading' | 'authenticated' | 'anonymous'
export type SignOutReason = 'expired' | 'idle' | 'user'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  signOutReason: SignOutReason | null
  completeLogin: (session: Session) => void
  signOut: (reason?: SignOutReason) => Promise<void>
  refreshSession: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null)

  const clearLocalSession = useCallback(
    (reason: SignOutReason) => {
      queryClient.clear()
      setSession(null)
      setStatus('anonymous')
      setSignOutReason(reason)
    },
    [queryClient],
  )

  // Probe the cookie session once on start-up.
  useEffect(() => {
    const controller = new AbortController()
    authApi
      .me(controller.signal)
      .then((s) => {
        setSession(s)
        setStatus('authenticated')
      })
      .catch(() => {
        if (controller.signal.aborted) return
        // 401 or backend unreachable: treat as signed out; the login page surfaces errors.
        setStatus('anonymous')
      })
    return () => controller.abort()
  }, [])

  // Any 401 from a protected endpoint ends the session centrally.
  useEffect(() => {
    setUnauthorizedHandler(() => clearLocalSession('expired'))
    return () => setUnauthorizedHandler(null)
  }, [clearLocalSession])

  const completeLogin = useCallback((s: Session) => {
    setSession(s)
    setSignOutReason(null)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(
    async (reason: SignOutReason = 'user') => {
      try {
        await authApi.logout()
      } catch {
        // Even if the server call fails, drop the local session.
      }
      clearLocalSession(reason)
    },
    [clearLocalSession],
  )

  const refreshSession = useCallback(async () => {
    try {
      const s = await authApi.me()
      setSession(s)
      return true
    } catch {
      clearLocalSession('expired')
      return false
    }
  }, [clearLocalSession])

  const value = useMemo(
    () => ({ status, session, signOutReason, completeLogin, signOut, refreshSession }),
    [status, session, signOutReason, completeLogin, signOut, refreshSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
