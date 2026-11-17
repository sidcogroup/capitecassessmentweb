export function Logo() {
  return (
    <span className="logo" aria-label="Capitec Bank (assessment simulation)">
      <svg className="logo__mark" viewBox="0 0 64 34" aria-hidden="true" focusable="false">
        <path
          d="M4 17a13 13 0 0 1 13-13h14v10H17a3 3 0 0 0 0 6h14v10H17A13 13 0 0 1 4 17z"
          fill="var(--color-navy)"
        />
        <path
          d="M33 4h14a13 13 0 0 1 0 26H33V20h14a3 3 0 0 0 0-6H33z"
          fill="var(--color-red)"
        />
      </svg>
      <span className="logo__text" aria-hidden="true">
        <span className="logo__name">CAPITEC</span>
        <span className="logo__sub">BANK</span>
      </span>
    </span>
  )
}
