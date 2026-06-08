'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { formatUnits, type Address } from 'viem'
import { AJO_FACTORY_ABI, AJO_FACTORY_ADDRESS, AJO_CIRCLE_ABI } from '@/lib/contracts'
import { Navbar } from '@/components/Navbar'
import { ConnectWallet } from '@/components/ConnectWallet'
import { Coins, Users, Calendar, ArrowRight, Loader2, Award, FolderHeart, PlusCircle } from 'lucide-react'

// Helper for formatting frequency
const getFrequencyLabel = (secs: bigint | undefined) => {
  if (!secs) return '—'
  const secondsNum = Number(secs)
  if (secondsNum === 604800) return 'Weekly'
  if (secondsNum === 1209600) return 'Biweekly'
  return `${Math.round(secondsNum / 86400)} days`
}

export default function MyCirclesPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined')

  // 1. Fetch user-created circles from factory
  const { data: createdAddresses, isLoading: isCreatedLoading } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_FACTORY_ABI,
    functionName: 'getUserCircles',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  // 2. Fetch ALL circle addresses to check membership status
  const { data: allAddresses, isLoading: isAllLoading } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_FACTORY_ABI,
    functionName: 'getAllCircles',
    query: { enabled: !!address },
  })

  // 3. Batch read membership checks + details for ALL circles
  const membershipContracts = (allAddresses ?? []).flatMap((circleAddr) => [
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'name' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'contributionAmount' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'maxMembers' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'activeMemberCount' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'cycleDuration' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'isMemberActive', args: address ? [address] : undefined },
  ])

  const { data: batchData, isLoading: isBatchLoading } = useReadContracts({
    contracts: membershipContracts,
    query: { enabled: !!allAddresses && allAddresses.length > 0 && !!address },
  })

  // 4. Batch read details for USER-CREATED circles (for full card rendering)
  const createdContracts = (createdAddresses ?? []).flatMap((circleAddr) => [
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'name' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'contributionAmount' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'maxMembers' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'activeMemberCount' },
    { address: circleAddr, abi: AJO_CIRCLE_ABI, functionName: 'cycleDuration' },
  ])

  const { data: batchCreatedData, isLoading: isBatchCreatedLoading } = useReadContracts({
    contracts: createdContracts,
    query: { enabled: !!createdAddresses && createdAddresses.length > 0 && !!address },
  })

  // Process joined circles from batch data
  const joinedCirclesList: any[] = []
  if (allAddresses && batchData) {
    for (let i = 0; i < allAddresses.length; i++) {
      const offset = i * 6
      const isMember = batchData[offset + 5]?.result as boolean | undefined

      if (isMember) {
        joinedCirclesList.push({
          address: allAddresses[i],
          name: batchData[offset + 0]?.result as string | undefined,
          contribution: batchData[offset + 1]?.result as bigint | undefined,
          maxMembers: batchData[offset + 2]?.result as bigint | undefined,
          activeMembers: batchData[offset + 3]?.result as bigint | undefined,
          cycleDuration: batchData[offset + 4]?.result as bigint | undefined,
        })
      }
    }
  }

  // Process created circles from batch data
  const createdCirclesList: any[] = []
  if (createdAddresses && batchCreatedData) {
    for (let i = 0; i < createdAddresses.length; i++) {
      const offset = i * 5
      createdCirclesList.push({
        address: createdAddresses[i],
        name: batchCreatedData[offset + 0]?.result as string | undefined,
        contribution: batchCreatedData[offset + 1]?.result as bigint | undefined,
        maxMembers: batchCreatedData[offset + 2]?.result as bigint | undefined,
        activeMembers: batchCreatedData[offset + 3]?.result as bigint | undefined,
        cycleDuration: batchCreatedData[offset + 4]?.result as bigint | undefined,
      })
    }
  }

  const isLoading = isCreatedLoading || isAllLoading || isBatchLoading || isBatchCreatedLoading

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900">
      <Navbar />

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#60435f] sm:text-4xl">My Savings Circles</h1>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto font-medium">
            Manage the ROSCA circles you are actively saving with or the ones you have launched.
          </p>
        </div>

        {!isConnected ? (
          /* Unconnected State */
          <div className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-12 text-center shadow-sm max-w-md mx-auto">
            <FolderHeart className="mx-auto mb-4 h-12 w-12 text-[#60435f]/20" />
            <h2 className="text-lg font-bold text-[#60435f]">Connect your wallet</h2>
            <p className="mt-2 mb-6 text-xs text-slate-500 font-medium">
              Please connect your wallet to access your personal dashboard and active savings circles.
            </p>
            <div className="flex justify-center">
              <ConnectWallet />
            </div>
          </div>
        ) : (
          /* Connected State */
          <div>
            {/* Tabs */}
            <div className="mb-8 flex justify-center border-b border-[#e2a3c7]/10 pb-px">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('joined')}
                  className={`border-b-2 px-6 py-3 text-sm font-bold transition-all duration-150 ${
                    activeTab === 'joined'
                      ? 'border-[#60435f] text-[#60435f]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Joined Circles ({joinedCirclesList.length})
                </button>
                <button
                  onClick={() => setActiveTab('created')}
                  className={`border-b-2 px-6 py-3 text-sm font-bold transition-all duration-150 ${
                    activeTab === 'created'
                      ? 'border-[#60435f] text-[#60435f]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Created Circles ({createdCirclesList.length})
                </button>
              </div>
            </div>

            {isLoading ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center py-20 text-[#60435f]">
                <Loader2 className="h-8 w-8 animate-spin text-[#d67ab1]" />
                <p className="mt-3 text-xs font-semibold text-gray-500">Loading your circles…</p>
              </div>
            ) : (
              /* Lists */
              <div>
                {activeTab === 'joined' && (
                  joinedCirclesList.length === 0 ? (
                    <EmptyCirclesState
                      title="No Joined Circles"
                      description="You haven't joined any savings circles yet. Browse active circles to start saving."
                      actionLabel="Browse Circles"
                      actionUrl="/join"
                    />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {joinedCirclesList.map((c) => (
                        <CircleCard key={c.address} circle={c} router={router} />
                      ))}
                    </div>
                  )
                )}

                {activeTab === 'created' && (
                  createdCirclesList.length === 0 ? (
                    <EmptyCirclesState
                      title="No Created Circles"
                      description="You haven't launched any circles yet. Create a circle and invite members to save together."
                      actionLabel="Launch Circle"
                      actionUrl="/create"
                    />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {createdCirclesList.map((c) => (
                        <CircleCard key={c.address} circle={c} router={router} />
                      ))}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Reusable Empty State ────────────────────────────────────────────────────

function EmptyCirclesState({
  title,
  description,
  actionLabel,
  actionUrl,
}: {
  title: string
  description: string
  actionLabel: string
  actionUrl: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e2a3c7]/30 bg-white/60 backdrop-blur-sm p-12 text-center shadow-sm">
      <PlusCircle className="mx-auto mb-4 h-12 w-12 text-[#60435f]/25" />
      <h3 className="text-lg font-bold text-[#60435f]">{title}</h3>
      <p className="mt-2 text-xs text-slate-500 max-w-sm mx-auto font-medium leading-relaxed">
        {description}
      </p>
      <Link
        href={actionUrl}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#60435f] px-6 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#d67ab1]"
      >
        {actionLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Simple Reusable Circle Card ──────────────────────────────────────────────

function CircleCard({ circle, router }: { circle: any; router: any }) {
  const spotsRemaining =
    circle.maxMembers !== undefined && circle.activeMembers !== undefined
      ? Number(circle.maxMembers - circle.activeMembers)
      : 0

  const isFull = spotsRemaining <= 0

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:bg-white/80">
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="font-extrabold text-[#60435f] line-clamp-1">{circle.name}</h3>
          {isFull ? (
            <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 border border-red-100">
              Full
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-100">
              {spotsRemaining} left
            </span>
          )}
        </div>

        <p className="mb-4 font-mono text-[10px] text-gray-400 break-all">{circle.address}</p>

        <div className="grid grid-cols-2 gap-3 rounded-xl bg-[#fdf7fa]/50 p-3 text-xs text-[#60435f]/95 border border-[#e2a3c7]/10">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Coins className="h-3 w-3 text-[#d67ab1]" />
              Contribution
            </span>
            <span className="font-bold">
              {circle.contribution ? formatUnits(circle.contribution, 18) : '0'} G$
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Users className="h-3 w-3 text-[#d67ab1]" />
              Members
            </span>
            <span className="font-bold">
              {circle.activeMembers?.toString()}/{circle.maxMembers?.toString()}
            </span>
          </div>

          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[10px] font-semibold text-gray-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-[#d67ab1]" />
              Frequency
            </span>
            <span className="font-bold">
              {getFrequencyLabel(circle.cycleDuration)}
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push(`/dashboard/${circle.circleAddress || circle.address}`)}
        className="mt-5 w-full rounded-xl bg-[#60435f] py-2.5 text-center text-xs font-bold text-white shadow transition hover:bg-[#d67ab1] hover:shadow-md active:scale-95"
      >
        Go to Dashboard
      </button>
    </div>
  )
}
