import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { clientName, type ClientDisputeSummary } from '../../api/consultant'
import {
  useClientDisputeSummaries,
  useConsultantClients,
  useConsultantDisputes,
} from '../../api/queries'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, PageLoader, Spinner } from '../../components/Feedback'
import { Pager } from '../../components/Pager'
import { readPage } from '../../lib/paging'
import { formatLongDate } from '../../lib/format'

const CLIENT_PAGE_SIZE = 5

export function ConsultantDashboardPage() {
  const { session } = useAuth()
  const [today] = useState(() => new Date())
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const clients = useConsultantClients({ page, pageSize: CLIENT_PAGE_SIZE })
  // Page size 1 is enough to read the total number of disputes for the summary tile.
  const disputeTotal = useConsultantDisputes({ page: 1, pageSize: 1 })

  const items = clients.data?.items ?? []
  const disputeSummaries = useClientDisputeSummaries(items.map((c) => c.userId))

  return (
    <>
      <h1 className="page-title">Consultant Dashboard</h1>
      <dl className="client-meta">
        <dt>Consultant:</dt>
        <dd>{session?.username ?? '—'}</dd>
        <dt>Today&apos;s date:</dt>
        <dd>{formatLongDate(today)}</dd>
      </dl>

      <div className="stat-grid">
        <div className="stat card">
          <span className="stat__label">Clients</span>
          <span className="stat__value">{clients.data?.totalCount ?? '—'}</span>
        </div>
        <Link to="/consultant/disputes" className="stat card stat--link">
          <span className="stat__label">Disputes logged</span>
          <span className="stat__value">{disputeTotal.data?.totalCount ?? '—'}</span>
          <span className="stat__hint">Review and update disputes ›</span>
        </Link>
      </div>

      <section aria-labelledby="clients-heading">
        <div className="section-head">
          <h2 id="clients-heading">Clients</h2>
          {clients.isFetching && !clients.isPending && <Spinner label="Updating clients" />}
        </div>

        {clients.isPending && <PageLoader label="Loading clients" />}
        {clients.isError && (
          <ErrorState message={clients.error.message} onRetry={() => void clients.refetch()} />
        )}
        {clients.data && items.length === 0 && (
          <EmptyState>There are no clients to show.</EmptyState>
        )}

        {items.length > 0 && (
          <div className="table-wrap">
            <table className="table" aria-busy={clients.isFetching}>
              <caption className="visually-hidden">Clients, page {page}</caption>
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col" className="col-shade">
                    Username
                  </th>
                  <th scope="col">Email</th>
                  <th scope="col" className="col-shade">
                    Client ID
                  </th>
                  <th scope="col">Disputes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const summary = disputeSummaries.get(c.userId)
                  return (
                    <tr key={c.userId} className={summary?.open ? 'row--flagged' : undefined}>
                      <td>
                        <Link to={`/consultant/clients/${c.userId}`}>{clientName(c)}</Link>
                      </td>
                      <td className="col-shade">{c.username ?? '—'}</td>
                      <td>{c.email ?? '—'}</td>
                      <td className="col-shade muted">{c.userId}</td>
                      <td>
                        <DisputeMarker userId={c.userId} summary={summary} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {clients.data && clients.data.totalCount > 0 && (
          <Pager
            label="Client pages"
            noun="clients"
            page={page}
            totalPages={clients.data.totalPages}
            totalCount={clients.data.totalCount}
            onPage={(p) => setParams({ page: String(p) }, { replace: true })}
          />
        )}
      </section>
    </>
  )
}

function DisputeMarker({
  userId,
  summary,
}: {
  userId: number
  summary: ClientDisputeSummary | undefined
}) {
  if (!summary) return <span className="muted">…</span>
  if (summary.total === 0) return <span className="muted">None</span>
  const href = `/consultant/clients/${userId}#client-disputes-heading`
  return (
    <Link to={href} className="badge-link">
      {summary.open > 0 ? (
        <span className="badge badge--underreview">{summary.open} open</span>
      ) : (
        <span className="badge badge--resolved">{summary.total} closed</span>
      )}
      {summary.open > 0 && summary.open < summary.total && (
        <span className="muted"> of {summary.total}</span>
      )}
    </Link>
  )
}
