import { createAuthClient } from 'better-auth/react'
import { adminClient, organizationClient } from 'better-auth/client/plugins'

export const betterAuthClient = createAuthClient({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || '/api'}/auth`,
  plugins: [
    adminClient(),
    organizationClient(),
  ],
})
