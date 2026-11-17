import type { DisputeStatus } from '../api/disputes'

const LABELS: Record<DisputeStatus, string> = {
  Submitted: 'Submitted',
  UnderReview: 'Under review',
  Resolved: 'Resolved',
  Rejected: 'Declined',
}

export function disputeStatusLabel(status: DisputeStatus): string {
  return LABELS[status] ?? status
}
