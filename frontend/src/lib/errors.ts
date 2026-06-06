/**
 * parseContractError
 * Converts raw wagmi/viem/contract errors into human-readable messages.
 * Handles: Solidity custom errors, revert strings, network errors, user rejections.
 */
export function parseContractError(err: unknown): string {
  if (!err) return 'An unknown error occurred.'
  const msg = (err as Error).message ?? String(err)

  // ── User rejected ─────────────────────────────────────────────────────────
  if (/user rejected|user denied|rejected the request/i.test(msg)) {
    return 'Transaction cancelled — you rejected the request in your wallet.'
  }

  // ── Network / RPC ─────────────────────────────────────────────────────────
  if (/network|fetch|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(msg)) {
    return 'Network error — check your connection and try again.'
  }

  // ── AjoCircle custom errors ───────────────────────────────────────────────
  if (/AlreadyMember/i.test(msg))
    return 'You are already a member of this circle.'
  if (/CircleFull/i.test(msg))
    return 'This circle is full — no seats remaining.'
  if (/IdentityNotVerified/i.test(msg))
    return 'You must be GoodDollar verified to join this circle.'
  if (/NotMember/i.test(msg))
    return 'You are not a member of this circle.'
  if (/CircleNotStarted/i.test(msg))
    return 'The circle has not started yet — waiting for all members to join.'
  if (/AlreadyContributed/i.test(msg))
    return 'You have already contributed for this cycle.'
  if (/CycleNotEnded/i.test(msg))
    return 'The cycle has not ended yet — payout cannot be triggered early.'
  if (/NoPayoutsRemaining/i.test(msg))
    return 'All payouts have been distributed — circle is complete.'
  if (/NoEligibleRecipient/i.test(msg))
    return 'No eligible recipient found for this cycle.'
  if (/EmptyPot/i.test(msg))
    return 'The pot is empty — nothing to pay out.'
  if (/CircleNotComplete/i.test(msg))
    return 'The circle is not complete yet — collateral cannot be reclaimed.'

  // ── ERC-20 / token errors ─────────────────────────────────────────────────
  if (/insufficient allowance|ERC20: transfer amount exceeds allowance/i.test(msg))
    return 'Insufficient G$ allowance — please approve first.'
  if (/insufficient balance|ERC20: transfer amount exceeds balance/i.test(msg))
    return 'Insufficient G$ balance for this action.'

  // ── Generic revert ────────────────────────────────────────────────────────
  if (/execution reverted/i.test(msg)) {
    // Try to extract revert reason
    const match = msg.match(/reason: (.+?)(?:\n|$)/i)
    if (match) return `Transaction failed: ${match[1]}`
    return 'Transaction reverted — check your inputs and try again.'
  }

  // ── Gas estimation failures ───────────────────────────────────────────────
  if (/cannot estimate gas|gas required exceeds/i.test(msg))
    return 'Cannot estimate gas — the transaction would likely fail.'

  // ── Fallback: truncate raw message ────────────────────────────────────────
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg
}

/** Format a tx hash into a short display string */
export function shortHash(hash: string): string {
  if (!hash || hash.length < 10) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}
