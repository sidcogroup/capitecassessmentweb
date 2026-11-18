import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { accounts, mockApi, renderApp, session } from '../test/utils'

describe('two-step login', () => {
  it('validates, requests an OTP, verifies it and lands on the portfolio', async () => {
    const user = userEvent.setup()
    let loggedIn = false
    const fetchMock = mockApi({
      'GET /api/v1/authenticate/me': () => (loggedIn ? { status: 200, body: session } : { status: 401 }),
      'POST /api/v2/authenticate/authenticate': () => ({
        status: 200,
        body: { message: 'If the account number is registered, a one-time pin has been sent.' },
      }),
      'POST /api/v1/authenticate/verify-otp': (body) => {
        const { code } = body as { code: string }
        if (code !== '838526') return { status: 401 }
        loggedIn = true
        return { status: 200, body: session }
      },
      'GET /api/v1/accounts': () => (loggedIn ? { status: 200, body: accounts } : { status: 401 }),
    })

    renderApp('/')

    // Unauthenticated -> redirected to login
    const accountInput = await screen.findByLabelText(/account number\/username/i)
    expect(screen.getByRole('heading', { name: /online banking assessment/i })).toBeInTheDocument()

    await user.type(accountInput, '12345')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/enter your 10-digit account number/i)).toBeInTheDocument()

    await user.clear(accountInput)
    await user.type(accountInput, '1052000101')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Step 2: OTP
    const otpInput = await screen.findByLabelText(/one-time pin/i)
    expect(screen.getByText('******0101')).toBeInTheDocument()

    await user.type(otpInput, '000000')
    await user.click(screen.getByRole('button', { name: /log in/i }))
    expect(await screen.findByText(/incorrect or has expired/i)).toBeInTheDocument()

    await user.type(otpInput, '838526')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByRole('heading', { name: /my banking portfolio/i })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'GLOBAL ONE ACCOUNT' })).toBeInTheDocument()

    const verifyCall = fetchMock.mock.calls.findLast(([url]) =>
      String(url).includes('verify-otp'),
    )
    expect(JSON.parse(String(verifyCall?.[1]?.body))).toEqual({
      accountNumber: '1052000101',
      code: '838526',
    })
  })

  it('accepts an alphanumeric consultant username and shows it unmasked on the OTP step', async () => {
    const user = userEvent.setup()
    const fetchMock = mockApi({
      'GET /api/v1/authenticate/me': () => ({ status: 401 }),
      'POST /api/v2/authenticate/authenticate': () => ({ status: 200, body: { message: null } }),
    })

    renderApp('/login')

    const input = await screen.findByLabelText(/account number\/username/i)

    await user.type(input, 'consult!')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/letters and numbers/i)).toBeInTheDocument()

    await user.clear(input)
    await user.type(input, 'consultant1')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    await screen.findByLabelText(/one-time pin/i)
    expect(screen.getByText('Username:')).toBeInTheDocument()
    expect(screen.getByText('consultant1')).toBeInTheDocument()

    const otpCall = fetchMock.mock.calls.findLast(([url]) => String(url).includes('authenticate'))
    expect(JSON.parse(String(otpCall?.[1]?.body))).toEqual({ identifier: 'consultant1' })
  })

  it('sends the user back to login when the session expires', async () => {
    mockApi({
      'GET /api/v1/authenticate/me': () => ({ status: 200, body: session }),
      'GET /api/v1/accounts': () => ({ status: 401 }),
      'POST /api/v1/authenticate/logout': () => ({ status: 204 }),
    })

    renderApp('/')

    expect(await screen.findByText(/your session has expired/i)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByLabelText(/account number\/username/i)).toBeInTheDocument(),
    )
  })
})
