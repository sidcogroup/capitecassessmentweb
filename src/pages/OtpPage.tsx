import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/auth'
import { ApiError } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import { Alert } from '../components/Feedback'
import { SecurityBasics } from '../components/SecurityBasics'
import { isClientIdentifier, maskAccountNumber } from '../lib/format'
import { AuthShell } from './AuthShell'
import type { OtpRouteState } from './LoginPage'

const OTP_VALIDITY_SECONDS = 5 * 60
const RESEND_COOLDOWN_SECONDS = 30

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Enter the 6-digit one-time pin'),
})
type FormValues = z.infer<typeof schema>

/** Ticking clock; remaining time is derived from it during render. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

const secondsUntil = (deadline: number, now: number) =>
  Math.max(0, Math.ceil((deadline - now) / 1000))

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function OtpPage() {
  const location = useLocation()
  const state = location.state as OtpRouteState | null

  if (!state?.accountNumber) return <Navigate to="/login" replace />
  return <OtpForm {...state} />
}

function OtpForm({ accountNumber, message, from }: OtpRouteState) {
  const navigate = useNavigate()
  const { completeLogin } = useAuth()
  const [issuedAt, setIssuedAt] = useState(() => Date.now())
  const [resentNotice, setResentNotice] = useState(false)
  const now = useNow()
  const validityLeft = secondsUntil(issuedAt + OTP_VALIDITY_SECONDS * 1000, now)
  const resendLeft = secondsUntil(issuedAt + RESEND_COOLDOWN_SECONDS * 1000, now)

  const {
    register,
    handleSubmit,
    resetField,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } })

  useEffect(() => setFocus('code'), [setFocus])

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verifyOtp(accountNumber, code),
    onSuccess: (session) => {
      completeLogin(session)
      navigate(from && from !== '/login' ? from : '/', { replace: true })
    },
    onError: () => {
      resetField('code')
      setFocus('code')
    },
  })

  const resend = useMutation({
    mutationFn: () => authApi.requestOtp(accountNumber),
    onSuccess: () => {
      verify.reset()
      setIssuedAt(Date.now())
      setResentNotice(true)
    },
  })

  const onSubmit = handleSubmit(({ code }) => {
    if (!verify.isPending) verify.mutate(code)
  })

  const verifyError =
    verify.error instanceof ApiError && (verify.error.status === 401 || verify.error.status === 400)
      ? 'The one-time pin is incorrect or has expired. Please try again or request a new one.'
      : verify.error?.message

  return (
    <AuthShell aside={<SecurityBasics />}>
      <Alert tone="info">
        {message ??
          'If the account number is registered, a one-time pin has been sent to the email address on file.'}
      </Alert>
      {resentNotice && !resend.isError && (
        <Alert tone="success">A new one-time pin has been requested.</Alert>
      )}
      {verifyError && <Alert tone="error">{verifyError}</Alert>}
      {resend.isError && <Alert tone="error">{resend.error.message}</Alert>}

      <form className="login-form" onSubmit={onSubmit} noValidate>
        <div className="form-row">
          <span className="form-row__label">
            {isClientIdentifier(accountNumber) ? 'Account number:' : 'Username:'}
          </span>
          <span className="form-row__control form-row__value">
            {isClientIdentifier(accountNumber) ? maskAccountNumber(accountNumber) : accountNumber}
          </span>
        </div>
        <div className="form-row">
          <label htmlFor="code">One-time pin (OTP):</label>
          <div className="form-row__control">
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              spellCheck={false}
              className="input--otp"
              aria-invalid={errors.code ? 'true' : 'false'}
              aria-describedby={`code-hint${errors.code ? ' code-error' : ''}`}
              {...register('code')}
            />
            <span id="code-hint" className="field-hint" aria-live="polite">
              {validityLeft > 0
                ? `Valid for ${formatClock(validityLeft)}`
                : 'This one-time pin has expired. Request a new one.'}
            </span>
            {errors.code && (
              <span id="code-error" className="field-error">
                {errors.code.message}
              </span>
            )}
          </div>
        </div>
        <div className="actions">
          <button type="submit" className="btn" disabled={verify.isPending}>
            {verify.isPending ? 'Verifying…' : 'Log in'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={resendLeft > 0 || resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resendLeft > 0 ? `Resend OTP (${resendLeft}s)` : 'Resend OTP'}
          </button>
          <Link to="/login" className="link-muted">
            Not you? Start again
          </Link>
        </div>
      </form>
    </AuthShell>
  )
}
