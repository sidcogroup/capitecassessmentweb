import { formatMoney } from '../lib/format'

type Direction = 'credit' | 'debit'

interface MoneyProps {
  amount: number
  currency?: string | null
  /**
   * Set for transaction amounts. The API may send positive values for both
   * directions, so the sign is derived from the direction, not the number.
   */
  direction?: Direction
}

export function Money({ amount, currency, direction }: MoneyProps) {
  if (!direction) {
    return (
      <span className={`money${amount < 0 ? ' money--negative' : ''}`}>
        {formatMoney(amount, currency)}
      </span>
    )
  }

  const credit = direction === 'credit'
  return (
    <span className={`money money--${direction}`}>
      <span className="visually-hidden">{credit ? 'Credit ' : 'Debit '}</span>
      <span aria-hidden="true">{credit ? '+' : '−'}</span>
      {formatMoney(Math.abs(amount), currency)}
    </span>
  )
}
