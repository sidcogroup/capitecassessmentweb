export function Pager({
  label,
  noun,
  page,
  totalPages,
  totalCount,
  onPage,
}: {
  /** Accessible name of the nav, e.g. "Client pages". */
  label: string
  /** Plural noun for the count, e.g. "clients". */
  noun: string
  page: number
  totalPages: number
  totalCount: number
  onPage: (page: number) => void
}) {
  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="btn btn--secondary btn--small"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span aria-live="polite">
        Page {page} of {Math.max(totalPages, 1)} · {totalCount} {noun}
      </span>
      <button
        type="button"
        className="btn btn--secondary btn--small"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
