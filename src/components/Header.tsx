import { Link, NavLink } from 'react-router-dom'
import { useProfile } from '../api/queries'
import { useAuth } from '../auth/AuthContext'
import { Logo } from './Logo'

export const SUPPORT_NUMBER = '0860 10 20 43'

export function PublicHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/login" className="site-header__brand">
          <Logo />
        </Link>
        <nav className="site-header__nav" aria-label="Help">
          <span>Capitec Bank</span>
          <span>Security</span>
          <span>Privacy Centre</span>
          <a href={`tel:${SUPPORT_NUMBER.replaceAll(' ', '')}`}>{SUPPORT_NUMBER}</a>
        </nav>
      </div>
    </header>
  )
}

export function AppHeader() {
  const { signOut } = useAuth()
  const clientName = useProfile().data?.fullName
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand">
          <Logo />
        </Link>
        <nav className="site-header__nav site-header__nav--app" aria-label="Main">
          <NavLink to="/" end>
            My portfolio
          </NavLink>
          <NavLink to="/disputes">My disputes</NavLink>
          <a href={`tel:${SUPPORT_NUMBER.replaceAll(' ', '')}`}>{SUPPORT_NUMBER}</a>
          {clientName && (
            <span className="site-header__user" aria-label="Signed in as">
              {clientName}
            </span>
          )}
          <button type="button" className="btn btn--link" onClick={() => void signOut('user')}>
            Log out
          </button>
        </nav>
      </div>
    </header>
  )
}
