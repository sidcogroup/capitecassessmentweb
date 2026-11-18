import type { DisputeStatus } from '../api/disputes'
import { disputeStatusLabel } from '../lib/disputeStatus'

/** `label` overrides the customer-facing wording (consultants see the backend status names). */
export function StatusBadge({ status, label }: { status: DisputeStatus; label?: string }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      {label ?? disputeStatusLabel(status)}
    </span>
  )
}
