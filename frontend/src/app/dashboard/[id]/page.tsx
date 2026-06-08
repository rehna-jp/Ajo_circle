'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { usePrivy } from '@privy-io/react-auth'
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
  useSimulateContract,
} from 'wagmi'
import { formatUnits, type Address } from 'viem'
import {
  AJO_CIRCLE_ABI,
  ERC20_ABI,
  G_DOLLAR_ADDRESS,
} from '@/lib/contracts'
import { Navbar } from '@/components/Navbar'
import { toast } from '@/components/Toast'
import { parseContractError } from '@/lib/errors'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Users,
  TrendingUp,
  Coins,
  Copy,
  Check,
  ShieldAlert,
  Zap,
  Trophy,
  RefreshCw,
  LogOut,
} from 'lucide-react'

// ─── Helpers ────────────────────────────────────────────────────────────────

function shorten(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatGD(raw: bigint | undefined, decimals = 18): string {
  if (raw === undefined) return '—'
  return parseFloat(formatUnits(raw, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function cycleLabel(secs: bigint | undefined): string {
  if (!secs) return '—'
  const days = Number(secs) / 86400
  if (days <= 7) return 'Weekly'
  if (days <= 14) return 'Biweekly'
  return `Every ${Math.round(days)} days`
}

function countdown(targetTs: number): string {
  const diff = targetTs * 1000 - Date.now()
  if (diff <= 0) return 'Ready for payout'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ─── Custom Hook: useDashboardData ──────────────────────────────────────────

function useDashboardData(circleAddress: Address, userAddress: Address | undefined) {
  const circleContract = { address: circleAddress, abi: AJO_CIRCLE_ABI } as const

  // 1. Fetch circle details
  const { data: reads, isLoading: isCircleLoading, refetch: refetchReads } = useReadContracts({
    contracts: [
      { ...circleContract, functionName: 'name' },
      { ...circleContract, functionName: 'contributionAmount' },
      { ...circleContract, functionName: 'maxMembers' },
      { ...circleContract, functionName: 'cycleDuration' },
      { ...circleContract, functionName: 'currentCycle' },
      { ...circleContract, functionName: 'cycleStartTime' },
      { ...circleContract, functionName: 'activeMemberCount' },
      { ...circleContract, functionName: 'creator' },
      { ...circleContract, functionName: 'getMembers' },
      { ...circleContract, functionName: 'getNextPayout' },
    ],
  })

  // Extract variables
  const name = reads?.[0]?.result as string | undefined
  const contributionAmt = reads?.[1]?.result as bigint | undefined
  const maxMembers = reads?.[2]?.result as bigint | undefined
  const cycleDuration = reads?.[3]?.result as bigint | undefined
  const currentCycle = reads?.[4]?.result as bigint | undefined
  const cycleStartTime = reads?.[5]?.result as bigint | undefined
  const activeMemberCount = reads?.[6]?.result as bigint | undefined
  const creator = reads?.[7]?.result as Address | undefined
  const members = reads?.[8]?.result as Address[] | undefined
  const nextPayout = reads?.[9]?.result as [Address, bigint] | undefined

  const nextPayoutRecipient = nextPayout?.[0]
  const cycleEndTs = nextPayout?.[1] ? Number(nextPayout[1]) : undefined

  // 2. Fetch user-specific info
  const { data: userReads, isLoading: isUserLoading, refetch: refetchUser } = useReadContracts({
    contracts: userAddress
      ? [
          { ...circleContract, functionName: 'isMemberActive', args: [userAddress] },
          { ...circleContract, functionName: 'hasContributed', args: [userAddress, currentCycle ?? BigInt(0)] },
          { ...circleContract, functionName: 'hasReceivedPayout', args: [userAddress] },
          { ...circleContract, functionName: 'collateral', args: [userAddress] },
        ]
      : [],
    query: { enabled: !!userAddress && currentCycle !== undefined },
  })

  const isUserMember = userReads?.[0]?.result as boolean | undefined
  const userContributed = userReads?.[1]?.result as boolean | undefined
  const userReceivedPayout = userReads?.[2]?.result as boolean | undefined
  const userCollateral = userReads?.[3]?.result as bigint | undefined

  // 3. Fetch user allowance
  const { data: allowance, isLoading: isAllowanceLoading, refetch: refetchAllowance } = useReadContract({
    address: G_DOLLAR_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress ? [userAddress, circleAddress] : undefined,
    query: { enabled: !!userAddress },
  })

  // 4. Batch read members data
  const memberContracts = useMemo(() => {
    if (!members) return []
    return members.flatMap((m) => [
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'hasContributed', args: [m, currentCycle ?? BigInt(0)] },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'hasReceivedPayout', args: [m] },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'collateral', args: [m] },
    ])
  }, [members, circleAddress, currentCycle])

  const { data: memberReads, isLoading: isMembersLoading, refetch: refetchMembers } = useReadContracts({
    contracts: memberContracts,
    query: { enabled: !!members && members.length > 0 && currentCycle !== undefined },
  })

  const isBatchLoading = !!members && members.length > 0 && isMembersLoading
  const isLoading = isCircleLoading || isUserLoading || isAllowanceLoading || isBatchLoading

  const refetchAll = async () => {
    await Promise.all([
      refetchReads(),
      refetchUser(),
      refetchAllowance(),
      refetchMembers(),
    ])
  }

  return {
    circleDetails: {
      name,
      contributionAmt,
      maxMembers,
      cycleDuration,
      currentCycle,
      cycleStartTime,
      activeMemberCount,
      creator,
      members,
      nextPayoutRecipient,
      cycleEndTs,
    },
    userDetails: {
      isUserMember,
      userContributed,
      userReceivedPayout,
      userCollateral,
      allowance,
    },
    memberData: memberReads,
    isLoading,
    refetchAll,
  }
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const params = useParams()
  const router = useRouter()
  const circleAddress = params.id as Address

  const { authenticated, login } = usePrivy()
  const { address: userAddress } = useAccount()

  const [now, setNow] = useState(Date.now())
  const [txPhase, setTxPhase] = useState<
    'idle' | 'approving' | 'contributing' | 'triggering' | 'withdrawing'
  >('idle')
  const [txError, setTxError] = useState('')
  const [copiedAddr, setCopiedAddr] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')

  // Live clock for countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000)
    return () => clearInterval(t)
  }, [])

  // Custom data-fetching hook
  const {
    circleDetails,
    userDetails,
    memberData,
    isLoading,
    refetchAll,
  } = useDashboardData(circleAddress, userAddress)

  const {
    name: circleName,
    contributionAmt,
    maxMembers,
    cycleDuration,
    currentCycle,
    cycleStartTime,
    activeMemberCount,
    members,
    nextPayoutRecipient,
    cycleEndTs,
  } = circleDetails

  const {
    isUserMember,
    userContributed,
    userReceivedPayout,
    userCollateral,
    allowance,
  } = userDetails

  // ─── Computed values ────────────────────────────────────────────────────

  const totalPot = contributionAmt && activeMemberCount
    ? contributionAmt * activeMemberCount
    : undefined

  const spotsLeft = maxMembers && activeMemberCount
    ? Number(maxMembers) - Number(activeMemberCount)
    : undefined

  const cycleStarted = cycleStartTime !== undefined && cycleStartTime > BigInt(0)

  const payoutReady =
    cycleEndTs !== undefined && now / 1000 >= cycleEndTs

  const needsApproval = allowance !== undefined && contributionAmt !== undefined
    ? allowance < contributionAmt
    : true

  // Position in payout queue
  const userPayoutPosition = useMemo(() => {
    if (!members || !userAddress) return undefined
    const idx = members.findIndex(
      (m) => m.toLowerCase() === userAddress.toLowerCase()
    )
    if (idx === -1) return undefined
    return idx + 1
  }, [members, userAddress])

  // ─── Write transaction simulation hooks ─────────────────────────────────

  const { data: approveSim } = useSimulateContract({
    address: G_DOLLAR_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: contributionAmt ? [circleAddress, contributionAmt * 10n] : undefined,
    query: { enabled: !!userAddress && needsApproval && !!contributionAmt && isUserMember },
  })

  const { data: contributeSim } = useSimulateContract({
    address: circleAddress,
    abi: AJO_CIRCLE_ABI,
    functionName: 'contribute',
    query: { enabled: !!userAddress && !needsApproval && !!contributionAmt && isUserMember && cycleStarted && !userContributed },
  })

  const { data: payoutSim } = useSimulateContract({
    address: circleAddress,
    abi: AJO_CIRCLE_ABI,
    functionName: 'triggerPayout',
    query: { enabled: !!userAddress && cycleStarted && payoutReady },
  })

  const { data: withdrawSim } = useSimulateContract({
    address: circleAddress,
    abi: AJO_CIRCLE_ABI,
    functionName: 'emergencyWithdraw',
    query: { enabled: !!userAddress && isUserMember && !!userCollateral && userCollateral > 0n },
  })

  // Write contract hook
  const { writeContract, data: txHash, error: writeError, isPending: isWritePending } =
    useWriteContract()

  // Receipt wait hook
  const { data: receipt, isLoading: isConfirming, isSuccess: txSuccess, error: confirmError } =
    useWaitForTransactionReceipt({ hash: txHash })

  const busy = isWritePending || isConfirming || txPhase !== 'idle'

  // After tx success: refetch & notify
  useEffect(() => {
    if (txSuccess && txHash) {
      refetchAll()
      
      let title = 'Transaction Successful'
      let message = 'Your transaction has been confirmed on Celo.'
      
      if (txPhase === 'approving') {
        title = 'G$ Allowance Approved!'
        message = 'Allowance for savings circle has been successfully updated.'
      } else if (txPhase === 'contributing') {
        title = 'Contribution Made!'
        message = `Successfully contributed ${formatGD(contributionAmt)} G$ for this cycle.`
      } else if (txPhase === 'triggering') {
        title = 'Payout Triggered!'
        message = `Round payout of ${formatGD(totalPot)} G$ sent to recipient.`
      } else if (txPhase === 'withdrawing') {
        title = 'Collateral Reclaimed!'
        message = 'Your locked collateral has been returned to your wallet.'
      }

      toast({
        type: 'success',
        title,
        message,
        txHash,
      })

      setTxPhase('idle')
      setTxError('')
      setActionSuccess('Transaction confirmed!')
      const t = setTimeout(() => setActionSuccess(''), 4000)
      return () => clearInterval(t)
    }
  }, [txSuccess, txHash])

  useEffect(() => {
    const err = writeError || confirmError
    if (err) {
      setTxPhase('idle')
      setTxError(parseContractError(err))
    }
  }, [writeError, confirmError])

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = () => {
    if (!contributionAmt) return
    setTxError('')
    setTxPhase('approving')
    if (approveSim?.request) {
      writeContract(approveSim.request)
    } else {
      writeContract({
        address: G_DOLLAR_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [circleAddress, contributionAmt * BigInt(10)], // approve 10× for future cycles
      })
    }
  }

  // ── Contribute ───────────────────────────────────────────────────────────
  const handleContribute = () => {
    setTxError('')
    setTxPhase('contributing')
    if (contributeSim?.request) {
      writeContract(contributeSim.request)
    } else {
      writeContract({
        address: circleAddress,
        abi: AJO_CIRCLE_ABI,
        functionName: 'contribute',
      })
    }
  }

  // ── Trigger payout ───────────────────────────────────────────────────────
  const handleTriggerPayout = () => {
    setTxError('')
    setTxPhase('triggering')
    if (payoutSim?.request) {
      writeContract(payoutSim.request)
    } else {
      writeContract({
        address: circleAddress,
        abi: AJO_CIRCLE_ABI,
        functionName: 'triggerPayout',
      })
    }
  }

  // ── Emergency withdraw ───────────────────────────────────────────────────
  const handleEmergencyWithdraw = () => {
    setTxError('')
    setTxPhase('withdrawing')
    if (withdrawSim?.request) {
      writeContract(withdrawSim.request)
    } else {
      writeContract({
        address: circleAddress,
        abi: AJO_CIRCLE_ABI,
        functionName: 'emergencyWithdraw',
      })
    }
  }

  // ─── Copy address ────────────────────────────────────────────────────────
  const handleCopyAddr = () => {
    navigator.clipboard.writeText(circleAddress)
    setCopiedAddr(true)
    setTimeout(() => setCopiedAddr(false), 2000)
  }

  // ─── UI state helpers ────────────────────────────────────────────────────
  const isFull = spotsLeft === 0
  const isComplete =
    members !== undefined &&
    members.length > 0 &&
    activeMemberCount !== undefined &&
    currentCycle !== undefined &&
    Number(currentCycle) > Number(maxMembers ?? BigInt(0))

  return (
    <div className="min-h-screen bg-transparent font-sans text-slate-900">
      <Navbar />

      {isLoading ? (
        /* ── Loading skeleton ─────────────────────────────────────────────── */
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-[#60435f]/60">
            <Loader2 className="h-8 w-8 animate-spin text-[#d67ab1]" />
            <p className="text-sm font-semibold">Loading circle data…</p>
          </div>
        </div>
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* ── Back button + Contract address ──────────────────────────────── */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm font-bold text-[#60435f]/80 hover:text-[#60435f] transition hover:scale-102"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <button
              onClick={handleCopyAddr}
              className="flex items-center gap-2 rounded-full bg-white/60 backdrop-blur-sm px-4 py-1.5 text-xs font-mono font-bold text-[#60435f]/80 border border-[#e2a3c7]/20 hover:border-[#d67ab1]/30 hover:text-[#60435f] transition active:scale-95"
            >
              {shorten(circleAddress)}
              {copiedAddr ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* ── Status banner ───────────────────────────────────────────────── */}
          {!cycleStarted && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs font-semibold text-amber-800">
              <Clock className="h-5 w-5 shrink-0 text-amber-500" />
              <p>
                Waiting for members. The circle starts automatically when
                all {maxMembers?.toString()} seats are filled.
              </p>
            </div>
          )}
          {isComplete && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-[#a8dcd9]/15 px-5 py-4 text-xs font-semibold text-emerald-800">
              <Trophy className="h-5 w-5 shrink-0 text-emerald-600" />
              <p>
                Circle Complete! All members have received their payout.
                Collateral can now be reclaimed.
              </p>
            </div>
          )}

          {/* ── 2-column grid (left: overview, right: your status) ─────────── */}
          <div className="mb-8 grid gap-6 md:grid-cols-2">
            {/* ── LEFT — Circle Overview ──────────────────────────────────── */}
            <div className="flex flex-col gap-5">
              {/* Title + cycle progress */}
              <div className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-6 shadow-sm">
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div>
                    <h1 className="text-2xl font-extrabold text-[#60435f]">
                      {circleName}
                    </h1>
                    <p className="mt-0.5 text-xs font-bold text-[#60435f]/50">
                      {cycleLabel(cycleDuration)} · {activeMemberCount?.toString()} /{' '}
                      {maxMembers?.toString()} members
                    </p>
                  </div>

                  {/* Open / Full badge */}
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold border ${
                      isFull
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}
                  >
                    {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                  </span>
                </div>

                {/* Cycle progress bar */}
                {cycleStarted && maxMembers && currentCycle !== undefined && (
                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-400">
                      <span>Cycle {Number(currentCycle) + 1} of {maxMembers.toString()}</span>
                      <span>{Math.round(((Number(currentCycle)) / Number(maxMembers)) * 100)}% complete</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#fdf7fa] border border-[#e2a3c7]/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d67ab1] to-[#e2a3c7] transition-all duration-500"
                        style={{
                          width: `${Math.max(
                            2,
                            (Number(currentCycle) / Number(maxMembers)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stat cards row */}
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Pot size"
                  value={`${formatGD(totalPot)} G$`}
                  sub="this cycle"
                  icon={Coins}
                />
                <StatCard
                  label="Total payout"
                  value={`${formatGD(totalPot)} G$`}
                  sub="+ yield"
                  accent
                  icon={TrendingUp}
                />
              </div>

              {/* Next payout info */}
              {cycleStarted && nextPayoutRecipient && cycleEndTs && (
                <div className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-5 shadow-sm">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#60435f]/60">
                    Next Payout
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-bold text-[#60435f]">
                        {shorten(nextPayoutRecipient)}
                        {nextPayoutRecipient.toLowerCase() === userAddress?.toLowerCase() && (
                          <span className="ml-2 rounded-full bg-[#d67ab1]/10 px-2 py-0.5 text-[10px] font-bold text-[#d67ab1]">
                            You!
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                        Cycle ends: {new Date(cycleEndTs * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-extrabold ${
                          payoutReady ? 'text-emerald-600' : 'text-[#60435f]'
                        }`}
                      >
                        {payoutReady ? 'Ready!' : countdown(cycleEndTs)}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {payoutReady ? 'Trigger payout now' : 'remaining'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT — Your Status + Actions ───────────────────────────── */}
            <div className="flex flex-col gap-5">
              {!authenticated ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-8 text-center shadow-sm">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf7fa] border border-[#e2a3c7]/10">
                    <Users className="h-7 w-7 text-[#d67ab1]" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Connect your wallet to view your status and contribute.</p>
                  <button
                    onClick={login}
                    className="rounded-full bg-[#60435f] px-6 py-2.5 text-xs font-bold text-white transition hover:bg-[#d67ab1] shadow shadow-[#60435f]/10"
                  >
                    Connect Wallet
                  </button>
                </div>
              ) : (
                <>
                  {/* Your Status card */}
                  <div className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-6 shadow-sm">
                    <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#60435f]/60">
                      Your Status
                    </p>

                    {isUserMember === false && (
                      <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 border border-amber-100">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                        <span>You are not a member of this circle.</span>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 font-semibold text-slate-500 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Your address</span>
                        <span className="font-mono text-sm font-bold text-[#60435f]">
                          {shorten(userAddress ?? '')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Contribution this cycle</span>
                        {cycleStarted ? (
                          userContributed ? (
                            <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" /> Paid
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                              <AlertTriangle className="h-4 w-4" /> Due
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">Cycle not started</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Payout status</span>
                        {userReceivedPayout ? (
                          <span className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" /> Received
                          </span>
                        ) : userPayoutPosition !== undefined ? (
                          <span className="text-sm font-bold text-[#60435f]">
                            Position #{userPayoutPosition}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span>Collateral locked</span>
                        <span className="text-sm font-bold text-[#60435f]">
                          {formatGD(userCollateral)} G$
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ── Action Panel ──────────────────────────────────────── */}
                  <ActionPanel
                    isUserMember={isUserMember}
                    cycleStarted={cycleStarted}
                    userContributed={userContributed}
                    isComplete={isComplete}
                    needsApproval={needsApproval}
                    busy={busy}
                    txPhase={txPhase}
                    payoutReady={payoutReady}
                    isFull={isFull}
                    nextPayoutRecipient={nextPayoutRecipient}
                    contributionAmt={contributionAmt}
                    circleAddress={circleAddress}
                    userCollateral={userCollateral}
                    handleApprove={handleApprove}
                    handleContribute={handleContribute}
                    handleTriggerPayout={handleTriggerPayout}
                    handleEmergencyWithdraw={handleEmergencyWithdraw}
                    txError={txError}
                    actionSuccess={actionSuccess}
                    isWritePending={isWritePending}
                    isConfirming={isConfirming}
                  />
                </>
              )}
            </div>
          </div>

          {/* ── Full-width Member Table ──────────────────────────────────────── */}
          <MemberTable
            members={members}
            activeMemberCount={activeMemberCount}
            maxMembers={maxMembers}
            circleAddress={circleAddress}
            currentCycle={currentCycle}
            userAddress={userAddress}
            nextPayoutRecipient={nextPayoutRecipient}
            memberData={memberData}
          />
        </main>
      )}
    </div>
  )
}

// ─── Action Button ────────────────────────────────────────────────────────────

function ActionButton({
  label,
  sub,
  icon: Icon,
  onClick,
  busy,
  busyLabel,
  primary,
}: {
  label: string
  sub?: string
  icon: React.ElementType
  onClick: () => void
  busy: boolean
  busyLabel: string
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex w-full items-center gap-4 rounded-xl px-4 py-3.5 text-left transition disabled:opacity-50 active:scale-[0.99] ${
        primary
          ? 'bg-[#d67ab1] text-white hover:bg-[#e2a3c7] shadow shadow-[#d67ab1]/15'
          : 'border border-[#60435f]/15 bg-[#fdf7fa]/50 text-[#60435f] hover:border-[#d67ab1]/30 hover:bg-[#d67ab1]/5'
      }`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          primary ? 'bg-white/20' : 'bg-white border border-[#e2a3c7]/20 shadow-sm'
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-xs font-bold">{busy ? busyLabel : label}</p>
        {sub && <p className={`text-[10px] font-bold ${primary ? 'text-white/85' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </button>
  )
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  icon: Icon,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
  icon?: React.ElementType
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? 'border-[#d67ab1]/25 bg-gradient-to-br from-[#60435f] to-[#4c354b] text-white shadow shadow-[#60435f]/10'
          : 'border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm text-[#60435f]'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-wider ${accent ? 'text-[#e2a3c7]' : 'text-[#60435f]/50'}`}>
          {label}
        </p>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent ? 'bg-white/10' : 'bg-[#fdf7fa] border border-[#e2a3c7]/10'}`}>
            <Icon className={`h-4 w-4 ${accent ? 'text-[#e2a3c7]' : 'text-[#d67ab1]'}`} />
          </div>
        )}
      </div>
      <p className={`mt-3 text-2xl font-extrabold ${accent ? 'text-white' : 'text-[#60435f]'}`}>{value}</p>
      {sub && (
        <p className={`mt-0.5 text-[10px] font-bold ${accent ? 'text-[#e2a3c7]/80' : 'text-slate-400'}`}>{sub}</p>
      )}
    </div>
  )
}

// ─── Action Panel Component ──────────────────────────────────────────────────

function ActionPanel({
  isUserMember,
  cycleStarted,
  userContributed,
  isComplete,
  needsApproval,
  busy,
  txPhase,
  payoutReady,
  isFull,
  nextPayoutRecipient,
  contributionAmt,
  circleAddress,
  userCollateral,
  handleApprove,
  handleContribute,
  handleTriggerPayout,
  handleEmergencyWithdraw,
  txError,
  actionSuccess,
  isWritePending,
  isConfirming,
}: any) {
  return (
    <div className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm p-6 shadow-sm">
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[#60435f]/60">
        Actions
      </p>

      <div className="flex flex-col gap-3">
        {/* Contribute flow: approve → contribute */}
        {isUserMember && cycleStarted && !userContributed && !isComplete && (
          <>
            {needsApproval ? (
              <ActionButton
                label="Approve G$ for Contribution"
                sub={`Approve ${formatGD(contributionAmt)} G$`}
                icon={CheckCircle2}
                onClick={handleApprove}
                busy={busy && txPhase === 'approving'}
                busyLabel="Approving…"
              />
            ) : (
              <ActionButton
                label="Contribute This Cycle"
                sub={`Send ${formatGD(contributionAmt)} G$`}
                icon={Zap}
                onClick={handleContribute}
                busy={busy && txPhase === 'contributing'}
                busyLabel="Sending…"
                primary
              />
            )}
          </>
        )}

        {/* Trigger payout */}
        {cycleStarted && payoutReady && !isComplete && (
          <ActionButton
            label="Trigger Payout"
            sub={`Send pot to ${shorten(nextPayoutRecipient ?? '')}`}
            icon={RefreshCw}
            onClick={handleTriggerPayout}
            busy={busy && txPhase === 'triggering'}
            busyLabel="Triggering…"
          />
        )}

        {/* Emergency withdraw — only after circle complete */}
        {isComplete && isUserMember && (
          <ActionButton
            label="Reclaim Collateral"
            sub={`Withdraw ${formatGD(userCollateral)} G$`}
            icon={LogOut}
            onClick={handleEmergencyWithdraw}
            busy={busy && txPhase === 'withdrawing'}
            busyLabel="Withdrawing…"
          />
        )}

        {/* Join link if not a member and circle is open */}
        {isUserMember === false && !isFull && (
          <Link
            href={`/join/${circleAddress}`}
            className="flex items-center justify-center gap-2.5 rounded-xl border border-[#60435f]/25 bg-[#fdf7fa]/50 py-3 text-xs font-bold text-[#60435f] transition-all hover:bg-[#60435f] hover:text-white hover:border-transparent active:scale-[0.99]"
          >
            <Users className="h-4 w-4" />
            Join This Circle
          </Link>
        )}

        {/* Idle state */}
        {isUserMember && cycleStarted && userContributed && !payoutReady && !isComplete && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>You&apos;ve contributed this cycle. Sit tight!</span>
          </div>
        )}
      </div>

      {/* Error / Success feedback */}
      {txError && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-50 p-3.5 text-xs font-semibold text-red-600 border border-red-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{txError}</span>
        </div>
      )}
      {actionSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Generic loading indicator */}
      {(isWritePending || isConfirming) && txPhase === 'idle' && (
        <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d67ab1]" />
          <span>Waiting for confirmation…</span>
        </div>
      )}
    </div>
  )
}

// ─── Member Table Component ──────────────────────────────────────────────────

function MemberTable({
  members,
  activeMemberCount,
  maxMembers,
  circleAddress,
  currentCycle,
  userAddress,
  nextPayoutRecipient,
  memberData,
}: any) {
  return (
    <section className="rounded-2xl border border-[#e2a3c7]/20 bg-white/65 backdrop-blur-sm shadow-sm overflow-hidden">
      <div className="border-b border-[#e2a3c7]/10 px-6 py-4 bg-white/30">
        <h2 className="text-base font-extrabold text-[#60435f]">Members</h2>
        <p className="text-xs font-bold text-gray-400">
          {activeMemberCount?.toString() ?? '—'} active ·{' '}
          {maxMembers?.toString() ?? '—'} total seats
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {members && members.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2a3c7]/10 bg-[#fdf7fa]/60 backdrop-blur-sm text-left text-xs font-bold uppercase tracking-wider text-[#60435f]/50">
                <th className="px-6 py-3.5">#</th>
                <th className="px-6 py-3.5">Address</th>
                <th className="px-6 py-3.5">Contributed</th>
                <th className="px-6 py-3.5">Payout</th>
                <th className="px-6 py-3.5">Collateral</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member: Address, i: number) => {
                // Read from parent batched payload instead of row hooks
                const offset = i * 3
                const contributed = memberData?.[offset]?.result as boolean | undefined
                const receivedPayout = memberData?.[offset + 1]?.result as boolean | undefined
                const memberCollateral = memberData?.[offset + 2]?.result as bigint | undefined

                return (
                  <MemberRow
                    key={member}
                    position={i + 1}
                    member={member}
                    contributed={contributed}
                    receivedPayout={receivedPayout}
                    memberCollateral={memberCollateral}
                    isCurrentUser={
                      userAddress?.toLowerCase() === member.toLowerCase()
                    }
                    isNextPayout={
                      nextPayoutRecipient?.toLowerCase() === member.toLowerCase()
                    }
                  />
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-xs font-bold text-gray-400">
            No members yet.
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Member Row Component (Stateless) ────────────────────────────────────────

function MemberRow({
  position,
  member,
  contributed,
  receivedPayout,
  memberCollateral,
  isCurrentUser,
  isNextPayout,
}: {
  position: number
  member: Address
  contributed: boolean | undefined
  receivedPayout: boolean | undefined
  memberCollateral: bigint | undefined
  isCurrentUser: boolean
  isNextPayout: boolean
}) {
  return (
    <tr
      className={`border-b border-[#e2a3c7]/10 transition hover:bg-[#fdf7fa]/50 ${
        isCurrentUser ? 'bg-[#d67ab1]/5' : ''
      }`}
    >
      <td className="px-6 py-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fdf7fa] border border-[#e2a3c7]/10 text-xs font-bold text-[#60435f]">
          {position}
        </span>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-[#60435f]">{shorten(member)}</span>
          {isCurrentUser && (
            <span className="rounded-full bg-[#d67ab1]/15 px-2.5 py-0.5 text-[9px] font-bold text-[#d67ab1]">
              You
            </span>
          )}
          {isNextPayout && (
            <span className="rounded-full bg-amber-50 border border-amber-100 px-2.5 py-0.5 text-[9px] font-bold text-amber-600">
              Next
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        {contributed === undefined ? (
          <span className="text-gray-300">…</span>
        ) : contributed ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Paid
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Due
          </span>
        )}
      </td>
      <td className="px-6 py-4">
        {receivedPayout === undefined ? (
          <span className="text-gray-300">…</span>
        ) : receivedPayout ? (
          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">
            <Trophy className="h-3.5 w-3.5 text-[#d67ab1]" /> Received
          </span>
        ) : (
          <span className="text-xs font-bold text-gray-400">Pending</span>
        )}
      </td>
      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">
        {memberCollateral !== undefined ? `${formatGD(memberCollateral)} G$` : '…'}
      </td>
    </tr>
  )
}
