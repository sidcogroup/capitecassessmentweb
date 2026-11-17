import { formatMoney } from '../lib/format'

export function Money({ amount, currency }: { amount: number; currency?: string | null }) {
  return (
    <span className={`money${amount < 0 ? ' money--negative' : ''}`}>
      {formatMoney(amount, currency)}
    </span>
  )
}
