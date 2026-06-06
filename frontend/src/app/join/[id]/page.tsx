'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import Link from 'next/link'
import { ConnectWallet } from '@/components/ConnectWallet'
import { AJO_CIRCLE_ABI, ERC20_ABI, G_DOLLAR_ADDRESS } from '@/lib/contracts'
import { ArrowRight, Loader2, Sparkles, ShieldCheck, AlertCircle, Coins, Users, Calendar } from 'lucide-react'
import { toast } from '@/components/Toast'
import { parseContractError } from '@/lib/errors'

export default function JoinCircle() {
  const params = useParams()
  const router = useRouter()
  const circleAddress = params.id as `0x${string}`

  const { address } = useAccount()

  // GoodDollar Identity Mainnet Address state
  const [identityAddress, setIdentityAddress] = useState('')
  const [isVerified, setIsVerified] = useState(true) // Bypassed on Sepolia by default
  const [lastAction, setLastAction] = useState<'approve' | 'join' | null>(null)

  // Set default identity input value when wallet connects
  useEffect(() => {
    if (address) {
      setIdentityAddress(address)
    }
  }, [address])

  // Batch read circle configuration details
  const { data: circleData, isLoading: isCircleLoading, error: circleLoadError, refetch: refetchCircle } = useReadContracts({
    contracts: [
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'name' },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'contributionAmount' },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'maxMembers' },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'activeMemberCount' },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'cycleDuration' },
      { address: circleAddress, abi: AJO_CIRCLE_ABI, functionName: 'isMemberActive', args: address ? [address] : undefined },
    ],
  })

  // Extract variables safely
  const name = circleData?.[0]?.result as string | undefined
  const contributionAmount = circleData?.[1]?.result as bigint | undefined
  const maxMembers = circleData?.[2]?.result as bigint | undefined
  const activeMembers = circleData?.[3]?.result as bigint | undefined
  const cycleDuration = circleData?.[4]?.result as bigint | undefined
  const isAlreadyMember = circleData?.[5]?.result as boolean | undefined

  // Derived values
  const spotsRemaining = maxMembers !== undefined && activeMembers !== undefined
    ? Number(maxMembers - activeMembers)
    : 0

  const isFull = spotsRemaining <= 0

  const collateralAmount = contributionAmount !== undefined
    ? contributionAmount / 10n // 10%
    : 0n

  // Fetch allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: G_DOLLAR_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, circleAddress] : undefined,
    query: { enabled: !!address },
  })

  const needsApproval = allowance === undefined || contributionAmount === undefined || allowance < collateralAmount

  // Transaction execution
  const { writeContract, data: txHash, isPending: isTxPending, error: txError } = useWriteContract()

  // Track confirmation
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Refetch status and allowance on success
  useEffect(() => {
    if (isSuccess && txHash) {
      refetchAllowance()
      refetchCircle()
      
      if (lastAction === 'approve') {
        toast({
          type: 'success',
          title: 'Collateral Approved!',
          message: 'Your G$ collateral allowance has been approved.',
          txHash,
        })
      } else if (lastAction === 'join') {
        toast({
          type: 'success',
          title: 'Successfully Joined!',
          message: 'You have successfully joined the Ajo circle.',
          txHash,
        })
        router.push(`/dashboard/${circleAddress}`)
      }
      setLastAction(null)
    }
  }, [isSuccess, txHash, lastAction, circleAddress, router])

  const handleApprove = () => {
    if (!contributionAmount) return
    setLastAction('approve')
    writeContract({
      address: G_DOLLAR_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [circleAddress, collateralAmount],
    })
  }

  const handleJoin = () => {
    setLastAction('join')
    writeContract({
      address: circleAddress,
      abi: AJO_CIRCLE_ABI,
      functionName: 'joinCircle',
    })
  }

  // Format cycle duration
  const getFrequencyLabel = (secs: bigint | undefined) => {
    if (!secs) return '—'
    const secondsNum = Number(secs)
    if (secondsNum === 604800) return 'Weekly'
    if (secondsNum === 1209600) return 'Biweekly'
    return `${Math.round(secondsNum / 86400)} days`
  }

  const busy = isTxPending || isConfirming

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

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-xl px-6 py-12">
        {isCircleLoading ? (
          /* Loading State */
          <div className="flex flex-col items-center justify-center py-20 text-[#60435f]">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="mt-4 text-sm font-semibold">Loading circle details…</p>
          </div>
        ) : circleLoadError || !name ? (
          /* Error / Not Found */
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="text-xl font-bold text-[#60435f]">Failed to Load Circle</h1>
            <p className="mt-2 text-sm text-gray-500">
              The contract address might be invalid or not yet deployed on Celo Sepolia.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-[#60435f] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#d67ab1]"
            >
              Back to Home
            </Link>
          </div>
        ) : (
          /* Main Screen */
          <div>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-[#60435f]">{name}</h1>
              <p className="mt-2 font-mono text-xs text-gray-400 break-all">{circleAddress}</p>
            </div>

            <div className="flex flex-col gap-6 rounded-2xl border border-[#e2a3c7]/20 bg-white p-6 shadow-md sm:p-8">
              
              {/* Status Badge */}
              <div className="flex justify-center">
                {isAlreadyMember ? (
                  <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-bold text-emerald-600 border border-emerald-100">
                    ✓ You are already a member
                  </span>
                ) : isFull ? (
                  <span className="rounded-full bg-red-50 px-4 py-1 text-xs font-bold text-red-600 border border-red-100">
                    Circle Full
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-4 py-1 text-xs font-bold text-emerald-600 border border-emerald-100">
                    {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} remaining
                  </span>
                )}
              </div>

              {/* Circle Details Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#fdf7fa] p-4 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-[#d67ab1]" />
                    Contribution
                  </span>
                  <span className="font-bold text-[#60435f]">
                    {contributionAmount ? formatUnits(contributionAmount, 18) : '0'} G$ / round
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#d67ab1]" />
                    Members
                  </span>
                  <span className="font-bold text-[#60435f]">
                    {activeMembers?.toString()}/{maxMembers?.toString()} joined
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#d67ab1]" />
                    Frequency
                  </span>
                  <span className="font-bold text-[#60435f]">
                    {getFrequencyLabel(cycleDuration)}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 font-semibold flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-[#d67ab1]" />
                    Lock Collateral
                  </span>
                  <span className="font-bold text-[#60435f]">
                    {collateralAmount ? formatUnits(collateralAmount, 18) : '0'} G$ (10%)
                  </span>
                </div>
              </div>

              {/* Identity Check */}
              <div className="rounded-xl border border-[#e2a3c7]/20 bg-white p-4">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/80">
                  GoodDollar Identity Verification
                </label>
                <input
                  type="text"
                  placeholder="Enter GoodDollar Wallet Address"
                  value={identityAddress}
                  onChange={(e) => setIdentityAddress(e.target.value)}
                  className="w-full rounded-xl border border-[#60435f]/20 bg-[#fdf7fa] px-4 py-2.5 text-xs text-[#60435f] outline-none transition focus:border-[#d67ab1]"
                />
                
                <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-[#60435f]/70 bg-[#a8dcd9]/15 px-3 py-1.5 rounded-lg border border-[#a8dcd9]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>Celo Sepolia check: Bypassed. Automatically verified as human.</span>
                </div>

                <div className="mt-3 flex justify-between items-center bg-[#fdf7fa] px-3 py-2 rounded-lg text-xs border border-[#e2a3c7]/10">
                  <span className="font-semibold text-gray-500">Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                    GoodDollar Verified
                  </span>
                </div>
              </div>

              {/* Tx Action Error Box */}
              {txError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-600 border border-red-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-all">{parseContractError(txError)}</span>
                </div>
              )}

              {/* Connect Wallet / Actions */}
              {!address ? (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">Connect your wallet to join the circle.</p>
                  <ConnectWallet />
                </div>
              ) : isAlreadyMember ? (
                <Link
                  href={`/dashboard/${circleAddress}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#60435f] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#d67ab1]"
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <div className="flex flex-col gap-3">
                  {needsApproval ? (
                    /* Step 1 — Approve */
                    <button
                      onClick={handleApprove}
                      disabled={busy || isFull}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#d67ab1] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#e2a3c7] disabled:opacity-50"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing transaction…
                        </>
                      ) : (
                        <>
                          Step 1: Approve {formatUnits(collateralAmount, 18)} G$
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  ) : (
                    /* Step 2 — Join */
                    <button
                      onClick={handleJoin}
                      disabled={busy || isFull}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#60435f] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#d67ab1] disabled:opacity-50"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Joining circle…
                        </>
                      ) : (
                        <>
                          Step 2: Join Circle & Lock Collateral
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
