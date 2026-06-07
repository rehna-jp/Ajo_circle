'use client'

import { useState } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from '@privy-io/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { celo } from 'viem/chains'
import { wagmiConfig } from '@/lib/wagmi'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!privyAppId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fdf7fa] p-6 text-center font-sans text-gray-800">
        <div className="max-w-md rounded-2xl border border-[#e2a3c7]/20 bg-white p-8 shadow-md">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 animate-bounce">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-[#60435f]">Privy App ID Required</h2>
          <p className="mb-6 text-sm text-gray-500">
            Before running the frontend, you must configure a Privy Application ID in your environment variables.
          </p>
          <div className="mb-6 rounded-lg bg-gray-50 p-4 text-left font-mono text-xs text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">To fix this:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Open <code className="bg-gray-200 px-1 rounded">frontend/.env.local</code></li>
              <li>Set <code className="bg-gray-200 px-1 rounded">NEXT_PUBLIC_PRIVY_APP_ID</code></li>
              <li>Restart the dev server</li>
            </ol>
          </div>
          <a
            href="https://dashboard.privy.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-full bg-[#d67ab1] px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#e2a3c7]"
          >
            Get Privy App ID
          </a>
        </div>
      </div>
    )
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['wallet', 'email'],
        appearance: {
          theme: 'light',
          accentColor: '#35D07F',
          logo: '/logo.svg',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: celo,
        supportedChains: [celo],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
