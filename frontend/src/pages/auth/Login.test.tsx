import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'
import { apiFetch, setToken } from '../../lib/api'
import { betterAuthClient } from '../../lib/better-auth-client'

vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  setToken: vi.fn(),
}))

vi.mock('../../lib/better-auth-client', () => ({
  betterAuthClient: {
    signIn: { email: vi.fn() },
  },
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs in with Better Auth and exchanges the session for an API token', async () => {
    vi.mocked(betterAuthClient.signIn.email).mockResolvedValue({ data: {}, error: null } as never)
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ access_token: 'jwt-token' })
      .mockResolvedValueOnce({ user: { platformRole: 'user' } })

    render(<MemoryRouter><Login /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(betterAuthClient.signIn.email).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'password123',
      })
      expect(apiFetch).toHaveBeenCalledWith('/auth/api-token', { method: 'POST' })
      expect(setToken).toHaveBeenCalledWith('jwt-token')
    })
  })

  it('shows an error when Better Auth rejects credentials', async () => {
    vi.mocked(betterAuthClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    } as never)

    render(<MemoryRouter><Login /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(apiFetch).not.toHaveBeenCalled()
  })
})
