import type { Session } from '../api/auth'

export type Role = 'consultant' | 'customer'

export const CONSULTANT_HOME = '/consultant'
export const CUSTOMER_HOME = '/'

/** The backend sends the role as free text (e.g. "Consultant"); anything else is a customer. */
export function roleOf(session: Pick<Session, 'role'> | null | undefined): Role {
  return session?.role?.trim().toLowerCase() === 'consultant' ? 'consultant' : 'customer'
}

export function homePathFor(session: Pick<Session, 'role'> | null | undefined): string {
  return roleOf(session) === 'consultant' ? CONSULTANT_HOME : CUSTOMER_HOME
}
