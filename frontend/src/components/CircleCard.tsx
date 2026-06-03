'use client'

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatUnits, maxUint256 } from 'viem'
import { AJO_CIRCLE_ABI, AJO_FACTORY_ADDRESS, ERC20_ABI, CircleStatus, STATUS_LABEL } from '@/lib/contracts'
import { useIsVerified } from '@/hooks/useIsVerified'
import { VerificationBanner } from '@/components/VerificationBanner'

interface CircleData {
  id: bigint
  creator: `0x${string}`
  token: `0x${string}`
  contributionAmount: bigint
  maxMembers: bigint
  roundDuration: bigint
  members: `0x${string}`[]
  currentRound: bigint
  roundStartTime: bigint
  contributionCount: bigint
  status: number
}

interface CircleCardProps {
  circleId: bigint
}

const STATUS_COLORS: Record<number, string> = {
  [CircleStatus.Open]: 'bg-blue-100 text-blue-700',
  [CircleStatus.Active]: 'bg-celo-mist text-celo-green',
  [CircleStatus.Completed]: 'bg-gray-100 text-gray-500',
}

export function CircleCard({ circleId }: CircleCardProps) {
  const { address } = useAccount()

  const { data: circle, refetch } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_CIRCLE_ABI,
    functionName: 'getCircle',
    args: [circleId],
  }) as { data: CircleData | undefined; refetch: () => void }

  const { data: hasContributed } = useReadContract({
    address: AJO_FACTORY_ADDRESS,
    abi: AJO_CIRCLE_ABI,
    functionName: 'hasContributed',
    args: [circleId, circle?.currentRound ?? 0n, address!],
    query: { enabled: !!address && circle?.status === CircleStatus.Active },
  })

  const { data: allowance } = useReadContract({
    address: circle?.token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, AJO_FACTORY_ADDRESS],
    query: { enabled: !!address && !!circle },
  })

  // GoodDollar identity check — must be verified to join a circle.
  const { isVerified, isLoading: isVerifyLoading } = useIsVerified(address)

  const { writeContract, data: txHash, isPending } = useWriteContract()
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
      // refetch circle data once tx is confirmed
      onSuccess: () => refetch(),
    } as Parameters<typeof useWaitForTransactionReceipt>[0]['query'],
  })

  if (!circle) {
    return <div className="h-48 animate-pulse rounded-2xl bg-celo-mist" />
  }

  const contributionFormatted = formatUnits(circle.contributionAmount, 18)
  const roundDays = Number(circle.roundDuration) / 86400
  const membersJoined = circle.members.length
  const isUserMember = address ? circle.members.includes(address as `0x${string}`) : false
  const needsApproval = allowance !== undefined && allowance < circle.contributionAmount
  const busy = isPending || isConfirming

  const handleJoin = () =>
    writeContract({ address: AJO_FACTORY_ADDRESS, abi: AJO_CIRCLE_ABI, functionName: 'joinCircle', args: [circleId] })

  const handleStart = () =>
    writeContract({ address: AJO_FACTORY_ADDRESS, abi: AJO_CIRCLE_ABI, functionName: 'startCircle', args: [circleId] })

  const handleApprove = () =>
    writeContract({ address: circle.token, abi: ERC20_ABI, functionName: 'approve', args: [AJO_FACTORY_ADDRESS, maxUint256] })

  const handleContribute = () =>
    writeContract({ address: AJO_FACTORY_ADDRESS, abi: AJO_CIRCLE_ABI, functionName: 'contribute', args: [circleId] })

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-gray-400">Circle #{circleId.toString()}</p>
          <p className="mt-0.5 text-lg font-bold text-gray-900">
            {contributionFormatted} G$ / round
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[circle.status] ?? ''}`}>
          {STATUS_LABEL[circle.status as keyof typeof STATUS_LABEL] ?? 'Unknown'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-50 p-3 text-center text-sm">
        <div>
          <p className="text-xs text-gray-500">Members</p>
          <p className="font-semibold text-gray-900">
            {membersJoined}/{circle.maxMembers.toString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Round</p>
          <p className="font-semibold text-gray-900">
            {circle.status === CircleStatus.Active
              ? `${Number(circle.currentRound) + 1}/${circle.members.length}`
              : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Frequency</p>
          <p className="font-semibold text-gray-900">
            {roundDays}d
          </p>
        </div>
      </div>

      {/* Progress bar — contributions this round */}
      {circle.status === CircleStatus.Active && (
        <div>
          <div className="mb-1 flex justify-between text-xs text-gray-500">
            <span>Contributions</span>
            <span>{Number(circle.contributionCount)}/{membersJoined}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-celo-green transition-all"
              style={{ width: `${(Number(circle.contributionCount) / membersJoined) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      {address && (
        <div className="flex flex-col gap-2">
          {circle.status === CircleStatus.Open && !isUserMember && (
            <>
              {/* Show verification banner while loading or when unverified */}
              {(isVerifyLoading || !isVerified) && (
                <VerificationBanner isLoading={isVerifyLoading} />
              )}

              <button
                onClick={handleJoin}
                disabled={busy || isVerifyLoading || !isVerified}
                title={
                  !isVerified && !isVerifyLoading
                    ? 'You must be GoodDollar verified to join'
                    : undefined
                }
                className="w-full rounded-xl bg-celo-green py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isVerifyLoading
                  ? 'Checking identity…'
                  : busy
                  ? 'Joining…'
                  : 'Join Circle'}
              </button>
            </>
          )}

          {circle.status === CircleStatus.Open &&
            circle.creator === address &&
            membersJoined >= 2 && (
              <button
                onClick={handleStart}
                disabled={busy}
                className="w-full rounded-xl bg-celo-gold py-2 text-sm font-semibold text-gray-900 transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Starting…' : 'Start Circle'}
              </button>
            )}

          {circle.status === CircleStatus.Active && isUserMember && !hasContributed && (
            needsApproval ? (
              <button
                onClick={handleApprove}
                disabled={busy}
                className="w-full rounded-xl border-2 border-celo-green py-2 text-sm font-semibold text-celo-green transition hover:bg-celo-mist disabled:opacity-50"
              >
                {busy ? 'Approving…' : 'Approve G$'}
              </button>
            ) : (
              <button
                onClick={handleContribute}
                disabled={busy}
                className="w-full rounded-xl bg-celo-green py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Confirming…' : `Contribute ${contributionFormatted} G$`}
              </button>
            )
          )}

          {circle.status === CircleStatus.Active && isUserMember && hasContributed && (
            <p className="text-center text-sm text-gray-500">✓ You've contributed this round</p>
          )}
        </div>
      )}
    </div>
  )
}
