# Online Banking Assessment – Transactions Dispute Portal (Web)

React front end for the assessment brief *"Transactions Dispute Portal: customers view transactions,
dispute them, and see a historic view of disputed transactions."* The UI simulates the look and feel
of an online-banking site. It is built for evaluation only and is not affiliated with Capitec Bank.

## Stack

Vite · React 19 · TypeScript · React Router · TanStack Query · React Hook Form + Zod · Vitest + Testing Library · oxlint

## Getting started

```bash
npm install
cp .env.example .env.local   # optional, defaults work
npm run dev                  # http://localhost:5173
```

The backend must be running on `https://localhost:7082`. The Vite dev server proxies `/api/*` there, so
the httpOnly auth cookie is **same-origin**: no CORS setup or `SameSite=None` is needed.

| Script | Purpose |
| --- | --- |
| `npm run dev` | Dev server with API proxy |
| `npm test` | Unit and integration tests (fetch is stubbed, no backend needed) |
| `npm run lint` | oxlint |
| `npm run build` | Type-check and production build |

### Environment

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_PROXY_TARGET` | `https://localhost:7082` | Backend the proxy forwards `/api` to |
| `VITE_DISPUTES_API` | `mock` | `mock` = in-browser dispute store, `live` = call `/api/v1/disputes` |

## User journey

1. **Login step 1** (`/login`): enter a 10-digit account number → `POST /api/v2/authenticate/request-otp`.
2. **Login step 2** (`/login/otp`): enter the 6-digit OTP → `POST /api/v1/authenticate/verify-otp`. The backend sets the session cookie.
3. **My banking portfolio** (`/`): `GET /api/v1/accounts`.
4. **Transaction history** (`/accounts/:accountNumber`): `GET /api/v1/accounts/{n}/transactions?Days&Page&PageSize`, with filters and paging kept in the URL.
5. **Dispute a transaction** (`/accounts/:n/transactions/:id/dispute`): enter the reason and details, review and confirm, then get a reference number.
6. **My disputes** (`/disputes`): the history of every disputed transaction, filterable by status.

## Disputes backend

The dispute endpoints are not implemented on the backend yet. `src/api/disputes.ts` defines the typed
contract (`list`, `create`) and has two implementations:

- **mock** (default) stores disputes in `sessionStorage`, rejects a second open dispute on the same transaction with a 409, and honours idempotency keys.
- **live** calls `GET/POST /api/v1/disputes` and sends an `Idempotency-Key` header.

When the backend endpoints are ready, adjust paths and payloads in that one file and set `VITE_DISPUTES_API=live`.

## Security considerations

- **No tokens in JavaScript.** Auth relies only on the backend's httpOnly cookie (`credentials: 'include'`). Session state is held in memory and restored from `GET /authenticate/me`.
- **Central 401 handling.** Any 401 clears cached data (`queryClient.clear()`) and returns the user to login with a "session expired" notice.
- **Inactivity timeout.** After 4 minutes idle a warning appears, and after 5 minutes the user is logged out (`POST /authenticate/logout`).
- **No account enumeration.** The OTP screen repeats the backend's neutral message. The account number is masked (`******0101`).
- **Input validation** mirrors the API: account `^[0-9]{10}$`, OTP `^[0-9]{6}$`. Dispute details are capped at 500 characters and card-number-like strings are rejected.
- **Safe error messages.** Server 4xx validation details are shown, but 5xx bodies never reach the UI.
- **Double submits are blocked**: buttons disable while a request is pending, and an idempotency key is sent for each dispute.
- **No inline scripts.** For production, serve the app with a strict CSP (`default-src 'self'`), HSTS, `X-Frame-Options: DENY` and `Referrer-Policy`.
- **Accessibility**: labelled controls, `aria-invalid` and `aria-describedby` on errors, live regions, focus moves to the heading on each dispute step, a skip link, and a modal `<dialog>` for the timeout warning.

## Project structure

```
src/
  api/         http wrapper, endpoint modules, React Query hooks
  auth/        AuthContext, route guards, idle timeout
  components/  header, layouts, logo, alerts, money, badges
  lib/         formatting, query client, status labels
  pages/       Login, OTP, Portfolio, Account, Dispute, Disputes
  styles/      global.css (design tokens and components)
  test/        test setup and fetch-stub helpers
```
