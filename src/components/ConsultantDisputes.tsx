import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import {
  API_DISPUTE_STATUSES,
  clientName,
  NOTE_MAX,
  toApiStatus,
  type ConsultantDispute,
} from '../api/consultant'
import { useAccountDirectory, useUpdateDispute } from '../api/queries'
import { formatDateTime } from '../lib/format'
import { Alert } from './Feedback'
import { Money } from './Money'
import { StatusBadge } from './StatusBadge'

/** Table of disputes with an "Update" action per row. */
export function ConsultantDisputesTable({
  disputes,
  caption,
  busy,
  showClient = false,
}: {
  disputes: ConsultantDispute[]
  caption: string
  busy?: boolean
  /** Adds a Client column linking each dispute to its client (all-clients view). */
  showClient?: boolean
}) {
  // Also used without the Client column, to link account numbers to their transactions.
  const directory = useAccountDirectory()
  const [editing, setEditing] = useState<ConsultantDispute | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <>
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="table-wrap">
        <table className="table" aria-busy={busy}>
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Dispute Ref</th>
              <th scope="col" className="col-shade">
                Logged
              </th>
              {showClient && <th scope="col">Client</th>}
              <th scope="col">Account</th>
              <th scope="col" className="num col-shade">
                Amount
              </th>
              <th scope="col">Reason</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((d) => {
              const owner = d.accountNumber ? directory.data?.get(d.accountNumber) : undefined
              const clientHref = owner ? `/consultant/clients/${owner.client.userId}` : undefined
              return (
                <tr key={d.reference || d.transactionId}>
                  <td>
                    <strong>{d.reference || '—'}</strong>
                  </td>
                  <td className="col-shade nowrap">
                    {formatDateTime(d.createdAt)}
                    {d.updatedAt && d.updatedAt !== d.createdAt && (
                      <span className="tx-merchant">Updated {formatDateTime(d.updatedAt)}</span>
                    )}
                  </td>
                  {showClient && (
                    <td>
                      {owner && clientHref ? (
                        <Link to={clientHref}>{clientName(owner.client)}</Link>
                      ) : directory.isPending ? (
                        <span className="muted">Looking up…</span>
                      ) : (
                        <span className="muted">Unknown</span>
                      )}
                    </td>
                  )}
                  <td className="nowrap">
                    {owner && clientHref && d.accountNumber ? (
                      <Link
                        to={`${clientHref}/accounts/${owner.accountId}`}
                        aria-label={`View transactions for account ${d.accountNumber}`}
                      >
                        {d.accountNumber}
                      </Link>
                    ) : (
                      (d.accountNumber ?? '—')
                    )}
                    {d.transactionReference && (
                      <span className="tx-merchant">
                        Trnx Ref: <strong>{d.transactionReference}</strong>
                      </span>
                    )}
                  </td>
                  <td className="num col-shade">
                    {d.transactionAmount != null ? <Money amount={d.transactionAmount} /> : '—'}
                  </td>
                  <td>
                    <details>
                      <summary>{d.reason || 'No reason given'}</summary>
                      <p className="pre-wrap">{d.details || 'No details provided.'}</p>
                    </details>
                  </td>
                  <td>
                    <StatusBadge status={d.status} label={toApiStatus(d.status)} />
                  </td>
                  <td className="cell-action">
                    <button
                      type="button"
                      className="btn btn--small btn--secondary"
                      disabled={!d.reference}
                      onClick={() => {
                        setNotice(null)
                        setEditing(d)
                      }}
                      aria-label={`Update dispute ${d.reference}`}
                    >
                      Update
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <UpdateDisputeDialog
          dispute={editing}
          onClose={() => setEditing(null)}
          onUpdated={(updated) => {
            setEditing(null)
            setNotice(`Dispute ${updated.reference} is now ${toApiStatus(updated.status)}.`)
          }}
        />
      )}
    </>
  )
}

const schema = z.object({
  status: z.enum(API_DISPUTE_STATUSES),
  note: z.string().max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters`),
})
type FormValues = z.infer<typeof schema>

function UpdateDisputeDialog({
  dispute,
  onClose,
  onUpdated,
}: {
  dispute: ConsultantDispute
  onClose: () => void
  onUpdated: (d: ConsultantDispute) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const update = useUpdateDispute()
  const currentStatus = toApiStatus(dispute.status)

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { status: currentStatus, note: '' },
  })
  const noteLength = useWatch({ control, name: 'note' })?.length ?? 0

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  const onSubmit = handleSubmit(({ status, note }) => {
    if (status === currentStatus && !note.trim()) {
      setError('note', { message: 'Change the status or add a note' })
      return
    }
    if (update.isPending) return
    update.mutate(
      { reference: dispute.reference, body: { status, note } },
      // Some responses may omit the reference; keep the one we sent.
      {
        onSuccess: (d) => onUpdated({ ...d, reference: d.reference || dispute.reference }),
      },
    )
  })

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide"
      aria-labelledby="update-dispute-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <h2 id="update-dispute-title">Update dispute {dispute.reference}</h2>
      <dl className="review-list">
        <dt>Current status</dt>
        <dd>
          <StatusBadge status={dispute.status} label={currentStatus} />
        </dd>
        <dt>Reason</dt>
        <dd>{dispute.reason || '—'}</dd>
        {dispute.transactionAmount != null && (
          <>
            <dt>Amount</dt>
            <dd>
              <Money amount={dispute.transactionAmount} />
            </dd>
          </>
        )}
      </dl>

      {update.isError && <Alert tone="error">{update.error.message}</Alert>}

      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="dispute-status">New status</label>
          <select id="dispute-status" {...register('status')}>
            {API_DISPUTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dispute-note">Note</label>
          <textarea
            id="dispute-note"
            rows={4}
            maxLength={NOTE_MAX}
            aria-invalid={errors.note ? 'true' : 'false'}
            aria-describedby={`dispute-note-hint${errors.note ? ' dispute-note-error' : ''}`}
            {...register('note')}
          />
          <span id="dispute-note-hint" className="field-hint">
            Recorded with this status change. {noteLength}/{NOTE_MAX}
          </span>
          {errors.note && (
            <span id="dispute-note-error" className="field-error">
              {errors.note.message}
            </span>
          )}
        </div>
        <div className="actions">
          <button type="submit" className="btn" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save update'}
          </button>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
