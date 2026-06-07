'use client'

import { useState, useEffect } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, decodeEventLog } from 'viem'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { AJO_FACTORY_ABI, AJO_FACTORY_ADDRESS, G_DOLLAR_ADDRESS, YIELD_VAULT_ADDRESS, IDENTITY_ADDRESS } from '@/lib/contracts'
import { useIsVerified } from '@/hooks/useIsVerified'
import { Copy, Check, ArrowRight, Loader2, Sparkles, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { toast } from '@/components/Toast'
import { parseContractError } from '@/lib/errors'

const FREQUENCY_OPTIONS = [
  { label: 'Weekly', seconds: 604800, days: 7 },
  { label: 'Biweekly', seconds: 1209600, days: 14 },
]

export default function CreateCircle() {
  const { authenticated, login } = usePrivy()
  const { address } = useAccount()
  const { isVerified, isLoading: isVerifyLoading } = useIsVerified(address)

  // Form states
  const [name, setName] = useState('')
  const [maxMembers, setMaxMembers] = useState('5')
  const [contribution, setContribution] = useState('50')
  const [frequencyIndex, setFrequencyIndex] = useState(0)
  const [payoutOrder, setPayoutOrder] = useState('join') // 'join' or 'random'
  const [formError, setFormError] = useState('')

  // Copy share link state
  const [copied, setCopied] = useState(false)

  // Contract write hooks
  const { writeContract, data: txHash, error: writeError, isPending: isWritePending } = useWriteContract()
  const { data: receipt, isLoading: isConfirming, isSuccess, error: confirmError } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  // Calculations for real-time preview card
  const membersCount = parseInt(maxMembers, 10) || 0
  const contributionAmount = parseFloat(contribution) || 0
  const totalPot = membersCount * contributionAmount
  const collateralToLock = contributionAmount * 0.1
  const selectedFreq = FREQUENCY_OPTIONS[frequencyIndex]

  // Extract deployed circle address from event logs in transaction receipt
  let deployedCircleAddress: `0x${string}` | undefined = undefined
  if (receipt) {
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: AJO_FACTORY_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'CircleCreated') {
          deployedCircleAddress = decoded.args.circleAddress
          break
        }
      } catch (e) {
        // Not a CircleCreated log or couldn't decode
      }
    }
  }

  // Fallback share link
  const shareLink = typeof window !== 'undefined' && deployedCircleAddress
    ? `${window.location.origin}/join/${deployedCircleAddress}`
    : ''

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // 1. Validation
    if (!name.trim()) {
      setFormError('Circle name is required.')
      return
    }
    if (name.length > 32) {
      setFormError('Circle name cannot exceed 32 characters.')
      return
    }
    if (isNaN(membersCount) || membersCount < 2 || membersCount > 20) {
      setFormError('Members must be between 2 and 20.')
      return
    }
    if (isNaN(contributionAmount) || contributionAmount < 10) {
      setFormError('Contribution amount must be at least 10 G$.')
      return
    }

    // 2. Auth checks
    if (!authenticated || !address) {
      login()
      return
    }

    // 3. KYC checks
    if (!isVerified) {
      setFormError('You must be GoodDollar verified before you can deploy a savings circle.')
      return
    }

    // 4. Contract call
    writeContract({
      address: AJO_FACTORY_ADDRESS,
      abi: AJO_FACTORY_ABI,
      functionName: 'createCircle',
      args: [
        name,
        parseUnits(contribution, 18),
        BigInt(membersCount),
        BigInt(selectedFreq.seconds),
        G_DOLLAR_ADDRESS,
        YIELD_VAULT_ADDRESS,
        IDENTITY_ADDRESS,
      ],
    })
  }

  useEffect(() => {
    if (isSuccess && txHash) {
      toast({
        type: 'success',
        title: 'Circle Created!',
        message: `Savings circle "${name}" is now live on Celo.`,
        txHash,
      })
    }
  }, [isSuccess, txHash, name])

  const busy = isWritePending || isConfirming
  const errorMsg = formError || (writeError || confirmError ? parseContractError(writeError || confirmError) : '')

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-xl px-6 py-12">
        {isSuccess && deployedCircleAddress ? (
          /* ── Success Screen ───────────────────────────────────────────── */
          <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            
            <h1 className="mb-2 text-2xl font-extrabold text-[#60435f]">Circle Created Successfully!</h1>
            <p className="mb-6 text-sm text-gray-500">Your savings circle is live on Celo.</p>

            <div className="mb-6 rounded-xl bg-gray-50 p-4 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Circle Details</p>
              <p className="mt-1 font-bold text-[#60435f]">{name}</p>
              <p className="mt-0.5 font-mono text-xs text-gray-500 break-all">{deployedCircleAddress}</p>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Invite Members</p>
              <div className="flex overflow-hidden rounded-xl border border-gray-200">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="w-full bg-gray-50 px-4 py-2.5 text-xs text-gray-600 outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center bg-[#d67ab1] px-4 text-white transition hover:bg-[#e2a3c7]"
                >
                  {copied ? <Check className="h-4.5 w-4.5" /> : <Copy className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link
                href={`/dashboard/${deployedCircleAddress}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#60435f] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#d67ab1]"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="text-sm font-semibold text-gray-500 hover:text-[#60435f]"
              >
                Return Home
              </Link>
            </div>
          </div>
        ) : (
          /* ── Main Form Screen ─────────────────────────────────────────── */
          <div>
            <div className="mb-8 text-center">
              <h1 className="text-3xl font-extrabold text-[#60435f]">Create a Circle</h1>
              <p className="mt-2 text-sm text-gray-500">
                Establish your group ROSCA. Set contribution amount, member count, and rules.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-6 rounded-2xl border border-[#e2a3c7]/20 bg-white p-6 shadow-md sm:p-8">
              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/70">
                  Circle Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={32}
                  placeholder="e.g. Family Fund"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-xl border border-[#60435f]/20 bg-[#fdf7fa] px-4 py-3 text-sm text-[#60435f] outline-none transition focus:border-[#d67ab1] focus:ring-2 focus:ring-[#e2a3c7]/30 disabled:opacity-50"
                />
              </div>

              {/* Grid for Members and Amount */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Max Members */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/70">
                    Number of Members (2-20)
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={20}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-xl border border-[#60435f]/20 bg-[#fdf7fa] px-4 py-3 text-sm text-[#60435f] outline-none transition focus:border-[#d67ab1] focus:ring-2 focus:ring-[#e2a3c7]/30 disabled:opacity-50"
                  />
                </div>

                {/* Contribution Amount */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/70">
                    Contribution Amount (G$)
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[#60435f]/20 bg-[#fdf7fa] focus-within:border-[#d67ab1] focus-within:ring-2 focus-within:ring-[#e2a3c7]/30">
                    <input
                      type="number"
                      required
                      min={10}
                      value={contribution}
                      onChange={(e) => setContribution(e.target.value)}
                      disabled={busy}
                      className="w-full bg-[#fdf7fa] px-4 py-3 text-sm text-[#60435f] outline-none disabled:opacity-50"
                    />
                    <span className="flex items-center bg-gray-50 px-4 text-xs font-semibold text-gray-500">
                      G$
                    </span>
                  </div>
                </div>
              </div>

              {/* Cycle Frequency */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/70">
                  Cycle Frequency
                </label>
                <div className="flex gap-3">
                  {FREQUENCY_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.label}
                      type="button"
                      disabled={busy}
                      onClick={() => setFrequencyIndex(i)}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition ${
                        frequencyIndex === i
                          ? 'border-[#d67ab1] bg-[#e2a3c7]/10 text-[#d67ab1]'
                          : 'border-gray-200 text-gray-500 hover:border-[#60435f]/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payout Order */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#60435f]/70">
                  Payout Order
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[#60435f]">
                    <input
                      type="radio"
                      name="payoutOrder"
                      value="join"
                      checked={payoutOrder === 'join'}
                      onChange={() => setPayoutOrder('join')}
                      disabled={busy}
                      className="accent-[#d67ab1]"
                    />
                    Join Order
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-400" title="Coming soon in contract upgrade">
                    <input
                      type="radio"
                      name="payoutOrder"
                      value="random"
                      checked={payoutOrder === 'random'}
                      onChange={() => setPayoutOrder('random')}
                      disabled={busy}
                      className="accent-[#d67ab1]"
                    />
                    Random Draw (Soon)
                  </label>
                </div>
              </div>

              {/* ── Real-Time Preview Card ────────────────────────────────── */}
              <div className="rounded-xl border border-[#e2a3c7]/10 bg-[#fdf7fa] p-4 text-xs">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[#60435f]/60">Circle Preview</p>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total pot per cycle:</span>
                    <span className="font-bold text-[#60435f]">{totalPot.toLocaleString()} G$</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Your collateral to lock:</span>
                    <span className="font-bold text-[#60435f]">{collateralToLock.toLocaleString()} G$</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estimated cycle yield:</span>
                    <span className="flex items-center gap-0.5 font-bold text-emerald-600">
                      <Sparkles className="h-3 w-3" />
                      ~8% APY
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">First payout in:</span>
                    <span className="font-bold text-[#60435f]">{selectedFreq.days} days</span>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3.5 text-xs text-red-600">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#d67ab1] py-3.5 text-sm font-bold text-white shadow transition hover:bg-[#e2a3c7] disabled:opacity-50"
              >
                {isWritePending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming in wallet…
                  </>
                ) : isConfirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deploying your circle…
                  </>
                ) : (
                  <>
                    Deploy Circle
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
