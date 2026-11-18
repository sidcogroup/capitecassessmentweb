import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  DEFAULT_DISPUTE_PAGE_SIZE,
  isMockDisputes,
  reasonLabel,
  type DisputeStatus,
} from '../api/disputes'
import { useDisputeHistory, useDisputesPage } from '../api/queries'
import { Alert, EmptyState, ErrorState, PageLoader } from '../components/Feedback'
import { Money } from '../components/Money'
import { StatusBadge } from '../components/StatusBadge'
import { disputeStatusLabel } from '../lib/disputeStatus'
import { formatDateTime } from '../lib/format'

const FILTERS: Array<DisputeStatus | 'All'> = [
  'All',
  'Submitted',
  'UnderReview',
  'Resolved',
  'Rejected',
]

function HistoryToggle({ disputeReference }: { disputeReference: string }) {
  const [open, setOpen] = useState(false)
  const history = useDisputeHistory(disputeReference, open)

  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Status history</summary>
      {history.isPending && open && <p role="status">Loading history…</p>}
      {history.isError && (
        <p role="alert">
          {history.error.message}{' '}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => void history.refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {history.data && history.data.length === 0 && <p>No status changes yet.</p>}
      {history.data && history.data.length > 0 && (
        <ol className="history-list">
          {history.data.map((h, i) => (
            <li key={`${h.changedAt}-${i}`}>
              <StatusBadge status={h.status} />{' '}
              {h.changedAt && <time dateTime={h.changedAt}>{formatDateTime(h.changedAt)}</time>}
              {h.note && <span className="tx-merchant">{h.note}</span>}
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

export function DisputesPage() {
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1))
  const disputes = useDisputesPage({
    page,
    pageSize: DEFAULT_DISPUTE_PAGE_SIZE,
  })
  const [filter, setFilter] = useState<DisputeStatus | 'All'>('All')

  const items = disputes.data?.items
  // The status filter applies to the disputes on the current page only.
  const rows = useMemo(
    () => (items ?? []).filter((d) => filter === 'All' || d.status === filter),
    [items, filter],
  )
  const totalPages = disputes.data?.totalPages ?? 0
  const goToPage = (next: number) => setParams({ page: String(next) }, { replace: true })

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
          {filter !== 'All'
            ? 'No disputes on this page match this status.'
            : page > 1 && disputes.data.totalCount > 0
              ? 'There are no disputes on this page.'
              : 'You have not disputed any transactions yet.'}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <>
          <div className="table-wrap" aria-busy={disputes.isFetching}>
            <table className="table">
              <caption className="visually-hidden">Disputed transactions</caption>
              <thead>
                <tr>
                  <th scope="col">Dispute Ref</th>
                  <th scope="col" className="col-shade">
                    Logged
                  </th>
                  <th scope="col">Account</th>
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
                    <td>
                      <strong>{d.reference}</strong>
                    </td>
                    <td className="col-shade nowrap">{formatDateTime(d.createdAt)}</td>
                    <td className="nowrap">
                      {d.accountNumber ? (
                        <Link
                          to={`/accounts/${encodeURIComponent(d.accountNumber)}`}
                          aria-label={`Open account ${d.accountNumber}`}
                        >
                          {d.accountNumber}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {d.transactionReference && (
                        <span className="tx-merchant">
                          Trnx Ref: <strong>{d.transactionReference}</strong>
                        </span>
                      )}
                    </td>
                    <td className="num col-shade">
                      {d.transactionAmount != null ? (
                        <Money amount={d.transactionAmount} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <details>
                        <summary>{reasonLabel(d.reason)}</summary>
                        <p className="pre-wrap">{d.details || 'No details provided.'}</p>
                      </details>
                      <HistoryToggle disputeReference={d.reference} />
                    </td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {disputes.data && disputes.data.totalCount > 0 && (
        <nav className="pagination" aria-label="Dispute pages">
          <button
            type="button"
            className="btn btn--secondary btn--small"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {page} of {Math.max(totalPages, 1)} · {disputes.data.totalCount} disputes
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--small"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </>
  )
}
