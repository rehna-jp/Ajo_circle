'use client'

import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { AJO_CIRCLE_ABI, AJO_FACTORY_ADDRESS, G_DOLLAR_ADDRESS } from '@/lib/contracts'

interface CreateCircleModalProps {
  onClose: () => void
  onSuccess: () => void
}

const DURATION_OPTIONS = [
  { label: '1 week', seconds: 7 * 24 * 3600 },
  { label: '2 weeks', seconds: 14 * 24 * 3600 },
  { label: '1 month', seconds: 30 * 24 * 3600 },
]

export function CreateCircleModal({ onClose, onSuccess }: CreateCircleModalProps) {
  const [contribution, setContribution] = useState('')
  const [maxMembers, setMaxMembers] = useState('5')
  const [durationIndex, setDurationIndex] = useState(0)
  const [error, setError] = useState('')

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  if (isSuccess) {
    onSuccess()
  }

  const busy = isPending || isConfirming

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const amount = parseFloat(contribution)
    const members = parseInt(maxMembers, 10)

    if (isNaN(amount) || amount <= 0) {
      setError('Enter a valid contribution amount.')
      return
    }
    if (isNaN(members) || members < 2 || members > 20) {
      setError('Members must be between 2 and 20.')
      return
    }

    writeContract({
      address: AJO_FACTORY_ADDRESS,
      abi: AJO_CIRCLE_ABI,
      functionName: 'createCircle',
      args: [
        G_DOLLAR_ADDRESS,
        parseUnits(contribution, 18),
        BigInt(members),
        BigInt(DURATION_OPTIONS[durationIndex].seconds),
      ],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Create a Circle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Contribution amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Contribution per round (G$)
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-celo-green">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="e.g. 50"
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                className="flex-1 bg-white px-4 py-2.5 text-sm outline-none"
                required
              />
              <span className="flex items-center bg-gray-50 px-3 text-sm font-medium text-gray-500">
                G$
              </span>
            </div>
          </div>

          {/* Max members */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Number of members (2–20)
            </label>
            <input
              type="number"
              min="2"
              max="20"
              value={maxMembers}
              onChange={(e) => setMaxMembers(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-celo-green"
              required
            />
          </div>

          {/* Round duration */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Round duration</label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setDurationIndex(i)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition ${
                    durationIndex === i
                      ? 'border-celo-green bg-celo-mist text-celo-green'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          {contribution && (
            <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
              Total payout per round:{' '}
              <span className="font-semibold text-gray-900">
                {(parseFloat(contribution) * parseInt(maxMembers || '0', 10)).toFixed(2)} G$
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 w-full rounded-xl bg-celo-green py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending
              ? 'Confirm in wallet…'
              : isConfirming
              ? 'Creating circle…'
              : 'Create Circle'}
          </button>
        </form>
      </div>
    </div>
  )
}
