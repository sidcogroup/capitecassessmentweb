import { useEffect } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { clientName, isValidUserId } from '../../api/consultant'
import {
  useConsultantClient,
  useConsultantClientAccounts,
  useConsultantDisputes,
} from '../../api/queries'
import { ConsultantDisputesTable } from '../../components/ConsultantDisputes'
import { Alert, EmptyState, ErrorState, PageLoader } from '../../components/Feedback'
import { Money } from '../../components/Money'
import { Pager } from '../../components/Pager'
import { readPage } from '../../lib/paging'
import { formatDate } from '../../lib/format'

const CLIENT_DISPUTES_PAGE_SIZE = 6

export function ConsultantClientPage() {
  const { userId = '' } = useParams()
  if (!isValidUserId(userId)) {
    return (
      <>
        <h1 className="page-title">client</h1>
        <Alert tone="error">That client could not be found.</Alert>
        <Link to="/consultant">Back to clients</Link>
      </>
    )
  }
  return <ClientDetails userId={userId} />
}

function ClientDetails({ userId }: { userId: string }) {
  const client = useConsultantClient(userId)
  const name = client.data ? clientName(client.data) : null

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/consultant">Clients</Link> <span aria-hidden="true">›</span>{' '}
        <span aria-current="page">{name ?? `Client ${userId}`}</span>
      </nav>
      <h1 className="page-title">{name ?? 'client details'}</h1>

      {client.isPending && <PageLoader label="Loading client" />}
      {client.isError && (
        <ErrorState message={client.error.message} onRetry={() => void client.refetch()} />
      )}
      {client.data && (
        <section className="card profile-card" aria-label="Client details">
          <dl className="review-list">
            <dt>Client ID</dt>
            <dd>{client.data.userId}</dd>
            <dt>Username</dt>
            <dd>{client.data.username ?? '—'}</dd>
            <dt>First name</dt>
            <dd>{client.data.firstName ?? '—'}</dd>
            <dt>Last name</dt>
            <dd>{client.data.lastName ?? '—'}</dd>
            <dt>Email</dt>
            <dd>{client.data.email ?? '—'}</dd>
            <dt>Contact email</dt>
            <dd>{client.data.contactEmail ?? '—'}</dd>
            <dt>Contact number</dt>
            <dd>{client.data.contactNumber ?? '—'}</dd>
            <dt>Client since</dt>
            <dd>{formatDate(client.data.createdAt)}</dd>
          </dl>
        </section>
      )}

      <ClientAccounts userId={userId} />
      <ClientDisputes userId={userId} />
    </>
  )
}

function ClientAccounts({ userId }: { userId: string }) {
  const accounts = useConsultantClientAccounts(userId)

  return (
    <section aria-labelledby="accounts-heading">
      <div className="section-head">
        <h2 id="accounts-heading">Accounts</h2>
      </div>
      {accounts.isPending && <PageLoader label="Loading accounts" />}
      {accounts.isError && (
        <ErrorState message={accounts.error.message} onRetry={() => void accounts.refetch()} />
      )}
      {accounts.data && accounts.data.length === 0 && (
        <EmptyState>This client has no accounts.</EmptyState>
      )}
      {accounts.data && accounts.data.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Client accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Account Number</th>
                  <th scope="col" className="col-shade">
                    Account Name
                  </th>
                  <th scope="col">Account Type</th>
                  <th scope="col" className="num col-shade">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.data.map((a) => {
                  const href = `/consultant/clients/${userId}/accounts/${a.accountId}`
                  return (
                    <tr key={a.accountId}>
                      <td>
                        <Link to={href}>{a.accountNumber ?? a.accountId}</Link>
                      </td>
                      <td className="col-shade">
                        <Link to={href}>{a.accountName?.toUpperCase() ?? '—'}</Link>
                      </td>
                      <td>{a.accountType ?? '—'}</td>
                      <td className="num col-shade">
                        <Money amount={a.balance} currency={a.currency} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="table-hint">Click on an account number or name to view transactions</p>
        </>
      )}
    </section>
  )
}

function ClientDisputes({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('disputesPage'))
  const disputes = useConsultantDisputes({ page, pageSize: CLIENT_DISPUTES_PAGE_SIZE }, userId)
  const items = disputes.data?.items ?? []
  const { hash } = useLocation()
  const loaded = disputes.isSuccess

  // The dashboard's dispute markers link to #client-disputes-heading; scroll once it has content.
  useEffect(() => {
    if (loaded && hash === '#client-disputes-heading') {
      document.getElementById('client-disputes-heading')?.scrollIntoView?.({ block: 'start' })
    }
  }, [loaded, hash])

  return (
    <section aria-labelledby="client-disputes-heading">
      <div className="section-head">
        <h2 id="client-disputes-heading">Disputes</h2>
      </div>
      {disputes.isPending && <PageLoader label="Loading disputes" />}
      {disputes.isError && (
        <ErrorState message={disputes.error.message} onRetry={() => void disputes.refetch()} />
      )}
      {disputes.data && items.length === 0 && (
        <EmptyState>This client has not disputed any transactions.</EmptyState>
      )}
      {items.length > 0 && (
        <ConsultantDisputesTable
          disputes={items}
          caption="Disputes logged by this client"
          busy={disputes.isFetching}
        />
      )}
      {disputes.data && disputes.data.totalCount > 0 && (
        <Pager
          label="Client dispute pages"
          noun="disputes"
          page={page}
          totalPages={disputes.data.totalPages}
          totalCount={disputes.data.totalCount}
          onPage={(p) => setParams({ disputesPage: String(p) }, { replace: true })}
        />
      )}
    </section>
  )
}
