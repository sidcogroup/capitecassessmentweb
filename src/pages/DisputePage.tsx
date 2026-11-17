import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useLocation, useParams } from 'react-router-dom'
import { z } from 'zod'
import { isDebit, type Transaction } from '../api/accounts'
import { DISPUTE_REASONS, OPEN_STATUSES, reasonLabel, type Dispute } from '../api/disputes'
import { useCreateDispute, useDisputes } from '../api/queries'
import { Alert } from '../components/Feedback'
import { Money } from '../components/Money'
import { formatDate, formatDateTime } from '../lib/format'

const DETAILS_MAX = 500
const reasonValues = DISPUTE_REASONS.map((r) => r.value) as [
  (typeof DISPUTE_REASONS)[number]['value'],
  ...(typeof DISPUTE_REASONS)[number]['value'][],
]

const schema = z.object({
  reason: z.enum(reasonValues, { error: 'Select a reason for the dispute' }),
  details: z
    .string()
    .trim()
    .min(10, 'Tell us a bit more (at least 10 characters)')
    .max(DETAILS_MAX, `Keep it under ${DETAILS_MAX} characters`)
    .refine((v) => !/\d{13,19}/.test(v.replace(/[\s-]/g, '')), {
      message: 'Do not include card numbers in your description',
    }),
})
type FormValues = z.infer<typeof schema>

interface RouteState {
  transaction?: Transaction
  currency?: string
}

export function DisputePage() {
  const { accountNumber = '', transactionId = '' } = useParams()
  const state = useLocation().state as RouteState | null
  const tx = state?.transaction?.id === transactionId ? state.transaction : undefined

  if (!tx || !isDebit(tx)) {
    return (
      <>
        <h1 className="page-title">dispute a transaction</h1>
        <Alert tone="warning">
          Please choose the transaction you want to dispute from your transaction history.
        </Alert>
        <Link className="btn" to={`/accounts/${accountNumber}`}>
          Go to transaction history
        </Link>
      </>
    )
  }

  return (
    <DisputeFlow accountNumber={accountNumber} tx={tx} currency={state?.currency ?? 'ZAR'} />
  )
}

type Step = 'capture' | 'review' | 'done'

