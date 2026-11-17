import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccounts, useDisputes, useProfile } from '../api/queries'
import { OPEN_STATUSES } from '../api/disputes'
import { EmptyState, ErrorState, PageLoader } from '../components/Feedback'
import { Money } from '../components/Money'
import { formatLongDate } from '../lib/format'

export function PortfolioPage() {
  const profile = useProfile()
  const [today] = useState(() => new Date())
  const accounts = useAccounts()
  const disputes = useDisputes()
  const openDisputes = disputes.data?.filter((d) => OPEN_STATUSES.includes(d.status)).length ?? 0

  return (
    <>
      <h1 className="page-title">my banking portfolio</h1>
      <dl className="client-meta">
        <dt>Client name:</dt>
        <dd>{profile.data?.fullName ?? '—'}</dd>
        <dt>Today&apos;s date:</dt>
        <dd>{formatLongDate(today)}</dd>
      </dl>

      {accounts.isPending && <PageLoader label="Loading your accounts" />}
      {accounts.isError && (
        <ErrorState message={accounts.error.message} onRetry={() => void accounts.refetch()} />
      )}
      {accounts.data && accounts.data.length === 0 && (
        <EmptyState>You have no accounts linked to this profile.</EmptyState>
      )}
      {accounts.data && accounts.data.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="visually-hidden">Your accounts</caption>
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
                  const href = `/accounts/${a.accountNumber}`
                  return (
                    <tr key={a.accountNumber}>
                      <td>
                        <Link to={href}>{a.accountNumber}</Link>
                      </td>
                      <td className="col-shade">
                        <Link to={href}>{a.accountName?.toUpperCase()}</Link>
                      </td>
                      <td>{a.accountType}</td>
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

      <section className="i-want-to" aria-labelledby="i-want-to">
        <h2 id="i-want-to">I want to</h2>
        <ul className="chevron-list">
          <li>
            <Link to="/disputes">
              View my disputed transactions
              {openDisputes > 0 && <span className="pill">{openDisputes} open</span>}
            </Link>
          </li>
          {accounts.data?.map((a) => (
            <li key={a.accountNumber}>
              <Link to={`/accounts/${a.accountNumber}`}>
                Dispute a transaction on {a.accountName}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
