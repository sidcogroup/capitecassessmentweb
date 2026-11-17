import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ACCOUNT_NUMBER_PATTERN, isDebit, type Transaction } from '../api/accounts'
import { OPEN_STATUSES, type Dispute } from '../api/disputes'
import { useAccount, useDisputes, useTransactions } from '../api/queries'
import { Alert, EmptyState, ErrorState, PageLoader, Spinner } from '../components/Feedback'
import { Money } from '../components/Money'
import { StatusBadge } from '../components/StatusBadge'
import { formatDate } from '../lib/format'

const DAY_OPTIONS = [7, 30, 60, 90, 180] as const
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const

function readInt(value: string | null, allowed: readonly number[], fallback: number) {
  const n = Number(value)
  return allowed.includes(n) ? n : fallback
}

export function AccountPage() {
  const { accountNumber = '' } = useParams()
  if (!ACCOUNT_NUMBER_PATTERN.test(accountNumber)) {
    return (
      <>
        <h1 className="page-title">transaction history</h1>
        <Alert tone="error">That account could not be found.</Alert>
        <Link to="/">Back to my portfolio</Link>
      </>
    )
  }
  return <AccountTransactions accountNumber={accountNumber} />
}

function AccountTransactions({ accountNumber }: { accountNumber: string }) {
  const [params, setParams] = useSearchParams()
  const days = readInt(params.get('days'), DAY_OPTIONS, 30)
  const pageSize = readInt(params.get('pageSize'), PAGE_SIZE_OPTIONS, 10)
  const page = Math.max(1, Math.floor(Number(params.get('page')) || 1))

  const { account } = useAccount(accountNumber)
  const tx = useTransactions(accountNumber, { days, page, pageSize })
  const disputes = useDisputes()

  const disputeByTx = useMemo(() => {
    const map = new Map<string, Dispute>()
    // Newest first, keep the latest dispute per transaction.
    for (const d of disputes.data ?? []) if (!map.has(d.transactionId)) map.set(d.transactionId, d)
    return map
  }, [disputes.data])

  const update = (next: Partial<Record<'days' | 'page' | 'pageSize', number>>) => {
    const merged = { days, page, pageSize, ...next }
    setParams(
      { days: String(merged.days), page: String(merged.page), pageSize: String(merged.pageSize) },
      { replace: true },
    )
  }

  const items = tx.data?.items ?? []
  const totalPages = tx.data?.totalPages ?? 0

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">My portfolio</Link> <span aria-hidden="true">›</span>{' '}
        <span aria-current="page">{account?.accountName ?? accountNumber}</span>
      </nav>
      <h1 className="page-title">transaction history</h1>

      <div className="account-summary card">
        <div>
          <span className="account-summary__label">Account</span>
          <strong>{account?.accountName ?? '—'}</strong>
          <span className="muted">
            {accountNumber}
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
          Show
          <select value={days} onChange={(e) => update({ days: Number(e.target.value), page: 1 })}>
            {DAY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </select>
        </label>
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
      {tx.data && items.length === 0 && (
        <EmptyState>No transactions in the last {days} days.</EmptyState>
      )}

      {items.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table" aria-busy={tx.isFetching}>
              <caption className="visually-hidden">
                Transactions for account {accountNumber}, last {days} days, page {page}
              </caption>
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
                  <th scope="col">
                    <span className="visually-hidden">Dispute</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    tx={t}
                    accountNumber={accountNumber}
                    currency={account?.currency ?? 'ZAR'}
                    dispute={disputeByTx.get(t.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <nav className="pagination" aria-label="Transaction pages">
            <button
              type="button"
              className="btn btn--secondary btn--small"
              disabled={page <= 1}
              onClick={() => update({ page: page - 1 })}
            >
              Previous
            </button>
            <span aria-live="polite">
              Page {page} of {Math.max(totalPages, 1)} · {tx.data?.totalCount ?? 0} transactions
            </span>
            <button
              type="button"
              className="btn btn--secondary btn--small"
              disabled={page >= totalPages}
              onClick={() => update({ page: page + 1 })}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </>
  )
}

function TransactionRow({
  tx,
  accountNumber,
  currency,
  dispute,
}: {
  tx: Transaction
  accountNumber: string
  currency: string
  dispute?: Dispute
}) {
  const openDispute = dispute && OPEN_STATUSES.includes(dispute.status)
  const debit = isDebit(tx)
  const canDispute = debit && !openDispute

  return (
    <tr>
      <td className="nowrap">{formatDate(tx.transactionDate)}</td>
      <td className="col-shade">
        <span className="tx-desc">{tx.description ?? '—'}</span>
        {tx.merchant && tx.merchant !== tx.description && (
          <span className="tx-merchant">{tx.merchant}</span>
        )}
      </td>
      <td className="muted">{tx.reference ?? '—'}</td>
      <td className="num col-shade">
        <Money amount={tx.amount} currency={currency} direction={debit ? 'debit' : 'credit'} />
      </td>
      <td className="cell-action">
        {dispute && (
          <Link to="/disputes" className="badge-link" title={`Dispute ${dispute.reference}`}>
            <StatusBadge status={dispute.status} />
          </Link>
        )}
        {canDispute && (
          <Link
            className="btn btn--small btn--secondary"
            to={`/accounts/${accountNumber}/transactions/${tx.id}/dispute`}
            state={{ transaction: tx, currency }}
            aria-label={`Dispute ${tx.description ?? 'transaction'} on ${formatDate(tx.transactionDate)}`}
          >
            Dispute
          </Link>
        )}
      </td>
    </tr>
  )
}
