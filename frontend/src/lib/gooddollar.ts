import { createPublicClient, http } from 'viem'
import { celo } from 'viem/chains'
import { IdentitySDK, Envs, type contractEnv } from '@goodsdks/identity-sdk'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * GoodDollar environment driven by NEXT_PUBLIC_GOODDOLLAR_ENV.
 *
 * Testnet / local dev:  staging     → identity contract on Celo staging deployment
 * Celo mainnet:         production  → identity contract 0xC361A6E67822a0EDc17D899227dd9FC50BD62F42
 *
 * Switching to mainnet is a one-line env change — no code changes required.
 */
export const GOODDOLLAR_ENV: contractEnv =
  (process.env.NEXT_PUBLIC_GOODDOLLAR_ENV as contractEnv | undefined) ?? 'production'

/**
 * URL for GoodDollar's face-verification flow in the current environment.
 * Redirect unverified users here so they can get their G$ identity.
 */
export const GOODDOLLAR_IDENTITY_URL: string = Envs[GOODDOLLAR_ENV].identityUrl

// ─── SDK factory ─────────────────────────────────────────────────────────────

/**
 * Build a read-only IdentitySDK instance from any viem PublicClient.
 *
 * walletClient is typed as required by the SDK constructor but is only accessed
 * inside submitAndWait() and generateFVLink() — neither of which we call for
 * an identity check. Passing null here is intentional and safe for read paths.
 */
export function buildReadOnlySDK(publicClient: any): IdentitySDK {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new IdentitySDK(publicClient, null as any, GOODDOLLAR_ENV)
}

// ─── Standalone client (for use outside React) ────────────────────────────────

/**
 * Module-level viem PublicClient for Celo Mainnet.
 * Lazy-initialised so the module can be imported during SSR without side-effects.
 * React components should prefer the wagmi-provided client via useIsVerified.
 */
let _standaloneClient: any = null

function getStandaloneClient(): any {
  if (!_standaloneClient) {
    _standaloneClient = createPublicClient({
      chain: celo,
      transport: http(
        process.env.NEXT_PUBLIC_RPC_URL ?? 'https://forno.celo.org',
      ),
    })
  }
  return _standaloneClient
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a wallet address holds a valid GoodDollar identity.
 *
 * @param address     - Wallet address to check (0x-prefixed string).
 * @param publicClient - Optional viem PublicClient to use for the RPC call.
 *                       Defaults to a standalone module-level client so the
 *                       function is safe to call outside of React.
 *                       Pass the wagmi-managed client from usePublicClient()
 *                       when calling from inside a component or hook — it
 *                       re-uses the existing connection and respects any
 *                       per-request caching wagmi applies.
 *
 * @returns true when the address (or any linked root address) is whitelisted
 *          on the GoodDollar IdentityV2 contract.
 *
 * @example
 *   // Outside React (e.g. a server action or a script):
 *   const verified = await checkIsVerified('0xAbc...')
 *
 *   // Inside a hook with wagmi's client:
 *   const publicClient = usePublicClient()
 *   const verified = await checkIsVerified(address, publicClient)
 */
export async function checkIsVerified(
  address: string,
  publicClient: any = getStandaloneClient(),
): Promise<boolean> {
  const sdk = buildReadOnlySDK(publicClient)
  const { isWhitelisted } = await sdk.getWhitelistedRoot(address as `0x${string}`)
  return isWhitelisted
}
