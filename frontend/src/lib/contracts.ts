// =============================================================================
// contracts.ts — ABI definitions + deployed addresses for Ajo Circle
//
// All function signatures are verified against:
//   - contracts/src/AjoFactory.sol
//   - contracts/src/AjoCircle.sol
//   - contracts/src/AjoYieldVault.sol
//
// IMPORTANT: Set the NEXT_PUBLIC_* vars in frontend/.env.local after deployment.
// =============================================================================

// ─── Deployed addresses (fill after `npm run deploy:sepolia`) ────────────────

function getRequiredAddress(envVarName: string, defaultValue?: string): `0x${string}` {
  const val = process.env[envVarName] || defaultValue
  if (!val) {
    throw new Error(`Environment variable ${envVarName} is missing. Please set it in your .env.local file.`)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(val)) {
    throw new Error(`Environment variable ${envVarName} must be a valid 20-byte hex address starting with 0x. Got "${val}".`)
  }
  return val as `0x${string}`
}

export const AJO_FACTORY_ADDRESS = getRequiredAddress('NEXT_PUBLIC_AJO_FACTORY_ADDRESS')
export const YIELD_VAULT_ADDRESS = getRequiredAddress('NEXT_PUBLIC_YIELD_VAULT_ADDRESS')
export const G_DOLLAR_ADDRESS = getRequiredAddress('NEXT_PUBLIC_G_DOLLAR_ADDRESS')
export const IDENTITY_ADDRESS = getRequiredAddress('NEXT_PUBLIC_IDENTITY_ADDRESS', '0xC361A6E67822a0EDc17D899227dd9FC50BD62F42')

// ─── Chain constant ──────────────────────────────────────────────────────────

/** AjoCircle.GRACE_PERIOD = 1 hours (3600 seconds). Added to cycleEnd for UI. */
export const GRACE_PERIOD_SECONDS = 3600

