export const AJO_FACTORY_ADDRESS =
  (process.env.NEXT_PUBLIC_AJO_FACTORY_ADDRESS as `0x${string}`) ?? '0x'

export const YIELD_VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS as `0x${string}`) ?? '0x'

export const G_DOLLAR_ADDRESS =
  (process.env.NEXT_PUBLIC_G_DOLLAR_ADDRESS as `0x${string}`) ?? '0x'

// ABI generated from contracts/out/AjoCircle.sol/AjoCircle.json
export const AJO_CIRCLE_ABI = [
  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'CircleCreated',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'token', type: 'address', indexed: false },
      { name: 'contributionAmount', type: 'uint256', indexed: false },
      { name: 'maxMembers', type: 'uint256', indexed: false },
      { name: 'roundDuration', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'MemberJoined',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'member', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CircleStarted',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'startTime', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ContributionMade',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'round', type: 'uint256', indexed: true },
      { name: 'contributor', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PayoutDistributed',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'round', type: 'uint256', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CircleCompleted',
    inputs: [{ name: 'id', type: 'uint256', indexed: true }],
  },

  // ─── Read functions ────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'circleCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getCircle',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'creator', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'contributionAmount', type: 'uint256' },
          { name: 'maxMembers', type: 'uint256' },
          { name: 'roundDuration', type: 'uint256' },
          { name: 'members', type: 'address[]' },
          { name: 'currentRound', type: 'uint256' },
          { name: 'roundStartTime', type: 'uint256' },
          { name: 'contributionCount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'isMember',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'hasContributed',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'round', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'currentRecipient',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },

  // ─── Write functions ───────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createCircle',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'contributionAmount', type: 'uint256' },
      { name: 'maxMembers', type: 'uint256' },
      { name: 'roundDuration', type: 'uint256' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'joinCircle',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'startCircle',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'contribute',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'distributeRound',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
  },
] as const

// Minimal ERC-20 ABI — only what the frontend needs (approve + allowance)
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
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
] as const

// Circle status enum — mirrors AjoCircle.sol
export const CircleStatus = {
  Open: 0,
  Active: 1,
  Completed: 2,
} as const

export type CircleStatusValue = (typeof CircleStatus)[keyof typeof CircleStatus]

export const STATUS_LABEL: Record<CircleStatusValue, string> = {
  [CircleStatus.Open]: 'Open',
  [CircleStatus.Active]: 'Active',
  [CircleStatus.Completed]: 'Completed',
}
