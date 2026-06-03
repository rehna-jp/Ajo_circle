'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'

export function ConnectWallet() {
  const { login, logout, authenticated, ready } = usePrivy()
  const { address } = useAccount()

  if (!ready) {
    return (
      <div className="h-9 w-32 animate-pulse rounded-full bg-celo-mist" />
    )
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-full bg-celo-green px-5 py-2 text-sm font-semibold text-white shadow transition hover:opacity-90 active:scale-95"
      >
        Connect Wallet
      </button>
    )
  }

  const shortAddr = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : 'Connected'

  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full bg-celo-mist px-4 py-1.5 text-sm font-mono text-gray-700">
        {shortAddr}
      </span>
      <button
        onClick={logout}
        className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
      >
        Disconnect
      </button>
    </div>
  )
}
