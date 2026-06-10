import type { NextConfig } from 'next'

const config: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

export default config
