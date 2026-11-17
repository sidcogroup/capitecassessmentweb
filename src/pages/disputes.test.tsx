import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearMockDisputes } from '../api/disputes'
import { accounts, mockApi, renderApp, session, transactionsPage } from '../test/utils'

describe('transactions and disputes', () => {
  beforeEach(() => {
    clearMockDisputes()
    mockApi({
      'GET /api/v1/authenticate/me': () => ({ status: 200, body: session }),
      'GET /api/v1/accounts': () => ({ status: 200, body: accounts }),
      'GET /api/v1/accounts/1052000101/transactions': () => ({
        status: 200,
        body: transactionsPage,
      }),
    })
  })

  it('lists transactions and only offers disputes on debits', async () => {
    renderApp('/accounts/1052000101')

    const rows = await screen.findAllByRole('row')
    const purchase = rows.find((r) => within(r).queryByText('Card purchase'))!
    const salary = rows.find((r) => within(r).queryByText('Salary'))!

    expect(within(purchase).getByRole('link', { name: /dispute/i })).toBeInTheDocument()
    expect(within(salary).queryByRole('link', { name: /dispute/i })).not.toBeInTheDocument()
    expect(screen.getByText(/page 1 of 1/i)).toBeInTheDocument()
  })

  it('captures, confirms and records a dispute in history', async () => {
    const user = userEvent.setup()
    renderApp('/accounts/1052000101')

    await user.click(await screen.findByRole('link', { name: /dispute card purchase/i }))
    expect(await screen.findByRole('heading', { name: /dispute a transaction/i })).toBeInTheDocument()

    // Validation
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(await screen.findByText(/select a reason/i, { selector: '.field-error' })).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/why are you disputing/i), 'Duplicate')
    await user.type(screen.getByLabelText(/tell us what happened/i), 'Charged twice at the till.')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // Review step: submit disabled until confirmed
    const submit = await screen.findByRole('button', { name: /submit dispute/i })
    expect(submit).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(submit)

    expect(await screen.findByText(/we have received your dispute/i)).toBeInTheDocument()
    const reference = screen.getByText(/^DSP-\d{8}$/).textContent!

    await user.click(screen.getByRole('link', { name: /view my disputes/i }))
    expect(await screen.findByRole('heading', { name: /my disputes/i })).toBeInTheDocument()
    expect(await screen.findByText(reference)).toBeInTheDocument()
    expect(screen.getByText('I was charged more than once')).toBeInTheDocument()
  })
})
