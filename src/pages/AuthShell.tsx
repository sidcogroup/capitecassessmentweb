import type { ReactNode } from 'react'

export function AuthShell({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="auth">
      <h1 className="page-title">online banking assessment</h1>
      <div className="auth__grid">
        <section className="auth__form">{children}</section>
        {aside}
      </div>
    </div>
  )
}
