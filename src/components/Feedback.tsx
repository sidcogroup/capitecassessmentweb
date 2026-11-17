import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span className="spinner" role="status">
      <span className="spinner__circle" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-loader">
      <Spinner label={label} />
      <span aria-hidden="true">{label}…</span>
    </div>
  )
}

type AlertTone = 'error' | 'info' | 'success' | 'warning'

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <strong className="alert__title">{title}</strong>}
      {children && <div>{children}</div>}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <Alert tone="error" title="We could not load this information">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary btn--small" onClick={onRetry}>
          Try again
        </button>
      )}
    </Alert>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty-state">{children}</p>
}
