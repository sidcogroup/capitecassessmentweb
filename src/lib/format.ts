const currencyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(amount: number, currency: string | null = 'ZAR'): string {
  const code = currency || 'ZAR'
  let fmt = currencyFormatters.get(code)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
    })
    currencyFormatters.set(code, fmt)
  }
  return fmt.format(amount)
}

const dateFmt = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const dateTimeFmt = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const longDateFmt = new Intl.DateTimeFormat('en-ZA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function safe(value: string | Date | null | undefined, fmt: Intl.DateTimeFormat): string {
  if (value == null) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(d.getTime()) ? '—' : fmt.format(d)
}

export const formatDate = (v: string | Date | null | undefined) => safe(v, dateFmt)
export const formatDateTime = (v: string | Date | null | undefined) => safe(v, dateTimeFmt)
export const formatLongDate = (v: string | Date) => safe(v, longDateFmt)

/** Shows only the last 4 digits, e.g. ******0101 */
/** Purely numeric identifiers are clients (account numbers); alphanumeric ones are consultant usernames. */
export const isClientIdentifier = (value: string) => /^[0-9]+$/.test(value)

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber
  return `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`
}
