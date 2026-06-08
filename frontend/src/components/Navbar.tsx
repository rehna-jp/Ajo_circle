'use client'

import Link from 'next/link'
import { ConnectWallet } from '@/components/ConnectWallet'
import { useAccount } from 'wagmi'

export function Navbar() {
  const { address } = useAccount()

  return (
    <header className="sticky top-0 z-50 border-b border-[#e2a3c7]/20 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-4 transition hover:opacity-90 active:scale-98">
            <img
              src="/logo.png"
              alt="Ajo Logo"
              className="h-18 w-auto"
            />
            <div>
              <p className="text-xl font-extrabold tracking-tight text-[#60435f]">Ajo</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#d67ab1]">Smart savings on Celo</p>
            </div>
          </Link>

          {address && (
            <Link
              href="/my-circles"
              className="hidden sm:inline-block text-sm font-bold text-[#60435f]/80 transition hover:text-[#60435f] hover:scale-102 active:scale-98"
            >
              My Circles
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {address && (
            <Link
              href="/my-circles"
              className="inline-block sm:hidden text-xs font-bold text-[#60435f]/80 transition hover:text-[#60435f]"
            >
              My Circles
            </Link>
          )}
          <ConnectWallet />
        </div>
      </div>
    </header>
  )
}
