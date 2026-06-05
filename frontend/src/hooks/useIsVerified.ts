'use client'

import { useState, useEffect, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { celoSepolia } from 'viem/chains'
import { checkIsVerified } from '@/lib/gooddollar'

export interface UseIsVerifiedResult {
  /** True when the address is whitelisted on GoodDollar IdentityV2. */
  isVerified: boolean
  /** True while the on-chain check is in flight. */
  isLoading: boolean
  /** Non-null when the RPC call failed. */
  error: string | null
}

/**
 * React hook that checks whether a wallet address holds a valid GoodDollar
 * identity on Celo Alfajores.
 *
 * Uses wagmi's PublicClient so the hook re-uses the application's existing
 * RPC connection rather than opening a second one.
 *
 * @param address - 0x-prefixed wallet address, or undefined when the user is
 *                  not yet connected (returns isVerified=false immediately).
 *
 * @example
 *   const { isVerified, isLoading, error } = useIsVerified(address)
 *
 *   if (isLoading) return <Spinner />
 *   if (!isVerified) return <VerificationBanner />
 *   return <JoinButton />
 */
export function useIsVerified(address: string | undefined): UseIsVerifiedResult {
  const [isVerified, setIsVerified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Explicitly target Sepolia so the correct client is used even if wagmi
  // is ever extended with additional chains.
  const publicClient = usePublicClient({ chainId: celoSepolia.id })

  // Guard against setting state on an unmounted component or a stale request
  // when address changes quickly (e.g. wallet switch).
  const abortRef = useRef(false)

  useEffect(() => {
    if (!address || !publicClient) {
      setIsVerified(false)
      setIsLoading(false)
      setError(null)
      return
    }

    abortRef.current = false
    setIsLoading(true)
    setError(null)

    checkIsVerified(address, publicClient)
      .then((verified) => {
        if (!abortRef.current) setIsVerified(verified)
      })
      .catch((err: unknown) => {
        if (!abortRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'GoodDollar identity check failed. Please try again.',
          )
        }
      })
      .finally(() => {
        if (!abortRef.current) setIsLoading(false)
      })

    return () => {
      // Mark in-flight requests as stale so their callbacks are ignored.
      abortRef.current = true
    }
  }, [address, publicClient])

  return { isVerified, isLoading, error }
}
