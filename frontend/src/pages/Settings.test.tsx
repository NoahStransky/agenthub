import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import Settings from './Settings'

describe('Settings', () => {
  beforeEach(() => {
    localStorage.setItem('agenthub_token', 'jwt-token')
    vi.restoreAllMocks()
  })

  it('lists masked providers and tests an existing provider connection', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          {
            id: 'provider-1',
            name: 'Tenant OpenAI',
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            apiKeyMasked: 'sk-t****7890',
            isDefault: true,
            tenantId: 'tenant-1',
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          status: 200,
          latencyMs: 42,
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          modelCount: 12,
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<Settings />)

    expect(await screen.findByText('Tenant OpenAI')).toBeInTheDocument()
    expect(screen.getByText('sk-t****7890')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Test' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/llm-providers/provider-1/test',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('Provider connection succeeded')).toBeInTheDocument()
    expect(screen.getByText(/12 models/)).toBeInTheDocument()
  })

  it('tests a draft provider and saves it as default when it is the first provider', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          status: 200,
          latencyMs: 31,
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          modelCount: 3,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'provider-1',
          name: 'OpenAI',
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          apiKeyMasked: 'sk-t****7890',
          isDefault: true,
          tenantId: 'tenant-1',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<Settings />)

    await screen.findByText('Model Providers')
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test-1234567890' } })
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/llm-providers/test',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('sk-test-1234567890'),
        }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save Provider' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/llm-providers',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"isDefault":true'),
        }),
      )
    })
  })
})
