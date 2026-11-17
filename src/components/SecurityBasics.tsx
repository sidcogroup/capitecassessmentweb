import { SUPPORT_NUMBER } from './Header'

export function SecurityBasics() {
  return (
    <aside className="card security-basics" aria-labelledby="security-basics-title">
      <h2 id="security-basics-title">Security Basics</h2>
      <ol>
        <li>We will NEVER ask you for your Remote PIN, password or one-time pin by email, SMS or telephone</li>
        <li>ALWAYS keep your username, Remote PIN, password and one-time pin secret</li>
        <li>NEVER use a link or an attachment in any message to access Online Banking</li>
        <li>ALWAYS check that the website address bar and certificate both match the bank's domain</li>
        <li>
          Check your accounts often and report any suspicious activity immediately on{' '}
          {SUPPORT_NUMBER}
        </li>
      </ol>
    </aside>
  )
}
