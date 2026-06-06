'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useReadContract, useReadContracts } from 'wagmi'
import { formatUnits } from 'viem'
import { AJO_FACTORY_ABI, AJO_FACTORY_ADDRESS, AJO_CIRCLE_ABI } from '@/lib/contracts'
import { ConnectWallet } from '@/components/ConnectWallet'
import { Search, Loader2, ArrowRight, Coins, Users, Calendar, Sparkles, PlusCircle } from 'lucide-react'

// Helper for formatting frequency
const getFrequencyLabel = (secs: bigint | undefined) => {
  if (!secs) return '—'
  const secondsNum = Number(secs)
  if (secondsNum === 604800) return 'Weekly'
  if (secondsNum === 1209600) return 'Biweekly'
  return `${Math.round(secondsNum / 86400)} days`
}

export default function JoinBrowsePage() {
  const router = useRouter()
  const [searchAddress, setSearchAddress] = useState('')
  const [searchError, setSearchError] = useState('')

  // 1. Fetch all circle addresses from factory
  const { data: circleAddresses, isLoading: isListLoading, error: listError } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_FACTORY_ABI,
    functionName: 'getAllCircles',
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchError('')

    const cleanAddr = searchAddress.trim()
    if (!cleanAddr) return

    // Simple hex address validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(cleanAddr)) {
      setSearchError('Please enter a valid Celo Ethereum address (0x followed by 40 hex characters).')
      return
    }

    router.push(`/join/${cleanAddr}`)
  }

  // Slice list or reverse to show newest first
  const reversedAddresses = circleAddresses ? [...circleAddresses].reverse() : []

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

      {/* ── Main Container ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-[#60435f] sm:text-4xl">Browse Savings Circles</h1>
          <p className="mt-2 text-sm text-gray-500">
            Join an existing Ajo circle by entering its contract address or choose one from the list below.
          </p>
        </div>

        {/* ── Address Search Form ────────────────────────────────────────── */}
        <div className="mb-12 rounded-2xl border border-[#e2a3c7]/20 bg-white p-6 shadow-md">
          <form onSubmit={handleSearchSubmit}>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#60435f]/80">
              Join via Circle Address
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter circle contract address (0x...)"
                  value={searchAddress}
                  onChange={(e) => {
                    setSearchAddress(e.target.value)
                    setSearchError('')
                  }}
                  className="w-full rounded-xl border border-[#60435f]/20 bg-[#fdf7fa] pl-10 pr-4 py-3.5 text-xs text-[#60435f] outline-none transition focus:border-[#d67ab1]"
                />
                <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-[#60435f]/40" />
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#d67ab1] px-6 py-3.5 text-xs font-bold text-white shadow transition hover:bg-[#e2a3c7]"
              >
                Find Circle
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {searchError && (
              <p className="mt-2.5 text-xs font-medium text-red-600">{searchError}</p>
            )}
          </form>
        </div>

        {/* ── Deployed Circles List ──────────────────────────────────────── */}
        <section>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#60435f]">Active ROSCA Circles</h2>
            <span className="rounded-full bg-[#60435f]/5 px-3 py-1 text-xs font-semibold text-[#60435f]">
              {circleAddresses ? `${circleAddresses.length} Deployed` : '—'}
            </span>
          </div>

          {isListLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#60435f]">
              <Loader2 className="h-8 w-8 animate-spin text-[#d67ab1]" />
              <p className="mt-3 text-xs font-semibold text-gray-500">Loading deployed circles…</p>
            </div>
          ) : listError ? (
            <div className="rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-red-600 font-semibold">Failed to fetch savings circles.</p>
              <p className="mt-1 text-xs text-gray-400">Please check your RPC connection.</p>
            </div>
          ) : reversedAddresses.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border-2 border-dashed border-[#e2a3c7]/20 bg-white p-12 text-center shadow-sm">
              <PlusCircle className="mx-auto mb-4 h-12 w-12 text-[#60435f]/20" />
              <h3 className="text-lg font-bold text-[#60435f]">Create your first Ajo circle</h3>
              <p className="mt-2 text-xs text-gray-500 max-w-sm mx-auto">
                No savings circles have been created yet on this network. Be the pioneer and launch one now!
              </p>
              <Link
                href="/create"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#60435f] px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#d67ab1]"
              >
                Launch Circle
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {reversedAddresses.map((addr) => (
                <CircleAddressCard key={addr} address={addr} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

// ─── Individual Circle Card ──────────────────────────────────────────────────

function CircleAddressCard({ address }: { address: `0x${string}` }) {
  const router = useRouter()

  // Batch read circle data
  const { data: circleData, isLoading } = useReadContracts({
    contracts: [
      { address, abi: AJO_CIRCLE_ABI, functionName: 'name' },
      { address, abi: AJO_CIRCLE_ABI, functionName: 'contributionAmount' },
      { address, abi: AJO_CIRCLE_ABI, functionName: 'maxMembers' },
      { address, abi: AJO_CIRCLE_ABI, functionName: 'activeMemberCount' },
      { address, abi: AJO_CIRCLE_ABI, functionName: 'cycleDuration' },
    ],
  })

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-5 w-2/3 rounded bg-gray-200" />
        <div className="mt-3 h-4 w-1/2 rounded bg-gray-200" />
        <div className="mt-6 grid grid-cols-2 gap-2">
          <div className="h-8 rounded bg-gray-100" />
          <div className="h-8 rounded bg-gray-100" />
        </div>
      </div>
    )
  }

  const name = circleData?.[0]?.result as string | undefined
  const contribution = circleData?.[1]?.result as bigint | undefined
  const maxMembers = circleData?.[2]?.result as bigint | undefined
  const activeMembers = circleData?.[3]?.result as bigint | undefined
  const cycleDuration = circleData?.[4]?.result as bigint | undefined

  if (!name) return null // Skip invalid circles

  const spotsRemaining = maxMembers !== undefined && activeMembers !== undefined
    ? Number(maxMembers - activeMembers)
    : 0

  const isFull = spotsRemaining <= 0

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#e2a3c7]/20 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-extrabold text-[#60435f] line-clamp-1">{name}</h3>
          {isFull ? (
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-100">
              Full
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
              {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} left
            </span>
          )}
        </div>
        
        <p className="mb-4 font-mono text-[10px] text-gray-400 break-all">{address}</p>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#fdf7fa] p-3 text-xs text-[#60435f]/90">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Coins className="h-3 w-3 text-[#d67ab1]" />
              Contribution
            </span>
            <span className="font-bold">
              {contribution ? formatUnits(contribution, 18) : '0'} G$
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Users className="h-3 w-3 text-[#d67ab1]" />
              Members
            </span>
            <span className="font-bold">
              {activeMembers?.toString()}/{maxMembers?.toString()}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#d67ab1]" />
              Frequency
            </span>
            <span className="font-bold">
              {getFrequencyLabel(cycleDuration)} cycles
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => router.push(`/dashboard/${address}`)}
          className="flex-1 rounded-xl border border-[#60435f]/20 py-2.5 text-center text-xs font-bold text-[#60435f] hover:bg-gray-50 transition"
        >
          View Dashboard
        </button>
        {!isFull && (
          <button
            onClick={() => router.push(`/join/${address}`)}
            className="flex-1 rounded-xl bg-[#60435f] py-2.5 text-center text-xs font-bold text-white shadow hover:bg-[#d67ab1] transition"
          >
            Join Circle
          </button>
        )}
      </div>
    </div>
  )
}
