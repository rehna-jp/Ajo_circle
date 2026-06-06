/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@privy-io/react-auth', '@privy-io/wagmi'],
}

module.exports = nextConfig
