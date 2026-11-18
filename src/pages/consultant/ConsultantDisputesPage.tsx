import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { API_DISPUTE_STATUSES, toApiStatus, type ApiDisputeStatus } from '../../api/consultant'
import { useConsultantDisputes } from '../../api/queries'
import { ConsultantDisputesTable } from '../../components/ConsultantDisputes'
import { EmptyState, ErrorState, PageLoader, Spinner } from '../../components/Feedback'
import { Pager } from '../../components/Pager'
import { readPage } from '../../lib/paging'

const ALL_DISPUTES_PAGE_SIZE = 10

export function ConsultantDisputesPage() {
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const disputes = useConsultantDisputes({
    page,
    pageSize: ALL_DISPUTES_PAGE_SIZE,
  })
  const [filter, setFilter] = useState<ApiDisputeStatus | 'All'>('All')

  const items = disputes.data?.items
  // There is no server-side status filter, so this applies to the current page only.
  const rows = useMemo(
    () => (items ?? []).filter((d) => filter === 'All' || toApiStatus(d.status) === filter),
    [items, filter],
  )

  return (
    <>
      <h1 className="page-title">client disputes</h1>
      <p className="lead">Every dispute logged by every client, newest first.</p>

      <div className="toolbar">
        <label>
          Status
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ApiDisputeStatus | 'All')}
          >
            <option value="All">All statuses</option>
            {API_DISPUTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {disputes.isFetching && !disputes.isPending && <Spinner label="Updating disputes" />}
      </div>

      {disputes.isPending && <PageLoader label="Loading disputes" />}
      {disputes.isError && (
        <ErrorState message={disputes.error.message} onRetry={() => void disputes.refetch()} />
      )}
      {disputes.data && rows.length === 0 && (
        <EmptyState>
          {filter !== 'All'
            ? 'No disputes on this page match this status.'
            : 'No disputes have been logged.'}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <ConsultantDisputesTable
          disputes={rows}
          caption={`All client disputes, page ${page}`}
          showClient
          busy={disputes.isFetching}
        />
      )}
      {disputes.data && disputes.data.totalCount > 0 && (
        <Pager
          label="Dispute pages"
          noun="disputes"
          page={page}
          totalPages={disputes.data.totalPages}
          totalCount={disputes.data.totalCount}
          onPage={(p) => setParams({ page: String(p) }, { replace: true })}
        />
      )}
    </>
  )
}
