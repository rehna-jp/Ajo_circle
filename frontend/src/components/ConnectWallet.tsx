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
        className="rounded-full bg-[#60435f] px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-[#60435f]/10 transition-all duration-200 hover:bg-[#d67ab1] hover:shadow-lg hover:shadow-[#d67ab1]/20 active:scale-95"
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
      <span className="rounded-full bg-[#fdf7fa] px-4 py-1.5 text-xs font-mono font-bold text-[#60435f] border border-[#e2a3c7]/30 shadow-sm">
        {shortAddr}
      </span>
      <button
        onClick={logout}
        className="rounded-full border border-[#e2a3c7]/20 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-bold text-[#60435f]/80 shadow-sm transition-all duration-200 hover:bg-white hover:text-[#60435f] active:scale-95"
      >
        Disconnect
      </button>
    </div>
  )
}

