import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/auth'
import { Alert } from '../components/Feedback'
import { SecurityBasics } from '../components/SecurityBasics'
import { useAuth, type SignOutReason } from '../auth/AuthContext'
import { isClientIdentifier } from '../lib/format'
import { AuthShell } from './AuthShell'

const schema = z.object({
  accountNumber: z
    .string()
    .trim()
    .min(1, 'Enter your account number or username')
    .superRefine((value, ctx) => {
      if (isClientIdentifier(value)) {
        if (!/^[0-9]{10}$/.test(value)) {
          ctx.addIssue({ code: 'custom', message: 'Enter your 10-digit account number' })
        }
      } else if (!/^[A-Za-z0-9]{3,32}$/.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Username can only contain letters and numbers',
        })
      }
    }),
})
type FormValues = z.infer<typeof schema>

export interface OtpRouteState {
  accountNumber: string
  message: string | null
  from?: string
}

const SIGN_OUT_MESSAGES: Record<SignOutReason, { tone: 'info' | 'warning'; text: string }> = {
  user: { tone: 'info', text: 'You have been logged out successfully.' },
  idle: { tone: 'warning', text: 'You were logged out because of inactivity.' },
  expired: { tone: 'warning', text: 'Your session has expired. Please log in again.' },
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signOutReason } = useAuth()
  const from = (location.state as { from?: string } | null)?.from

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { accountNumber: '' } })

  const requestOtp = useMutation({
    mutationFn: (accountNumber: string) => authApi.requestOtp(accountNumber),
    onSuccess: (res, accountNumber) => {
      const state: OtpRouteState = { accountNumber, message: res?.message ?? null, from }
      navigate('/login/otp', { state })
    },
  })

  const onSubmit = handleSubmit(({ accountNumber }) => {
    if (!requestOtp.isPending) requestOtp.mutate(accountNumber)
  })

  const notice = signOutReason ? SIGN_OUT_MESSAGES[signOutReason] : null

  return (
    <AuthShell aside={<SecurityBasics />}>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {requestOtp.isError && <Alert tone="error">{requestOtp.error.message}</Alert>}

      <form className="login-form" onSubmit={onSubmit} noValidate>
        <div className="form-row">
          <label htmlFor="accountNumber">Account number/username:</label>
          <div className="form-row__control">
            <input
              id="accountNumber"
              type="text"
              autoComplete="username"
              maxLength={32}
              spellCheck={false}
              aria-invalid={errors.accountNumber ? 'true' : 'false'}
              aria-describedby={errors.accountNumber ? 'accountNumber-error' : undefined}
              {...register('accountNumber')}
            />
            {errors.accountNumber && (
              <span id="accountNumber-error" className="field-error">
                {errors.accountNumber.message}
              </span>
            )}
          </div>
        </div>
        <button type="submit" className="btn" disabled={requestOtp.isPending}>
          {requestOtp.isPending ? 'Please wait…' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  )
}
