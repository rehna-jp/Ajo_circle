import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile Privy and wagmi packages that ship ESM
  transpilePackages: ['@privy-io/react-auth', '@privy-io/wagmi'],
}

export default nextConfig
