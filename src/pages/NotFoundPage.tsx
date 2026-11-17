import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <>
      <h1 className="page-title">page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/">Back to my portfolio</Link>
    </>
  )
}