// =============================================================================
// AjoFactory ABI
// Verified against: contracts/src/AjoFactory.sol
// =============================================================================
export const AJO_FACTORY_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createCircle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'name',               type: 'string'  },  // arg 1 — circle name (≤ 32 chars)
      { name: 'contributionAmount', type: 'uint256' },  // arg 2 — G$ per round (wei)
      { name: 'maxMembers',         type: 'uint256' },  // arg 3 — 2–20
      { name: 'cycleDuration',      type: 'uint256' },  // arg 4 — seconds (≥ 86400)
      { name: 'gDollarToken',       type: 'address' },  // arg 5 — G$ ERC-20 address
      { name: 'yieldVault',         type: 'address' },  // arg 6 — vault or address(0)
      { name: 'identityContract',   type: 'address' },  // arg 7 — KYC or address(0)
    ],
    outputs: [{ name: 'circleAddress', type: 'address' }],
  },
  // ── Read ───────────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'getAllCircles',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getUserCircles',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getCircleCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ── Public state vars (auto-generated getters) ─────────────────────────────
  {
    type: 'function',
    name: 'allCircles',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'userCircles',
    stateMutability: 'view',
    inputs: [
      { name: 'user',  type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'CircleCreated',
    inputs: [
      { name: 'circleAddress',      type: 'address', indexed: true  },
      { name: 'creator',            type: 'address', indexed: true  },
      { name: 'name',               type: 'string',  indexed: false },
      { name: 'contributionAmount', type: 'uint256', indexed: false },
      { name: 'maxMembers',         type: 'uint256', indexed: false },
    ],
  },
] as const

// =============================================================================
// AjoCircle ABI
// Verified against: contracts/src/AjoCircle.sol
//
// ✅  joinCircle()      — no arguments, called on circle instance
// ✅  contribute()      — no arguments, called on circle instance
// ✅  triggerPayout()   — no arguments, called on circle instance
// ✅  emergencyWithdraw() — no arguments, called on circle instance
// ❌  startCircle()     — does NOT exist; circle auto-starts when last seat is filled
// =============================================================================
export const AJO_CIRCLE_ABI = [
  // ── Write — external functions ─────────────────────────────────────────────

  /**
   * joinCircle()
   * - Caller must pre-approve G$ for: (contributionAmount × 1000) / 10_000  (= 10%)
   * - Reverts: AlreadyMember | CircleFull | IdentityNotVerified
   * - Side-effect: when last seat is filled → cycleStartTime is set automatically
   *   (NO separate startCircle() call needed)
   */
  {
    type: 'function',
    name: 'joinCircle',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  /**
   * contribute()
   * - Caller must pre-approve G$ for: contributionAmount
   * - Reverts: NotMember | CircleNotStarted | AlreadyContributed
   */
  {
    type: 'function',
    name: 'contribute',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  /**
   * triggerPayout()
   * - Callable by anyone once: block.timestamp >= cycleStartTime + cycleDuration + GRACE_PERIOD
   * - Reverts: CircleNotStarted | CycleNotEnded | NoPayoutsRemaining | NoEligibleRecipient | EmptyPot
   */
  {
    type: 'function',
    name: 'triggerPayout',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  /**
   * emergencyWithdraw()
   * - Callable only after all members have received a payout (circle complete)
   * - Returns all remaining collateral to every member who still has a balance
   * - Reverts: CircleNotComplete
   */
  {
    type: 'function',
    name: 'emergencyWithdraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },

  // ── Read — explicit view functions ─────────────────────────────────────────

  {
    type: 'function',
    name: 'getMembers',
    stateMutability: 'view',
    inputs: [],
    // Returns only active (non-slashed) members in join order
    outputs: [{ name: 'active', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getMemberCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'count', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getNextPayout',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'recipient', type: 'address' },
      // cycleEnd = cycleStartTime + cycleDuration + GRACE_PERIOD (1 hour)
      // triggerPayout() is callable once block.timestamp >= cycleEnd
      { name: 'cycleEnd',  type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'isMemberActive',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ── Read — public state variable auto-getters ──────────────────────────────

  { type: 'function', name: 'name',               stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string'  }] },
  { type: 'function', name: 'contributionAmount', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'maxMembers',         stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'cycleDuration',      stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'currentCycle',       stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'cycleStartTime',     stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'currentPayoutIndex', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'activeMemberCount',  stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'creator',            stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'yieldVault',         stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'gDollarToken',       stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'identityContract',   stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'address' }] },
  { type: 'function', name: 'COLLATERAL_BPS',     stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  // hasContributed[account][cycle]
  {
    type: 'function',
    name: 'hasContributed',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'cycle',   type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // hasReceivedPayout[account]
  {
    type: 'function',
    name: 'hasReceivedPayout',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // collateral[account]
  {
    type: 'function',
    name: 'collateral',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // isMember[account] — raw mapping (isMemberActive() is the recommended view)
  {
    type: 'function',
    name: 'isMember',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'MemberJoined',
    inputs: [
      { name: 'member',           type: 'address', indexed: true  },
      { name: 'collateralAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ContributionMade',
    inputs: [
      { name: 'member', type: 'address', indexed: true  },
      { name: 'cycle',  type: 'uint256', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PayoutSent',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true  },
      { name: 'cycle',     type: 'uint256', indexed: true  },
      { name: 'amount',    type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CollateralSlashed',
    inputs: [
      { name: 'member', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberRemoved',
    inputs: [
      { name: 'member', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CircleStarted',
    inputs: [
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CycleAdvanced',
    inputs: [
      { name: 'newCycle',       type: 'uint256', indexed: true  },
      { name: 'cycleStartTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EmergencyWithdrawal',
    inputs: [
      { name: 'member', type: 'address', indexed: true  },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

// =============================================================================
// Minimal ERC-20 ABI
// Only what the frontend needs: approve + allowance + balanceOf + decimals
// =============================================================================
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner',   type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

// =============================================================================
// Circle status — mirrors AjoCircle state logic (derived, not on-chain enum)
// =============================================================================

/** Inferred from on-chain state — not a Solidity enum, just a UI convenience. */
export const CircleStatus = {
  Open:      0,   // cycleStartTime === 0 (waiting for members)
  Active:    1,   // cycleStartTime > 0 and pending payouts remain
  Completed: 2,   // no active member without a payout
} as const

export type CircleStatusValue = (typeof CircleStatus)[keyof typeof CircleStatus]

export const STATUS_LABEL: Record<CircleStatusValue, string> = {
  [CircleStatus.Open]:      'Open',
  [CircleStatus.Active]:    'Active',
  [CircleStatus.Completed]: 'Completed',
}
