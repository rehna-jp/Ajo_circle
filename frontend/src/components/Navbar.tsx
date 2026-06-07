'use client'

import Link from 'next/link'
import { ConnectWallet } from '@/components/ConnectWallet'

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl shadow-lg shadow-slate-200/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-4 transition hover:opacity-95">
          <img
            src="/logo.png"
            alt="Ajo Logo"
            className="h-14 w-auto rounded-2xl border border-slate-100 bg-white p-2 shadow-sm"
          />
          <div>
            <p className="text-xl font-black tracking-tight text-slate-950">Ajo Circle</p>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Smart savings on Celo</p>
          </div>
        </Link>

        <ConnectWallet />
      </div>
    </header>
  )
}
