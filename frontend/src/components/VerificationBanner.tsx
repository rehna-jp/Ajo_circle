'use client'

import { GOODDOLLAR_IDENTITY_URL } from '@/lib/gooddollar'

interface VerificationBannerProps {
  /** When true, show a subtle skeleton instead of the full banner. */
  isLoading?: boolean
}

/**
 * Shown inside the CircleCard when a connected wallet is not yet verified
 * on GoodDollar. Explains the requirement and links to the verification flow.
 */
export function VerificationBanner({ isLoading = false }: VerificationBannerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2.5">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gdollar" />
        <span className="text-xs text-gray-500">Checking GoodDollar identity…</span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3"
    >
      <div className="flex items-start gap-2">
        {/* Warning icon */}
        <span className="mt-px shrink-0 text-amber-500" aria-hidden>
          ⚠
        </span>
        <div>
          <p className="text-xs font-semibold text-amber-800">
            GoodDollar identity required
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            You must be verified as a real human via GoodDollar before you can
            join a savings circle. Verification is free and takes ~2 minutes.
          </p>
        </div>
      </div>

      <a
        href={GOODDOLLAR_IDENTITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-600"
      >
        Verify with GoodDollar
        {/* External-link indicator */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
      </a>
    </div>
  )
}
