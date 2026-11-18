import { useCallback, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useIdleTimeout } from '../auth/useIdleTimeout'
import { AppHeader, ConsultantHeader, PublicHeader } from './Header'

const IDLE_TIMEOUT_MS = 5 * 60 * 1000
const IDLE_WARNING_MS = 60 * 1000

function Footer() {
  return (
    <footer className="site-footer">
      <p>
        Online Banking Assessment – a simulated experience built for evaluation purposes only. Not
        affiliated with or operated by Capitec Bank.
      </p>
    </footer>
  )
}

export function PublicLayout() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <PublicHeader />
      <main id="main" className="page">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

/** Signs the user out after inactivity, with a one-minute warning dialog. */
function IdleSessionGuard() {
  const { signOut, refreshSession } = useAuth()
  const onTimeout = useCallback(() => void signOut('idle'), [signOut])
  const { warningVisible, secondsLeft, reset } = useIdleTimeout({
    timeoutMs: IDLE_TIMEOUT_MS,
    warningMs: IDLE_WARNING_MS,
    onTimeout,
  })

  const staySignedIn = async () => {
    if (await refreshSession()) reset()
  }

  if (!warningVisible) return null
  return (
    <SessionTimeoutDialog
      secondsLeft={secondsLeft}
      onStay={staySignedIn}
      onSignOut={() => void signOut('user')}
    />
  )
}

export function AppLayout() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className="page">
        <div className="broadcast" role="note">
          Disputes are reviewed within 10 business days. We will never ask for your one-time pin
          when you log a dispute.
        </div>
        <Outlet />
      </main>
      <Footer />
      <IdleSessionGuard />
    </div>
  )
}

export function ConsultantLayout() {
  return (
    <div className="app-shell consultant">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <ConsultantHeader />
      <main id="main" className="page page--wide">
        <Outlet />
      </main>
      <Footer />
      <IdleSessionGuard />
    </div>
  )
}

function SessionTimeoutDialog({
  secondsLeft,
  onStay,
  onSignOut,
}: {
  secondsLeft: number
  onStay: () => void
  onSignOut: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
      onCancel={(e) => e.preventDefault()}
    >
      <h2 id="idle-title">Are you still there?</h2>
      <p id="idle-desc">
        For your security you will be logged out in <strong>{secondsLeft}</strong> seconds due to
        inactivity.
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={onStay} autoFocus>
          Stay logged in
        </button>
        <button type="button" className="btn btn--secondary" onClick={onSignOut}>
          Log out
        </button>
      </div>
    </dialog>
  )
}
