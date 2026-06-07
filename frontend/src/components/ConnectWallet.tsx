'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'

export function ConnectWallet() {
  const { login, logout, authenticated, ready } = usePrivy()
  const { address } = useAccount()

  if (!ready) {
    return (
      <div className="h-10 w-36 animate-pulse rounded-full bg-slate-200" />
    )
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 active:scale-95"
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
      <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-mono font-semibold text-slate-700 border border-slate-200">
        {shortAddr}
      </span>
      <button
        onClick={logout}
        className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
      >
        Disconnect
      </button>
    </div>
  )
}

