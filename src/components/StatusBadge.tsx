import type { DisputeStatus } from '../api/disputes'
import { disputeStatusLabel } from '../lib/disputeStatus'

export function StatusBadge({ status }: { status: DisputeStatus }) {
  return <span className={`badge badge--${status.toLowerCase()}`}>{disputeStatusLabel(status)}</span>
}
