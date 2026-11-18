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

export function ConsultantHeader() {
  const { signOut, session } = useAuth()
  return (
    <header className="consultant-header">
      <div className="consultant-header__top">
        <Link to="/consultant" className="site-header__brand consultant-header__brand">
          <Logo />
          <span className="consultant-header__tag">Consultant</span>
        </Link>
        <div className="consultant-header__user">
          {session?.username && <span aria-label="Signed in as">{session.username}</span>}
          <button type="button" className="btn btn--link" onClick={() => void signOut('user')}>
            Log out
          </button>
        </div>
      </div>
      <nav className="consultant-header__nav" aria-label="Main">
        <div className="consultant-header__tabs">
          <NavLink to="/consultant" end>
            Clients
          </NavLink>
          <NavLink to="/consultant/disputes">Disputes</NavLink>
        </div>
      </nav>
    </header>
  )
}
