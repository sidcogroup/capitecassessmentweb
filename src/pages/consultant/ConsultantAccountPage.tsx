import { Link, useParams, useSearchParams } from 'react-router-dom'
import { isDebit } from '../../api/accounts'
import { clientName, isValidAccountId, isValidUserId } from '../../api/consultant'
import {
  useConsultantClient,
  useConsultantClientAccounts,
  useConsultantTransactions,
} from '../../api/queries'
import { Alert, EmptyState, ErrorState, PageLoader, Spinner } from '../../components/Feedback'
import { Money } from '../../components/Money'
import { Pager } from '../../components/Pager'
import { readPage } from '../../lib/paging'
import { formatDate } from '../../lib/format'

const PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 25]

export function ConsultantAccountPage() {
  const { userId = '', accountId = '' } = useParams()
  if (!isValidUserId(userId) || !isValidAccountId(accountId)) {
    return (
      <>
        <h1 className="page-title">transaction history</h1>
        <Alert tone="error">That account could not be found.</Alert>
        <Link to="/consultant">Back to clients</Link>
      </>
    )
  }
  return <AccountTransactions userId={userId} accountId={accountId} />
}

function AccountTransactions({ userId, accountId }: { userId: string; accountId: string }) {
  const [params, setParams] = useSearchParams()
  const page = readPage(params.get('page'))
  const requestedSize = Number(params.get('pageSize'))
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedSize) ? requestedSize : PAGE_SIZE_OPTIONS[0]

  const client = useConsultantClient(userId)
  const accounts = useConsultantClientAccounts(userId)
  const account = accounts.data?.find((a) => a.accountId === accountId)
  const tx = useConsultantTransactions(accountId, { page, pageSize })
  const items = tx.data?.items ?? []
  const name = client.data ? clientName(client.data) : `Client ${userId}`

  const update = (next: { page?: number; pageSize?: number }) => {
    const merged = { page, pageSize, ...next }
    setParams({ page: String(merged.page), pageSize: String(merged.pageSize) }, { replace: true })
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/consultant">Clients</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/consultant/clients/${userId}`}>{name}</Link> <span aria-hidden="true">›</span>{' '}
        <span aria-current="page">{account?.accountName ?? 'Account'}</span>
      </nav>
      <h1 className="page-title">transaction history</h1>

      <div className="account-summary card">
        <div>
          <span className="account-summary__label">Account</span>
          <strong>{account?.accountName ?? '—'}</strong>
          <span className="muted">
            {account?.accountNumber ?? accountId}
            {account?.accountType ? ` · ${account.accountType}` : ''}
          </span>
        </div>
        {account && (
          <div className="account-summary__balance">
            <span className="account-summary__label">Balance</span>
            <Money amount={account.balance} currency={account.currency} />
          </div>
        )}
      </div>

      <div className="toolbar">
        <label>
          Per page
          <select
            value={pageSize}
            onChange={(e) => update({ pageSize: Number(e.target.value), page: 1 })}
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        {tx.isFetching && !tx.isPending && <Spinner label="Updating transactions" />}
      </div>

      {tx.isPending && <PageLoader label="Loading transactions" />}
      {tx.isError && <ErrorState message={tx.error.message} onRetry={() => void tx.refetch()} />}
      {tx.data && items.length === 0 && <EmptyState>This account has no transactions.</EmptyState>}

      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table" aria-busy={tx.isFetching}>
            <caption className="visually-hidden">Transactions, page {page}</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col" className="col-shade">
                  Description
                </th>
                <th scope="col">Reference</th>
                <th scope="col" className="num col-shade">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="nowrap">{formatDate(t.transactionDate)}</td>
                  <td className="col-shade">
                    <span className="tx-desc">{t.description ?? '—'}</span>
                    {t.merchant && t.merchant !== t.description && (
                      <span className="tx-merchant">{t.merchant}</span>
                    )}
                  </td>
                  <td className="muted">{t.reference ?? '—'}</td>
                  <td className="num col-shade">
                    <Money
                      amount={t.amount}
                      currency={account?.currency ?? 'ZAR'}
                      direction={isDebit(t) ? 'debit' : 'credit'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tx.data && tx.data.totalCount > 0 && (
        <Pager
          label="Transaction pages"
          noun="transactions"
          page={page}
          totalPages={tx.data.totalPages}
          totalCount={tx.data.totalCount}
          onPage={(p) => update({ page: p })}
        />
      )}
    </>
  )
}
