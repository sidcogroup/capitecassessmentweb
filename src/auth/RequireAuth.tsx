import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoader } from '../components/Feedback'
import { useAuth } from './AuthContext'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Keeps signed-in users away from the login screens. */
export function RedirectIfAuthenticated() {
  const { status } = useAuth()
  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <Outlet />
}
