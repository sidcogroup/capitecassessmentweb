import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { isMockDisputes, reasonLabel, type DisputeStatus } from '../api/disputes'
import { useDisputes } from '../api/queries'
import { Alert, EmptyState, ErrorState, PageLoader } from '../components/Feedback'
import { Money } from '../components/Money'
import { StatusBadge } from '../components/StatusBadge'
import { disputeStatusLabel } from '../lib/disputeStatus'
import { formatDate, formatDateTime } from '../lib/format'

const FILTERS: Array<DisputeStatus | 'All'> = [
  'All',
  'Submitted',
  'UnderReview',
  'Resolved',
  'Rejected',
]

export function DisputesPage() {
  const disputes = useDisputes()
  const [filter, setFilter] = useState<DisputeStatus | 'All'>('All')

  const rows = useMemo(
    () => (disputes.data ?? []).filter((d) => filter === 'All' || d.status === filter),
    [disputes.data, filter],
  )

  return (
    <>
      <h1 className="page-title">my disputes</h1>
      <p className="lead">
        A history of every transaction you have disputed. To dispute a new transaction, open the
        account from <Link to="/">my portfolio</Link>.
      </p>
      {isMockDisputes && (
        <Alert tone="info">
          Demo mode: disputes are stored in this browser tab until the disputes service is
          connected.
        </Alert>
      )}

      <div className="toolbar">
        <label>
          Status
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as DisputeStatus | 'All')}
          >
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f === 'All' ? 'All statuses' : disputeStatusLabel(f)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {disputes.isPending && <PageLoader label="Loading your disputes" />}
      {disputes.isError && (
        <ErrorState message={disputes.error.message} onRetry={() => void disputes.refetch()} />
      )}
      {disputes.data && rows.length === 0 && (
        <EmptyState>
          {filter === 'All'
            ? 'You have not disputed any transactions yet.'
            : 'No disputes match this status.'}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Disputed transactions</caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col" className="col-shade">
                  Logged
                </th>
                <th scope="col">Transaction</th>
                <th scope="col" className="num col-shade">
                  Amount
                </th>
                <th scope="col">Reason</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="nowrap">
                    <strong>{d.reference}</strong>
                    <span className="tx-merchant">Acc {d.accountNumber}</span>
                  </td>
                  <td className="col-shade nowrap">{formatDateTime(d.createdAt)}</td>
                  <td>
                    <span className="tx-desc">{d.transactionDescription ?? '—'}</span>
                    <span className="tx-merchant">{formatDate(d.transactionDate)}</span>
                  </td>
                  <td className="num col-shade">
                    <Money amount={d.amount} />
                  </td>
                  <td>
                    <details>
                      <summary>{reasonLabel(d.reason)}</summary>
                      <p className="pre-wrap">{d.details}</p>
                    </details>
                  </td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
