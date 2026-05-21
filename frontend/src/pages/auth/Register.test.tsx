import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Register from './Register'
import { apiFetch, setToken } from '../../lib/api'
import { betterAuthClient } from '../../lib/better-auth-client'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  setToken: vi.fn(),
}))

vi.mock('../../lib/better-auth-client', () => ({
  betterAuthClient: {
    signUp: { email: vi.fn() },
  },
}))

describe('Register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs up with Better Auth and exchanges the session for an API token', async () => {
    vi.mocked(betterAuthClient.signUp.email).mockResolvedValue({ data: {}, error: null } as never)
    vi.mocked(apiFetch).mockResolvedValueOnce({ access_token: 'jwt-token' })

    render(<MemoryRouter><Register /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(betterAuthClient.signUp.email).toHaveBeenCalledWith({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'password123',
      })
      expect(apiFetch).toHaveBeenCalledWith('/auth/api-token', { method: 'POST' })
      expect(setToken).toHaveBeenCalledWith('jwt-token')
    })
  })
})
