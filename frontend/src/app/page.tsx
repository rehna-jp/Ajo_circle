'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import Link from 'next/link'
import { ConnectWallet } from '@/components/ConnectWallet'
import { G_DOLLAR_ADDRESS, ERC20_ABI } from '@/lib/contracts'
import { UserPlus, RefreshCw, CircleDollarSign, ArrowRight } from 'lucide-react'

export default function Home() {
  const { authenticated } = usePrivy()
  const { address } = useAccount()

  // Read G$ balance if connected and authenticated
  const { data: balanceData } = useReadContract({
    address: G_DOLLAR_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && authenticated },
  })

  const gDollarBalance = balanceData !== undefined
    ? parseFloat(formatUnits(balanceData, 18)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null

  return (
    <div className="min-h-screen bg-[#fdf7fa] font-sans text-gray-800">
      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[#e2a3c7]/20 bg-[#fdf7fa]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-90">
            <img src="/logo.png" alt="Ajo Logo" className="h-8 w-auto object-contain" />
          </Link>
          <ConnectWallet />
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#60435f] py-24 text-center text-[#fdf7fa] md:py-32">
        {/* Subtle decorative background gradient circles */}
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-[#d67ab1]/10 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-[#a8dcd9]/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <span className="mb-4 inline-block rounded-full bg-[#a8dcd9]/25 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-[#a8dcd9]">
            The trustless ROSCA protocol on Celo
          </span>

          <h1 className="mb-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Your community savings circle,{' '}
            <span className="bg-gradient-to-r from-[#d67ab1] to-[#e2a3c7] bg-clip-text text-transparent">
              on-chain.
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#fdf7fa]/80 md:text-xl">
            Save together with your community. Auto-contribute from your G$ UBI.
            Earn yield. No trust required.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/create"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#d67ab1] px-8 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[#e2a3c7] hover:scale-[1.03] active:scale-95 sm:w-auto"
            >
              Create a Circle
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/join"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#fdf7fa] px-8 py-3.5 text-base font-bold text-[#fdf7fa] transition hover:bg-[#fdf7fa] hover:text-[#60435f] hover:scale-[1.03] active:scale-95 sm:w-auto"
            >
              Join a Circle
            </Link>
          </div>

          {authenticated && address && gDollarBalance !== null && (
            <div className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#fdf7fa]/10 px-5 py-2 text-sm font-semibold text-[#fdf7fa] backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#a8dcd9] animate-pulse" />
              <span>Balance: <span className="font-mono">{gDollarBalance}</span> G$</span>
            </div>
          )}
        </div>
      </section>

      {/* ── How it works Section ────────────────────────────────────────── */}
      <section className="bg-[#fdf7fa] py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-extrabold text-[#60435f] md:text-4xl">
              How Ajo Works
            </h2>
            <div className="mx-auto h-1 w-12 rounded bg-[#d67ab1]" />
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {/* Card 1 */}
            <div className="group rounded-2xl border border-[#e2a3c7]/20 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf7fa] text-[#d67ab1] group-hover:bg-[#d67ab1] group-hover:text-white transition-colors duration-300">
                <UserPlus className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#60435f]">Join a Circle</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                Set your contribution, lock collateral, and invite your community.
              </p>
            </div>

            {/* Card 2 */}
            <div className="group rounded-2xl border border-[#e2a3c7]/20 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf7fa] text-[#d67ab1] group-hover:bg-[#d67ab1] group-hover:text-white transition-colors duration-300">
                <RefreshCw className="h-7 w-7 animate-spin-slow" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#60435f]">Auto-Save</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                G$ deducted from your daily UBI. Your pooled circle pot earns yield.
              </p>
            </div>

            {/* Card 3 */}
            <div className="group rounded-2xl border border-[#e2a3c7]/20 bg-white p-8 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf7fa] text-[#d67ab1] group-hover:bg-[#d67ab1] group-hover:text-white transition-colors duration-300">
                <CircleDollarSign className="h-7 w-7" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-[#60435f]">Get Paid</h3>
              <p className="text-sm leading-relaxed text-gray-600">
                When your round turn comes, receive the full pot plus accumulated yield.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e2a3c7]/10 bg-[#fdf7fa] py-8 text-center text-xs font-medium text-gray-400">
        Powered by <span className="text-gray-500 font-semibold">GoodDollar</span> · Built on{' '}
        <span className="text-gray-500 font-semibold">Celo</span>
      </footer>
    </div>
  )
}