function DisputeFlow({
  accountNumber,
  tx,
  currency,
}: {
  accountNumber: string
  tx: Transaction
  currency: string
}) {
  const [step, setStep] = useState<Step>('capture')
  const [confirmed, setConfirmed] = useState(false)
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [created, setCreated] = useState<Dispute | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const createDispute = useCreateDispute()
  const disputes = useDisputes()
  const existing = disputes.data?.find(
    (d) => d.transactionId === tx.id && OPEN_STATUSES.includes(d.status),
  )

  const {
    register,
    handleSubmit,
    getValues,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: undefined, details: '' },
  })
  const detailsLength = useWatch({ control, name: 'details' })?.length ?? 0

  // Move focus to the step heading for screen-reader users on every step change.
  useEffect(() => headingRef.current?.focus(), [step])

  const submit = () => {
    if (createDispute.isPending || !confirmed) return
    const { reason, details } = getValues()
    createDispute.mutate(
      {
        input: { accountNumber, transactionId: tx.id, reason, details: details.trim() },
        snapshot: {
          transactionDate: tx.transactionDate,
          description: tx.description,
          reference: tx.reference,
          amount: tx.amount,
        },
        idempotencyKey,
      },
      {
        onSuccess: (d) => {
          setCreated(d)
          setStep('done')
        },
      },
    )
  }

  const summary = (
    <section className="card tx-summary" aria-label="Transaction being disputed">
      <dl>
        <dt>Date</dt>
        <dd>{formatDate(tx.transactionDate)}</dd>
        <dt>Description</dt>
        <dd>{tx.description ?? '—'}</dd>
        {tx.merchant && (
          <>
            <dt>Merchant</dt>
            <dd>{tx.merchant}</dd>
          </>
        )}
        <dt>Reference</dt>
        <dd>{tx.reference ?? '—'}</dd>
        <dt>Amount</dt>
        <dd>
          <Money amount={tx.amount} currency={currency} />
        </dd>
        <dt>Account</dt>
        <dd>{accountNumber}</dd>
      </dl>
    </section>
  )

  if (step === 'done' && created) {
    return (
      <>
        <h1 className="page-title" ref={headingRef} tabIndex={-1}>
          dispute submitted
        </h1>
        <Alert tone="success" title="We have received your dispute">
          <p>
            Your reference number is <strong>{created.reference}</strong>. Logged on{' '}
            {formatDateTime(created.createdAt)}. We will review it within 10 business days.
          </p>
        </Alert>
        {summary}
        <div className="actions">
          <Link className="btn" to="/disputes">
            View my disputes
          </Link>
          <Link className="btn btn--secondary" to={`/accounts/${accountNumber}`}>
            Back to transactions
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">My portfolio</Link> <span aria-hidden="true">›</span>{' '}
        <Link to={`/accounts/${accountNumber}`}>Transactions</Link>{' '}
        <span aria-hidden="true">›</span> <span aria-current="page">Dispute</span>
      </nav>
      <h1 className="page-title" ref={headingRef} tabIndex={-1}>
        {step === 'capture' ? 'dispute a transaction' : 'confirm your dispute'}
      </h1>
      <ol className="steps" aria-label="Progress">
        <li aria-current={step === 'capture' ? 'step' : undefined}>1. Details</li>
        <li aria-current={step === 'review' ? 'step' : undefined}>2. Confirm</li>
        <li>3. Submitted</li>
      </ol>

      {existing && (
        <Alert tone="warning">
          This transaction already has an open dispute ({existing.reference}).{' '}
          <Link to="/disputes">View my disputes</Link>
        </Alert>
      )}

      <div className="dispute-grid">
        {summary}

        {step === 'capture' && (
          <form
            className="card dispute-form"
            noValidate
            onSubmit={handleSubmit(() => setStep('review'))}
          >
            <fieldset disabled={!!existing}>
              <legend className="visually-hidden">Dispute details</legend>
              <div className="field">
                <label htmlFor="reason">Why are you disputing this transaction?</label>
                <select
                  id="reason"
                  defaultValue=""
                  aria-invalid={errors.reason ? 'true' : 'false'}
                  aria-describedby={errors.reason ? 'reason-error' : undefined}
                  {...register('reason')}
                >
                  <option value="" disabled>
                    Select a reason
                  </option>
                  {DISPUTE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {errors.reason && (
                  <span id="reason-error" className="field-error">
                    {errors.reason.message}
                  </span>
                )}
              </div>
              <div className="field">
                <label htmlFor="details">Tell us what happened</label>
                <textarea
                  id="details"
                  rows={5}
                  maxLength={DETAILS_MAX}
                  aria-invalid={errors.details ? 'true' : 'false'}
                  aria-describedby={`details-hint${errors.details ? ' details-error' : ''}`}
                  {...register('details')}
                />
                <span id="details-hint" className="field-hint">
                  Never include your PIN, password, OTP or full card number. {detailsLength}/
                  {DETAILS_MAX}
                </span>
                {errors.details && (
                  <span id="details-error" className="field-error">
                    {errors.details.message}
                  </span>
                )}
              </div>
              <div className="actions">
                <button type="submit" className="btn">
                  Continue
                </button>
                <Link className="btn btn--secondary" to={`/accounts/${accountNumber}`}>
                  Cancel
                </Link>
              </div>
            </fieldset>
          </form>
        )}

        {step === 'review' && (
          <section className="card dispute-form" aria-label="Review dispute">
            <dl className="review-list">
              <dt>Reason</dt>
              <dd>{reasonLabel(getValues('reason'))}</dd>
              <dt>What happened</dt>
              <dd className="pre-wrap">{getValues('details')}</dd>
            </dl>
            {createDispute.isError && <Alert tone="error">{createDispute.error.message}</Alert>}
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              I confirm that the information above is true and correct.
            </label>
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={!confirmed || createDispute.isPending}
                onClick={submit}
              >
                {createDispute.isPending ? 'Submitting…' : 'Submit dispute'}
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                disabled={createDispute.isPending}
                onClick={() => setStep('capture')}
              >
                Back
              </button>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
