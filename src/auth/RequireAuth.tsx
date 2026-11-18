import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { PageLoader } from '../components/Feedback'
import { useAuth } from './AuthContext'
import { homePathFor, roleOf, type Role } from './roles'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/** Sends a signed-in user to their own home when they open the other role's area. */
export function RequireRole({ role }: { role: Role }) {
  const { session } = useAuth()
  if (roleOf(session) !== role) return <Navigate to={homePathFor(session)} replace />
  return <Outlet />
}

/** Keeps signed-in users away from the login screens. */
export function RedirectIfAuthenticated() {
  const { status, session } = useAuth()
  if (status === 'loading') return <PageLoader label="Checking your session" />
  if (status === 'authenticated') return <Navigate to={homePathFor(session)} replace />
  return <Outlet />
}
