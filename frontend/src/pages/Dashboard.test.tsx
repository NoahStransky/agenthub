import { render, screen, waitFor } from '@testing-library/react'
import Dashboard from './Dashboard'

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.setItem('agenthub_token', 'jwt-token')
    vi.restoreAllMocks()
  })

  it('renders dashboard data loaded from the API', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instances: 3,
          tasks: 7,
          projects: 2,
          usage: { totalTokens: 12345 },
          quota: 100000,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {
            email: 'alice@example.com',
            platformRole: 'user',
          },
          activeTenant: {
            name: 'Alice Workspace',
            tier: 'pro',
          },
          memberRole: 'owner',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          providers: [{ id: 'openai', name: 'OpenAI' }],
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('12,345')).toBeInTheDocument()
    })

    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument()
    expect(screen.getByText(/OpenAI/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/dashboard/stats',
      expect.objectContaining({ headers: expect.any(Headers) }),
    )
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('shows an error when dashboard API calls fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<Dashboard />)

    expect(await screen.findByText('Dashboard data unavailable')).toBeInTheDocument()
  })
})
