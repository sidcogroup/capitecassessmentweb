import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { homePathFor, roleOf } from '../auth/roles'

export function NotFoundPage() {
  const { session } = useAuth()
  return (
    <>
      <h1 className="page-title">page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to={homePathFor(session)}>
        {roleOf(session) === 'consultant' ? 'Back to the dashboard' : 'Back to my portfolio'}
      </Link>
    </>
  )
}
